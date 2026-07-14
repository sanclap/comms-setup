import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendWhatsAppBatch } from "@/lib/whatsapp";
import { renderTemplate } from "@/lib/email";
import type { SendResult } from "@/lib/types";

// NexG's multi-send endpoint accepts many recipients per call, but keep
// each call to a sane batch size rather than firing hundreds at once.
const BATCH_SIZE = 100;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event_id, template_id, registrant_ids }: {
      event_id: string;
      template_id: string;
      registrant_ids?: string[];
    } = body;

    if (!event_id || !template_id) {
      return NextResponse.json({ error: "event_id and template_id are required" }, { status: 400 });
    }

    const { data: template } = await supabaseAdmin.from("templates").select("*").eq("id", template_id).single();
    if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    const { data: event } = await supabaseAdmin.from("events").select("*").eq("id", event_id).single();
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    let query = supabaseAdmin.from("registrants").select("*").eq("event_id", event_id);
    if (registrant_ids?.length) query = query.in("id", registrant_ids);

    const { data: registrants } = await query;
    if (!registrants?.length) return NextResponse.json({ total: 0, sent: 0, failed: 0, errors: [] });

    const result: SendResult = { total: registrants.length, sent: 0, failed: 0, errors: [] };
    const logRows: object[] = [];

    // Registrants missing a phone number are skipped up front
    const sendable = registrants.filter((r) => {
      if (!r.phone) {
        result.failed++;
        result.errors.push({ email: r.email, reason: "No phone number" });
        logRows.push({
          registrant_id: r.id, event_id, channel: "whatsapp", status: "failed",
          template_name: template.name, failure_reason: "No phone number",
        });
        return false;
      }
      return true;
    });

    for (let i = 0; i < sendable.length; i += BATCH_SIZE) {
      const chunk = sendable.slice(i, i + BATCH_SIZE);

      const recipients = chunk.map((r) => ({
        phone: r.phone as string,
        message: renderTemplate(template.body, {
          full_name: r.full_name,
          joining_link: event.joining_link || "",
          event_name: event.name,
          event_date: event.event_date,
        }),
      }));

      const waResults = await sendWhatsAppBatch(recipients);

      chunk.forEach((r, idx) => {
        const waResult = waResults[idx];
        if (waResult.success) {
          result.sent++;
        } else {
          result.failed++;
          result.errors.push({ email: r.email, reason: waResult.error || "Unknown" });
        }

        logRows.push({
          registrant_id: r.id,
          event_id,
          channel: "whatsapp",
          // "submitted" not "sent" — this only confirms NexG's API accepted
          // the request, not that the message was actually delivered.
          status: waResult.success ? "submitted" : "failed",
          template_name: template.name,
          message_id: waResult.messageId || null,
          failure_reason: waResult.error || null,
          response: waResult.raw || null,
        });
      });

      await supabaseAdmin.from("message_logs").insert(logRows.splice(0));
      if (i + BATCH_SIZE < sendable.length) await new Promise((res) => setTimeout(res, 300));
    }

    if (logRows.length) await supabaseAdmin.from("message_logs").insert(logRows);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Send WhatsApp error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

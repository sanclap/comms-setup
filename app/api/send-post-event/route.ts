import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail, renderTemplate } from "@/lib/email";
import { generateCertificate } from "@/lib/certificate";
import type { SendResult } from "@/lib/types";

const CONCURRENCY = 3;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const event_id            = formData.get("event_id") as string;
    const template_id         = formData.get("template_id") as string;
    const registrant_ids_raw  = formData.get("registrant_ids") as string;
    const include_certificate = formData.get("include_certificate") === "true";
    const certificate_template = formData.get("certificate_template") as string || "teacher-student";
    const handout_file        = formData.get("handout") as File | null;

    if (!event_id || !template_id) {
      return NextResponse.json({ error: "event_id and template_id are required" }, { status: 400 });
    }

    const { data: template } = await supabaseAdmin.from("templates").select("*").eq("id", template_id).single();
    if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    const { data: event } = await supabaseAdmin.from("events").select("*").eq("id", event_id).single();
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const registrant_ids = registrant_ids_raw ? JSON.parse(registrant_ids_raw) : null;
    let query = supabaseAdmin.from("registrants").select("*").eq("event_id", event_id);
    if (registrant_ids?.length) query = query.in("id", registrant_ids);
    const { data: registrants } = await query;
    if (!registrants?.length) return NextResponse.json({ total: 0, sent: 0, failed: 0, errors: [] });

    let handoutBase64: string | null = null;
    let handoutName = "session-handout.pdf";
    if (handout_file) {
      const bytes = await handout_file.arrayBuffer();
      handoutBase64 = Buffer.from(bytes).toString("base64");
      handoutName = handout_file.name;
    }

    const result: SendResult = { total: registrants.length, sent: 0, failed: 0, errors: [] };
    const logRows: object[] = [];

    for (let i = 0; i < registrants.length; i += CONCURRENCY) {
      const chunk = registrants.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map(async (r) => {
        const htmlBody = renderTemplate(template.body, {
          full_name: r.full_name,
          joining_link: event.joining_link || "",
          event_name: event.name,
          event_date: event.event_date_label || event.event_date,
          event_time: event.event_time || "",
          event_end_time: event.event_end_time || "",
        });

        const attachments = [];

        if (include_certificate) {
          try {
            const school = r.tags?.[0] || r.school || "";
            const certBytes = await generateCertificate(certificate_template, {
              full_name: r.full_name,
              school,
              event_date: event.event_date,
              event_date_label: event.event_date_label,
            });
            attachments.push({
              name: `Certificate_${r.full_name.replace(/\s+/g, "_")}.pdf`,
              content: Buffer.from(certBytes).toString("base64"),
              mime_type: "application/pdf",
            });
          } catch (certErr) {
            console.error("Certificate failed for", r.full_name, certErr);
          }
        }

        if (handoutBase64) {
          attachments.push({ name: handoutName, content: handoutBase64, mime_type: "application/pdf" });
        }

        const emailResult = await sendEmail({
          to: { email: r.email, name: r.full_name },
          subject: template.subject || "Thank You | EDXSO",
          htmlBody, attachments,
        });

        if (emailResult.success) result.sent++;
        else { result.failed++; result.errors.push({ email: r.email, reason: emailResult.error || "Unknown" }); }

        logRows.push({
          registrant_id: r.id, event_id, channel: "email",
          status: emailResult.success ? "sent" : "failed",
          template_name: template.name,
          message_id: emailResult.messageId || null,
          failure_reason: emailResult.error || null,
        });
      }));

      await supabaseAdmin.from("message_logs").insert(logRows.splice(0));
      if (i + CONCURRENCY < registrants.length) await new Promise((r) => setTimeout(r, 200));
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Post-event send error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
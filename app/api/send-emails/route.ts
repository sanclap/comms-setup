import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail, renderTemplate, type Attachment } from "@/lib/email";
import type { SendResult, CsvRow } from "@/lib/types";

const CONCURRENCY = 5;

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// GET /api/send-emails -> list past Quick Blast uploads (metadata only — tracked
// independently of any event, so past blasts can be reviewed even though they
// were never tied to a registrant list).
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("blast_uploads")
    .select("id, filename, template_name, row_count, sent_count, failed_count, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event_id, template_id, registrant_ids, rows, attachment, filename }: {
      event_id?: string;
      template_id: string;
      registrant_ids?: string[];
      rows?: CsvRow[];
      attachment?: Attachment;
      filename?: string;
    } = body;

    if (!template_id) {
      return NextResponse.json({ error: "template_id is required" }, { status: 400 });
    }

    const { data: template } = await supabaseAdmin.from("templates").select("*").eq("id", template_id).single();
    if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    // No event_id + rows present -> "Quick Blast" mode: ad-hoc CSV recipients, no event.
    if (!event_id) {
      if (!rows || rows.length === 0) {
        return NextResponse.json({ error: "event_id or rows is required" }, { status: 400 });
      }
      return runBlast(template, rows, attachment, filename);
    }

    // Otherwise -> normal event-campaign mode.
    const { data: event } = await supabaseAdmin.from("events").select("*").eq("id", event_id).single();
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    let query = supabaseAdmin.from("registrants").select("*").eq("event_id", event_id);
    if (registrant_ids?.length) query = query.in("id", registrant_ids);
    const { data: registrants } = await query;
    if (!registrants?.length) return NextResponse.json({ total: 0, sent: 0, failed: 0, errors: [] });

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

        const emailResult = await sendEmail({
          to: { email: r.email, name: r.full_name },
          subject: template.subject || "Message from EDXSO",
          htmlBody,
        });

        if (emailResult.success) { result.sent++; }
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
      if (i + CONCURRENCY < registrants.length) await new Promise((r) => setTimeout(r, 150));
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Send email error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function runBlast(
  template: { name: string; subject: string | null; body: string },
  rows: CsvRow[],
  attachment?: Attachment,
  filename?: string
) {
  const validRows: CsvRow[] = [];
  const result: SendResult = { total: rows.length, sent: 0, failed: 0, errors: [] };

  for (const row of rows) {
    if (!row.full_name?.trim() || !row.email?.trim() || !validateEmail(row.email.trim())) {
      result.failed++;
      result.errors.push({ email: row.email || "(missing)", reason: "Missing/invalid name or email" });
      continue;
    }
    validRows.push({ ...row, full_name: row.full_name.trim(), email: row.email.trim().toLowerCase() });
  }

  const attachments: Attachment[] | undefined = attachment ? [attachment] : undefined;
  const logRows: object[] = [];

  for (let i = 0; i < validRows.length; i += CONCURRENCY) {
    const chunk = validRows.slice(i, i + CONCURRENCY);

    await Promise.all(chunk.map(async (r) => {
      const htmlBody = renderTemplate(template.body, { full_name: r.full_name });

      const emailResult = await sendEmail({
        to: { email: r.email, name: r.full_name },
        subject: template.subject || "Message from EDXSO",
        htmlBody,
        attachments,
      });

      if (emailResult.success) { result.sent++; }
      else { result.failed++; result.errors.push({ email: r.email, reason: emailResult.error || "Unknown" }); }

      logRows.push({
        registrant_id: null,
        event_id: null,
        channel: "email",
        status: emailResult.success ? "sent" : "failed",
        template_name: template.name,
        message_id: emailResult.messageId || null,
        failure_reason: emailResult.error || null,
        response: { blast: true, to_email: r.email, to_name: r.full_name },
      });
    }));

    await supabaseAdmin.from("message_logs").insert(logRows.splice(0));
    if (i + CONCURRENCY < validRows.length) await new Promise((res) => setTimeout(res, 150));
  }

  // Track this blast as its own record, independent of any event — keeps a
  // reusable history of who was uploaded and how the send went, even though
  // Quick Blast never creates registrants.
  const { error: trackError } = await supabaseAdmin.from("blast_uploads").insert({
    filename: filename || null,
    template_name: template.name,
    row_count: rows.length,
    sent_count: result.sent,
    failed_count: result.failed,
    data: validRows,
  });
  if (trackError) console.error("Failed to record blast history:", trackError.message);

  return NextResponse.json(result);
}
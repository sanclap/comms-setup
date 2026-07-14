import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail, renderTemplate } from "@/lib/email";

// GET /api/drips?event_id=xxx        -> list campaigns for an event
// GET /api/drips?action=run&secret=xxx[&force=true]  -> cron runner (used by vercel.json + manual trigger)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  if (searchParams.get("action") === "run") {
    const authHeader = req.headers.get("authorization");
    const secret = searchParams.get("secret");
    const isAuthorized =
      authHeader === `Bearer ${process.env.CRON_SECRET}` || secret === process.env.CRON_SECRET;
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const force = searchParams.get("force") === "true"; // bypass time check for testing
    return runDrips(force);
  }

  const event_id = searchParams.get("event_id");
  let query = supabaseAdmin
    .from("drip_campaigns")
    .select("*, templates(id, name)")
    .order("days_offset");

  if (event_id) query = query.eq("event_id", event_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/drips  { event_id, name, ... }   -> create campaign (default)
// POST /api/drips  { action: "run" }         -> cron runner, auth via Authorization header (Vercel Cron POST style)
export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.action === "run") {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return runDrips(false);
  }

  const { event_id, name, email_template_id, days_offset, send_hour, send_minute } = body;

  if (!event_id || !name || !email_template_id) {
    return NextResponse.json({ error: "event_id, name and email_template_id are required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("drip_campaigns")
    .insert({ event_id, name, email_template_id, days_offset, send_hour, send_minute })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("drip_campaigns")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabaseAdmin.from("drip_campaigns").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

async function runDrips(force = false) {
  // Current time in IST
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  const currentHour = istNow.getUTCHours();

  const todayIST = new Date(istNow);
  todayIST.setUTCHours(0, 0, 0, 0);

  // Fetch all active drip campaigns
  const { data: drips, error: dripsError } = await supabaseAdmin
    .from("drip_campaigns")
    .select(`
      *,
      events!inner(id, name, event_date, joining_link, status),
      templates(id, name, subject, body)
    `)
    .eq("is_active", true)
    .eq("events.status", "active");

  if (dripsError) {
    return NextResponse.json({ error: dripsError.message }, { status: 500 });
  }

  if (!drips?.length) {
    return NextResponse.json({
      message: "No active drips found",
      processed: 0,
      debug: { istTime: istNow.toISOString(), hour: currentHour }
    });
  }

  const results = [];
  const skipped = [];

  for (const drip of drips) {
    const event = drip.events as {
      id: string; name: string; event_date: string; joining_link: string;
    };
    const template = drip.templates as {
      subject: string; body: string;
    } | null;

    if (!template) {
      skipped.push({ drip: drip.name, reason: "No template assigned" });
      continue;
    }

    // Calculate the target send date for this drip
    const eventDateIST = new Date(new Date(event.event_date).getTime() + istOffset);
    const targetDate = new Date(eventDateIST);
    targetDate.setUTCDate(targetDate.getUTCDate() + drip.days_offset);
    targetDate.setUTCHours(0, 0, 0, 0);

    const isToday = targetDate.getTime() === todayIST.getTime();
    const isRightHour = currentHour === drip.send_hour;

    if (!force && (!isToday || !isRightHour)) {
      skipped.push({
        drip: drip.name,
        reason: `Not scheduled for now`,
        targetDate: targetDate.toISOString().split("T")[0],
        targetHour: drip.send_hour,
        currentDate: todayIST.toISOString().split("T")[0],
        currentHour,
      });
      continue;
    }

    // Get registrants not yet sent this drip
    const { data: alreadySent } = await supabaseAdmin
      .from("drip_logs")
      .select("registrant_id")
      .eq("drip_id", drip.id)
      .eq("status", "sent");

    const sentIds = new Set((alreadySent || []).map((l: { registrant_id: string }) => l.registrant_id));

    const { data: registrants } = await supabaseAdmin
      .from("registrants")
      .select("id, full_name, email")
      .eq("event_id", event.id);

    const pending = (registrants || []).filter((r: { id: string }) => !sentIds.has(r.id));

    if (!pending.length) {
      skipped.push({ drip: drip.name, reason: "All registrants already received this drip" });
      continue;
    }

    let sent = 0, failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < pending.length; i += 5) {
      const chunk = pending.slice(i, i + 5);

      await Promise.all(chunk.map(async (r: { id: string; full_name: string; email: string }) => {
        const htmlBody = renderTemplate(template.body, {
          full_name: r.full_name,
          joining_link: event.joining_link || "",
          event_name: event.name,
          event_date: event.event_date,
        });

        const result = await sendEmail({
          to: { email: r.email, name: r.full_name },
          subject: template.subject || `${drip.name} | EDXSO`,
          htmlBody,
        });

        const status = result.success ? "sent" : "failed";
        result.success ? sent++ : failed++;
        if (!result.success) errors.push(`${r.email}: ${result.error}`);

        // Upsert to drip_logs — unique(drip_id, registrant_id) prevents duplicates
        await supabaseAdmin.from("drip_logs").upsert({
          drip_id: drip.id,
          registrant_id: r.id,
          event_id: event.id,
          status,
        }, { onConflict: "drip_id,registrant_id", ignoreDuplicates: true });

        // Also log to message_logs for visibility in dashboard
        await supabaseAdmin.from("message_logs").insert({
          registrant_id: r.id,
          event_id: event.id,
          channel: "email",
          status,
          template_name: `${drip.name} (Auto)`,
          message_id: result.messageId || null,
          failure_reason: result.error || null,
        });
      }));

      await new Promise((r) => setTimeout(r, 150));
    }

    results.push({ drip: drip.name, event: event.name, sent, failed, errors });
  }

  return NextResponse.json({
    processed: results.length,
    results,
    skipped,
    debug: {
      istTime: istNow.toISOString(),
      currentHour,
      todayIST: todayIST.toISOString().split("T")[0],
      force,
    }
  });
}

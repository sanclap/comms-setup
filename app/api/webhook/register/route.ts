import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail, renderTemplate } from "@/lib/email";
import { sendWhatsApp } from "@/lib/whatsapp";

// Protect with a webhook secret so only your website can call this
function verifySecret(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  const querySecret = new URL(req.url).searchParams.get("secret");
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return true; // if no secret set, allow all (dev mode)
  return authHeader === `Bearer ${secret}` || querySecret === secret;
}

export async function POST(req: NextRequest) {
  if (!verifySecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    const {
      event_id,
      full_name,
      email,
      phone,
      school,
      city,
      country,
      designation,
      classes_taught,
    }: {
      event_id: string;
      full_name: string;
      email: string;
      phone?: string;
      school?: string;
      city?: string;
      country?: string;
      designation?: string;
      classes_taught?: string[];
    } = body;

    // Validate required fields
    if (!event_id) return NextResponse.json({ error: "event_id is required" }, { status: 400 });
    if (!full_name) return NextResponse.json({ error: "full_name is required" }, { status: 400 });
    if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

    // Validate event exists and is active
    const { data: event } = await supabaseAdmin
      .from("events")
      .select("*")
      .eq("id", event_id)
      .eq("status", "active")
      .single();

    if (!event) {
      return NextResponse.json({ error: "Event not found or not active" }, { status: 404 });
    }

    // Upsert registrant (handles re-registration gracefully)
    const { data: registrant, error: regError } = await supabaseAdmin
      .from("registrants")
      .upsert(
        {
          event_id,
          full_name: full_name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone?.trim() || null,
          school: school?.trim() || null,
          city: city?.trim() || null,
          country: country?.trim() || null,
          designation: designation?.trim() || null,
          classes_taught: classes_taught || null,
          tags: school?.trim() ? [school.trim()] : null,
          confirmation_sent: false,
        },
        { onConflict: "event_id,email" }
      )
      .select()
      .single();

    if (regError || !registrant) {
      console.error("Registration error:", regError);
      return NextResponse.json({ error: "Failed to save registrant" }, { status: 500 });
    }

    const templateVars = {
      full_name: registrant.full_name,
      joining_link: event.joining_link || "",
      event_name: event.name,
      event_date: event.event_date_label || event.event_date,
      event_time: event.event_time || "",
      event_end_time: event.event_end_time || "",
    };

    // Fetch confirmation templates
    const { data: emailTemplate } = await supabaseAdmin
      .from("templates")
      .select("*")
      .eq("type", "email")
      .ilike("name", "Registration Confirmation%")
      .single();

    const { data: waTemplate } = await supabaseAdmin
      .from("templates")
      .select("*")
      .eq("type", "whatsapp")
      .ilike("name", "Registration Confirmation%")
      .single();

    let emailSent = false;
    let whatsappSent = false;
    const errors: string[] = [];

    // Send email confirmation
    if (emailTemplate) {
      const htmlBody = renderTemplate(emailTemplate.body, templateVars);
      const emailResult = await sendEmail({
        to: { email: registrant.email, name: registrant.full_name },
        subject: renderTemplate(emailTemplate.subject || "Registration Confirmed | EDXSO", templateVars),
        htmlBody,
      });
      emailSent = emailResult.success;
      if (!emailResult.success) errors.push(`Email: ${emailResult.error}`);

      await supabaseAdmin.from("message_logs").insert({
        registrant_id: registrant.id,
        event_id,
        channel: "email",
        status: emailResult.success ? "sent" : "failed",
        template_name: emailTemplate.name,
        message_id: emailResult.messageId || null,
        failure_reason: emailResult.error || null,
      });
    }

    // Send WhatsApp confirmation
    if (waTemplate && registrant.phone) {
      const message = renderTemplate(waTemplate.body, templateVars);
      const waResult = await sendWhatsApp(registrant.phone, message);
      whatsappSent = waResult.success;
      if (!waResult.success) errors.push(`WhatsApp: ${waResult.error}`);

      await supabaseAdmin.from("message_logs").insert({
        registrant_id: registrant.id,
        event_id,
        channel: "whatsapp",
        status: waResult.success ? "sent" : "failed",
        template_name: waTemplate.name,
        message_id: waResult.messageId || null,
        failure_reason: waResult.error || null,
      });
    }

    // Mark confirmation sent
    if (emailSent || whatsappSent) {
      await supabaseAdmin
        .from("registrants")
        .update({ confirmation_sent: true })
        .eq("id", registrant.id);
    }

    return NextResponse.json({
      success: true,
      registrant_id: registrant.id,
      email_sent: emailSent,
      whatsapp_sent: whatsappSent,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET — health check so your website can verify the endpoint is live
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "EDXSO Registration Webhook",
    version: "1.0",
  });
}
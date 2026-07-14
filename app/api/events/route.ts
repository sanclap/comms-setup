import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("events")
    .select("*, registrants(count)")
    .order("event_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, event_date, event_date_label, event_time, event_end_time, joining_link, description, status } = body;

  if (!name || !event_date) {
    return NextResponse.json({ error: "name and event_date are required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("events")
    .insert({ name, event_date, event_date_label, event_time, event_end_time, joining_link, description, status: status || "active" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  // Only allow known, editable columns through — ignores anything unexpected in the body
  const allowed = ["name", "event_date", "event_date_label", "event_time", "event_end_time", "joining_link", "description", "status"];
  const patch: Record<string, unknown> = {};
  for (const key of allowed) if (key in updates) patch[key] = updates[key];

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("events")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

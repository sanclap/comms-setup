import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/events/[id]/bible          -> list saved bible datasets for this event (metadata only)
// GET /api/events/[id]/bible?type=xxx -> full saved data for one type (attendance/feedback/chat)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id: event_id } = params;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  let query = supabaseAdmin.from("event_bible").select("*").eq("event_id", event_id);
  if (type) query = query.eq("type", type);

  const { data, error } = await (type ? query.single() : query);
  if (error) {
    // No rows found for a single() lookup isn't a real error — just means nothing saved yet
    if (error.code === "PGRST116") return NextResponse.json(null);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (type) return NextResponse.json(data);

  // List mode — strip the heavy `data` payload, just return metadata
  const list = Array.isArray(data)
    ? data.map(({ id, event_id, type, filename, row_count, uploaded_at }) => ({ id, event_id, type, filename, row_count, uploaded_at }))
    : data;
  return NextResponse.json(list);
}

// POST /api/events/[id]/bible  { type, filename, data }
// Saves (or replaces) the parsed dataset for this event + type.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id: event_id } = params;
  const body = await req.json();
  const { type, filename, data } = body as { type: string; filename?: string; data: unknown[] };

  if (!type || !["attendance", "feedback", "chat"].includes(type)) {
    return NextResponse.json({ error: "type must be attendance, feedback, or chat" }, { status: 400 });
  }
  if (!Array.isArray(data)) {
    return NextResponse.json({ error: "data must be an array" }, { status: 400 });
  }

  const { data: saved, error } = await supabaseAdmin
    .from("event_bible")
    .upsert(
      { event_id, type, filename: filename || null, row_count: data.length, data, uploaded_at: new Date().toISOString() },
      { onConflict: "event_id,type" }
    )
    .select("id, event_id, type, filename, row_count, uploaded_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(saved);
}

// DELETE /api/events/[id]/bible?type=xxx
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { id: event_id } = params;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  if (!type) return NextResponse.json({ error: "type is required" }, { status: 400 });

  const { error } = await supabaseAdmin.from("event_bible").delete().eq("event_id", event_id).eq("type", type);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

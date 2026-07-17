import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET — fetch previously saved attendance data for an event
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const event_id = searchParams.get("event_id");
  if (!event_id) return NextResponse.json({ error: "event_id required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("attendance_records")
    .select("*")
    .eq("event_id", event_id)
    .order("full_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// POST — save/update attendance records for an event
// Uses upsert on (event_id, full_name) — re-uploading updates existing rows
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event_id, records }: {
      event_id: string;
      records: Array<{
        full_name: string;
        email?: string;
        duration_seconds: number;
        camera_on: boolean;
        feedback_filled: boolean;
        raw_data?: Record<string, unknown>;
      }>;
    } = body;

    if (!event_id) return NextResponse.json({ error: "event_id required" }, { status: 400 });
    if (!records?.length) return NextResponse.json({ error: "records required" }, { status: 400 });

    const rows = records.map((r) => ({
      event_id,
      full_name: r.full_name,
      email: r.email || null,
      duration_seconds: r.duration_seconds,
      camera_on: r.camera_on,
      feedback_filled: r.feedback_filled,
      raw_data: r.raw_data || null,
    }));

    // Upsert in batches of 500 to stay safe on payload size
    let saved = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      const { error } = await supabaseAdmin
        .from("attendance_records")
        .upsert(batch, { onConflict: "event_id,full_name" });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      saved += batch.length;
    }

    return NextResponse.json({ success: true, saved });
  } catch (err) {
    console.error("Attendance save error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
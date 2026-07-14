import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const event_id = searchParams.get("event_id");
  const limit = parseInt(searchParams.get("limit") || "100");

  let query = supabaseAdmin
    .from("message_logs")
    .select("*, registrants(full_name, email)")
    .order("sent_at", { ascending: false })
    .limit(limit);

  if (event_id) {
    query = query.eq("event_id", event_id);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

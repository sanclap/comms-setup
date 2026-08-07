import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const PAGE_SIZE = 1000; // Supabase/PostgREST default max rows per request

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const allRegistrants = [];
    let from = 0;

    // Loop until we've fetched every row — a single query caps at 1000 rows
    while (true) {
      const { data, error } = await supabaseAdmin
        .from("registrants")
        .select("*")
        .eq("event_id", params.id)
        .order("created_at", { ascending: true }) // newest uploads still included, consistent order
        .range(from, from + PAGE_SIZE - 1);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data || data.length === 0) break;

      allRegistrants.push(...data);
      if (data.length < PAGE_SIZE) break; // last page reached

      from += PAGE_SIZE;
    }

    return NextResponse.json(allRegistrants);
  } catch (err) {
    console.error("Fetch registrants error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
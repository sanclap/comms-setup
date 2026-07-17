import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { CsvRow, UploadResult } from "@/lib/types";

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rows, event_id }: {
      rows: (CsvRow & { school?: string; school_name?: string; "school name"?: string })[];
      event_id: string;
    } = body;

    if (!event_id) return NextResponse.json({ error: "event_id is required" }, { status: 400 });
    if (!rows || rows.length === 0) return NextResponse.json({ error: "No rows provided" }, { status: 400 });

    const result: UploadResult = { imported: 0, skipped: 0, errors: [] };

    // Process in batches to avoid overwhelming a single request, and so
    // one bad row doesn't block the rest of a large upload
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      if (!row.full_name?.trim()) {
        result.errors.push({ row: i + 2, reason: "Missing full_name", data: row });
        result.skipped++;
        continue;
      }

      if (!row.email?.trim() || !validateEmail(row.email.trim())) {
        result.errors.push({ row: i + 2, reason: "Invalid email", data: row });
        result.skipped++;
        continue;
      }

      const school =
        row.school?.trim() ||
        row.school_name?.trim() ||
        row["school name"]?.trim() ||
        "";

      const tags = school ? [school] : null;

      // Upsert — new email = new row, existing email = updated in place
      // ignoreDuplicates: false ensures re-uploads UPDATE existing rows rather than silently skipping
      const { error } = await supabaseAdmin
        .from("registrants")
        .upsert(
          {
            event_id,
            full_name: row.full_name.trim(),
            email: row.email.trim().toLowerCase(),
            phone: row.phone?.trim() || null,
            school: school || null,
            tags,
          },
          { onConflict: "event_id,email", ignoreDuplicates: false }
        );

      if (error) {
        result.errors.push({ row: i + 2, reason: error.message, data: row });
        result.skipped++;
      } else {
        result.imported++;
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
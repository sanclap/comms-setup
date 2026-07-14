import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { RawCsvRow, ColumnTarget, UploadResult } from "@/lib/types";

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rows, event_id, mapping }: {
      rows: RawCsvRow[];
      event_id: string;
      mapping: { header: string; target: ColumnTarget }[];
    } = body;

    if (!event_id) return NextResponse.json({ error: "event_id is required" }, { status: 400 });
    if (!rows || rows.length === 0) return NextResponse.json({ error: "No rows provided" }, { status: 400 });
    if (!mapping || mapping.length === 0) return NextResponse.json({ error: "Column mapping is required" }, { status: 400 });

    const fullNameCol = mapping.find((m) => m.target === "full_name")?.header;
    const emailCol = mapping.find((m) => m.target === "email")?.header;
    const phoneCol = mapping.find((m) => m.target === "phone")?.header;
    const tagCols = mapping.filter((m) => m.target === "tag").map((m) => m.header);

    if (!fullNameCol || !emailCol) {
      return NextResponse.json(
        { error: "Map at least one column to Full Name and one to Email" },
        { status: 400 }
      );
    }

    // Fetch emails already registered for this event so we can tell new
    // registrants apart from ones an updated CSV is just refreshing.
    const { data: existingRows } = await supabaseAdmin
      .from("registrants")
      .select("email")
      .eq("event_id", event_id);
    const existingEmails = new Set((existingRows || []).map((r) => r.email));

    const result: UploadResult = { imported: 0, new_count: 0, updated_count: 0, skipped: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const fullName = row[fullNameCol]?.trim();
      const email = row[emailCol]?.trim();

      if (!fullName) {
        result.errors.push({ row: i + 2, reason: "Missing full name" });
        result.skipped++;
        continue;
      }

      if (!email || !validateEmail(email)) {
        result.errors.push({ row: i + 2, reason: "Invalid email", email });
        result.skipped++;
        continue;
      }

      const normalizedEmail = email.toLowerCase();
      const isUpdate = existingEmails.has(normalizedEmail);
      const tags = tagCols.map((c) => row[c]?.trim()).filter(Boolean);

      const { error } = await supabaseAdmin
        .from("registrants")
        .upsert(
          {
            event_id,
            full_name: fullName,
            email: normalizedEmail,
            phone: phoneCol ? row[phoneCol]?.trim() || null : null,
            tags: tags.length ? tags : null,
          },
          { onConflict: "event_id,email", ignoreDuplicates: false }
        );

      if (error) {
        result.errors.push({ row: i + 2, reason: error.message, email });
        result.skipped++;
      } else {
        result.imported++;
        if (isUpdate) result.updated_count++;
        else result.new_count++;
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

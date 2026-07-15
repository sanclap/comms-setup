import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// ONE-TIME FIX: Visit /api/fix-cert-coords?secret=YOUR_CRON_SECRET once, then delete this file.

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = [];

  // FIX 1: Mastery cert — add underline under name
  const { error: masteryError } = await supabaseAdmin
    .from("certificate_templates")
    .update({
      fields: {
        name: {
          cover: { x: 296, y: 595.5 - 290, width: 250, height: 40 },
          textY: 595.5 - 282, centerX: 421,
          fontSize: 20, bold: true,
          underline: { x1: 300, x2: 542 },
        },
        date_range: {
          cover: { x: 374, y: 595.5 - 417, width: 276, height: 22 },
          textY: 595.5 - 409, centerX: 512,
          fontSize: 11, bold: true,
        },
      },
    })
    .eq("id", "mastery");
  results.push({ id: "mastery", success: !masteryError, error: masteryError?.message });

  // FIX 2: Teacher-Student-v2 — widen school cover box to fully erase old text
  const { error: v2Error } = await supabaseAdmin
    .from("certificate_templates")
    .update({
      fields: {
        name: {
          cover: { x: 262, y: 595.5 - 289, width: 330, height: 40 },
          textY: 595.5 - 283, centerX: 427,
          fontSize: 20, bold: true,
        },
        school: {
          cover: { x: 260, y: 595.5 - 326, width: 240, height: 26 },
          textY: 595.5 - 318, centerX: 378,
          fontSize: 13, bold: false,
        },
        date: {
          cover: { x: 463, y: 595.5 - 415, width: 153, height: 22 },
          textY: 595.5 - 409, leftX: 467,
          fontSize: 11, bold: false,
        },
      },
    })
    .eq("id", "teacher-student-v2");
  results.push({ id: "teacher-student-v2", success: !v2Error, error: v2Error?.message });

  return NextResponse.json({ results });
}
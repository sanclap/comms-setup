import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// ONE-TIME FIX v2: Visit /api/fix-cert-coords-v2?secret=YOUR_CRON_SECRET once, then delete.

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Teacher-Student-v2: the sentence reads "of [SCHOOL] has actively participated..."
  // "of" is static text at x0=248.3-264.1 — must NOT be covered
  // "has" starts at x0=491.8 — must NOT be covered
  // School name replacement zone: x=266 to x=489 (between "of" and "has")
  // This is a NARROW gap — long school names will overflow unless font shrinks aggressively
  // and text is vertically centered exactly on the same baseline as "of"/"has" (top=307.6, bottom=323.9)

  const { error } = await supabaseAdmin
    .from("certificate_templates")
    .update({
      fields: {
        name: {
          cover: { x: 262, y: 595.5 - 289, width: 330, height: 40 },
          textY: 595.5 - 283, centerX: 427,
          fontSize: 20, bold: true,
        },
        school: {
  cover: { x: 271, y: 595.5 - 324.5, width: 214, height: 18 },
  textY: 595.5 - 323.9 + 3,
  centerX: 378,
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

  return NextResponse.json({ success: !error, error: error?.message });
}
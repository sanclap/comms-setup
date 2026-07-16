import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import fs from "fs";
import path from "path";

// Visit /api/migrate-certs?secret=YOUR_CRON_SECRET to (re)seed built-in certificates.
// Safe to re-run anytime — uses upsert, so re-running just updates coordinates.

const BUILTIN_DEFS = [
  // File: certificate-template.pdf — original underline-style Teacher-Student cert
  {
    id: "teacher-student",
    label: "Teacher–Student Workshop (Underline Style)",
    file: "certificate-template.pdf",
    page_width: 720, page_height: 405,
    fields: {
      name: {
        cover: { x: 250, y: 405 - 178 + 0.5, width: 334, height: 20 },
        textY: 405 - 178 + 5, centerX: 416.5,
        fontSize: 12, bold: true,
      },
      school: {
        cover: { x: 83, y: 405 - 205.3 + 0.5, width: 336, height: 22 },
        textY: 405 - 205.3 + 5, centerX: 250.4,
        fontSize: 13, bold: true,
        underline: { x1: 83.8, x2: 417.0 },
      },
      date: {
        cover: { x: 536, y: 405 - 237, width: 110, height: 17 },
        textY: 405 - 235 + 2, leftX: 539,
        fontSize: 11, bold: true,
      },
    },
  },

  // File: certificate-template-cba.pdf — "Certificate of Mastery" design
  {
    id: "mastery",
    label: "Certificate of Mastery (Competency-Based MCQ Designer)",
    file: "certificate-template-cba.pdf",
    page_width: 842.2, page_height: 595.5,
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
  },

  // File: certificate-template-mastery.pdf — Gold Ribbon Teacher-Student design
  // Sentence: "of [SCHOOL] has actively participated..."
  // "of" x0=248.3-264.1 · "has" x0=491.8-521.8 (both regular, non-bold, ~fontSize 13)
  // Erase the ENTIRE zone from before "of" to after "has", then redraw all 3 pieces:
  //   "of" (static, left) → school name (dynamic, centered) → "has" (static, right)
  {
    id: "teacher-student-v2",
    label: "Teacher–Student Relationship (Gold Ribbon Style)",
    file: "certificate-template-mastery.pdf",
    page_width: 842.2, page_height: 595.5,
    fields: {
      name: {
        cover: { x: 262, y: 595.5 - 289, width: 330, height: 40 },
        textY: 595.5 - 283, centerX: 427,
        fontSize: 20, bold: true,
      },
      school: {
        // Full erase zone: from just before "of" (246) to just after "has" (525)
        cover: { x: 246, y: 595.5 - 325, width: 279, height: 20 },
        textY: 595.5 - 323.9 + 3,
        centerX: 378,          // midpoint between "of" end (264.1) and "has" start (491.8)
        fontSize: 12, bold: false,
        fontFamily: "poppins", // matches the PDF's actual body font
        prefixText: "of", prefixX: 248.3,
        suffixText: "has", suffixX: 491.8,
        staticFontSize: 12,
      },
      date: {
        cover: { x: 463, y: 595.5 - 415, width: 153, height: 22 },
        textY: 595.5 - 409, leftX: 467,
        fontSize: 11, bold: false,
        fontFamily: "poppins",
      },
    },
  },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = [];

  for (const def of BUILTIN_DEFS) {
    try {
      const filePath = path.join(process.cwd(), "public", def.file);

      const { data: existingFile } = await supabaseAdmin.storage
        .from("certificates")
        .list("", { search: `${def.id}.pdf` });

      if (!existingFile || existingFile.length === 0) {
        if (!fs.existsSync(filePath)) {
          results.push({ id: def.id, success: false, error: `File not found: ${def.file}` });
          continue;
        }
        const bytes = fs.readFileSync(filePath);
        const { error: uploadError } = await supabaseAdmin.storage
          .from("certificates")
          .upload(`${def.id}.pdf`, bytes, { contentType: "application/pdf", upsert: true });

        if (uploadError) {
          results.push({ id: def.id, success: false, error: `Upload failed: ${uploadError.message}` });
          continue;
        }
      }

      const { error: dbError } = await supabaseAdmin.from("certificate_templates").upsert({
        id: def.id,
        label: def.label,
        storage_path: `${def.id}.pdf`,
        page_width: def.page_width,
        page_height: def.page_height,
        fields: def.fields,
        is_builtin: true,
      });

      if (dbError) {
        results.push({ id: def.id, success: false, error: `DB save failed: ${dbError.message}` });
        continue;
      }

      results.push({ id: def.id, success: true, label: def.label });
    } catch (err) {
      results.push({ id: def.id, success: false, error: String(err) });
    }
  }

  return NextResponse.json({ results });
}
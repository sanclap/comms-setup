import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import fs from "fs";
import path from "path";

// ONE-TIME MIGRATION: Run this once to move built-in certs from /public into Supabase
// Visit: /api/migrate-certs?secret=YOUR_CRON_SECRET
// Delete this file after running successfully.

const BUILTIN_DEFS = [
  {
    id: "teacher-student",
    label: "Teacher-Student Session",
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
  {
    id: "cba",
    label: "CBA Session (Free)",
    file: "certificate-template-cba.pdf",
    page_width: 842.2, page_height: 595.5,
    fields: {
      name: {
        cover: { x: 270, y: 595.5 - 284, width: 305, height: 38 },
        textY: 595.5 - 276, centerX: 421,
        fontSize: 18, bold: true,
      },
      school: {
        cover: { x: 308, y: 595.5 - 326, width: 140, height: 22 },
        textY: 595.5 - 320, centerX: 378,
        fontSize: 11, bold: false,
      },
      date: {
        cover: { x: 466, y: 595.5 - 417, width: 126, height: 24 },
        textY: 595.5 - 409, leftX: 473,
        fontSize: 11, bold: true,
      },
    },
  },
  {
    id: "mastery",
    label: "Mastery Certificate (Paid)",
    file: "certificate-template-mastery.pdf",
    page_width: 842.2, page_height: 595.5,
    fields: {
      name: {
        cover: { x: 296, y: 595.5 - 290, width: 250, height: 40 },
        textY: 595.5 - 282, centerX: 421,
        fontSize: 20, bold: true,
      },
      date_range: {
        cover: { x: 374, y: 595.5 - 416, width: 276, height: 22 },
        textY: 595.5 - 409, centerX: 512,
        fontSize: 11, bold: true,
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

      if (!fs.existsSync(filePath)) {
        results.push({ id: def.id, success: false, error: `File not found: ${def.file}. Make sure it's in /public and deployed.` });
        continue;
      }

      const bytes = fs.readFileSync(filePath);

      // Upload to storage
      const { error: uploadError } = await supabaseAdmin.storage
        .from("certificates")
        .upload(`${def.id}.pdf`, bytes, { contentType: "application/pdf", upsert: true });

      if (uploadError) {
        results.push({ id: def.id, success: false, error: `Upload failed: ${uploadError.message}` });
        continue;
      }

      // Save definition
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

      results.push({ id: def.id, success: true });
    } catch (err) {
      results.push({ id: def.id, success: false, error: String(err) });
    }
  }

  return NextResponse.json({ results });
}
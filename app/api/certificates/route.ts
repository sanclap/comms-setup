import { NextRequest, NextResponse } from "next/server";
import { getAllCertDefs, saveCertDef, deleteCertDef } from "@/lib/certificate";

export async function GET() {
  const defs = await getAllCertDefs();
  return NextResponse.json(defs);
}

export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData();
    const id    = fd.get("id") as string;
    const label = fd.get("label") as string;
    const file  = fd.get("file") as File | null;
    const defJson = fd.get("definition") as string;

    if (!id || !label || !defJson) {
      return NextResponse.json({ error: "id, label and definition are required" }, { status: 400 });
    }
    if (!/^[a-z0-9-]+$/.test(id)) {
      return NextResponse.json({ error: "id must be lowercase letters, numbers and hyphens only" }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: "PDF file is required" }, { status: 400 });
    }

    const def = JSON.parse(defJson);
    const bytes = Buffer.from(await file.arrayBuffer());

    const result = await saveCertDef(id, label, bytes, def.pageWidth, def.pageHeight, def.fields);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error("Certificate save error:", err);
    return NextResponse.json({ error: "Failed to save certificate" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const result = await deleteCertDef(id);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
}
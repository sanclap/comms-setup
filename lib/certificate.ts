import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { supabaseAdmin } from "./supabase";

const WHITE = rgb(1, 1, 1);
const BLACK = rgb(0, 0, 0);
const GREY  = rgb(0.35, 0.35, 0.35);

export interface CertificateField {
  cover: { x: number; y: number; width: number; height: number };
  textY: number;
  centerX?: number;
  leftX?: number;
  fontSize: number;
  bold: boolean;
  underline?: { x1: number; x2: number };
  // Static text drawn alongside the dynamic value (e.g. "of" before school, "has" after)
  // Needed when the cover box erases surrounding static words that must be redrawn.
  prefixText?: string;
  prefixX?: number;
  suffixText?: string;
  suffixX?: number;
  staticFontSize?: number; // font size for prefix/suffix (defaults to fontSize)
}

export interface CertificateDefinition {
  id: string;
  label: string;
  storage_path: string;
  page_width: number;
  page_height: number;
  fields: {
    name?: CertificateField;
    school?: CertificateField;
    date?: CertificateField;
    date_range?: CertificateField;
  };
  is_builtin?: boolean;
}

export async function getAllCertDefs(): Promise<CertificateDefinition[]> {
  const { data, error } = await supabaseAdmin
    .from("certificate_templates").select("*").order("created_at");
  if (error) { console.error("Failed to load certificate templates:", error); return []; }
  return data || [];
}

export async function getCertDef(id: string): Promise<CertificateDefinition | null> {
  const { data, error } = await supabaseAdmin
    .from("certificate_templates").select("*").eq("id", id).single();
  if (error || !data) return null;
  return data;
}

export async function saveCertDef(
  id: string, label: string, pdfBytes: Buffer,
  pageWidth: number, pageHeight: number,
  fields: CertificateDefinition["fields"]
): Promise<{ success: boolean; error?: string }> {
  const storagePath = `${id}.pdf`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from("certificates")
    .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: true });
  if (uploadError) return { success: false, error: `Storage upload failed: ${uploadError.message}` };

  const { error: dbError } = await supabaseAdmin
    .from("certificate_templates")
    .upsert({ id, label, storage_path: storagePath, page_width: pageWidth, page_height: pageHeight, fields, is_builtin: false });
  if (dbError) return { success: false, error: `Database save failed: ${dbError.message}` };
  return { success: true };
}

export async function deleteCertDef(id: string): Promise<{ success: boolean; error?: string }> {
  const def = await getCertDef(id);
  if (def?.is_builtin) return { success: false, error: "Cannot delete built-in templates" };
  if (def) await supabaseAdmin.storage.from("certificates").remove([def.storage_path]);
  const { error } = await supabaseAdmin.from("certificate_templates").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export function formatEventDate(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDate();
  const suffix = day === 1 ? "st" : day === 2 ? "nd" : day === 3 ? "rd" : "th";
  const month = date.toLocaleString("en-US", { month: "long" });
  const year = date.getFullYear();
  return `${day}${suffix} ${month} ${year}`;
}

export async function generateCertificate(
  certId: string,
  vars: { full_name: string; school?: string; event_date?: string; event_date_label?: string; date_range?: string; }
): Promise<Uint8Array> {
  const def = await getCertDef(certId);
  if (!def) throw new Error(`Certificate template not found: ${certId}`);

  const { data: fileData, error: downloadError } = await supabaseAdmin.storage
    .from("certificates").download(def.storage_path);
  if (downloadError || !fileData) throw new Error(`Failed to download certificate template: ${downloadError?.message}`);

  const templateBytes = Buffer.from(await fileData.arrayBuffer());
  const pdfDoc = await PDFDocument.load(templateBytes);
  const page = pdfDoc.getPages()[0];
  const boldFont    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const drawField = (field: CertificateField, text: string) => {
    if (!text?.trim()) return;
    const font = field.bold ? boldFont : regularFont;

    // Erase the entire zone — including any static words that will be redrawn below
    page.drawRectangle({ ...field.cover, color: WHITE, borderWidth: 0, opacity: 1 });

    // Redraw static prefix text (e.g. "of") if this field has one
    if (field.prefixText && field.prefixX !== undefined) {
      page.drawText(field.prefixText, {
        x: field.prefixX, y: field.textY,
        size: field.staticFontSize || field.fontSize,
        font: regularFont, color: BLACK,
      });
    }

    // Auto-shrink dynamic text to fit its slot
    let fontSize = field.fontSize;
    const maxWidth = field.cover.width - 4;
    while (font.widthOfTextAtSize(text, fontSize) > maxWidth && fontSize > 7) fontSize -= 0.5;

    const x = field.centerX !== undefined
      ? field.centerX - font.widthOfTextAtSize(text, fontSize) / 2
      : field.leftX!;

    page.drawText(text, { x, y: field.textY, size: fontSize, font, color: BLACK });

    // Redraw static suffix text (e.g. "has actively") if this field has one
    if (field.suffixText && field.suffixX !== undefined) {
      page.drawText(field.suffixText, {
        x: field.suffixX, y: field.textY,
        size: field.staticFontSize || field.fontSize,
        font: regularFont, color: BLACK,
      });
    }

    if (field.underline) {
      page.drawLine({
        start: { x: field.underline.x1, y: field.textY - 4 },
        end:   { x: field.underline.x2, y: field.textY - 4 },
        thickness: 0.75, color: GREY,
      });
    }
  };

  const dateStr = vars.event_date_label || (vars.event_date ? formatEventDate(vars.event_date) : "");
  const { fields } = def;

  if (fields.name)       drawField(fields.name, vars.full_name);
  if (fields.school)     drawField(fields.school, vars.school || "");
  if (fields.date)       drawField(fields.date, dateStr ? `${dateStr}.` : "");
  if (fields.date_range) drawField(fields.date_range, vars.date_range || "");

  return pdfDoc.save();
}
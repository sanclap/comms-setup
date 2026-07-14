"use client";
import { useState, useEffect } from "react";

interface CertDef {
  id: string;
  label: string;
  file: string;
  pageWidth: number;
  pageHeight: number;
  fields: {
    name?: FieldDef;
    school?: FieldDef;
    date?: FieldDef;
    date_range?: FieldDef;
  };
}

interface FieldDef {
  cover: { x: number; y: number; width: number; height: number };
  textY: number;
  centerX?: number;
  leftX?: number;
  fontSize: number;
  bold: boolean;
}

const BUILTIN_IDS = ["teacher-student", "cba", "mastery"];

const EMPTY_FIELD: FieldDef = {
  cover: { x: 0, y: 0, width: 200, height: 30 },
  textY: 0, centerX: 0, fontSize: 14, bold: true,
};

export default function CertificatesPage() {
  const [certs, setCerts] = useState<CertDef[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Form state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    id: "",
    label: "",
    pageWidth: 842,
    pageHeight: 596,
    hasName: true,
    hasSchool: false,
    hasDate: true,
    hasDateRange: false,
  });
  const [fields, setFields] = useState<{
    name: FieldDef; school: FieldDef; date: FieldDef; date_range: FieldDef;
  }>({
    name:       { ...EMPTY_FIELD, fontSize: 18, bold: true },
    school:     { ...EMPTY_FIELD, fontSize: 12, bold: false },
    date:       { ...EMPTY_FIELD, fontSize: 11, bold: true },
    date_range: { ...EMPTY_FIELD, fontSize: 11, bold: true },
  });

  const load = () =>
    fetch("/api/certificates").then((r) => r.json()).then((d) => Array.isArray(d) && setCerts(d));

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.id || !form.label || !pdfFile) {
      setError("ID, label and PDF file are required.");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(form.id)) {
      setError("ID must be lowercase letters, numbers and hyphens only.");
      return;
    }

    setSaving(true); setError("");
    const definition = {
      pageWidth: form.pageWidth,
      pageHeight: form.pageHeight,
      fields: {
        ...(form.hasName && { name: fields.name }),
        ...(form.hasSchool && { school: fields.school }),
        ...(form.hasDate && { date: fields.date }),
        ...(form.hasDateRange && { date_range: fields.date_range }),
      },
    };

    const fd = new FormData();
    fd.append("id", form.id);
    fd.append("label", form.label);
    fd.append("file", pdfFile);
    fd.append("filename", `certificate-${form.id}.pdf`);
    fd.append("definition", JSON.stringify(definition));

    const res = await fetch("/api/certificates", { method: "POST", body: fd });
    const data = await res.json();
    if (data.error) { setError(data.error); }
    else { setShowForm(false); load(); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this certificate template?")) return;
    setDeleting(id);
    await fetch(`/api/certificates?id=${id}`, { method: "DELETE" });
    setDeleting(null);
    load();
  };

  const updateField = (key: keyof typeof fields, updates: Partial<FieldDef>) => {
    setFields((prev) => ({ ...prev, [key]: { ...prev[key], ...updates } }));
  };

  const updateCover = (key: keyof typeof fields, updates: Partial<FieldDef["cover"]>) => {
    setFields((prev) => ({
      ...prev,
      [key]: { ...prev[key], cover: { ...prev[key].cover, ...updates } },
    }));
  };

  const inputCls = "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500";
  const numCls   = "bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500 w-20";

  return (
    <div className="max-w-4xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Certificate Manager</h1>
          <p className="text-slate-400 text-sm mt-1">Manage certificate templates for post-event sending</p>
        </div>
        <button onClick={() => { setShowForm((x) => !x); setError(""); }}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 rounded-lg text-white text-sm font-semibold">
          + Add Template
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 mb-6">
          <h2 className="text-sm font-semibold text-white mb-5">New Certificate Template</h2>
          <div className="space-y-5">

            {/* Basic info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Template ID * <span className="text-slate-600">(e.g. spark-session)</span></label>
                <input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
                  placeholder="my-cert" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Display Name *</label>
                <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="SPARK Session Certificate" className={inputCls} />
              </div>
            </div>

            {/* PDF upload */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Certificate PDF Template *</label>
              <label className={`block border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                pdfFile ? "border-brand-500/50 bg-brand-500/5" : "border-slate-700 hover:border-slate-600"
              }`}>
                {pdfFile ? (
                  <p className="text-sm text-green-400">✓ {pdfFile.name}</p>
                ) : (
                  <p className="text-sm text-slate-500">Click to upload PDF template</p>
                )}
                <input type="file" accept=".pdf" className="hidden"
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)} />
              </label>
            </div>

            {/* Page size */}
            <div>
              <label className="block text-xs text-slate-400 mb-2">Page Size (from PDF properties)</label>
              <div className="flex gap-3 items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Width:</span>
                  <input type="number" value={form.pageWidth}
                    onChange={(e) => setForm({ ...form, pageWidth: parseFloat(e.target.value) })}
                    className={numCls} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Height:</span>
                  <input type="number" value={form.pageHeight}
                    onChange={(e) => setForm({ ...form, pageHeight: parseFloat(e.target.value) })}
                    className={numCls} />
                </div>
                <p className="text-xs text-slate-500">A4 landscape = 842 × 596</p>
              </div>
            </div>

            {/* Fields to replace */}
            <div>
              <label className="block text-xs text-slate-400 mb-3 uppercase tracking-wide">Fields to Replace</label>
              <div className="space-y-4">

                {/* NAME */}
                <FieldConfig
                  label="👤 Name"
                  enabled={form.hasName}
                  onToggle={(v) => setForm({ ...form, hasName: v })}
                  field={fields.name}
                  onUpdate={(u) => updateField("name", u)}
                  onCoverUpdate={(u) => updateCover("name", u)}
                  numCls={numCls}
                />

                {/* SCHOOL */}
                <FieldConfig
                  label="🏫 School / Institution"
                  enabled={form.hasSchool}
                  onToggle={(v) => setForm({ ...form, hasSchool: v })}
                  field={fields.school}
                  onUpdate={(u) => updateField("school", u)}
                  onCoverUpdate={(u) => updateCover("school", u)}
                  numCls={numCls}
                />

                {/* DATE */}
                <FieldConfig
                  label="📅 Event Date"
                  enabled={form.hasDate}
                  onToggle={(v) => setForm({ ...form, hasDate: v, hasDateRange: v ? false : form.hasDateRange })}
                  field={fields.date}
                  onUpdate={(u) => updateField("date", u)}
                  onCoverUpdate={(u) => updateCover("date", u)}
                  numCls={numCls}
                />

                {/* DATE RANGE */}
                <FieldConfig
                  label="📅 Date Range (e.g. 1st June to 3rd June 2026)"
                  enabled={form.hasDateRange}
                  onToggle={(v) => setForm({ ...form, hasDateRange: v, hasDate: v ? false : form.hasDate })}
                  field={fields.date_range}
                  onUpdate={(u) => updateField("date_range", u)}
                  onCoverUpdate={(u) => updateCover("date_range", u)}
                  numCls={numCls}
                />
              </div>
            </div>

            <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg px-4 py-3 text-xs text-slate-400">
              💡 <strong className="text-white">How to find coordinates:</strong> Open your PDF in Adobe Acrobat or{" "}
              <a href="https://pdfplumber.readthedocs.io" target="_blank" rel="noopener noreferrer" className="text-brand-400 underline">pdfplumber</a>.
              The <strong className="text-white">Cover box</strong> should fully cover the placeholder text in the PDF.
              The <strong className="text-white">Text Y</strong> is where the new text baseline sits (inside the cover box).
              <strong className="text-white"> Center X</strong> = midpoint of the text area for centering.
            </div>

            {error && <p className="text-sm text-red-400">⚠️ {error}</p>}

            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 rounded-lg text-white text-sm font-semibold">
                {saving ? "Saving…" : "Save Template"}
              </button>
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Certificate list */}
      <div className="space-y-3">
        {certs.map((cert) => (
          <div key={cert.id} className="bg-slate-900 rounded-xl border border-slate-800 p-5 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-white">{cert.label}</span>
                {BUILTIN_IDS.includes(cert.id) && (
                  <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-500 rounded">Built-in</span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-mono">id: {cert.id} · file: {cert.file}</p>
              <div className="flex gap-3 mt-2 text-xs text-slate-500">
                {cert.fields.name && <span className="text-green-400">✓ Name</span>}
                {cert.fields.school && <span className="text-green-400">✓ School</span>}
                {cert.fields.date && <span className="text-green-400">✓ Date</span>}
                {cert.fields.date_range && <span className="text-green-400">✓ Date Range</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`/api/certificates?preview=${cert.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg"
              >
                Preview
              </a>
              {!BUILTIN_IDS.includes(cert.id) && (
                <button onClick={() => handleDelete(cert.id)} disabled={deleting === cert.id}
                  className="text-xs px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg disabled:opacity-40">
                  {deleting === cert.id ? "…" : "Delete"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FieldConfig({ label, enabled, onToggle, field, onUpdate, onCoverUpdate, numCls }: {
  label: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  field: FieldDef;
  onUpdate: (u: Partial<FieldDef>) => void;
  onCoverUpdate: (u: Partial<FieldDef["cover"]>) => void;
  numCls: string;
}) {
  return (
    <div className={`rounded-lg border p-4 transition-colors ${enabled ? "border-brand-500/30 bg-brand-500/5" : "border-slate-800"}`}>
      <label className="flex items-center gap-2 cursor-pointer mb-3">
        <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)}
          className="rounded border-slate-600" />
        <span className="text-sm font-medium text-white">{label}</span>
      </label>

      {enabled && (
        <div className="space-y-3">
          <div>
            <p className="text-xs text-slate-500 mb-2">Cover Box (erase old text)</p>
            <div className="flex flex-wrap gap-3">
              {(["x", "y", "width", "height"] as const).map((k) => (
                <div key={k} className="flex items-center gap-1">
                  <span className="text-xs text-slate-500">{k}:</span>
                  <input type="number" value={field.cover[k]}
                    onChange={(e) => onCoverUpdate({ [k]: parseFloat(e.target.value) })}
                    className={numCls} />
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">Text Y:</span>
              <input type="number" value={field.textY}
                onChange={(e) => onUpdate({ textY: parseFloat(e.target.value) })}
                className={numCls} />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">Center X:</span>
              <input type="number" value={field.centerX || 0}
                onChange={(e) => onUpdate({ centerX: parseFloat(e.target.value) })}
                className={numCls} />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">Font Size:</span>
              <input type="number" value={field.fontSize}
                onChange={(e) => onUpdate({ fontSize: parseFloat(e.target.value) })}
                className={numCls} />
            </div>
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={field.bold}
                onChange={(e) => onUpdate({ bold: e.target.checked })}
                className="rounded border-slate-600" />
              <span className="text-xs text-slate-400">Bold</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
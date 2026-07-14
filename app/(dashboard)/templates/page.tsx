"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { Template } from "@/lib/types";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), { ssr: false });

const EMPTY_FORM = { type: "email" as "email" | "whatsapp", name: "", subject: "", body: "" };

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Template | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [editorMode, setEditorMode] = useState<"rich" | "html">("rich");

  const load = () =>
    fetch("/api/templates").then((r) => r.json()).then((d) => Array.isArray(d) && setTemplates(d));

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.name || !form.body) { setError("Name and body are required."); return; }
    if (form.type === "email" && !form.subject) { setError("Subject is required for email templates."); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: form.type, name: form.name, subject: form.subject, body: form.body }),
    });
    const data = await res.json();
    if (data.error) { setError(data.error); } else { setShowForm(false); setForm(EMPTY_FORM); load(); }
    setSaving(false);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this template?")) return;
    setDeleting(id);
    await fetch(`/api/templates?id=${id}`, { method: "DELETE" });
    setDeleting(null);
    if (selected?.id === id) setSelected(null);
    load();
  };

  const inputCls = "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500";
  const emailTpls = templates.filter((t) => t.type === "email");
  const waTpls = templates.filter((t) => t.type === "whatsapp");

  return (
    <div className="max-w-5xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Templates</h1>
          <p className="text-slate-400 text-sm mt-1">Manage reusable message templates</p>
        </div>
        <button onClick={() => { setForm(EMPTY_FORM); setError(""); setEditorMode("rich"); setShowForm(true); }}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 rounded-lg text-white text-sm font-semibold">
          + New Template
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 mb-6">
          <h2 className="text-sm font-semibold text-white mb-4">New Template</h2>
          <div className="space-y-4">
            {/* Type */}
            <div>
              <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">Type</label>
              <div className="flex gap-2">
                {(["email", "whatsapp"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setForm({ ...form, type: t })}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border ${
                      form.type === t ? "bg-brand-600 border-brand-500 text-white" : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                    }`}>
                    {t === "email" ? "✉️ Email" : "💬 WhatsApp"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Template Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. DRIP 1 - First Reminder" className={inputCls} />
            </div>

            {form.type === "email" && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">Subject *</label>
                <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="e.g. Reminder | {{event_name}}" className={inputCls} />
              </div>
            )}

            {/* Body */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-slate-400">
                  {form.type === "email" ? "Email Body *" : "Message Body *"}
                </label>
                {form.type === "email" && (
                  <div className="flex gap-1 bg-slate-800 rounded-lg p-0.5">
                    <button type="button" onClick={() => setEditorMode("rich")}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                        editorMode === "rich" ? "bg-brand-600 text-white" : "text-slate-400 hover:text-white"
                      }`}>
                      ✏️ Rich Text
                    </button>
                    <button type="button" onClick={() => setEditorMode("html")}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                        editorMode === "html" ? "bg-brand-600 text-white" : "text-slate-400 hover:text-white"
                      }`}>
                      {"</>"} HTML
                    </button>
                  </div>
                )}
              </div>

              {form.type === "email" && editorMode === "rich" ? (
                <RichTextEditor
                  value={form.body}
                  onChange={(html) => setForm({ ...form, body: html })}
                  placeholder="Start writing your email..."
                />
              ) : (
                <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
                  rows={12}
                  placeholder={form.type === "email"
                    ? "<p>Dear {{full_name}},</p>\n<p>...</p>"
                    : "Dear {{full_name}},\n\nYour message here...\n\n🔗 *Joining Link:* {{joining_link}}"}
                  className={`${inputCls} font-mono resize-y`} />
              )}

              {form.type === "whatsapp" && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-xs text-slate-500 self-center">Insert:</span>
                  {["{{full_name}}", "{{event_name}}", "{{event_date}}", "{{event_time}}", "{{event_end_time}}", "{{joining_link}}"].map((ph) => (
                    <button key={ph} type="button"
                      onClick={() => setForm({ ...form, body: form.body + ph })}
                      className="text-xs px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 font-mono">
                      {ph}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Preview */}
            {form.type === "email" && form.body && (
              <div>
                <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wide">Preview</label>
                <iframe
                  srcDoc={`<html><body style="font-family:Arial,sans-serif;padding:16px;color:#111;line-height:1.6">${form.body}</body></html>`}
                  className="w-full h-64 bg-white rounded-lg border border-slate-700"
                  sandbox="allow-same-origin" />
              </div>
            )}

            {error && <p className="text-sm text-red-400">⚠️ {error}</p>}

            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 rounded-lg text-white text-sm font-semibold">
                {saving ? "Saving…" : "Save Template"}
              </button>
              <button onClick={() => { setShowForm(false); setError(""); }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {emailTpls.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">✉️ Email Templates ({emailTpls.length})</h2>
          <div className="space-y-3">
            {emailTpls.map((tpl) => (
              <TemplateCard key={tpl.id} tpl={tpl} selected={selected} onSelect={setSelected}
                onDelete={handleDelete} deleting={deleting} />
            ))}
          </div>
        </div>
      )}

      {waTpls.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">💬 WhatsApp Templates ({waTpls.length})</h2>
          <div className="space-y-3">
            {waTpls.map((tpl) => (
              <TemplateCard key={tpl.id} tpl={tpl} selected={selected} onSelect={setSelected}
                onDelete={handleDelete} deleting={deleting} />
            ))}
          </div>
        </div>
      )}

      {templates.length === 0 && !showForm && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 px-5 py-10 text-center text-slate-500 text-sm">
          No templates yet. Click <strong className="text-white">+ New Template</strong> to create one.
        </div>
      )}
    </div>
  );
}

function TemplateCard({ tpl, selected, onSelect, onDelete, deleting }: {
  tpl: Template; selected: Template | null;
  onSelect: (t: Template | null) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  deleting: string | null;
}) {
  const isOpen = selected?.id === tpl.id;
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      <div onClick={() => onSelect(isOpen ? null : tpl)}
        className="px-5 py-4 flex items-start justify-between cursor-pointer hover:bg-slate-800/30">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
              tpl.type === "email" ? "bg-blue-500/10 text-blue-400" : "bg-green-500/10 text-green-400"
            }`}>{tpl.type.toUpperCase()}</span>
            <span className="font-medium text-white text-sm">{tpl.name}</span>
          </div>
          {tpl.subject && <p className="text-xs text-slate-500 truncate">Subject: {tpl.subject}</p>}
        </div>
        <div className="flex items-center gap-2 ml-4 shrink-0">
          <button onClick={(e) => { e.stopPropagation(); onSelect(isOpen ? null : tpl); }}
            className="text-xs px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 font-medium">
            {isOpen ? "Hide" : "View"}
          </button>
          <a href="/send" onClick={(e) => e.stopPropagation()}
            className="text-xs px-3 py-1 bg-brand-600 hover:bg-brand-500 rounded-lg text-white font-medium">
            Send →
          </a>
          <button onClick={(e) => onDelete(tpl.id, e)} disabled={deleting === tpl.id}
            className="text-xs px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg disabled:opacity-40">
            {deleting === tpl.id ? "…" : "Delete"}
          </button>
          <span className="text-slate-600 text-sm">{isOpen ? "▲" : "▼"}</span>
        </div>
      </div>
      {isOpen && (
        <div className="border-t border-slate-800 p-4">
          {tpl.type === "email" ? (
            <iframe
              srcDoc={`<html><body style="font-family:Arial,sans-serif;padding:16px;color:#111;line-height:1.6">${tpl.body}</body></html>`}
              className="w-full h-80 bg-white rounded border border-slate-700"
              sandbox="allow-same-origin" />
          ) : (
            <pre className="text-xs text-slate-300 bg-slate-800 rounded p-3 whitespace-pre-wrap max-h-64 overflow-y-auto">{tpl.body}</pre>
          )}
        </div>
      )}
    </div>
  );
}
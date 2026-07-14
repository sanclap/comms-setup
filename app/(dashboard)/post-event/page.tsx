"use client";
import { useState, useEffect } from "react";
import type { Event, Template } from "@/lib/types";

interface Registrant { id: string; full_name: string; email: string; phone?: string; tags?: string[]; }
interface CertDef { id: string; label: string; }

const BATCH_SIZE = 30;

export default function PostEventPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [registrants, setRegistrants] = useState<Registrant[]>([]);
  const [certDefs, setCertDefs] = useState<CertDef[]>([]);

  const [selectedEvent, setSelectedEvent] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [includeCertificate, setIncludeCertificate] = useState(true);
  const [certificateTemplate, setCertificateTemplate] = useState("teacher-student");
  const [handoutFile, setHandoutFile] = useState<File | null>(null);

  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, failed: 0, total: 0, current: 0 });
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
  const [sendError, setSendError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/events").then((r) => r.json()),
      fetch("/api/templates").then((r) => r.json()),
      fetch("/api/certificates").then((r) => r.json()),
    ]).then(([ev, tpl, certs]) => {
      if (Array.isArray(ev)) setEvents(ev);
      if (Array.isArray(tpl)) setTemplates(tpl.filter((t: Template) => t.type === "email"));
      if (Array.isArray(certs)) setCertDefs(certs.map((c: CertDef) => ({ id: c.id, label: c.label })));
    });
  }, []);

  useEffect(() => {
    if (!selectedEvent) { setRegistrants([]); setSelectedIds([]); return; }
    fetch(`/api/events/${selectedEvent}/registrants`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setRegistrants(data);
          setSelectedIds(data.map((r: Registrant) => r.id));
        }
      });
  }, [selectedEvent]);

  const toggleAll = (checked: boolean) => setSelectedIds(checked ? registrants.map((r) => r.id) : []);
  const toggleOne = (id: string) => setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleSend = async () => {
    if (!selectedEvent || !selectedTemplate || selectedIds.length === 0) return;
    setSending(true); setResult(null); setSendError("");

    const total = selectedIds.length;
    let sent = 0, failed = 0;
    setProgress({ sent: 0, failed: 0, total, current: 0 });

    for (let offset = 0; offset < total; offset += BATCH_SIZE) {
      const pageIds = selectedIds.slice(offset, offset + BATCH_SIZE);
      try {
        const fd = new FormData();
        fd.append("event_id", selectedEvent);
        fd.append("template_id", selectedTemplate);
        fd.append("registrant_ids", JSON.stringify(pageIds));
        fd.append("include_certificate", String(includeCertificate));
        fd.append("certificate_template", certificateTemplate);
        if (handoutFile) fd.append("handout", handoutFile);

        const res = await fetch("/api/send-post-event", { method: "POST", body: fd });
        const data = await res.json();
        sent += data.sent || 0;
        failed += data.failed || 0;
      } catch { failed += pageIds.length; }
      setProgress({ sent, failed, total, current: Math.min(offset + BATCH_SIZE, total) });
      await new Promise((r) => setTimeout(r, 150));
    }

    setResult({ sent, failed });
    setSending(false);
  };

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  const inputCls = "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500";

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Post-Event Mail</h1>
        <p className="text-slate-400 text-sm mt-1">Send thank you email with certificate + handout</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">Event *</label>
          <select value={selectedEvent} onChange={(e) => setSelectedEvent(e.target.value)} className={inputCls}>
            <option value="">— Choose event —</option>
            {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          </select>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">Email Template *</label>
          <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)} className={inputCls}>
            <option value="">— Choose template —</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>

      {/* Attachments */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 mb-4">
        <h2 className="text-sm font-semibold text-white mb-4">Attachments</h2>

        {/* Certificate toggle */}
        <div className="flex items-start gap-3 mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
          <input type="checkbox" id="cert" checked={includeCertificate}
            onChange={(e) => setIncludeCertificate(e.target.checked)} className="mt-0.5 rounded border-slate-600" />
          <div className="flex-1">
            <label htmlFor="cert" className="text-sm font-medium text-white cursor-pointer">
              📜 Include Personalized Certificate
            </label>
            <p className="text-xs text-slate-500 mt-0.5">Generates a PDF certificate per registrant automatically.</p>

            {includeCertificate && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-slate-400">Certificate Design</p>
                <select value={certificateTemplate} onChange={(e) => setCertificateTemplate(e.target.value)}
                  className={inputCls}>
                  {certDefs.length === 0 && <option value="">Loading...</option>}
                  {certDefs.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <p className="text-xs text-slate-500">
                  Manage templates in{" "}
                  <a href="/certificates" className="text-brand-400 underline">Certificate Manager</a>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Handout */}
        <div>
          <p className="text-sm font-medium text-white mb-2">📄 Session Handout PDF <span className="text-slate-500 text-xs font-normal">(optional)</span></p>
          {handoutFile ? (
            <div className="flex items-center gap-3 bg-slate-800 rounded-lg px-4 py-3">
              <span className="text-sm text-white flex-1">{handoutFile.name}</span>
              <button onClick={() => setHandoutFile(null)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
            </div>
          ) : (
            <label className="block border-2 border-dashed border-slate-700 hover:border-slate-600 rounded-lg p-5 text-center cursor-pointer">
              <p className="text-slate-500 text-sm">Drop PDF here or click to browse</p>
              <input type="file" accept=".pdf" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setHandoutFile(f); }} />
            </label>
          )}
        </div>
      </div>

      {/* Registrants */}
      {registrants.length > 0 && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 mb-6 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center gap-3">
            <input type="checkbox" checked={selectedIds.length === registrants.length}
              onChange={(e) => toggleAll(e.target.checked)} className="rounded border-slate-600" />
            <span className="text-sm font-medium text-white">{selectedIds.length} / {registrants.length} selected</span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <tbody>
                {registrants.map((r) => (
                  <tr key={r.id} onClick={() => toggleOne(r.id)} className="border-t border-slate-800/50 cursor-pointer hover:bg-slate-800/30">
                    <td className="px-5 py-2.5 w-10">
                      <input type="checkbox" checked={selectedIds.includes(r.id)} onChange={() => toggleOne(r.id)} className="rounded border-slate-600" />
                    </td>
                    <td className="py-2.5 text-slate-300">{r.full_name}</td>
                    <td className="py-2.5 text-slate-500 text-xs font-mono">{r.email}</td>
                    <td className="py-2.5 pr-5 text-xs text-slate-500">{r.tags?.[0] || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Progress */}
      {sending && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 mb-4">
          <div className="flex justify-between text-xs text-slate-400 mb-2">
            <span>Sending… {progress.current} / {progress.total}</span>
            <span>{pct}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 mb-2">
            <div className="bg-brand-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex gap-4 text-xs">
            <span className="text-green-400">✓ {progress.sent} sent</span>
            {progress.failed > 0 && <span className="text-red-400">✗ {progress.failed} failed</span>}
          </div>
        </div>
      )}

      {sendError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400 mb-4">⚠️ {sendError}</div>
      )}

      <button onClick={handleSend}
        disabled={!selectedEvent || !selectedTemplate || selectedIds.length === 0 || sending}
        className="w-full py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white text-sm font-semibold">
        {sending ? `Sending ${progress.current} / ${progress.total} (${pct}%)…` : `Send to ${selectedIds.length} recipients`}
      </button>

      {result && !sending && (
        <div className="mt-4 bg-slate-900 rounded-xl border border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-white mb-3">✅ Send Complete</h3>
          <div className="flex gap-6">
            <div><p className="text-2xl font-bold text-green-400">{result.sent}</p><p className="text-xs text-slate-500">Sent</p></div>
            <div><p className="text-2xl font-bold text-red-400">{result.failed}</p><p className="text-xs text-slate-500">Failed</p></div>
          </div>
          <a href="/logs" className="text-xs text-brand-400 underline mt-2 block">View full logs →</a>
        </div>
      )}
    </div>
  );
}
"use client";
import { useState, useEffect } from "react";
import type { Event, Template, SendResult } from "@/lib/types";

interface Registrant {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
}

type Channel = "email" | "whatsapp" | "both";

export default function SendPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<Template[]>([]);
  const [waTemplates, setWaTemplates] = useState<Template[]>([]);
  const [registrants, setRegistrants] = useState<Registrant[]>([]);

  const [selectedEvent, setSelectedEvent] = useState("");
  const [channel, setChannel] = useState<Channel>("email");
  const [selectedEmailTemplate, setSelectedEmailTemplate] = useState("");
  const [selectedWaTemplate, setSelectedWaTemplate] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<(SendResult & { channel: string }) | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/events").then((r) => r.json()),
      fetch("/api/templates").then((r) => r.json()),
    ]).then(([ev, tpl]) => {
      if (Array.isArray(ev)) setEvents(ev);
      if (Array.isArray(tpl)) {
        setEmailTemplates(tpl.filter((t: Template) => t.type === "email"));
        setWaTemplates(tpl.filter((t: Template) => t.type === "whatsapp"));
      }
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

  const toggleAll = (checked: boolean) =>
    setSelectedIds(checked ? registrants.map((r) => r.id) : []);

  const toggleOne = (id: string) =>
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleSend = async () => {
    if (!selectedEvent || selectedIds.length === 0) return;
    if (channel !== "whatsapp" && !selectedEmailTemplate) return;
    if (channel !== "email" && !selectedWaTemplate) return;

    setSending(true);
    setResult(null);

    const payload = { event_id: selectedEvent, registrant_ids: selectedIds };

    if (channel === "both") {
      // Fire both in parallel
      const [emailRes, waRes] = await Promise.all([
        fetch("/api/send-emails", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, template_id: selectedEmailTemplate }),
        }).then((r) => r.json()),
        fetch("/api/send-whatsapp", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, template_id: selectedWaTemplate }),
        }).then((r) => r.json()),
      ]);

      setResult({
        channel: "both",
        total: emailRes.total,
        sent: emailRes.sent,
        failed: emailRes.failed,
        errors: [
          ...(emailRes.errors || []).map((e: { email: string; reason: string }) => ({ ...e, reason: `[Email] ${e.reason}` })),
          ...(waRes.errors || []).map((e: { email: string; reason: string }) => ({ ...e, reason: `[WA] ${e.reason}` })),
        ],
        waSent: waRes.sent,
        waFailed: waRes.failed,
      } as SendResult & { channel: string; waSent?: number; waFailed?: number });
    } else {
      const url = channel === "email" ? "/api/send-emails" : "/api/send-whatsapp";
      const templateId = channel === "email" ? selectedEmailTemplate : selectedWaTemplate;
      const data = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, template_id: templateId }),
      }).then((r) => r.json());
      setResult({ ...data, channel });
    }

    setSending(false);
  };

  const previewTemplate = channel !== "whatsapp"
    ? emailTemplates.find((t) => t.id === selectedEmailTemplate)
    : null;

  const noPhone = registrants.filter((r) => !r.phone).length;

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Send Campaign</h1>
        <p className="text-slate-400 text-sm mt-1">Send email and/or WhatsApp to registrants</p>
      </div>

      {/* Event + Channel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">Event *</label>
          <select value={selectedEvent} onChange={(e) => setSelectedEvent(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500">
            <option value="">— Choose event —</option>
            {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          </select>
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">Channel *</label>
          <div className="flex gap-2">
            {(["email", "whatsapp", "both"] as Channel[]).map((c) => (
              <button key={c} onClick={() => setChannel(c)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                  channel === c
                    ? "bg-brand-600 border-brand-500 text-white"
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                }`}>
                {c === "email" ? "✉️ Email" : c === "whatsapp" ? "💬 WhatsApp" : "⚡ Both"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Template selectors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {channel !== "whatsapp" && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
            <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">Email Template *</label>
            <select value={selectedEmailTemplate} onChange={(e) => setSelectedEmailTemplate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500">
              <option value="">— Choose template —</option>
              {emailTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {previewTemplate && (
              <button onClick={() => setShowPreview((x) => !x)}
                className="text-xs text-brand-400 mt-2 hover:text-brand-300">
                {showPreview ? "Hide" : "Show"} preview
              </button>
            )}
          </div>
        )}

        {channel !== "email" && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
            <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">WhatsApp Template *</label>
            <select value={selectedWaTemplate} onChange={(e) => setSelectedWaTemplate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500">
              <option value="">— Choose template —</option>
              {waTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {noPhone > 0 && selectedEvent && (
              <p className="text-xs text-yellow-400 mt-2">
                ⚠️ {noPhone} registrant{noPhone > 1 ? "s" : ""} missing phone — will be skipped
              </p>
            )}
          </div>
        )}
      </div>

      {/* Email preview */}
      {showPreview && previewTemplate && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 mb-4 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800">
            <span className="text-sm font-medium text-white">Email Preview</span>
          </div>
          <div className="p-4">
            <iframe srcDoc={previewTemplate.body}
              className="w-full h-96 bg-white rounded border border-slate-700"
              sandbox="allow-same-origin" />
          </div>
        </div>
      )}

      {/* Registrant list */}
      {registrants.length > 0 && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 mb-6 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center gap-3">
            <input type="checkbox" checked={selectedIds.length === registrants.length}
              onChange={(e) => toggleAll(e.target.checked)} className="rounded border-slate-600" />
            <span className="text-sm font-medium text-white">
              {selectedIds.length} / {registrants.length} selected
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <tbody>
                {registrants.map((r) => (
                  <tr key={r.id} onClick={() => toggleOne(r.id)}
                    className="border-t border-slate-800/50 cursor-pointer hover:bg-slate-800/30">
                    <td className="px-5 py-2.5 w-10">
                      <input type="checkbox" checked={selectedIds.includes(r.id)}
                        onChange={() => toggleOne(r.id)} className="rounded border-slate-600" />
                    </td>
                    <td className="py-2.5 text-slate-300">{r.full_name}</td>
                    <td className="py-2.5 text-slate-500 text-xs font-mono">{r.email}</td>
                    <td className="py-2.5 pr-5 text-xs">
                      {r.phone
                        ? <span className="text-green-400 font-mono">{r.phone}</span>
                        : <span className="text-slate-600">no phone</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {registrants.length === 0 && selectedEvent && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 px-5 py-8 text-center text-slate-500 text-sm mb-6">
          No registrants yet. <a href="/upload" className="text-brand-400 underline">Upload CSV</a>
        </div>
      )}

      {/* Send button */}
      <button onClick={handleSend}
        disabled={
          !selectedEvent || selectedIds.length === 0 || sending ||
          (channel !== "whatsapp" && !selectedEmailTemplate) ||
          (channel !== "email" && !selectedWaTemplate)
        }
        className="w-full py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white text-sm font-semibold">
        {sending
          ? `Sending to ${selectedIds.length} recipients…`
          : `Send ${channel === "both" ? "Email + WhatsApp" : channel === "email" ? "Email" : "WhatsApp"} to ${selectedIds.length} recipients`}
      </button>

      {/* Result */}
      {result && <ResultCard result={result} />}
    </div>
  );
}

function ResultCard({ result }: { result: SendResult & { channel: string; waSent?: number; waFailed?: number } }) {
  return (
    <div className="mt-4 bg-slate-900 rounded-xl border border-slate-800 p-5">
      <h3 className="text-sm font-semibold text-white mb-3">Send Complete</h3>
      <div className="flex gap-6 mb-3">
        {result.channel === "both" ? (
          <>
            <div>
              <p className="text-xs text-slate-500 mb-1">✉️ Email</p>
              <p className="text-xl font-bold text-green-400">{result.sent} sent</p>
              {result.failed > 0 && <p className="text-xs text-red-400">{result.failed} failed</p>}
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">💬 WhatsApp</p>
              <p className="text-xl font-bold text-green-400">{result.waSent} sent</p>
              {(result.waFailed ?? 0) > 0 && <p className="text-xs text-red-400">{result.waFailed} failed</p>}
            </div>
          </>
        ) : (
          <>
            <div><p className="text-2xl font-bold text-green-400">{result.sent}</p><p className="text-xs text-slate-500">Sent</p></div>
            <div><p className="text-2xl font-bold text-red-400">{result.failed}</p><p className="text-xs text-slate-500">Failed</p></div>
            <div><p className="text-2xl font-bold text-slate-400">{result.total}</p><p className="text-xs text-slate-500">Total</p></div>
          </>
        )}
      </div>
      {result.errors.length > 0 && (
        <details>
          <summary className="text-xs text-red-400 cursor-pointer">{result.errors.length} failure(s)</summary>
          <div className="mt-2 space-y-1">
            {result.errors.map((e, i) => (
              <div key={i} className="text-xs text-slate-400 font-mono">{e.email}: {e.reason}</div>
            ))}
          </div>
        </details>
      )}
      <a href="/logs" className="text-xs text-brand-400 underline mt-2 block">View full logs →</a>
    </div>
  );
}

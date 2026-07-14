"use client";
import { useState, useEffect } from "react";
import type { Event } from "@/lib/types";

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const EMPTY_FORM = {
    name: "",
    event_date: "",
    event_time: "",
    event_end_time: "",
    event_date_label: "",
    joining_link: "",
    description: "",
    status: "active",
  };
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = () =>
    fetch("/api/events").then((r) => r.json()).then((d) => Array.isArray(d) && setEvents(d));

  useEffect(() => { load(); }, []);

  // datetime-local inputs need "YYYY-MM-DDTHH:mm" — trim the seconds/timezone from the stored ISO string
  const toDatetimeLocal = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const startCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const startEdit = (ev: Event) => {
    setEditingId(ev.id);
    setForm({
      name: ev.name,
      event_date: toDatetimeLocal(ev.event_date),
      event_time: ev.event_time || "",
      event_end_time: ev.event_end_time || "",
      event_date_label: ev.event_date_label || "",
      joining_link: ev.joining_link || "",
      description: ev.description || "",
      status: ev.status,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSave = async () => {
    if (!form.name || !form.event_date) return;
    setSaving(true);
    if (editingId) {
      await fetch("/api/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, ...form }),
      });
    } else {
      await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    setSaving(false);
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    load();
  };

  const copyLink = (eventId: string) => {
    const url = `${window.location.origin}/register/${eventId}`;
    navigator.clipboard.writeText(url);
    setCopied(eventId);
    setTimeout(() => setCopied(null), 2000);
  };

  const inputCls = "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500";

  return (
    <div className="max-w-3xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Events</h1>
          <p className="text-slate-400 text-sm mt-1">Manage events and registration links</p>
        </div>
        <button onClick={() => (showForm ? setShowForm(false) : startCreate())}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 rounded-lg text-white text-sm font-semibold">
          + New Event
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 mb-6">
          <h2 className="text-sm font-semibold text-white mb-4">{editingId ? "Edit Event" : "Create Event"}</h2>
          <div className="space-y-3">

            <div>
              <label className="block text-xs text-slate-400 mb-1">Event Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Teacher-Student Relationship Session"
                className={inputCls} />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Event Date & Time *</label>
              <input type="datetime-local" value={form.event_date}
                onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                className={inputCls} />
            </div>

            {/* Human-readable date label for templates */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Date Label <span className="text-slate-600">(shown in emails — e.g. "Wednesday, 10th June 2026")</span>
              </label>
              <input value={form.event_date_label}
                onChange={(e) => setForm({ ...form, event_date_label: e.target.value })}
                placeholder="Wednesday, 10th June 2026"
                className={inputCls} />
            </div>

            {/* Start + End time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Start Time <span className="text-slate-600">(for emails)</span>
                </label>
                <input value={form.event_time}
                  onChange={(e) => setForm({ ...form, event_time: e.target.value })}
                  placeholder="5:00 PM"
                  className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  End Time <span className="text-slate-600">(for emails)</span>
                </label>
                <input value={form.event_end_time}
                  onChange={(e) => setForm({ ...form, event_end_time: e.target.value })}
                  placeholder="6:30 PM"
                  className={inputCls} />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Joining Link</label>
              <input value={form.joining_link} onChange={(e) => setForm({ ...form, joining_link: e.target.value })}
                placeholder="https://meetn.com/Event?ID=..."
                className={inputCls} />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2} className={`${inputCls} resize-none`} />
            </div>

            {editingId && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className={inputCls}>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            )}

            {/* Placeholder reference */}
            <div className="bg-slate-800/50 rounded-lg px-4 py-3 border border-slate-700">
              <p className="text-xs font-medium text-slate-400 mb-2">Available template placeholders</p>
              <div className="grid grid-cols-2 gap-1 text-xs font-mono">
                {[
                  ["{{full_name}}", "Registrant name"],
                  ["{{event_name}}", "Event name"],
                  ["{{event_date}}", "Date label"],
                  ["{{event_time}}", "Start time"],
                  ["{{event_end_time}}", "End time"],
                  ["{{joining_link}}", "Meeting link"],
                ].map(([ph, desc]) => (
                  <div key={ph} className="flex gap-2">
                    <span className="text-green-400">{ph}</span>
                    <span className="text-slate-600">→ {desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} disabled={!form.name || !form.event_date || saving}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 rounded-lg text-white text-sm font-semibold">
                {saving ? "Saving…" : editingId ? "Save Changes" : "Save Event"}
              </button>
              <button onClick={() => { setShowForm(false); setEditingId(null); }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {events.length === 0 && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 px-5 py-10 text-center text-slate-500 text-sm">
            No events yet.
          </div>
        )}
        {events.map((ev) => (
          <div key={ev.id} className="bg-slate-900 rounded-xl border border-slate-800 p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-medium text-white text-sm">{ev.name}</p>
                <p className="text-xs text-slate-500 mt-1">
                  📅 {(ev as {event_date_label?: string}).event_date_label || new Date(ev.event_date).toLocaleString("en-IN")}
                  {(ev as {event_time?: string}).event_time && ` · ${(ev as {event_time?: string}).event_time}`}
                  {(ev as {event_end_time?: string}).event_end_time && ` – ${(ev as {event_end_time?: string}).event_end_time}`}
                </p>
                {ev.joining_link && (
                  <a href={ev.joining_link} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-brand-400 mt-1 block truncate max-w-xs">
                    🔗 {ev.joining_link}
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded font-medium capitalize ${
                  ev.status === "active" ? "bg-green-500/10 text-green-400"
                  : ev.status === "draft" ? "bg-yellow-500/10 text-yellow-400"
                  : "bg-slate-800 text-slate-400"
                }`}>{ev.status}</span>
                <button onClick={() => startEdit(ev)}
                  className="text-xs px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium">
                  Edit
                </button>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-3">
              <p className="text-xs text-slate-500 mb-2">🔗 Registration Form Link</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-slate-800 px-3 py-2 rounded-lg text-slate-300 truncate">
                  {typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/register/{ev.id}
                </code>
                <button onClick={() => copyLink(ev.id)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    copied === ev.id ? "bg-green-500/20 text-green-400" : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                  }`}>
                  {copied === ev.id ? "✓ Copied!" : "Copy Link"}
                </button>
                <a href={`/register/${ev.id}`} target="_blank" rel="noopener noreferrer"
                  className="px-3 py-2 rounded-lg text-xs font-medium bg-brand-600 hover:bg-brand-500 text-white whitespace-nowrap">
                  Preview →
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
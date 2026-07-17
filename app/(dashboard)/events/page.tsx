"use client";
import { useState, useEffect } from "react";
import type { Event } from "@/lib/types";

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "", event_date: "", event_time: "", event_end_time: "",
    event_date_label: "", joining_link: "", description: "", status: "active",
  });
  const [saving, setSaving] = useState(false);

  const load = () =>
    fetch("/api/events").then((r) => r.json()).then((d) => Array.isArray(d) && setEvents(d));

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.name || !form.event_date) return;
    setSaving(true);
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setShowForm(false);
    setForm({ name: "", event_date: "", event_time: "", event_end_time: "", event_date_label: "", joining_link: "", description: "", status: "active" });
    load();
  };

  const inputCls = "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500";

  return (
    <div className="max-w-3xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Events</h1>
          <p className="text-slate-400 text-sm mt-1">Manage your events</p>
        </div>
        <button onClick={() => setShowForm((x) => !x)}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 rounded-lg text-white text-sm font-semibold">
          + New Event
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 mb-6">
          <h2 className="text-sm font-semibold text-white mb-4">Create Event</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Event Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Teacher-Student Relationship Session" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Event Date & Time *</label>
              <input type="datetime-local" value={form.event_date}
                onChange={(e) => setForm({ ...form, event_date: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Date Label <span className="text-slate-600">(shown in emails — e.g. &quot;Wednesday, 10th June 2026&quot;)</span>
              </label>
              <input value={form.event_date_label}
                onChange={(e) => setForm({ ...form, event_date_label: e.target.value })}
                placeholder="Wednesday, 10th June 2026" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Start Time</label>
                <input value={form.event_time} onChange={(e) => setForm({ ...form, event_time: e.target.value })}
                  placeholder="5:00 PM" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">End Time</label>
                <input value={form.event_end_time} onChange={(e) => setForm({ ...form, event_end_time: e.target.value })}
                  placeholder="6:30 PM" className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Joining Link</label>
              <input value={form.joining_link} onChange={(e) => setForm({ ...form, joining_link: e.target.value })}
                placeholder="https://meetn.com/Event?ID=..." className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2} className={`${inputCls} resize-none`} />
            </div>

            <div className="bg-slate-800/50 rounded-lg px-4 py-3 border border-slate-700">
              <p className="text-xs font-medium text-slate-400 mb-2">Template placeholders</p>
              <div className="grid grid-cols-2 gap-1 text-xs font-mono">
                {[["{{full_name}}", "Registrant name"], ["{{event_name}}", "Event name"], ["{{event_date}}", "Date label"],
                  ["{{event_time}}", "Start time"], ["{{event_end_time}}", "End time"], ["{{joining_link}}", "Meeting link"]].map(([ph, desc]) => (
                  <div key={ph} className="flex gap-2"><span className="text-green-400">{ph}</span><span className="text-slate-600">→ {desc}</span></div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} disabled={!form.name || !form.event_date || saving}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 rounded-lg text-white text-sm font-semibold">
                {saving ? "Saving…" : "Save Event"}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {events.length === 0 && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 px-5 py-10 text-center text-slate-500 text-sm">
            No events yet. Create your first event above.
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
                  <a href={ev.joining_link} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-400 mt-1 block truncate max-w-xs">🔗 {ev.joining_link}</a>
                )}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded font-medium capitalize ${
                ev.status === "active" ? "bg-green-500/10 text-green-400" : ev.status === "draft" ? "bg-yellow-500/10 text-yellow-400" : "bg-slate-800 text-slate-400"
              }`}>{ev.status}</span>
            </div>

            {/* Quick actions row */}
            <div className="flex gap-2 pt-3 border-t border-slate-800">
              <a href={`/send?event_id=${ev.id}`}
                className="flex-1 text-center px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-xs font-medium">
                ✉️ Send Campaign
              </a>
              <a href={`/post-event?event_id=${ev.id}`}
                className="flex-1 text-center px-3 py-2 bg-brand-600 hover:bg-brand-500 rounded-lg text-white text-xs font-medium">
                🎓 Send Certificate
              </a>
              <a href={`/bible?event_id=${ev.id}`}
                className="flex-1 text-center px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-xs font-medium">
                📖 Event Bible
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
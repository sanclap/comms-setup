"use client";
import { useState, useEffect } from "react";
import type { Event, Template } from "@/lib/types";

interface DripCampaign {
  id: string;
  event_id: string;
  name: string;
  email_template_id: string;
  days_offset: number;
  send_hour: number;
  send_minute: number;
  is_active: boolean;
  templates?: { id: string; name: string };
}

const EMPTY_FORM = {
  name: "",
  email_template_id: "",
  days_offset: -1,
  send_time: "19:00", // HH:MM format
};

function parseTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  return { send_hour: h, send_minute: m };
}

function formatTime(hour: number, minute: number) {
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

export default function DripsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [drips, setDrips] = useState<DripCampaign[]>([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<string>("");
  const [cronSecret, setCronSecret] = useState("");
  const [showSecretInput, setShowSecretInput] = useState(false);
  const [editingDrip, setEditingDrip] = useState<DripCampaign | null>(null);
  const [editForm, setEditForm] = useState({
    email_template_id: "",
    days_offset: -1,
    send_time: "19:00",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/events").then((r) => r.json()),
      fetch("/api/templates").then((r) => r.json()),
    ]).then(([ev, tpl]) => {
      if (Array.isArray(ev)) setEvents(ev);
      if (Array.isArray(tpl)) setTemplates(tpl.filter((t: Template) => t.type === "email"));
    });
  }, []);

  const loadDrips = (eventId: string) => {
    if (!eventId) { setDrips([]); return; }
    fetch(`/api/drips?event_id=${eventId}`)
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setDrips(d));
  };

  useEffect(() => { loadDrips(selectedEvent); }, [selectedEvent]);

  const handleSave = async () => {
    if (!selectedEvent || !form.name || !form.email_template_id) return;
    setSaving(true);
    const { send_hour, send_minute } = parseTime(form.send_time);
    await fetch("/api/drips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: selectedEvent,
        name: form.name,
        email_template_id: form.email_template_id,
        days_offset: form.days_offset,
        send_hour,
        send_minute,
      }),
    });
    setSaving(false);
    setShowForm(false);
    setForm(EMPTY_FORM);
    loadDrips(selectedEvent);
  };

  const startEdit = (drip: DripCampaign) => {
    setEditingDrip(drip);
    setEditForm({
      email_template_id: drip.email_template_id,
      days_offset: drip.days_offset,
      send_time: formatTime(drip.send_hour, drip.send_minute),
    });
  };

  const handleUpdate = async () => {
    if (!editingDrip) return;
    const { send_hour, send_minute } = parseTime(editForm.send_time);
    await fetch("/api/drips", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingDrip.id,
        email_template_id: editForm.email_template_id,
        days_offset: editForm.days_offset,
        send_hour,
        send_minute,
      }),
    });
    loadDrips(selectedEvent);
    setEditingDrip(null);
  };

  const toggleActive = async (drip: DripCampaign) => {
    await fetch("/api/drips", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: drip.id, is_active: !drip.is_active }),
    });
    loadDrips(selectedEvent);
  };

  const deleteDrip = async (id: string) => {
    if (!confirm("Delete this drip?")) return;
    await fetch(`/api/drips?id=${id}`, { method: "DELETE" });
    loadDrips(selectedEvent);
  };

  const triggerNow = async () => {
    if (!cronSecret) { setShowSecretInput(true); return; }
    setTriggering(true);
    setTriggerResult("");
    try {
      const res = await fetch(`/api/drips?action=run&secret=${encodeURIComponent(cronSecret)}`);
      const data = await res.json();
      setTriggerResult(JSON.stringify(data, null, 2));
    } catch (e) {
      setTriggerResult("Error: " + String(e));
    }
    setTriggering(false);
  };

  const formatSchedule = (drip: DripCampaign) => {
    const dayLabel = drip.days_offset === 0 ? "Day of event"
      : drip.days_offset < 0 ? `${Math.abs(drip.days_offset)} day(s) before`
      : `${drip.days_offset} day(s) after`;
    return `${dayLabel} at ${formatTime(drip.send_hour, drip.send_minute)} IST`;
  };

  const getFireDate = (offset: number, time: string) => {
    if (!selectedEventObj) return "—";
    const d = new Date(selectedEventObj.event_date);
    d.setDate(d.getDate() + offset);
    return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      + ` at ${time} IST`;
  };

  const selectedEventObj = events.find((e) => e.id === selectedEvent);

  const inputCls = "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500";

  return (
    <div className="max-w-3xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Drip Scheduler</h1>
          <p className="text-slate-400 text-sm mt-1">Schedule automated email drips per event</p>
        </div>
        <button onClick={triggerNow} disabled={triggering}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 text-sm font-medium disabled:opacity-40">
          {triggering ? "Running…" : "▶ Manual Trigger"}
        </button>
      </div>

      {/* CRON_SECRET input */}
      {showSecretInput && (
        <div className="bg-slate-900 rounded-xl border border-brand-500/30 p-5 mb-4">
          <label className="block text-xs font-medium text-slate-300 mb-2">Enter CRON_SECRET</label>
          <div className="flex gap-2">
            <input type="password" value={cronSecret} onChange={(e) => setCronSecret(e.target.value)}
              placeholder="Value from .env.local" className={`flex-1 ${inputCls}`}
              onKeyDown={(e) => e.key === "Enter" && (setShowSecretInput(false), triggerNow())} />
            <button onClick={() => { setShowSecretInput(false); triggerNow(); }}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 rounded-lg text-white text-sm font-semibold">Run</button>
            <button onClick={() => setShowSecretInput(false)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Event selector */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 mb-4">
        <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">Select Event</label>
        <select value={selectedEvent} onChange={(e) => setSelectedEvent(e.target.value)} className={inputCls}>
          <option value="">— Choose an event —</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.name} · {new Date(ev.event_date).toLocaleDateString("en-IN")}
            </option>
          ))}
        </select>
        {selectedEventObj && (
          <p className="text-xs text-slate-500 mt-2">
            Event date: <span className="text-slate-300">{new Date(selectedEventObj.event_date).toLocaleString("en-IN")}</span>
          </p>
        )}
      </div>

      {selectedEvent && (
        <>
          <div className="space-y-3 mb-4">
            {drips.length === 0 && (
              <div className="bg-slate-900 rounded-xl border border-slate-800 px-5 py-8 text-center text-slate-500 text-sm">
                No drips scheduled yet. Add your first drip below.
              </div>
            )}
            {drips.map((drip) => (
              <div key={drip.id} className={`bg-slate-900 rounded-xl border p-5 ${drip.is_active ? "border-slate-800" : "border-slate-800/50 opacity-60"}`}>
                {editingDrip?.id === drip.id ? (
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Editing: {drip.name}</p>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Email Template</label>
                      <select value={editForm.email_template_id}
                        onChange={(e) => setEditForm({ ...editForm, email_template_id: e.target.value })}
                        className={inputCls}>
                        {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Days Offset</label>
                        <input type="number" value={editForm.days_offset}
                          onChange={(e) => setEditForm({ ...editForm, days_offset: parseInt(e.target.value) })}
                          className={inputCls} />
                        <p className="text-xs text-slate-600 mt-1">
                          {editForm.days_offset === 0 ? "Day of event"
                            : editForm.days_offset < 0 ? `${Math.abs(editForm.days_offset)} day(s) before`
                            : `${editForm.days_offset} day(s) after`}
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Send Time (IST)</label>
                        <input type="time" value={editForm.send_time}
                          onChange={(e) => setEditForm({ ...editForm, send_time: e.target.value })}
                          className={inputCls} />
                      </div>
                    </div>
                    <div className="bg-brand-500/5 border border-brand-500/20 rounded-lg px-3 py-2 text-xs text-slate-400">
                      📅 Will fire on: <span className="text-white">{getFireDate(editForm.days_offset, editForm.send_time)}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleUpdate}
                        className="px-4 py-1.5 bg-brand-600 hover:bg-brand-500 rounded-lg text-white text-xs font-semibold">
                        Save Changes
                      </button>
                      <button onClick={() => setEditingDrip(null)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-xs">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${drip.is_active ? "bg-green-400" : "bg-slate-600"}`} />
                        <p className="font-medium text-white text-sm">{drip.name}</p>
                      </div>
                      <p className="text-xs text-slate-500">🕐 {formatSchedule(drip)}</p>
                      <p className="text-xs text-slate-500 mt-0.5">📧 {drip.templates?.name || "No template"}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(drip)}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium bg-slate-800 border border-slate-700 text-slate-300 hover:text-white">
                        Edit
                      </button>
                      <button onClick={() => toggleActive(drip)}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium border ${
                          drip.is_active
                            ? "bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20"
                            : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                        }`}>
                        {drip.is_active ? "Active" : "Paused"}
                      </button>
                      <button onClick={() => deleteDrip(drip.id)}
                        className="text-xs px-2 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg">
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add drip form */}
          {!showForm ? (
            <button onClick={() => setShowForm(true)}
              className="w-full py-3 border border-dashed border-slate-700 hover:border-brand-500 rounded-xl text-slate-400 hover:text-brand-400 text-sm transition-colors">
              + Add Drip
            </button>
          ) : (
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
              <h2 className="text-sm font-semibold text-white mb-4">New Drip</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Drip Name *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. DRIP 1 - First Reminder" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Email Template *</label>
                  <select value={form.email_template_id}
                    onChange={(e) => setForm({ ...form, email_template_id: e.target.value })}
                    className={inputCls}>
                    <option value="">— Select template —</option>
                    {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Days Offset</label>
                    <input type="number" value={form.days_offset}
                      onChange={(e) => setForm({ ...form, days_offset: parseInt(e.target.value) })}
                      className={inputCls} />
                    <p className="text-xs text-slate-600 mt-1">
                      {form.days_offset === 0 ? "Day of event"
                        : form.days_offset < 0 ? `${Math.abs(form.days_offset)} day(s) before`
                        : `${form.days_offset} day(s) after`}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Send Time (IST)</label>
                    <input type="time" value={form.send_time}
                      onChange={(e) => setForm({ ...form, send_time: e.target.value })}
                      className={inputCls} />
                    <p className="text-xs text-slate-600 mt-1">e.g. 14:07 for 2:07 PM</p>
                  </div>
                </div>
                <div className="bg-brand-500/5 border border-brand-500/20 rounded-lg px-4 py-3 text-xs text-slate-400">
                  📅 Will fire on: <span className="text-white font-medium">{getFireDate(form.days_offset, form.send_time)}</span>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleSave} disabled={!form.name || !form.email_template_id || saving}
                    className="px-5 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 rounded-lg text-white text-sm font-semibold">
                    {saving ? "Saving…" : "Schedule Drip"}
                  </button>
                  <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-sm">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {triggerResult && (
        <div className="mt-4 bg-slate-900 rounded-xl border border-slate-800 p-4">
          <p className="text-xs font-medium text-slate-400 mb-2">Trigger Result</p>
          <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">{triggerResult}</pre>
        </div>
      )}

      <div className="mt-8 bg-slate-900 rounded-xl border border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-white mb-3">⚙️ Supabase Cron Setup</h3>
        <p className="text-xs text-slate-400 mb-3">Run once in Supabase SQL Editor after deploying to Vercel:</p>
        <pre className="text-xs text-green-400 bg-slate-800 rounded-lg p-3 overflow-x-auto whitespace-pre">{`select cron.schedule(
  'run-drips-every-minute',
  '* * * * *',  -- every minute (matches exact times)
  $$
  select net.http_post(
    url := 'https://YOUR_VERCEL_URL/api/drips?action=run',
    headers := '{"Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);`}</pre>
        <p className="text-xs text-slate-500 mt-2">Running every minute allows exact time matching like 14:07.</p>
      </div>
    </div>
  );
}
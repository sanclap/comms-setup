"use client";
import { useState, useCallback, useEffect } from "react";
import Papa from "papaparse";

interface AttendeeRow {
  name: string;
  email: string;
  phone: string;
  duration_seconds: number;
  duration_minutes: number;
  interaction: string;
  platform: string;
  device: string;
  date: string;
  role: string;
  filled_feedback: boolean;
  raw: Record<string, string>;
}

interface FeedbackRow {
  name: string;
  email: string;
  phone: string;
  timestamp: string;
  rating: string;
  raw: Record<string, string>;
}

interface ChatRow {
  timestamp: string;
  type: string;
  message: string;
  sender: string;
}

type Tab = "attendance" | "feedback" | "chat";

function findCol(headers: string[], candidates: string[]): string {
  const h = headers.map((x) => x.toLowerCase().trim());
  for (const c of candidates) {
    const idx = h.findIndex((x) => x.includes(c.toLowerCase()));
    if (idx !== -1) return headers[idx];
  }
  return "";
}

function parseAttendance(rows: Record<string, string>[]): AttendeeRow[] {
  if (!rows.length) return [];
  const headers = Object.keys(rows[0]);
  const nameCol = findCol(headers, ["name"]);
  const emailCol = findCol(headers, ["email"]);
  const phoneCol = findCol(headers, ["phone"]);
  const durationCol = findCol(headers, ["duration"]);
  const interactionCol = findCol(headers, ["interaction"]);
  const platformCol = findCol(headers, ["platform"]);
  const deviceCol = findCol(headers, ["device"]);
  const dateCol = findCol(headers, ["date"]);
  const roleCol = findCol(headers, ["role"]);

  // Deduplicate by name — SUM duration, keep first value for other fields
  // Matches the Google Sheets QUERY formula logic
  const grouped = new Map<string, AttendeeRow>();

  rows
    .filter((r) => r[nameCol]?.trim())
    .forEach((r) => {
      const name = (r[nameCol] || "").trim();
      const secs = parseInt(r[durationCol] || "0") || 0;
      const key = name.toLowerCase();

      if (grouped.has(key)) {
        // Duplicate — just add duration
        const existing = grouped.get(key)!;
        existing.duration_seconds += secs;
        existing.duration_minutes = Math.round(existing.duration_seconds / 60);
        // If any session was interactive, mark as interactive
        const interaction = (r[interactionCol] || "").toLowerCase().trim();
        if (interaction === "interactive") existing.interaction = "interactive";
      } else {
        grouped.set(key, {
          name,
          email: (r[emailCol] || "").trim().toLowerCase(),
          phone: (r[phoneCol] || "").trim(),
          duration_seconds: secs,
          duration_minutes: Math.round(secs / 60),
          interaction: (r[interactionCol] || "").toLowerCase().trim(),
          platform: r[platformCol] || "",
          device: r[deviceCol] || "",
          date: r[dateCol] || "",
          role: r[roleCol] || "",
          filled_feedback: false,
          raw: r,
        });
      }
    });

  return Array.from(grouped.values());
}

function parseFeedback(rows: Record<string, string>[]): FeedbackRow[] {
  if (!rows.length) return [];
  const headers = Object.keys(rows[0]);
  const nameCol = findCol(headers, ["full name", "name"]);
  const emailCol = findCol(headers, ["email"]);
  const phoneCol = findCol(headers, ["contact", "phone"]);
  const timestampCol = findCol(headers, ["timestamp"]);
  const ratingCol = findCol(headers, ["rate", "rating", "overall"]);

  return rows
    .filter((r) => r[nameCol]?.trim())
    .map((r) => ({
      name: (r[nameCol] || "").trim(),
      email: (r[emailCol] || "").trim().toLowerCase(),
      phone: (r[phoneCol] || "").trim(),
      timestamp: r[timestampCol] || "",
      rating: r[ratingCol] || "",
      raw: r,
    }));
}

function parseChat(rows: Record<string, string>[]): ChatRow[] {
  return rows.map((r) => {
    const vals = Object.values(r);
    const raw = vals[2] || vals[1] || "";
    const colonIdx = raw.indexOf(":");
    return {
      timestamp: vals[0] || "",
      type: vals[1] || "",
      message: raw,
      sender: colonIdx > -1 ? raw.substring(0, colonIdx).trim() : "",
    };
  });
}

function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      headers.map((h) => {
        const val = String(r[h] ?? "").replace(/"/g, '""');
        return val.includes(",") || val.includes("\n") ? `"${val}"` : val;
      }).join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function BiblePage() {
  const [tab, setTab] = useState<Tab>("attendance");

  // Data state
  const [attendees, setAttendees] = useState<AttendeeRow[]>([]);
  const [attendanceFile, setAttendanceFile] = useState("");
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [feedbackFile, setFeedbackFile] = useState("");
  const [chat, setChat] = useState<ChatRow[]>([]);
  const [chatFile, setChatFile] = useState("");

  // Filters — multiple constraints
  const [minDuration, setMinDuration] = useState(0);
  const [requireFeedback, setRequireFeedback] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [feedbackSearch, setFeedbackSearch] = useState("");
  const [chatSearch, setChatSearch] = useState("");

  // Certificate sending state
  const [events, setEvents] = useState<{id: string; name: string}[]>([]);
  const [templates, setTemplates] = useState<{id: string; name: string}[]>([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [handoutFile, setHandoutFile] = useState<File | null>(null);
  const [showCertPanel, setShowCertPanel] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0, sent: 0, failed: 0 });
  const [sendResult, setSendResult] = useState<{sent: number; failed: number} | null>(null);

  // Event Bible linking — saving/loading parsed datasets tied to an event
  const [savedBible, setSavedBible] = useState<Record<string, { row_count: number; uploaded_at: string; filename: string | null }>>({});
  const [savingType, setSavingType] = useState<Tab | null>(null);
  const [loadingType, setLoadingType] = useState<Tab | null>(null);
  const [bibleMsg, setBibleMsg] = useState("");

  const feedbackEmails = new Set(feedback.map((f) => f.email).filter(Boolean));
  const feedbackNames = new Set(feedback.map((f) => f.name.toLowerCase().trim()));
  const hasFeedback = (a: AttendeeRow) =>
    (a.email && feedbackEmails.has(a.email)) || feedbackNames.has(a.name.toLowerCase().trim());

  const parseFile = useCallback((file: File, onDone: (rows: Record<string, string>[]) => void, setName: (n: string) => void) => {
    setName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true, skipEmptyLines: true,
      complete: (r) => onDone(r.data),
    });
  }, []);

  // Apply all constraints
  const filteredAttendees = attendees.filter((a) => {
    if (a.duration_minutes < minDuration) return false;
    if (requireFeedback && !hasFeedback(a)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!a.name.toLowerCase().includes(q) && !a.email.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const filteredFeedback = feedback.filter((f) => {
    if (!feedbackSearch) return true;
    const q = feedbackSearch.toLowerCase();
    return f.name.toLowerCase().includes(q) || f.email.toLowerCase().includes(q);
  });

  const filteredChat = chat.filter((c) => {
    if (!chatSearch) return true;
    const q = chatSearch.toLowerCase();
    return c.message.toLowerCase().includes(q) || c.sender.toLowerCase().includes(q);
  });

  // Stats
  const totalAttendees = attendees.length;
  const feedbackCount = attendees.filter(hasFeedback).length;
  const avg45 = attendees.filter((a) => a.duration_minutes >= 45).length;

  // Load events on mount so the "Link to Event" selector is always ready
  useEffect(() => {
    fetch("/api/events").then((r) => r.json()).then((d) => { if (Array.isArray(d)) setEvents(d); });
  }, []);

  // Whenever the linked event changes, fetch what's already saved for it
  useEffect(() => {
    if (!selectedEvent) { setSavedBible({}); return; }
    fetch(`/api/events/${selectedEvent}/bible`)
      .then((r) => r.json())
      .then((rows) => {
        if (!Array.isArray(rows)) { setSavedBible({}); return; }
        const map: typeof savedBible = {};
        rows.forEach((r: { type: string; row_count: number; uploaded_at: string; filename: string | null }) => {
          map[r.type] = { row_count: r.row_count, uploaded_at: r.uploaded_at, filename: r.filename };
        });
        setSavedBible(map);
      });
  }, [selectedEvent]);

  const saveToEvent = async (type: Tab) => {
    if (!selectedEvent) return;
    const dataMap = { attendance: attendees, feedback, chat };
    const fileMap = { attendance: attendanceFile, feedback: feedbackFile, chat: chatFile };
    const rows = dataMap[type];
    if (!rows.length) return;

    setSavingType(type);
    setBibleMsg("");
    try {
      const res = await fetch(`/api/events/${selectedEvent}/bible`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, filename: fileMap[type], data: rows }),
      });
      const saved = await res.json();
      if (saved.error) {
        setBibleMsg(`⚠️ ${saved.error}`);
      } else {
        setSavedBible((prev) => ({ ...prev, [type]: { row_count: saved.row_count, uploaded_at: saved.uploaded_at, filename: saved.filename } }));
        setBibleMsg(`✓ Saved ${rows.length} ${type} rows to this event`);
      }
    } catch {
      setBibleMsg("⚠️ Failed to save — check your connection");
    }
    setSavingType(null);
  };

  const loadFromEvent = async (type: Tab) => {
    if (!selectedEvent) return;
    setLoadingType(type);
    try {
      const res = await fetch(`/api/events/${selectedEvent}/bible?type=${type}`);
      const saved = await res.json();
      if (saved?.data) {
        if (type === "attendance") { setAttendees(saved.data); setAttendanceFile(saved.filename || "(saved)"); }
        if (type === "feedback") { setFeedback(saved.data); setFeedbackFile(saved.filename || "(saved)"); }
        if (type === "chat") { setChat(saved.data); setChatFile(saved.filename || "(saved)"); }
        setBibleMsg(`✓ Loaded ${saved.row_count} saved ${type} rows`);
      }
    } catch {
      setBibleMsg("⚠️ Failed to load saved data");
    }
    setLoadingType(null);
  };

  // Load events + templates for cert sending
  const loadCertData = async () => {
    const [evRes, tplRes] = await Promise.all([
      fetch("/api/events").then((r) => r.json()),
      fetch("/api/templates").then((r) => r.json()),
    ]);
    if (Array.isArray(evRes)) setEvents(evRes);
    if (Array.isArray(tplRes)) setTemplates(tplRes.filter((t: {type: string}) => t.type === "email"));
  };

  const handleShowCertPanel = () => {
    if (!showCertPanel) loadCertData();
    setShowCertPanel(!showCertPanel);
  };

  // Send certificates to filtered attendees
  const sendCertificates = async () => {
    if (!selectedEvent || !selectedTemplate || !filteredAttendees.length) return;
    setSending(true);
    setSendResult(null);

    const BATCH = 10;
    let sent = 0, failed = 0;
    setSendProgress({ current: 0, total: filteredAttendees.length, sent: 0, failed: 0 });

    for (let i = 0; i < filteredAttendees.length; i += BATCH) {
      const batch = filteredAttendees.slice(i, i + BATCH);

      const fd = new FormData();
      fd.append("event_id", selectedEvent);
      fd.append("template_id", selectedTemplate);
      fd.append("include_certificate", "true");
      fd.append("registrant_ids", JSON.stringify([])); // won't use this path
      // Pass attendees directly as JSON since they came from CSV not DB
      fd.append("attendees_json", JSON.stringify(batch.map((a) => ({
        full_name: a.name,
        email: a.email,
        phone: a.phone,
      }))));
      if (handoutFile) fd.append("handout", handoutFile);

      try {
        const res = await fetch("/api/send-bible-certs", { method: "POST", body: fd });
        const data = await res.json();
        sent += data.sent || 0;
        failed += data.failed || 0;
      } catch {
        failed += batch.length;
      }

      setSendProgress({ current: Math.min(i + BATCH, filteredAttendees.length), total: filteredAttendees.length, sent, failed });
      await new Promise((r) => setTimeout(r, 200));
    }

    setSendResult({ sent, failed });
    setSending(false);
  };

  const pct = sendProgress.total > 0 ? Math.round((sendProgress.current / sendProgress.total) * 100) : 0;

  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Event Bible</h1>
        <p className="text-slate-400 text-sm mt-1">Filter, analyse and act on post-event data</p>
      </div>

      {/* Link to event */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 mb-4">
        <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
          Link to Event
        </label>
        <select
          value={selectedEvent}
          onChange={(e) => { setSelectedEvent(e.target.value); setBibleMsg(""); }}
          className="w-full md:w-96 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
        >
          <option value="">— Not linked (this session only) —</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>{ev.name}</option>
          ))}
        </select>
        <p className="text-xs text-slate-500 mt-2">
          {selectedEvent
            ? "Save each dataset below to keep it attached to this event, so you (or anyone else) can reload it later without re-uploading the CSV."
            : "Uploaded data here is temporary and lost on refresh unless you link it to an event and save it."}
        </p>
        {bibleMsg && <p className="text-xs text-slate-300 mt-2">{bibleMsg}</p>}
      </div>

      {/* Upload row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <UploadCard label="Attendance CSV" file={attendanceFile} count={attendees.length} icon="👥"
          onFile={(f) => parseFile(f, (rows) => setAttendees(parseAttendance(rows)), setAttendanceFile)} />
        <UploadCard label="Feedback CSV" file={feedbackFile} count={feedback.length} icon="📝"
          onFile={(f) => parseFile(f, (rows) => setFeedback(parseFeedback(rows)), setFeedbackFile)} />
        <UploadCard label="Chat History CSV" file={chatFile} count={chat.length} icon="💬"
          onFile={(f) => parseFile(f, (rows) => setChat(parseChat(rows)), setChatFile)} />
      </div>

      {/* Save/load per type — only shown once an event is linked */}
      {selectedEvent && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {(["attendance", "feedback", "chat"] as Tab[]).map((type) => {
            const counts = { attendance: attendees.length, feedback: feedback.length, chat: chat.length };
            const saved = savedBible[type];
            return (
              <div key={type} className="bg-slate-900 rounded-xl border border-slate-800 p-4 text-xs">
                <p className="text-slate-400 mb-2 capitalize">{type} data</p>
                {saved ? (
                  <p className="text-slate-500 mb-2">
                    Saved: {saved.row_count} rows · {new Date(saved.uploaded_at).toLocaleString("en-IN")}
                  </p>
                ) : (
                  <p className="text-slate-600 mb-2">Nothing saved to this event yet</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => saveToEvent(type)}
                    disabled={!counts[type] || savingType === type}
                    className="flex-1 px-2 py-1.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed rounded text-white font-medium"
                  >
                    {savingType === type ? "Saving…" : "Save to Event"}
                  </button>
                  {saved && (
                    <button
                      onClick={() => loadFromEvent(type)}
                      disabled={loadingType === type}
                      className="flex-1 px-2 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded text-slate-300 font-medium"
                    >
                      {loadingType === type ? "Loading…" : "Load Saved"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stats */}
      {attendees.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatBox label="Total Attendees" value={totalAttendees} color="blue" />
          <StatBox label="Filled Feedback" value={`${feedbackCount} (${Math.round(feedbackCount/totalAttendees*100)}%)`} color="purple" />
          <StatBox label="45+ min" value={`${avg45} (${Math.round(avg45/totalAttendees*100)}%)`} color="green" />
          <StatBox label="Filtered" value={filteredAttendees.length} color="yellow" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 mb-4 w-fit">
        {(["attendance", "feedback", "chat"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              tab === t ? "bg-brand-600 text-white" : "text-slate-400 hover:text-white"
            }`}>
            {t === "attendance" ? `👥 Attendance${attendees.length ? ` (${filteredAttendees.length})` : ""}`
              : t === "feedback" ? `📝 Feedback${feedback.length ? ` (${filteredFeedback.length})` : ""}`
              : `💬 Chat${chat.length ? ` (${filteredChat.length})` : ""}`}
          </button>
        ))}
      </div>

      {/* ── ATTENDANCE TAB ── */}
      {tab === "attendance" && (
        <div>
          {attendees.length > 0 && (
            <>
              {/* Multi-constraint filter panel */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 mb-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Filter Constraints</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  {/* Duration */}
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Minimum Duration (minutes)</label>
                    <input type="number" value={minDuration} min={0}
                      onChange={(e) => setMinDuration(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500" />
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {[0, 15, 30, 45, 60, 75, 90].map((m) => (
                        <button key={m} onClick={() => setMinDuration(m)}
                          className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
                            minDuration === m ? "bg-brand-600 border-brand-500 text-white" : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                          }`}>
                          {m === 0 ? "All" : `${m}+`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Feedback required */}
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Feedback</label>
                    <div className="flex flex-col gap-2 mt-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={requireFeedback}
                          onChange={(e) => setRequireFeedback(e.target.checked)}
                          className="rounded border-slate-600" />
                        <span className="text-sm text-slate-300">Must have filled feedback</span>
                      </label>
                      {requireFeedback && feedback.length === 0 && (
                        <p className="text-xs text-yellow-400">⚠️ Upload feedback CSV first</p>
                      )}
                      {requireFeedback && feedback.length > 0 && (
                        <p className="text-xs text-green-400">✓ Cross-referencing {feedback.length} feedback entries</p>
                      )}
                    </div>
                  </div>

                  {/* Search */}
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Search</label>
                    <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Name or email..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500" />
                  </div>
                </div>

                {/* Active filter summary */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex gap-2 flex-wrap">
                    {minDuration > 0 && (
                      <span className="text-xs px-2 py-1 bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded-full">
                        ⏱ {minDuration}+ minutes
                      </span>
                    )}
                    {requireFeedback && (
                      <span className="text-xs px-2 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-full">
                        📝 Filled feedback
                      </span>
                    )}
                    {searchQuery && (
                      <span className="text-xs px-2 py-1 bg-slate-700 text-slate-300 rounded-full">
                        🔍 "{searchQuery}"
                      </span>
                    )}
                    {(minDuration > 0 || requireFeedback || searchQuery) && (
                      <button onClick={() => { setMinDuration(0); setRequireFeedback(false); setSearchQuery(""); }}
                        className="text-xs px-2 py-1 text-red-400 hover:text-red-300">
                        × Clear all
                      </button>
                    )}
                  </div>

                  <div className="ml-auto flex gap-2">
                    <button onClick={() => downloadCSV(
                      filteredAttendees.map((a) => ({
                        Name: a.name, Email: a.email, Phone: a.phone,
                        "Duration (min)": a.duration_minutes,
                        "Filled Feedback": hasFeedback(a) ? "Yes" : "No",
                        Device: a.device, Platform: a.platform,
                      })),
                      `filtered-${filteredAttendees.length}-attendees.csv`
                    )}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 text-xs font-semibold">
                      ↓ Download ({filteredAttendees.length})
                    </button>
                    <button onClick={handleShowCertPanel}
                      disabled={filteredAttendees.length === 0}
                      className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 rounded-lg text-white text-xs font-semibold">
                      🎓 Send Certificates ({filteredAttendees.length})
                    </button>
                  </div>
                </div>
              </div>

              {/* Certificate send panel */}
              {showCertPanel && (
                <div className="bg-slate-900 rounded-xl border border-brand-500/30 p-5 mb-4">
                  <h3 className="text-sm font-semibold text-white mb-4">
                    Send Certificates to {filteredAttendees.length} filtered attendees
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Event (for certificate date) *</label>
                      <select value={selectedEvent} onChange={(e) => setSelectedEvent(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500">
                        <option value="">— Choose event —</option>
                        {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Email Template *</label>
                      <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500">
                        <option value="">— Choose template —</option>
                        {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Handout upload */}
                  <div className="mb-4">
                    <label className="block text-xs text-slate-400 mb-1">Session Handout PDF (optional)</label>
                    <div className="flex items-center gap-3">
                      {handoutFile ? (
                        <div className="flex items-center gap-2 flex-1 bg-slate-800 rounded-lg px-3 py-2">
                          <span className="text-sm text-white">{handoutFile.name}</span>
                          <button onClick={() => setHandoutFile(null)} className="ml-auto text-xs text-red-400">Remove</button>
                        </div>
                      ) : (
                        <label className="flex-1 cursor-pointer bg-slate-800 border border-dashed border-slate-700 hover:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-500 text-center">
                          Click to upload handout PDF
                          <input type="file" accept=".pdf" className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) setHandoutFile(f); }} />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Progress */}
                  {sending && (
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Sending {sendProgress.current} / {sendProgress.total}</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2 mb-1">
                        <div className="bg-brand-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex gap-4 text-xs">
                        <span className="text-green-400">✓ {sendProgress.sent} sent</span>
                        {sendProgress.failed > 0 && <span className="text-red-400">✗ {sendProgress.failed} failed</span>}
                      </div>
                    </div>
                  )}

                  {sendResult && !sending && (
                    <div className="mb-4 bg-green-500/5 border border-green-500/20 rounded-lg px-4 py-3">
                      <p className="text-sm text-green-400 font-medium">✅ Done — {sendResult.sent} sent, {sendResult.failed} failed</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button onClick={sendCertificates}
                      disabled={!selectedEvent || !selectedTemplate || sending}
                      className="px-5 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 rounded-lg text-white text-sm font-semibold">
                      {sending ? `Sending ${pct}%…` : `Send to ${filteredAttendees.length} attendees`}
                    </button>
                    <button onClick={() => setShowCertPanel(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-sm">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Table */}
          {attendees.length === 0 ? (
            <EmptyState label="Upload an attendance CSV to get started" />
          ) : (
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-800">
                <span className="text-sm font-medium text-white">{filteredAttendees.length} of {totalAttendees} attendees match filters</span>
              </div>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-800/90">
                    <tr className="text-xs text-slate-500 uppercase">
                      <th className="text-left px-4 py-3">Name</th>
                      <th className="text-left px-4 py-3">Email</th>
                      <th className="text-left px-4 py-3">Duration</th>
                      <th className="text-left px-4 py-3">Feedback</th>
                      <th className="text-left px-4 py-3">Device</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttendees.map((a, i) => (
                      <tr key={i} className="border-t border-slate-800/50 hover:bg-slate-800/20">
                        <td className="px-4 py-2.5 text-slate-300 font-medium">{a.name}</td>
                        <td className="px-4 py-2.5 text-slate-500 text-xs font-mono">{a.email || "—"}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs font-medium ${
                            a.duration_minutes >= 60 ? "text-green-400"
                            : a.duration_minutes >= 30 ? "text-yellow-400"
                            : "text-red-400"
                          }`}>{a.duration_minutes} min</span>
                        </td>
                        <td className="px-4 py-2.5">
                          {feedback.length > 0 ? (
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                              hasFeedback(a) ? "bg-purple-500/10 text-purple-400" : "bg-slate-800 text-slate-600"
                            }`}>{hasFeedback(a) ? "✅ Yes" : "No"}</span>
                          ) : <span className="text-slate-700 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 text-xs capitalize">{a.device || a.platform || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── FEEDBACK TAB ── */}
      {tab === "feedback" && (
        <div>
          {feedback.length > 0 && (
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 mb-4 flex gap-3">
              <input value={feedbackSearch} onChange={(e) => setFeedbackSearch(e.target.value)}
                placeholder="Search name or email..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500" />
              <button onClick={() => downloadCSV(filteredFeedback.map((f) => f.raw), "feedback-filtered.csv")}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 rounded-lg text-white text-xs font-semibold whitespace-nowrap">
                ↓ Download ({filteredFeedback.length})
              </button>
            </div>
          )}
          {feedback.length === 0 ? <EmptyState label="Upload a feedback CSV to view responses" /> : (
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-800/90">
                    <tr className="text-xs text-slate-500 uppercase">
                      <th className="text-left px-4 py-3">Name</th>
                      <th className="text-left px-4 py-3">Email</th>
                      <th className="text-left px-4 py-3">Phone</th>
                      <th className="text-left px-4 py-3">Rating</th>
                      <th className="text-left px-4 py-3">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFeedback.map((f, i) => (
                      <tr key={i} className="border-t border-slate-800/50 hover:bg-slate-800/20">
                        <td className="px-4 py-2.5 text-slate-300 font-medium">{f.name}</td>
                        <td className="px-4 py-2.5 text-slate-500 text-xs font-mono">{f.email || "—"}</td>
                        <td className="px-4 py-2.5 text-slate-500 text-xs">{f.phone || "—"}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                            f.rating === "Excellent" ? "bg-green-500/10 text-green-400"
                            : f.rating === "Very Good" ? "bg-blue-500/10 text-blue-400"
                            : "bg-slate-800 text-slate-400"
                          }`}>{f.rating || "—"}</span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 text-xs">{f.timestamp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CHAT TAB ── */}
      {tab === "chat" && (
        <div>
          {chat.length > 0 && (
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 mb-4 flex gap-3">
              <input value={chatSearch} onChange={(e) => setChatSearch(e.target.value)}
                placeholder="Search messages or sender..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500" />
              <button onClick={() => downloadCSV(
                filteredChat.map((c) => ({ Timestamp: c.timestamp, Type: c.type, Sender: c.sender, Message: c.message })),
                "chat-filtered.csv"
              )}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 rounded-lg text-white text-xs font-semibold whitespace-nowrap">
                ↓ Download ({filteredChat.length})
              </button>
            </div>
          )}
          {chat.length === 0 ? <EmptyState label="Upload a chat history CSV to view messages" /> : (
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <div className="max-h-[500px] overflow-y-auto">
                {filteredChat.map((c, i) => (
                  <div key={i} className="border-b border-slate-800/50 px-5 py-3 hover:bg-slate-800/20">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-brand-400">{c.sender || "System"}</span>
                      <span className="text-xs text-slate-600">{c.timestamp}</span>
                    </div>
                    <p className="text-sm text-slate-300">{c.message.includes(":") ? c.message.split(":").slice(1).join(":").trim() : c.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UploadCard({ label, file, onFile, count, icon }: {
  label: string; file: string; onFile: (f: File) => void; count: number; icon: string;
}) {
  return (
    <label className={`block bg-slate-900 rounded-xl border-2 border-dashed p-5 cursor-pointer transition-colors ${
      file ? "border-brand-500/50 bg-brand-500/5" : "border-slate-700 hover:border-slate-600"
    }`}>
      <div className="text-2xl mb-2">{icon}</div>
      <p className="text-sm font-medium text-white">{label}</p>
      {file ? <p className="text-xs text-green-400 mt-1">✓ {file} · {count} rows</p>
        : <p className="text-xs text-slate-500 mt-1">Click to upload CSV</p>}
      <input type="file" accept=".csv" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
    </label>
  );
}

function StatBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colors: Record<string, string> = {
    blue: "text-blue-400", green: "text-green-400", purple: "text-purple-400", yellow: "text-yellow-400",
  };
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
      <p className={`text-xl font-bold ${colors[color]}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 px-5 py-12 text-center text-slate-500 text-sm">{label}</div>
  );
}
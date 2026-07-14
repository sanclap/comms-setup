"use client";
import React, { useState, useEffect } from "react";
import type { MessageLog, Event } from "@/lib/types";

export default function LogsPage() {
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [filterEvent, setFilterEvent] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = (eventId?: string) => {
    setLoading(true);
    const url = `/api/logs?limit=200${eventId ? `&event_id=${eventId}` : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setLogs(d);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setEvents(d));
    load();
  }, []);

  const handleEventFilter = (id: string) => {
    setFilterEvent(id);
    load(id || undefined);
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Message Logs</h1>
          <p className="text-slate-400 text-sm mt-1">All sent messages and their status</p>
        </div>
        <select
          value={filterEvent}
          onChange={(e) => handleEventFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
        >
          <option value="">All Events</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>{ev.name}</option>
          ))}
        </select>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        {loading ? (
          <div className="px-5 py-10 text-center text-slate-500 text-sm">Loading…</div>
        ) : logs.length === 0 ? (
          <div className="px-5 py-10 text-center text-slate-500 text-sm">No logs found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase bg-slate-800/50">
                  <th className="text-left px-5 py-3">Recipient</th>
                  <th className="text-left px-5 py-3">Channel</th>
                  <th className="text-left px-5 py-3">Template</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-left px-5 py-3">Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <React.Fragment key={log.id}>
                  <tr
                    onClick={() => log.response && setExpanded(expanded === log.id ? null : log.id)}
                    className={`border-t border-slate-800/50 hover:bg-slate-800/20 ${log.response ? "cursor-pointer" : ""}`}>
                    <td className="px-5 py-3">
                      <p className="text-slate-300">{log.registrants?.full_name || "—"}</p>
                      <p className="text-xs text-slate-500 font-mono">{log.registrants?.email}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">
                        {log.channel}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-400 max-w-[200px] truncate">
                      {log.template_name || "—"}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={log.status} />
                      {log.failure_reason && (
                        <p className="text-xs text-red-400 mt-0.5 max-w-[160px] truncate" title={log.failure_reason}>
                          {log.failure_reason}
                        </p>
                      )}
                      {log.response && (
                        <p className="text-xs text-brand-400 mt-0.5">{expanded === log.id ? "▲ hide raw response" : "▼ view raw response"}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">
                      {new Date(log.sent_at).toLocaleString("en-IN")}
                    </td>
                  </tr>
                  {expanded === log.id && log.response && (
                    <tr className="border-t border-slate-800/50 bg-slate-950">
                      <td colSpan={5} className="px-5 py-3">
                        <p className="text-xs text-slate-500 mb-1">Raw response from the provider (this is what actually determines the status above — useful for checking what NexG/ZeptoMail said, beyond just "sent" or "failed"):</p>
                        <pre className="text-xs text-slate-300 bg-slate-900 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(log.response, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    sent: "bg-green-500/10 text-green-400",
    submitted: "bg-blue-500/10 text-blue-400",
    failed: "bg-red-500/10 text-red-400",
    pending: "bg-yellow-500/10 text-yellow-400",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${map[status] || "bg-slate-800 text-slate-400"}`}>
      {status.toUpperCase()}
    </span>
  );
}

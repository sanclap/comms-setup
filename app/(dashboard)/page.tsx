"use client";
import { useEffect, useState } from "react";

interface Stats {
  events: number;
  registrants: number;
  emailsSent: number;
  failed: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentLogs, setRecentLogs] = useState<unknown[]>([]);

  useEffect(() => {
    async function load() {
      const [eventsRes, logsRes] = await Promise.all([
        fetch("/api/events").then((r) => r.json()),
        fetch("/api/logs?limit=200").then((r) => r.json()),
      ]);

      const events = Array.isArray(eventsRes) ? eventsRes : [];
      const logs = Array.isArray(logsRes) ? logsRes : [];

      // Count registrants via a separate call per event
      let totalRegistrants = 0;
      for (const ev of events) {
        const res = await fetch(`/api/events/${ev.id}/registrants`).then((r) => r.json());
        if (Array.isArray(res)) totalRegistrants += res.length;
      }

      setStats({
        events: events.length,
        registrants: totalRegistrants,
        emailsSent: logs.filter((l: { status: string; channel: string }) => l.status === "sent" && l.channel === "email").length,
        failed: logs.filter((l: { status: string }) => l.status === "failed").length,
      });
      setRecentLogs(logs.slice(0, 10));
    }
    load();
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">EDXSO Communication Platform</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Events" value={stats?.events ?? "—"} icon="📅" color="blue" />
        <StatCard label="Registrants" value={stats?.registrants ?? "—"} icon="👥" color="green" />
        <StatCard label="Emails Sent" value={stats?.emailsSent ?? "—"} icon="✉️" color="purple" />
        <StatCard label="Failed" value={stats?.failed ?? "—"} icon="⚠️" color="red" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <QuickAction href="/upload" title="Upload Registrants" desc="Import attendees via CSV" icon="📤" />
        <QuickAction href="/send" title="Send Campaign" desc="Send email or WhatsApp" icon="✉️" />
        <QuickAction href="/events" title="Create Event" desc="Add a new event" icon="📅" />
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-white">Recent Messages</h2>
        </div>
        {recentLogs.length === 0 ? (
          <div className="px-5 py-8 text-center text-slate-500 text-sm">No messages sent yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 uppercase">
                <th className="text-left px-5 py-3">Recipient</th>
                <th className="text-left px-5 py-3">Channel</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Time</th>
              </tr>
            </thead>
            <tbody>
              {(recentLogs as Array<{
                id: string;
                registrants?: { full_name: string; email: string };
                channel: string;
                status: string;
                sent_at: string;
              }>).map((log) => (
                <tr key={log.id} className="border-t border-slate-800/50">
                  <td className="px-5 py-3 text-slate-300">
                    {log.registrants?.full_name || "—"}
                    <span className="text-slate-500 text-xs ml-2">{log.registrants?.email}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">{log.channel}</span>
                  </td>
                  <td className="px-5 py-3"><StatusBadge status={log.status} /></td>
                  <td className="px-5 py-3 text-slate-500 text-xs font-mono">
                    {new Date(log.sent_at).toLocaleString("en-IN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-400",
    green: "bg-green-500/10 text-green-400",
    purple: "bg-purple-500/10 text-purple-400",
    red: "bg-red-500/10 text-red-400",
  };
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
      <div className={`inline-flex p-2 rounded-lg text-lg mb-3 ${colors[color]}`}>{icon}</div>
      <p className="text-2xl font-semibold text-white">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}

function QuickAction({ href, title, desc, icon }: { href: string; title: string; desc: string; icon: string }) {
  return (
    <a href={href} className="bg-slate-900 rounded-xl border border-slate-800 p-5 hover:border-brand-500/50 hover:bg-slate-800/50 group block">
      <div className="text-2xl mb-2">{icon}</div>
      <p className="font-medium text-white text-sm group-hover:text-brand-400">{title}</p>
      <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
    </a>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    sent: "bg-green-500/10 text-green-400",
    failed: "bg-red-500/10 text-red-400",
    pending: "bg-yellow-500/10 text-yellow-400",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${map[status] || "bg-slate-800 text-slate-400"}`}>
      {status.toUpperCase()}
    </span>
  );
}

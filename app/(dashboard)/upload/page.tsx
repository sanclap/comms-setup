"use client";
import { useState, useCallback, useEffect } from "react";
import Papa from "papaparse";
import type { CsvRow, UploadResult } from "@/lib/types";

interface Event { id: string; name: string; event_date: string; }

export default function UploadPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [parsedRows, setParsedRows] = useState<CsvRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [parseError, setParseError] = useState("");
  const [currentCount, setCurrentCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/events").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setEvents(data);
    });
  }, []);

  // Show current registrant count for the selected event — refetches every time
  // the event changes, so you always see the up-to-date total (not cached)
  useEffect(() => {
    if (!selectedEvent) { setCurrentCount(null); return; }
    fetch(`/api/events/${selectedEvent}/registrants`)
      .then((r) => r.json())
      .then((data) => setCurrentCount(Array.isArray(data) ? data.length : 0));
  }, [selectedEvent]);

  const handleFile = useCallback((file: File) => {
    setParseError(""); setResult(null); setFileName(file.name);
    Papa.parse<CsvRow>(file, {
      header: true, skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (results) => {
        const rows = results.data as CsvRow[];
        if (!rows[0]?.full_name && !rows[0]?.email) {
          setParseError("CSV must have columns: full_name, email (and optionally phone, school)");
          setParsedRows([]);
          return;
        }
        setParsedRows(rows);
      },
      error: (err) => setParseError(err.message),
    });
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleUpload = async () => {
    if (!selectedEvent || parsedRows.length === 0) return;
    setUploading(true); setResult(null);

    const res = await fetch("/api/registrants/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: parsedRows, event_id: selectedEvent }),
    });

    const data = await res.json();
    setResult(data);
    setUploading(false);

    // Refresh the count so you can immediately see new total after upload
    fetch(`/api/events/${selectedEvent}/registrants`)
      .then((r) => r.json())
      .then((d) => setCurrentCount(Array.isArray(d) ? d.length : 0));
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Upload Registrants</h1>
        <p className="text-slate-400 text-sm mt-1">Import attendees from a CSV file — safe to upload multiple times, new rows are added and existing ones updated</p>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 mb-4">
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Select Event <span className="text-red-400">*</span>
        </label>
        <select value={selectedEvent} onChange={(e) => setSelectedEvent(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500">
          <option value="">— Choose an event —</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.name} · {new Date(ev.event_date).toLocaleDateString("en-IN")}
            </option>
          ))}
        </select>
        {selectedEvent && currentCount !== null && (
          <p className="text-xs text-slate-500 mt-2">
            Currently <span className="text-white font-medium">{currentCount}</span> registrants for this event
          </p>
        )}
        {events.length === 0 && (
          <p className="text-xs text-slate-500 mt-2">
            No events found. <a href="/events" className="text-brand-400 underline">Create one first.</a>
          </p>
        )}
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 mb-4">
        <p className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">Expected CSV Format</p>
        <code className="text-xs font-mono text-green-400 bg-slate-800 px-3 py-2 rounded block">
          full_name,email,phone,school<br/>
          John Doe,john@example.com,9199999999,DPS Gurugram<br/>
          Jane Smith,jane@example.com,,
        </code>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors mb-4 ${
          isDragging ? "border-brand-500 bg-brand-500/5" : "border-slate-700 hover:border-slate-600"
        }`}>
        <div className="text-3xl mb-3">📂</div>
        <p className="text-slate-300 text-sm font-medium mb-1">Drop your CSV here</p>
        <p className="text-slate-500 text-xs mb-4">or click to browse</p>
        <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-300">
          <span>Browse file</span>
          <input type="file" accept=".csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} className="hidden" />
        </label>
      </div>

      {parseError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400 mb-4">⚠️ {parseError}</div>
      )}

      {parsedRows.length > 0 && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 mb-4 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
            <span className="text-sm font-medium text-white">{fileName} · {parsedRows.length} rows</span>
            <span className="text-xs text-slate-500">Preview (first 5)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase bg-slate-800/50">
                  <th className="text-left px-4 py-2">Full Name</th>
                  <th className="text-left px-4 py-2">Email</th>
                  <th className="text-left px-4 py-2">Phone</th>
                </tr>
              </thead>
              <tbody>
                {parsedRows.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-t border-slate-800/50">
                    <td className="px-4 py-2 text-slate-300">{row.full_name}</td>
                    <td className="px-4 py-2 text-slate-400 text-xs font-mono">{row.email}</td>
                    <td className="px-4 py-2 text-slate-400 text-xs font-mono">{row.phone || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <button onClick={handleUpload}
        disabled={!selectedEvent || parsedRows.length === 0 || uploading}
        className="w-full py-3 px-4 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white text-sm font-semibold transition-colors">
        {uploading ? `Importing ${parsedRows.length} rows…` : `Import ${parsedRows.length || 0} Registrants`}
      </button>

      {result && (
        <div className="mt-4 bg-slate-900 rounded-xl border border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Upload Complete</h3>
          <div className="flex gap-4 mb-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-400">{result.imported}</p>
              <p className="text-xs text-slate-500">Imported/Updated</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-400">{result.skipped}</p>
              <p className="text-xs text-slate-500">Skipped</p>
            </div>
            {currentCount !== null && (
              <div className="text-center">
                <p className="text-2xl font-bold text-brand-400">{currentCount}</p>
                <p className="text-xs text-slate-500">Total Now</p>
              </div>
            )}
          </div>
          {result.errors.length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-red-400 cursor-pointer">{result.errors.length} error(s) — click to expand</summary>
              <div className="mt-2 space-y-1">
                {result.errors.map((e, i) => (
                  <div key={i} className="text-xs text-slate-400 font-mono">Row {e.row}: {e.reason} — {e.data.email}</div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
"use client";
import { useState, useCallback, useEffect, useMemo } from "react";
import Papa from "papaparse";
import type { RawCsvRow, ColumnMapEntry, ColumnTarget, UploadResult } from "@/lib/types";

interface Event {
  id: string;
  name: string;
  event_date: string;
}

const TARGET_LABELS: Record<ColumnTarget, string> = {
  full_name: "Full Name",
  email: "Email",
  phone: "Phone",
  tag: "School / Tag",
  ignore: "Don't import",
};

function guessTarget(header: string): ColumnTarget {
  const h = header.toLowerCase();
  if (/name/.test(h)) return "full_name";
  if (/e-?mail/.test(h)) return "email";
  if (/phone|mobile|contact|whatsapp/.test(h)) return "phone";
  if (/school|college|organi[sz]ation|institute|university/.test(h)) return "tag";
  return "ignore";
}

function titleCase(header: string): string {
  return header
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
}

export default function UploadPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState("");

  const [rawRows, setRawRows] = useState<RawCsvRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [parseError, setParseError] = useState("");

  const [mapping, setMapping] = useState<ColumnMapEntry[]>([]);

  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setEvents(data);
      });
  }, []);

  const handleFile = useCallback((file: File) => {
    setParseError("");
    setResult(null);
    setFileName(file.name);

    Papa.parse<RawCsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (results) => {
        const rows = results.data as RawCsvRow[];
        const headers = results.meta.fields || [];

        if (headers.length === 0 || rows.length === 0) {
          setParseError("Couldn't find any columns or rows in that file.");
          setRawRows([]);
          setMapping([]);
          return;
        }

        setRawRows(rows);
        setMapping(
          headers.map((header) => ({
            header,
            label: titleCase(header),
            target: guessTarget(header),
          }))
        );
      },
      error: (err) => setParseError(err.message),
    });
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const updateMapping = (header: string, patch: Partial<ColumnMapEntry>) => {
    setMapping((prev) => prev.map((m) => (m.header === header ? { ...m, ...patch } : m)));
  };

  const includedColumns = useMemo(() => mapping.filter((m) => m.target !== "ignore"), [mapping]);
  const hasFullName = includedColumns.some((m) => m.target === "full_name");
  const hasEmail = includedColumns.some((m) => m.target === "email");
  const canImport = hasFullName && hasEmail && !!selectedEvent && rawRows.length > 0;

  const handleUpload = async () => {
    if (!canImport) return;
    setUploading(true);
    setResult(null);

    const res = await fetch("/api/registrants/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: selectedEvent,
        rows: rawRows,
        mapping: includedColumns.map(({ header, target }) => ({ header, target })),
      }),
    });

    const data = await res.json();
    setResult(data);
    setUploading(false);
  };

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Upload Registrants</h1>
        <p className="text-slate-400 text-sm mt-1">Import attendees from a CSV file</p>
      </div>

      {/* Event selector */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 mb-4">
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Select Event <span className="text-red-400">*</span>
        </label>
        <select
          value={selectedEvent}
          onChange={(e) => setSelectedEvent(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
        >
          <option value="">— Choose an event —</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.name} · {new Date(ev.event_date).toLocaleDateString("en-IN")}
            </option>
          ))}
        </select>
        {events.length === 0 && (
          <p className="text-xs text-slate-500 mt-2">
            No events found. <a href="/events" className="text-brand-400 underline">Create one first.</a>
          </p>
        )}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors mb-4 ${
          isDragging ? "border-brand-500 bg-brand-500/5" : "border-slate-700 hover:border-slate-600"
        }`}
      >
        <div className="text-3xl mb-3">📂</div>
        <p className="text-slate-300 text-sm font-medium mb-1">Drop your CSV here</p>
        <p className="text-slate-500 text-xs mb-4">Any column names are fine — you'll map them next</p>
        <p className="text-slate-600 text-xs mb-4 max-w-md mx-auto">
          Already uploaded a list for this event? Uploading another CSV is safe — rows with an email that's already registered will have their details updated, not duplicated.
        </p>
        <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-300">
          <span>Browse file</span>
          <input type="file" accept=".csv" onChange={onFileInput} className="hidden" />
        </label>
      </div>

      {parseError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400 mb-4">
          ⚠️ {parseError}
        </div>
      )}

      {mapping.length > 0 && (
        <>
          {/* Column mapping */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 mb-4 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800">
              <span className="text-sm font-medium text-white">Map your columns</span>
              <p className="text-xs text-slate-500 mt-0.5">
                Uncheck a column to leave it out of the import. Rename how it should be labeled, and tell us what it maps to.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase bg-slate-800/50">
                    <th className="text-left px-4 py-2 w-16">Import</th>
                    <th className="text-left px-4 py-2">Original Column</th>
                    <th className="text-left px-4 py-2">Rename To</th>
                    <th className="text-left px-4 py-2">Maps To</th>
                  </tr>
                </thead>
                <tbody>
                  {mapping.map((m) => {
                    const included = m.target !== "ignore";
                    return (
                      <tr key={m.header} className="border-t border-slate-800/50">
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            checked={included}
                            onChange={(e) =>
                              updateMapping(m.header, {
                                target: e.target.checked ? guessTarget(m.header) === "ignore" ? "tag" : guessTarget(m.header) : "ignore",
                              })
                            }
                            className="w-4 h-4 accent-brand-500"
                          />
                        </td>
                        <td className="px-4 py-2 text-slate-400 text-xs font-mono">{m.header}</td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={m.label}
                            disabled={!included}
                            onChange={(e) => updateMapping(m.header, { label: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white disabled:opacity-40 focus:outline-none focus:border-brand-500"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <select
                            value={m.target}
                            disabled={!included}
                            onChange={(e) => updateMapping(m.header, { target: e.target.value as ColumnTarget })}
                            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white disabled:opacity-40 focus:outline-none focus:border-brand-500"
                          >
                            {(["full_name", "email", "phone", "tag"] as ColumnTarget[]).map((t) => (
                              <option key={t} value={t}>{TARGET_LABELS[t]}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {(!hasFullName || !hasEmail) && (
              <div className="px-5 py-3 border-t border-slate-800 bg-yellow-500/10 text-xs text-yellow-400">
                ⚠️ You need at least one column mapped to <strong>Full Name</strong> and one mapped to <strong>Email</strong> to import.
              </div>
            )}
          </div>

          {/* Full scrollable data preview */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 mb-4 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
              <span className="text-sm font-medium text-white">{fileName} · {rawRows.length} rows</span>
              <span className="text-xs text-slate-500">Scroll to see all rows</span>
            </div>
            <div className="overflow-auto max-h-[28rem]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="text-xs text-slate-300 uppercase bg-slate-800">
                    <th className="text-left px-4 py-2 sticky left-0 bg-slate-800">#</th>
                    {includedColumns.map((m) => (
                      <th key={m.header} className="text-left px-4 py-2 whitespace-nowrap">
                        {m.label}
                        <span className="block text-[10px] normal-case text-slate-500 font-normal">
                          {TARGET_LABELS[m.target]}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rawRows.map((row, i) => (
                    <tr key={i} className="border-t border-slate-800/50 hover:bg-slate-800/30">
                      <td className="px-4 py-2 text-slate-600 text-xs sticky left-0 bg-slate-900">{i + 1}</td>
                      {includedColumns.map((m) => (
                        <td key={m.header} className="px-4 py-2 text-slate-300 text-xs whitespace-nowrap">
                          {row[m.header]?.trim() || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Upload button */}
      {mapping.length > 0 && (
        <button
          onClick={handleUpload}
          disabled={!canImport || uploading}
          className="w-full py-3 px-4 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white text-sm font-semibold transition-colors"
        >
          {uploading ? `Importing ${rawRows.length} rows…` : `Import ${rawRows.length || 0} Registrants`}
        </button>
      )}

      {/* Result */}
      {result && (
        <div className="mt-4 bg-slate-900 rounded-xl border border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Upload Complete</h3>
          <div className="flex gap-4 mb-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-400">{result.new_count}</p>
              <p className="text-xs text-slate-500">New</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-400">{result.updated_count}</p>
              <p className="text-xs text-slate-500">Updated</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-400">{result.skipped}</p>
              <p className="text-xs text-slate-500">Skipped</p>
            </div>
          </div>
          {result.updated_count > 0 && (
            <p className="text-xs text-slate-500 mb-2">
              {result.updated_count} row(s) matched an email already registered for this event — their details were refreshed rather than duplicated.
            </p>
          )}          {result.errors.length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-red-400 cursor-pointer">
                {result.errors.length} error(s) — click to expand
              </summary>
              <div className="mt-2 space-y-1">
                {result.errors.map((e, i) => (
                  <div key={i} className="text-xs text-slate-400 font-mono">
                    Row {e.row}: {e.reason}{e.email ? ` — ${e.email}` : ""}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

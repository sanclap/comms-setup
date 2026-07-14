"use client";
import { useState, useCallback, useEffect } from "react";
import Papa from "papaparse";
import type { CsvRow, Template, SendResult } from "@/lib/types";

interface AttachmentState {
  name: string;
  content: string; // base64
  mime_type: string;
  sizeLabel: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // strip the "data:mime;base64," prefix — API wants raw base64
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function BlastPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const [parsedRows, setParsedRows] = useState<CsvRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [parseError, setParseError] = useState("");

  const [attachment, setAttachment] = useState<AttachmentState | null>(null);
  const [attachError, setAttachError] = useState("");
  const [attaching, setAttaching] = useState(false);

  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  interface BlastHistoryItem {
    id: string;
    filename: string | null;
    template_name: string;
    row_count: number;
    sent_count: number;
    failed_count: number;
    created_at: string;
  }
  const [history, setHistory] = useState<BlastHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const loadHistory = () => {
    fetch("/api/send-emails")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setHistory(d));
  };

  useEffect(() => { loadHistory(); }, []);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTemplates(data.filter((t: Template) => t.type === "email"));
      });
  }, []);

  const handleFile = useCallback((file: File) => {
    setParseError("");
    setResult(null);
    setFileName(file.name);

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (results) => {
        const rows = results.data as CsvRow[];
        if (!rows[0]?.full_name && !rows[0]?.email) {
          setParseError("CSV must have columns: full_name, email (and optionally phone)");
          setParsedRows([]);
          return;
        }
        setParsedRows(rows);
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

  const onAttachmentInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachError("");

    if (file.size > 15 * 1024 * 1024) {
      setAttachError("Attachment too large — keep it under 15 MB");
      return;
    }

    setAttaching(true);
    try {
      const content = await fileToBase64(file);
      setAttachment({
        name: file.name,
        content,
        mime_type: file.type || "application/octet-stream",
        sizeLabel: formatSize(file.size),
      });
    } catch {
      setAttachError("Couldn't read that file — try again");
    } finally {
      setAttaching(false);
    }
  };

  const handleSend = async () => {
    if (parsedRows.length === 0 || !selectedTemplate) return;
    setSending(true);
    setResult(null);

    const payload: Record<string, unknown> = {
      rows: parsedRows,
      template_id: selectedTemplate,
      filename: fileName || null,
    };
    if (attachment) {
      payload.attachment = {
        name: attachment.name,
        content: attachment.content,
        mime_type: attachment.mime_type,
      };
    }

    const data = await fetch("/api/send-emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => r.json());

    setResult(data);
    setSending(false);
    loadHistory();
  };

  const previewTemplate = templates.find((t) => t.id === selectedTemplate);

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Quick Blast</h1>
        <p className="text-slate-400 text-sm mt-1">
          Upload a CSV and send straight away — no event required
        </p>
      </div>

      {/* Past blasts — tracked independently of events */}
      {history.length > 0 && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 mb-6 overflow-hidden">
          <button
            onClick={() => setShowHistory((x) => !x)}
            className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-800/30"
          >
            <span className="text-sm font-medium text-white">Past Blasts ({history.length})</span>
            <span className="text-slate-500 text-sm">{showHistory ? "▲" : "▼"}</span>
          </button>
          {showHistory && (
            <div className="border-t border-slate-800 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase bg-slate-800/50">
                    <th className="text-left px-4 py-2">File</th>
                    <th className="text-left px-4 py-2">Template</th>
                    <th className="text-left px-4 py-2">Sent</th>
                    <th className="text-left px-4 py-2">Failed</th>
                    <th className="text-left px-4 py-2">When</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-t border-slate-800/50">
                      <td className="px-4 py-2 text-slate-300">{h.filename || "—"}</td>
                      <td className="px-4 py-2 text-slate-400">{h.template_name}</td>
                      <td className="px-4 py-2 text-green-400">{h.sent_count}</td>
                      <td className="px-4 py-2 text-red-400">{h.failed_count}</td>
                      <td className="px-4 py-2 text-slate-500 text-xs">
                        {new Date(h.created_at).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CSV format hint */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 mb-4">
        <p className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">Expected CSV Format</p>
        <code className="text-xs font-mono text-green-400 bg-slate-800 px-3 py-2 rounded block">
          full_name,email,phone
          <br />
          John Doe,john@example.com,9199999999
          <br />
          Jane Smith,jane@example.com,
        </code>
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
        <p className="text-slate-500 text-xs mb-4">or click to browse</p>
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

      {/* CSV preview */}
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

      {/* Template select */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 mb-4">
        <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
          Email Template *
        </label>
        <select
          value={selectedTemplate}
          onChange={(e) => setSelectedTemplate(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
        >
          <option value="">— Choose template —</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        {templates.length === 0 && (
          <p className="text-xs text-slate-500 mt-2">
            No email templates found. <a href="/templates" className="text-brand-400 underline">Create one first.</a>
          </p>
        )}
        {previewTemplate && (
          <button onClick={() => setShowPreview((x) => !x)} className="text-xs text-brand-400 mt-2 hover:text-brand-300">
            {showPreview ? "Hide" : "Show"} preview
          </button>
        )}
      </div>

      {showPreview && previewTemplate && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 mb-4 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800">
            <span className="text-sm font-medium text-white">Email Preview</span>
          </div>
          <div className="p-4">
            <iframe
              srcDoc={previewTemplate.body}
              className="w-full h-96 bg-white rounded border border-slate-700"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      )}

      {/* Attachment */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 mb-6">
        <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
          Attachment (optional)
        </label>
        {!attachment ? (
          <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-300">
            <span>{attaching ? "Reading file…" : "📎 Attach PDF / file"}</span>
            <input type="file" onChange={onAttachmentInput} className="hidden" disabled={attaching} />
          </label>
        ) : (
          <div className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
            <span className="text-sm text-slate-300 truncate">
              📎 {attachment.name} <span className="text-slate-500 text-xs">({attachment.sizeLabel})</span>
            </span>
            <button onClick={() => setAttachment(null)} className="text-xs text-red-400 hover:text-red-300 ml-3">
              Remove
            </button>
          </div>
        )}
        {attachError && <p className="text-xs text-red-400 mt-2">⚠️ {attachError}</p>}
        <p className="text-xs text-slate-500 mt-2">Attached to every email in this send. Max 15 MB.</p>
      </div>

      {/* Send button */}
      <button
        onClick={handleSend}
        disabled={parsedRows.length === 0 || !selectedTemplate || sending || attaching}
        className="w-full py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white text-sm font-semibold"
      >
        {sending ? `Sending to ${parsedRows.length} recipients…` : `Send Blast to ${parsedRows.length || 0} recipients`}
      </button>

      {/* Result */}
      {result && (
        <div className="mt-4 bg-slate-900 rounded-xl border border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Send Complete</h3>
          <div className="flex gap-4 mb-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-400">{result.sent}</p>
              <p className="text-xs text-slate-500">Sent</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-400">{result.failed}</p>
              <p className="text-xs text-slate-500">Failed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-400">{result.total}</p>
              <p className="text-xs text-slate-500">Total</p>
            </div>
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
      )}
    </div>
  );
}

export interface Event {
  id: string;
  name: string;
  event_date: string;
  event_date_label?: string;
  event_time?: string;
  event_end_time?: string;
  joining_link: string;
  description?: string;
  status: "draft" | "active" | "completed";
  created_at: string;
}

export interface Registrant {
  id: string;
  event_id: string;
  full_name: string;
  email: string;
  phone?: string;
  tags?: string[];
  created_at: string;
}

export interface Template {
  id: string;
  type: "email" | "whatsapp";
  name: string;
  subject?: string;
  body: string;
  created_at: string;
}

export interface MessageLog {
  id: string;
  registrant_id?: string;
  event_id?: string;
  channel: "email" | "whatsapp";
  status: "sent" | "submitted" | "failed" | "pending";
  template_name?: string;
  response?: Record<string, unknown>;
  failure_reason?: string;
  message_id?: string;
  sent_at: string;
  registrants?: { full_name: string; email: string };
}

export interface CsvRow {
  full_name: string;
  email: string;
  phone?: string;
}

// Generic raw CSV row — arbitrary headers as uploaded, before any mapping
export type RawCsvRow = Record<string, string>;

export type ColumnTarget = "full_name" | "email" | "phone" | "tag" | "ignore";

export interface ColumnMapEntry {
  header: string;   // original CSV header
  label: string;    // user-editable display/rename label
  target: ColumnTarget;
}

export interface UploadResult {
  imported: number;
  new_count: number;
  updated_count: number;
  skipped: number;
  errors: Array<{ row: number; reason: string; email?: string }>;
}

export interface SendResult {
  total: number;
  sent: number;
  failed: number;
  errors: Array<{ email: string; reason: string }>;
}

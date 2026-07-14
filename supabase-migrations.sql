-- Run this in your Supabase project's SQL Editor (Database > SQL Editor > New query)
-- before using the new "Link to Event" feature on the Event Bible page.

create table if not exists event_bible (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  type text not null check (type in ('attendance', 'feedback', 'chat')),
  filename text,
  row_count int not null default 0,
  data jsonb not null,
  uploaded_at timestamptz not null default now()
);

-- One saved dataset per (event, type) — re-saving replaces the previous one
create unique index if not exists event_bible_event_type_idx on event_bible(event_id, type);
create index if not exists event_bible_event_id_idx on event_bible(event_id);

-- Tracks Quick Blast CSV uploads independently of any event, so past blasts
-- (who was included, which template, how the send went) can be reviewed later.
create table if not exists blast_uploads (
  id uuid primary key default gen_random_uuid(),
  filename text,
  template_name text not null,
  row_count int not null default 0,
  sent_count int not null default 0,
  failed_count int not null default 0,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists blast_uploads_created_at_idx on blast_uploads(created_at desc);

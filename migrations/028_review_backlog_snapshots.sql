-- Backend-only review backlog observability.
-- No document state, RBAC, assignment, or UI behavior is changed.

create table if not exists public.review_backlog_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null unique,
  captured_at timestamptz not null default now(),
  total_pending integer not null default 0,
  max_age_days integer not null default 0,
  sla_buckets jsonb not null default '{}'::jsonb,
  executive_summary jsonb not null default '[]'::jsonb,
  ownership_anomalies jsonb not null default '[]'::jsonb,
  backlog_anomalies jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.review_backlog_snapshots enable row level security;

comment on table public.review_backlog_snapshots is
  'Daily backend-only snapshots for pending-review aging, executive workload, and assignment integrity.';

create index if not exists review_backlog_snapshots_captured_at_idx
  on public.review_backlog_snapshots (captured_at desc);

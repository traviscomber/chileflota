-- Cronos Health Sentinel: additive, reversible operational observability.
create table if not exists public.system_health_checks (
  id uuid primary key default gen_random_uuid(),
  checked_at timestamptz not null default now(),
  health text not null check (health in ('healthy','degraded','stuck','broken')),
  severity text not null check (severity in ('ok','warning','high','critical')),
  metrics jsonb not null default '{}'::jsonb,
  reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.system_health_checks enable row level security;
create index if not exists system_health_checks_checked_at_idx
  on public.system_health_checks(checked_at desc);

create table if not exists public.system_health_incidents (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null,
  severity text not null check (severity in ('warning','high','critical')),
  status text not null default 'open' check (status in ('open','resolved')),
  title text not null,
  message text not null,
  occurrences integer not null default 1,
  opened_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.system_health_incidents enable row level security;
create unique index if not exists system_health_incidents_open_fingerprint_idx
  on public.system_health_incidents(fingerprint)
  where status='open';
create index if not exists system_health_incidents_last_seen_idx
  on public.system_health_incidents(last_seen_at desc);

create table if not exists public.system_runtime_flags (
  key text primary key,
  enabled boolean not null default false,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.system_runtime_flags enable row level security;

insert into public.system_runtime_flags(key,enabled,reason)
values ('background_processing_paused',false,'Health Sentinel initialized')
on conflict(key) do nothing;

create or replace function public.cronos_health_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog, storage
as $$
declare
  v_max_connections integer;
  v_current_connections integer;
  v_active_connections integer;
  v_blocked_queries integer;
  v_long_queries integer;
  v_database_bytes bigint;
  v_storage_bytes bigint;
  v_stale_runs integer;
begin
  v_max_connections := current_setting('max_connections')::integer;

  select
    count(*) filter (where datname=current_database()),
    count(*) filter (where datname=current_database() and state='active')
  into v_current_connections,v_active_connections
  from pg_stat_activity;

  select count(*)
  into v_blocked_queries
  from pg_stat_activity a
  where a.datname=current_database()
    and cardinality(pg_blocking_pids(a.pid)) > 0;

  select count(*)
  into v_long_queries
  from pg_stat_activity
  where datname=current_database()
    and state='active'
    and pid <> pg_backend_pid()
    and query_start < now() - interval '30 seconds';

  v_database_bytes := pg_database_size(current_database());

  select coalesce(sum(
    case when (metadata->>'size') ~ '^[0-9]+$' then (metadata->>'size')::bigint else 0 end
  ),0)
  into v_storage_bytes
  from storage.objects;

  select count(*)
  into v_stale_runs
  from public.system_job_runs
  where status='running'
    and started_at < now() - interval '30 minutes';

  return jsonb_build_object(
    'captured_at', now(),
    'max_connections', v_max_connections,
    'current_connections', v_current_connections,
    'active_connections', v_active_connections,
    'connection_ratio', case when v_max_connections > 0 then v_current_connections::numeric / v_max_connections else 0 end,
    'blocked_queries', v_blocked_queries,
    'long_queries_30s', v_long_queries,
    'database_bytes', v_database_bytes,
    'object_storage_bytes', v_storage_bytes,
    'stale_system_job_runs', v_stale_runs
  );
end;
$$;

revoke all on function public.cronos_health_snapshot() from public, anon, authenticated;
grant execute on function public.cronos_health_snapshot() to service_role;

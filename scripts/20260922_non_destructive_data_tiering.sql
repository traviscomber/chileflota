-- Non-destructive data tiering foundation for ChileFlota.
-- This migration does not delete, rewrite, deduplicate or move canonical data.
-- It adds query surfaces and an archive manifest so cold data can be exported
-- and verified before any future retirement decision.

create table if not exists public.data_archive_manifests (
  id uuid primary key default gen_random_uuid(),
  dataset text not null,
  partition_key text not null,
  source_table text not null,
  source_row_count bigint not null default 0,
  source_min_id bigint,
  source_max_id bigint,
  source_checksum text,
  storage_bucket text,
  storage_path text,
  storage_bytes bigint,
  archive_checksum text,
  status text not null default 'planned'
    check (status in ('planned','exporting','exported','verified','retired','failed')),
  verified_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(dataset, partition_key)
);

alter table public.data_archive_manifests enable row level security;

create index if not exists data_archive_manifests_status_idx
  on public.data_archive_manifests(status, dataset);

comment on table public.data_archive_manifests is
  'Non-destructive archive control plane. Source data is retained until an exported partition is independently verified.';

create or replace view public.prt_vehicle_current as
select distinct on (r.plate_normalized)
  r.id,
  r.batch_id,
  r.plate,
  r.plate_normalized,
  r.record_type,
  r.inspection_date,
  r.expiration_date,
  r.result_code,
  r.result_label,
  r.station_code,
  r.station_name,
  r.region_code,
  r.vehicle_class,
  r.certificate_number,
  r.source_period,
  r.created_at
from public.prt_vehicle_records r
order by
  r.plate_normalized,
  r.inspection_date desc nulls last,
  r.expiration_date desc nulls last,
  r.id desc;

comment on view public.prt_vehicle_current is
  'Current PRT lookup surface: one latest record per normalized plate. Historical evidence remains in prt_vehicle_records.';

create or replace view public.prt_vehicle_history_catalog as
select
  b.id as batch_id,
  b.period,
  b.record_type,
  b.status as batch_status,
  b.source_url,
  b.source_hash,
  b.source_size_bytes,
  b.rows_read,
  b.rows_valid,
  b.rows_rejected,
  b.rows_duplicates,
  count(r.id)::bigint as stored_records,
  min(r.id) as min_record_id,
  max(r.id) as max_record_id,
  min(r.inspection_date) as min_inspection_date,
  max(r.inspection_date) as max_inspection_date,
  min(r.expiration_date) as min_expiration_date,
  max(r.expiration_date) as max_expiration_date,
  min(r.created_at) as first_stored_at,
  max(r.created_at) as last_stored_at
from public.prt_import_batches b
left join public.prt_vehicle_records r on r.batch_id = b.id
group by
  b.id,b.period,b.record_type,b.status,b.source_url,b.source_hash,b.source_size_bytes,
  b.rows_read,b.rows_valid,b.rows_rejected,b.rows_duplicates;

comment on view public.prt_vehicle_history_catalog is
  'Query catalog for complete PRT history grouped by source batch. Does not remove or alter source evidence.';

create or replace view public.system_job_runs_recent as
select *
from public.system_job_runs
where started_at >= now() - interval '30 days';

comment on view public.system_job_runs_recent is
  'Hot operational query surface for recent system jobs; full telemetry remains in system_job_runs.';

-- ChileFlota / GTrack integration foundation
-- DRAFT ONLY: commit this schema before applying it to production.
-- Provider secrets remain in server environment variables and are never stored here.

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  transportista_id uuid not null references public.transportistas(id) on delete cascade,
  provider text not null,
  status text not null default 'inactive' check (status in ('inactive', 'active', 'error', 'disabled')),
  last_sync_at timestamptz,
  last_error_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (transportista_id, provider)
);

create table if not exists public.external_vehicle_links (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections(id) on delete cascade,
  vehiculo_id uuid not null references public.vehiculos(id) on delete cascade,
  external_vehicle_id text not null,
  external_device_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, external_vehicle_id),
  unique (connection_id, vehiculo_id)
);

create table if not exists public.vehicle_positions (
  id bigint generated always as identity primary key,
  connection_id uuid not null references public.integration_connections(id) on delete cascade,
  vehiculo_id uuid not null references public.vehiculos(id) on delete cascade,
  external_position_id text,
  recorded_at timestamptz not null,
  received_at timestamptz not null default now(),
  latitude numeric(9,6) not null check (latitude between -90 and 90),
  longitude numeric(9,6) not null check (longitude between -180 and 180),
  speed numeric(10,3) check (speed is null or speed >= 0),
  heading numeric(6,3) check (heading is null or (heading >= 0 and heading < 360)),
  raw_payload jsonb
);

create table if not exists public.integration_events (
  id bigint generated always as identity primary key,
  connection_id uuid not null references public.integration_connections(id) on delete cascade,
  vehiculo_id uuid references public.vehiculos(id) on delete set null,
  external_event_id text,
  event_type text not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_external_vehicle_links_vehiculo
  on public.external_vehicle_links (vehiculo_id);

create index if not exists idx_vehicle_positions_vehicle_time
  on public.vehicle_positions (vehiculo_id, recorded_at desc);

create index if not exists idx_vehicle_positions_connection_time
  on public.vehicle_positions (connection_id, recorded_at desc);

create unique index if not exists uq_vehicle_positions_external_id
  on public.vehicle_positions (connection_id, external_position_id)
  where external_position_id is not null;

create index if not exists idx_integration_events_vehicle_time
  on public.integration_events (vehiculo_id, occurred_at desc)
  where vehiculo_id is not null;

create index if not exists idx_integration_events_connection_time
  on public.integration_events (connection_id, occurred_at desc);

create unique index if not exists uq_integration_events_external_id
  on public.integration_events (connection_id, external_event_id)
  where external_event_id is not null;

alter table public.integration_connections enable row level security;
alter table public.external_vehicle_links enable row level security;
alter table public.vehicle_positions enable row level security;
alter table public.integration_events enable row level security;

comment on table public.integration_connections is
  'Configured external integrations per transportista. Secrets are stored only in server environment variables.';
comment on table public.external_vehicle_links is
  'Maps external provider vehicle identifiers to canonical ChileFlota vehiculos.';
comment on table public.vehicle_positions is
  'Normalized telematics positions derived from external providers; not canonical vehicle identity.';
comment on table public.integration_events is
  'Immutable-ish provider event evidence used for normalization, reconciliation, and alert generation.';

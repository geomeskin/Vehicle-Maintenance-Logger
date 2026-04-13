-- ============================================================
-- Vehicle Maintenance Logger — Initial Schema
-- Migration: 001_initial_schema.sql
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- VEHICLES
-- ============================================================
create table vehicles (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,              -- e.g. "Blue Truck", "Wife's Car"
  make             text,                       -- e.g. "Ford"
  model            text,                       -- e.g. "F-150"
  year             int,
  vin              text,
  license_plate    text,
  current_mileage  int default 0,
  color            text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ============================================================
-- RAW VOICE LOGS
-- Archive every transcript before parsing — lets you re-parse
-- if the Claude prompt improves or a parse fails.
-- ============================================================
create table raw_voice_logs (
  id              uuid primary key default gen_random_uuid(),
  vehicle_id      uuid references vehicles(id) on delete cascade,
  transcript      text not null,              -- raw Whisper output
  parsed_json     jsonb,                      -- what Claude returned
  parse_status    text not null default 'pending'
                  check (parse_status in ('pending','success','failed','corrected')),
  log_type        text,                       -- 'maintenance' | 'fuel' | 'unknown'
  error_message   text,                       -- if parse_status = 'failed'
  created_at      timestamptz not null default now()
);

-- ============================================================
-- MAINTENANCE LOGS
-- Oil changes, tire rotations, repairs, inspections, fluids —
-- anything that isn't a fuel fill-up lives here.
-- ============================================================
create table maintenance_logs (
  id              uuid primary key default gen_random_uuid(),
  vehicle_id      uuid not null references vehicles(id) on delete cascade,
  raw_log_id      uuid references raw_voice_logs(id) on delete set null,

  -- What was done
  category        text not null,              -- 'oil_change' | 'tires' | 'brakes' | 'repair' | 'fluid' | 'inspection' | 'other'
  description     text not null,
  parts_replaced  text[],                     -- array of part names
  notes           text,

  -- When / where
  mileage         int,
  logged_at       timestamptz not null default now(),
  shop_name       text,
  location        text,                       -- free text: "Firestone on 45" or GPS coords

  -- Cost
  cost            numeric(10,2),
  labor_cost      numeric(10,2),
  parts_cost      numeric(10,2),

  -- Next service reminder (optional, for future feature)
  next_service_mileage  int,
  next_service_date     date,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- FUEL LOGS
-- Separate table to enable MPG calculations and cost-per-mile
-- trend analysis without polluting maintenance data.
-- ============================================================
create table fuel_logs (
  id               uuid primary key default gen_random_uuid(),
  vehicle_id       uuid not null references vehicles(id) on delete cascade,
  raw_log_id       uuid references raw_voice_logs(id) on delete set null,

  -- Fuel data
  gallons          numeric(8,3),
  price_per_gallon numeric(6,3),
  total_cost       numeric(8,2),
  fuel_grade       text,                      -- 'regular' | 'mid' | 'premium' | 'diesel'
  full_tank        boolean default true,

  -- Mileage (for MPG calculation)
  mileage          int,                       -- odometer reading at fill-up
  miles_since_last int,                       -- calculated or stated

  -- Where
  station_name     text,
  location         text,

  notes            text,
  logged_at        timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_maintenance_vehicle_id  on maintenance_logs(vehicle_id);
create index idx_maintenance_logged_at   on maintenance_logs(logged_at desc);
create index idx_maintenance_category    on maintenance_logs(category);
create index idx_maintenance_mileage     on maintenance_logs(mileage);

create index idx_fuel_vehicle_id         on fuel_logs(vehicle_id);
create index idx_fuel_logged_at          on fuel_logs(logged_at desc);
create index idx_fuel_mileage            on fuel_logs(mileage);

create index idx_raw_logs_vehicle_id     on raw_voice_logs(vehicle_id);
create index idx_raw_logs_status         on raw_voice_logs(parse_status);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger vehicles_updated_at
  before update on vehicles
  for each row execute function update_updated_at();

create trigger maintenance_updated_at
  before update on maintenance_logs
  for each row execute function update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- Personal use: all rows owned by authenticated user.
-- Structured for future multi-user expansion.
-- ============================================================
alter table vehicles          enable row level security;
alter table raw_voice_logs    enable row level security;
alter table maintenance_logs  enable row level security;
alter table fuel_logs         enable row level security;

-- Vehicles: authenticated users can read/write their own rows
-- For personal use, we allow all authenticated access.
-- Swap auth.uid() = owner_id when you add multi-user support.
create policy "authenticated_all_vehicles"
  on vehicles for all to authenticated
  using (true) with check (true);

create policy "authenticated_all_raw_logs"
  on raw_voice_logs for all to authenticated
  using (true) with check (true);

create policy "authenticated_all_maintenance"
  on maintenance_logs for all to authenticated
  using (true) with check (true);

create policy "authenticated_all_fuel"
  on fuel_logs for all to authenticated
  using (true) with check (true);

-- ============================================================
-- SEED DATA — your 2 vehicles (update to match yours)
-- ============================================================
insert into vehicles (name, make, model, year, current_mileage) values
  ('Vehicle 1', 'Make', 'Model', 2020, 0),
  ('Vehicle 2', 'Make', 'Model', 2020, 0);

-- ============================================================
-- USEFUL VIEWS (optional, for future dashboard queries)
-- ============================================================

-- Latest entry per vehicle per category
create view latest_maintenance_per_category as
select distinct on (vehicle_id, category)
  vehicle_id,
  category,
  description,
  mileage,
  cost,
  logged_at
from maintenance_logs
order by vehicle_id, category, logged_at desc;

-- Fuel economy per fill-up
create view fuel_economy as
select
  f.id,
  f.vehicle_id,
  v.name as vehicle_name,
  f.logged_at,
  f.mileage,
  f.gallons,
  f.total_cost,
  f.miles_since_last,
  case
    when f.gallons > 0 and f.miles_since_last > 0
    then round((f.miles_since_last / f.gallons)::numeric, 1)
    else null
  end as mpg
from fuel_logs f
join vehicles v on v.id = f.vehicle_id
order by f.logged_at desc;

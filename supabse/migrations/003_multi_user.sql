-- ============================================================
-- Migration: 003_multi_user.sql
-- Adds owner_id to vehicles + tightens RLS for multi-user support
-- ============================================================

-- 1. Add owner_id to vehicles
alter table vehicles
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;

-- 2. Backfill existing vehicles to the first user (you)
--    Run this AFTER applying the migration, with your actual user UUID.
--    Find it in Supabase → Authentication → Users
    UPDATE vehicles SET owner_id = '7348833e-7c37-4264-9fe2-f0e800720e79' WHERE owner_id IS NULL;

-- 3. Make owner_id required going forward
--alter table vehicles
--  alter column owner_id set not null;
-- NOTE: Run step 2 before step 3 if you have existing vehicles, or combine:
-- alter table vehicles alter column owner_id set not null; will fail if nulls exist.
-- Safe order: backfill first, then add not null.

-- ============================================================
-- DROP old open policies
-- ============================================================
drop policy if exists "authenticated_all_vehicles"    on vehicles;
drop policy if exists "authenticated_all_raw_logs"    on raw_voice_logs;
drop policy if exists "authenticated_all_maintenance" on maintenance_logs;
drop policy if exists "authenticated_all_fuel"        on fuel_logs;

-- ============================================================
-- NEW RLS POLICIES — owner-scoped
-- ============================================================

-- Vehicles: only the owner can see/edit their vehicles
create policy "owner_vehicles"
  on vehicles for all to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Raw voice logs: scoped through vehicle ownership
create policy "owner_raw_logs"
  on raw_voice_logs for all to authenticated
  using (
    vehicle_id in (
      select id from vehicles where owner_id = auth.uid()
    )
  )
  with check (
    vehicle_id in (
      select id from vehicles where owner_id = auth.uid()
    )
  );

-- Maintenance logs: scoped through vehicle ownership
create policy "owner_maintenance"
  on maintenance_logs for all to authenticated
  using (
    vehicle_id in (
      select id from vehicles where owner_id = auth.uid()
    )
  )
  with check (
    vehicle_id in (
      select id from vehicles where owner_id = auth.uid()
    )
  );

-- Fuel logs: scoped through vehicle ownership
create policy "owner_fuel"
  on fuel_logs for all to authenticated
  using (
    vehicle_id in (
      select id from vehicles where owner_id = auth.uid()
    )
  )
  with check (
    vehicle_id in (
      select id from vehicles where owner_id = auth.uid()
    )
  );

-- ============================================================
-- Index on owner_id for fast per-user vehicle lookups
-- ============================================================
create index if not exists idx_vehicles_owner_id on vehicles(owner_id);

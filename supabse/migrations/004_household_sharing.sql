-- ============================================================
-- Migration: 004_household_sharing.sql
-- Widens RLS from owner-only (003) to household-wide: any
-- household member can see and log against any vehicle,
-- regardless of who owns it. Two known users for now (Alex,
-- Leanne) — add more UUIDs to the function below as needed.
-- ============================================================

create or replace function is_household_member(uid uuid)
returns boolean
language sql
stable
as $$
  select uid in (
    '7348833e-7c37-4264-9fe2-f0e800720e79',  -- Alex
    'ac9ba2c6-3880-485c-93c5-d22414f74ac7'   -- Leanne
  );
$$;

-- ============================================================
-- DROP owner-only policies from 003
-- ============================================================
drop policy if exists "owner_vehicles"    on vehicles;
drop policy if exists "owner_raw_logs"    on raw_voice_logs;
drop policy if exists "owner_maintenance" on maintenance_logs;
drop policy if exists "owner_fuel"        on fuel_logs;

-- ============================================================
-- NEW RLS POLICIES — household-scoped
-- owner_id is kept on vehicles (still records who added it /
-- powers the "★ DEFAULT" picker), it just no longer gates access.
-- ============================================================

create policy "household_vehicles"
  on vehicles for all to authenticated
  using (is_household_member(auth.uid()))
  with check (is_household_member(auth.uid()));

create policy "household_raw_logs"
  on raw_voice_logs for all to authenticated
  using (is_household_member(auth.uid()))
  with check (is_household_member(auth.uid()));

create policy "household_maintenance"
  on maintenance_logs for all to authenticated
  using (is_household_member(auth.uid()))
  with check (is_household_member(auth.uid()));

create policy "household_fuel"
  on fuel_logs for all to authenticated
  using (is_household_member(auth.uid()))
  with check (is_household_member(auth.uid()));

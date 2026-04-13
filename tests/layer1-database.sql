-- ============================================================
-- LAYER 1: Database Tests
-- Paste each section into Supabase SQL Editor and run.
-- Every query should return the expected result noted above it.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- TEST 1.1: Tables exist
-- Expected: 4 rows — vehicles, raw_voice_logs, maintenance_logs, fuel_logs
-- ────────────────────────────────────────────────────────────
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('vehicles','raw_voice_logs','maintenance_logs','fuel_logs')
order by table_name;


-- ────────────────────────────────────────────────────────────
-- TEST 1.2: Seed vehicles exist
-- Expected: 2 rows
-- ────────────────────────────────────────────────────────────
select id, name, make, model, year, current_mileage
from vehicles
order by created_at;


-- ────────────────────────────────────────────────────────────
-- TEST 1.3: Indexes exist
-- Expected: 8 rows (all the idx_* indexes)
-- ────────────────────────────────────────────────────────────
select indexname, tablename
from pg_indexes
where schemaname = 'public'
  and indexname like 'idx_%'
order by tablename, indexname;


-- ────────────────────────────────────────────────────────────
-- TEST 1.4: RLS is enabled on all tables
-- Expected: 4 rows, all with rowsecurity = true
-- ────────────────────────────────────────────────────────────
select relname as table_name, relrowsecurity as rowsecurity
from pg_class
where relname in ('vehicles','raw_voice_logs','maintenance_logs','fuel_logs')
order by relname;


-- ────────────────────────────────────────────────────────────
-- TEST 1.5: RLS policies exist
-- Expected: 4 rows (one policy per table)
-- ────────────────────────────────────────────────────────────
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename;


-- ────────────────────────────────────────────────────────────
-- TEST 1.6: RPC function exists
-- Expected: 1 row — update_vehicle_mileage_if_higher
-- ────────────────────────────────────────────────────────────
select routine_name, routine_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'update_vehicle_mileage_if_higher';


-- ────────────────────────────────────────────────────────────
-- TEST 1.7: Views exist
-- Expected: 2 rows — fuel_economy, latest_maintenance_per_category
-- ────────────────────────────────────────────────────────────
select table_name as view_name
from information_schema.views
where table_schema = 'public'
order by table_name;


-- ────────────────────────────────────────────────────────────
-- TEST 1.8: Insert a maintenance log and verify cascade
-- Expected: inserts succeed, mileage RPC updates vehicle
-- ────────────────────────────────────────────────────────────

-- Step A: grab a vehicle id
-- (replace the id below with your actual vehicle id from TEST 1.2)
do $$
declare
  v_id uuid;
  r_id uuid;
  m_id uuid;
begin
  select id into v_id from vehicles limit 1;

  -- Insert raw log
  insert into raw_voice_logs (vehicle_id, transcript, parse_status)
  values (v_id, 'TEST: oil change at 50000 miles', 'success')
  returning id into r_id;

  -- Insert maintenance log
  insert into maintenance_logs (vehicle_id, raw_log_id, category, description, mileage, cost)
  values (v_id, r_id, 'oil_change', 'TEST oil change', 50000, 89.99)
  returning id into m_id;

  -- Run the mileage RPC
  perform update_vehicle_mileage_if_higher(v_id, 50000);

  raise notice 'Test 1.8 passed — raw_log_id: %, maintenance_log_id: %', r_id, m_id;
end $$;

-- Verify the vehicle mileage was updated
select name, current_mileage from vehicles order by created_at limit 1;
-- Expected: current_mileage = 50000


-- ────────────────────────────────────────────────────────────
-- TEST 1.9: RPC does NOT roll back mileage
-- Expected: current_mileage stays at 50000 (ignores lower value)
-- ────────────────────────────────────────────────────────────
do $$
declare v_id uuid;
begin
  select id into v_id from vehicles limit 1;
  perform update_vehicle_mileage_if_higher(v_id, 30000); -- lower mileage
end $$;

select name, current_mileage from vehicles order by created_at limit 1;
-- Expected: current_mileage still 50000


-- ────────────────────────────────────────────────────────────
-- TEST 1.10: Insert fuel log and verify views
-- ────────────────────────────────────────────────────────────
do $$
declare v_id uuid;
begin
  select id into v_id from vehicles limit 1;
  insert into fuel_logs (vehicle_id, gallons, price_per_gallon, total_cost, mileage, miles_since_last, full_tank)
  values (v_id, 15.234, 3.459, 52.67, 50312, 312, true);
end $$;

-- Check fuel_economy view
select vehicle_name, mileage, gallons, miles_since_last, mpg
from fuel_economy
limit 5;
-- Expected: 1 row with mpg ~20.5


-- ────────────────────────────────────────────────────────────
-- CLEANUP: Remove test data
-- Run this after all tests pass to keep your DB clean
-- ────────────────────────────────────────────────────────────
delete from maintenance_logs where description like 'TEST%';
delete from raw_voice_logs where transcript like 'TEST%';
delete from fuel_logs where total_cost = 52.67;
update vehicles set current_mileage = 0 where current_mileage in (50000, 50312);

select 'Cleanup complete' as status;

-- ============================================================
-- Migration: 002_rpc_functions.sql
-- Helper RPC functions called from serverless API routes
-- ============================================================

-- update_vehicle_mileage_if_higher
-- Called after every maintenance or fuel log save.
-- Only updates current_mileage if the new reading is higher,
-- preventing stale/out-of-order logs from rolling back the odometer.
create or replace function update_vehicle_mileage_if_higher(
  p_vehicle_id uuid,
  p_mileage    int
)
returns void
language plpgsql
security definer  -- runs with owner privileges (bypasses RLS from API)
as $$
begin
  update vehicles
  set current_mileage = p_mileage,
      updated_at      = now()
  where id = p_vehicle_id
    and p_mileage > coalesce(current_mileage, 0);
end;
$$;

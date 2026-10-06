-- ============================================================
-- Migration: 008_mileage_rpc_invoker.sql
-- Tightens update_vehicle_mileage_if_higher (002).
--
-- 002 made it SECURITY DEFINER, so it ran with owner privileges
-- and skipped RLS entirely. Combined with Postgres' default
-- EXECUTE-to-PUBLIC, any caller, including anon, could raise
-- current_mileage on any vehicle whose UUID they knew.
--
-- The definer was never needed. Callers are either a logged-in
-- household member (api/logs/quick.js, api/logs/[id].js), whom
-- the household_vehicles policy from 004 already allows to update
-- vehicles, or the service role (api/parse-log.js), which bypasses
-- RLS anyway. Switching to SECURITY INVOKER lets those existing
-- permissions decide. A non-member now updates 0 rows silently,
-- the same no-op the function already returns for a lower reading.
--
-- Also pins search_path (Security Advisor "function_search_path_
-- mutable") and replaces the PUBLIC execute grant with explicit
-- grants to the two roles that actually call it.
-- ============================================================

alter function public.update_vehicle_mileage_if_higher(uuid, int)
  security invoker
  set search_path = public;

revoke execute on function public.update_vehicle_mileage_if_higher(uuid, int) from public, anon;
grant  execute on function public.update_vehicle_mileage_if_higher(uuid, int) to authenticated, service_role;

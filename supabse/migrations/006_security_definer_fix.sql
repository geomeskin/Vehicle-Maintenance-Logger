-- ============================================================
-- Migration: 006_security_definer_fix.sql
-- Fixes 2 Supabase Security Advisor findings: both views were
-- defined without security_invoker, meaning they ran with the
-- view creator's permissions and bypassed the RLS policies on
-- their underlying tables (household_maintenance / household_fuel
-- from 004) rather than respecting the querying user's access.
--
-- Low real-world impact here since household RLS already grants
-- both users full access to the underlying tables, but fixed for
-- correctness. Applied live via SQL Editor on 2026-09-23.
-- ============================================================

alter view public.latest_maintenance_per_category set (security_invoker = on);
alter view public.fuel_economy                    set (security_invoker = on);

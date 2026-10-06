-- ============================================================
-- Migration: 005_grants.sql
-- Explicit Data API grants for existing tables.
--
-- Supabase currently auto-grants Data API access to new public
-- tables, but stops doing so from 2026-10-30. Existing tables
-- keep their current access regardless, but a `supabase db reset`
-- or preview branch replays every migration from scratch — and
-- 001-004 never issued an explicit GRANT, only RLS policies.
-- This migration makes that grant explicit so a full replay
-- after the cutoff still leaves these tables API-reachable.
--
-- service_role needs the same grants: api/parse-log.js (voice
-- logging) connects with the service-role key, and BYPASSRLS
-- skips policies but not table privileges.
-- ============================================================

grant select, insert, update, delete on table public.vehicles          to authenticated, service_role;
grant select, insert, update, delete on table public.raw_voice_logs    to authenticated, service_role;
grant select, insert, update, delete on table public.maintenance_logs  to authenticated, service_role;
grant select, insert, update, delete on table public.fuel_logs         to authenticated, service_role;

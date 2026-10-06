-- ============================================================
-- Migration: 007_keepalive.sql
-- One-row heartbeat table for the GitHub keep-alive workflow.
--
-- The workflow's anon read of `vehicles` returned 200 [] on every
-- run (RLS filters everything out for anon), yet Supabase still
-- paused the project for inactivity on 2026-09-30, 4 days after a
-- successful ping. An empty RLS-filtered read evidently doesn't
-- count as activity, so the workflow now WRITES instead: it
-- updates pinged_at on this table's single row.
--
-- Anon is limited to exactly that: see/update row id=1's
-- pinged_at. No insert, no delete, no other columns, no other
-- tables. Grants are explicit (not Supabase's auto-grant) so a
-- replay after the 2026-10-30 cutoff behaves the same - see 005.
-- ============================================================

create table if not exists public.keepalive (
  id        smallint    primary key check (id = 1),
  pinged_at timestamptz not null default now()
);

insert into public.keepalive (id) values (1)
on conflict (id) do nothing;

alter table public.keepalive enable row level security;

-- UPDATE ... WHERE id = 1 needs SELECT visibility of the row too,
-- and PostgREST's return=representation reads it back.
create policy "anon can read keepalive row"
  on public.keepalive for select to anon
  using (id = 1);

create policy "anon can touch keepalive row"
  on public.keepalive for update to anon
  using (id = 1) with check (id = 1);

-- Replace whatever Supabase auto-granted with the minimum needed.
revoke all on table public.keepalive from anon, authenticated;
grant select on table public.keepalive to anon;
grant update (pinged_at) on table public.keepalive to anon;

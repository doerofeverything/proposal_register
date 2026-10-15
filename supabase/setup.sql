-- Flowdesk: run this entire file in the Supabase SQL Editor.
-- Creates an empty shared register. Does not import browser or historical data.
-- Quoted camelCase columns match the existing TypeScript Proposal interface.
-- Access is restricted to users explicitly added to register_members below.
-- RLS reference: https://supabase.com/docs/guides/database/postgres/row-level-security

begin;

create table if not exists public.register_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (length(trim(username)) > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.proposals (
  "number" text primary key,
  "baseId" text not null,
  "projectCode" text not null,
  "effluentCode" text not null,
  fy text not null check (fy ~ '^[0-9]{2}$'),
  "sequence" integer not null check ("sequence" >= 1),
  revision integer not null default 0 check (revision between 0 and 99),
  project text not null check (length(trim(project)) > 0),
  effluent text not null check (effluent in ('Raw water', 'Sewage', 'Effluent', 'Other')),
  flow numeric check (flow is null or flow >= 0),
  price numeric check (price is null or price >= 0),
  gp numeric,
  "proposalType" text not null check ("proposalType" in ('New', 'Revised')),
  date date not null,
  "createdAt" timestamptz not null default now(),
  location text not null default 'Sri Lanka',
  "requestedBy" text not null default '',
  "flowRaw" text,
  "priceRaw" text,
  "gpRaw" text,
  "sourceEffluentType" text,
  "originalProposalNumber" text,
  "referenceProposalNumber" text,
  "originalProposalType" text,
  "referenceProposalType" text,
  "sourceRow" text,
  "sourceIndex" text,
  unique ("baseId", revision),
  check (
    (revision = 0 and "proposalType" = 'New') or
    (revision > 0 and "proposalType" = 'Revised')
  )
);

create index if not exists proposals_created_at_idx
  on public.proposals ("createdAt" desc);

create index if not exists proposals_financial_year_sequence_idx
  on public.proposals (fy, "sequence");

create table if not exists public.register_settings (
  id boolean primary key default true check (id = true),
  fy text not null default '27' check (fy ~ '^[0-9]{2}$'),
  "next" integer not null default 1 check ("next" >= 1)
);

-- Re-running setup preserves saved settings and records.
insert into public.register_settings (id, fy, "next")
values (true, '27', 1)
on conflict (id) do nothing;

alter table public.register_members enable row level security;
alter table public.proposals enable row level security;
alter table public.register_settings enable row level security;

-- Remove default API grants; explicitly grant only supported operations.
revoke all on public.register_members from anon, authenticated;
revoke all on public.proposals from anon, authenticated;
revoke all on public.register_settings from anon, authenticated;

grant usage on schema public to authenticated;
grant select on public.register_members to authenticated;
grant select on public.proposals to authenticated;
grant select on public.register_settings to authenticated;
grant all on public.register_members, public.proposals, public.register_settings to service_role;

-- Membership can only be managed through the SQL Editor or trusted admin code.
drop policy if exists "Members can read their own membership" on public.register_members;
create policy "Members can read their own membership"
on public.register_members for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Members can read proposal history" on public.proposals;
create policy "Members can read proposal history"
on public.proposals for select to authenticated
using (
  exists (
    select 1 from public.register_members
    where user_id = (select auth.uid())
  )
);

-- All writes are performed by membership-checked functions in cloud-storage.sql.
-- Remove old direct-write policies if upgrading an earlier setup.
drop policy if exists "Members can insert proposals" on public.proposals;

drop policy if exists "Members can read numbering settings" on public.register_settings;
create policy "Members can read numbering settings"
on public.register_settings for select to authenticated
using (
  exists (
    select 1 from public.register_members
    where user_id = (select auth.uid())
  )
);

drop policy if exists "Members can update numbering settings" on public.register_settings;

commit;

-- NEXT: Create your login in Supabase Authentication > Users > Add user.
-- Use an email and password there; do not insert passwords into public tables.
-- Then replace the email below, uncomment this block, and run it separately:
--
-- insert into public.register_members (user_id, username)
-- select id, 'admin'
-- from auth.users
-- where lower(email) = lower('YOUR_EMAIL_HERE')
-- on conflict (user_id) do update set username = excluded.username;
--
-- select user_id, username from public.register_members;
--
-- Next run cloud-storage.sql for shared options and transactional writes,
-- then seed.sql to import all 152 historical records and advance numbering.

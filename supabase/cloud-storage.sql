-- Run AFTER setup.sql. Safe to rerun; never deletes proposal records.
-- All writes go through membership-checked transactions. This prevents callers
-- from bypassing numbering locks with direct table inserts/updates.
begin;

create table if not exists public.register_options (
  category text not null check (category in ('effluent', 'location')),
  label text not null check (length(trim(label)) > 0),
  sort_order integer not null default 0,
  primary key (category, label)
);

insert into public.register_options (category, label, sort_order) values
  ('effluent', 'Raw water', 0), ('effluent', 'Sewage', 1),
  ('effluent', 'Effluent', 2), ('effluent', 'Other', 3),
  ('location', 'Sri Lanka', 0), ('location', 'Maldives', 1),
  ('location', 'Africa', 2)
on conflict do nothing;

alter table public.register_options enable row level security;
revoke all on public.register_options from anon, authenticated;
grant select on public.register_options to authenticated;
grant all on public.register_options, public.proposals, public.register_settings,
  public.register_members to service_role;

drop policy if exists "Members can read form options" on public.register_options;
create policy "Members can read form options"
on public.register_options for select to authenticated
using (exists (select 1 from public.register_members where user_id = (select auth.uid())));

revoke insert, update, delete on public.proposals from authenticated;
revoke insert, update, delete on public.register_settings from authenticated;

-- This helper is callable only by the owner of the transaction functions.
create or replace function public.flowdesk_require_member()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.register_members where user_id = auth.uid()
  ) then
    raise exception 'Workspace membership is required.' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.flowdesk_require_member() from public, anon, authenticated;

create or replace function public.flowdesk_create_proposal(p_input jsonb, p_base_id text default null)
returns public.proposals language plpgsql security definer set search_path = '' as $$
declare
  settings public.register_settings;
  previous public.proposals;
  saved public.proposals;
  project_name text := trim(p_input->>'project');
  treatment text := p_input->>'effluent';
  project_code text;
  treatment_code text;
  financial_year text;
  project_sequence integer;
  revision_number integer;
  base_id text;
  proposal_number text;
begin
  perform public.flowdesk_require_member();
  select * into settings from public.register_settings where id = true for update;
  if not found then raise exception 'Numbering settings are missing. Run setup.sql.'; end if;
  if project_name is null or length(project_name) = 0 or length(project_name) > 200
    or not (p_input ?& array['flow', 'price', 'gp', 'date'])
    or nullif(p_input->>'date', '') is null
    or (p_input->>'flow')::numeric is null or (p_input->>'flow')::numeric <= 0
    or (p_input->>'price')::numeric is null or (p_input->>'price')::numeric < 0
    or (p_input->>'gp')::numeric is null
    or lower(p_input->>'flow') in ('nan', 'infinity', '-infinity')
    or lower(p_input->>'price') in ('nan', 'infinity', '-infinity')
    or lower(p_input->>'gp') in ('nan', 'infinity', '-infinity') then
    raise exception 'Complete all required fields with valid numeric values.';
  end if;
  if not exists (select 1 from public.register_options where category = 'effluent' and label = treatment)
    or not exists (select 1 from public.register_options where category = 'location' and label = p_input->>'location') then
    raise exception 'Choose a treatment type and location from the database options.';
  end if;

  if p_base_id is null then
    select rpad(left(coalesce(string_agg(left(word, 1), '' order by ord), ''), 3), 3, 'X')
      into project_code
      from regexp_split_to_table(upper(project_name), '[^A-Z0-9]+') with ordinality as words(word, ord)
      where word <> '';
    treatment_code := rpad(left(regexp_replace(upper(treatment), '[^A-Z]', '', 'g'), 3), 3, 'X');
    financial_year := settings.fy;
    select greatest(settings."next", coalesce(max("sequence") + 1, 1)) into project_sequence
      from public.proposals where fy = financial_year;
    revision_number := 0;
    base_id := gen_random_uuid()::text;
  else
    select * into previous from public.proposals where "baseId" = p_base_id order by revision desc limit 1;
    if not found then raise exception 'The original project no longer exists. Refresh the register.'; end if;
    project_code := previous."projectCode";
    treatment_code := previous."effluentCode";
    financial_year := previous.fy;
    project_sequence := previous."sequence";
    revision_number := previous.revision + 1;
    base_id := previous."baseId";
    if revision_number > 99 then raise exception 'Maximum revision 99 reached for this project.'; end if;
  end if;

  proposal_number := format('PP/%s/%s/%s/%s/%s', project_code, treatment_code, financial_year,
    lpad(project_sequence::text, greatest(2, length(project_sequence::text)), '0'),
    lpad(revision_number::text, 2, '0'));

  insert into public.proposals (
    "number", "baseId", "projectCode", "effluentCode", fy, "sequence", revision,
    project, effluent, flow, price, gp, "proposalType", date, location, "requestedBy", "flowRaw"
  ) values (
    proposal_number, base_id, project_code, treatment_code, financial_year, project_sequence, revision_number,
    project_name, treatment, (p_input->>'flow')::numeric, (p_input->>'price')::numeric,
    (p_input->>'gp')::numeric, case when revision_number = 0 then 'New' else 'Revised' end,
    (p_input->>'date')::date, p_input->>'location', coalesce(p_input->>'requestedBy', ''), p_input->>'flow'
  ) returning * into saved;

  if p_base_id is null then
    update public.register_settings set "next" = project_sequence + 1 where id = true;
  end if;
  return saved;
end;
$$;

create or replace function public.flowdesk_update_numbering(
  p_fy text, p_next integer, p_expected_fy text, p_expected_next integer
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  settings public.register_settings;
  minimum_next integer;
begin
  perform public.flowdesk_require_member();
  select * into settings from public.register_settings where id = true for update;
  if not found then raise exception 'Numbering settings are missing.'; end if;
  if settings.fy is distinct from p_expected_fy or settings."next" is distinct from p_expected_next then
    raise exception 'Numbering changed since this form was loaded. Load the current values and try again.';
  end if;
  if p_fy is null or p_fy !~ '^[0-9]{2}$' or p_next is null or p_next < 1 then
    raise exception 'Use a two-digit financial year and positive sequence number.';
  end if;
  select coalesce(max("sequence") + 1, 1) into minimum_next from public.proposals where fy = p_fy;
  if p_next < minimum_next then raise exception 'Next sequence must be at least % for this financial year.', minimum_next; end if;
  update public.register_settings set fy = p_fy, "next" = p_next where id = true;
end;
$$;

create or replace function public.flowdesk_import_proposals(p_records jsonb)
returns integer language plpgsql security definer set search_path = '' set timezone = 'Asia/Colombo' as $$
declare
  inserted_count integer;
begin
  perform public.flowdesk_require_member();
  perform 1 from public.register_settings where id = true for update;
  if not found then raise exception 'Numbering settings are missing.'; end if;
  if p_records is null or jsonb_typeof(p_records) <> 'array' then raise exception 'Expected an array of proposal records.'; end if;

  if exists (
    select 1 from jsonb_populate_recordset(null::public.proposals, p_records) as incoming
    join public.proposals as existing on existing."number" = incoming."number"
    where to_jsonb(incoming) is distinct from to_jsonb(existing)
  ) then
    raise exception 'A proposal number already exists with different values. Import stopped; no records were changed.';
  end if;

  insert into public.proposals
    select * from jsonb_populate_recordset(null::public.proposals, p_records)
    on conflict ("number") do nothing;
  get diagnostics inserted_count = row_count;

  update public.register_settings as settings set "next" = greatest(settings."next",
    coalesce((select max(p."sequence") + 1 from public.proposals p where p.fy = settings.fy), 1))
    where settings.id = true;
  return inserted_count;
end;
$$;

revoke all on function public.flowdesk_create_proposal(jsonb, text) from public, anon, authenticated;
revoke all on function public.flowdesk_update_numbering(text, integer, text, integer) from public, anon, authenticated;
revoke all on function public.flowdesk_import_proposals(jsonb) from public, anon, authenticated;
grant execute on function public.flowdesk_create_proposal(jsonb, text) to authenticated;
grant execute on function public.flowdesk_update_numbering(text, integer, text, integer) to authenticated;
grant execute on function public.flowdesk_import_proposals(jsonb) to authenticated;

commit;

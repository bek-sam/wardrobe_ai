-- Explicit, idempotent saving of a plan the stylist chat proposed.
--
-- Chat never writes a plan on its own. The browser sends only the agent_runs
-- id of a completed planning run; the plan itself is replayed from the safe
-- representation this server recorded, so a client can neither invent plan
-- days nor smuggle in items it does not own. The actual write still goes
-- through save_generated_week -> save_generated_plan -> save_generated_outfit,
-- which keep every existing ownership, activity, availability, role, and
-- foundation check.

create table if not exists public.generated_plan_saves (
  user_id uuid not null references public.profiles (id) on delete cascade,
  generation_id uuid not null references public.agent_runs (id) on delete cascade,
  plan_id uuid not null,
  outfit_id uuid not null,
  planned_date date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, generation_id, plan_id),
  constraint generated_plan_saves_plan_unique unique (plan_id),
  constraint generated_plan_saves_outfit_unique unique (outfit_id),
  -- Composite foreign keys: a service-role bug cannot attach one user's plan
  -- or outfit to another user's save row.
  constraint generated_plan_saves_plan_fk foreign key (plan_id, user_id)
    references public.outfit_plans (id, user_id) on delete cascade,
  constraint generated_plan_saves_outfit_fk foreign key (outfit_id, user_id)
    references public.outfits (id, user_id) on delete cascade
);

create index if not exists generated_plan_saves_user_generation_idx
  on public.generated_plan_saves (user_id, generation_id);
create index if not exists generated_plan_saves_user_created_idx
  on public.generated_plan_saves (user_id, created_at desc);

-- Owner may read their own save records; every mutation goes through the
-- security-definer RPC below or a service-role worker. No authenticated
-- insert/update/delete policy exists, so none is possible.
alter table public.generated_plan_saves enable row level security;
drop policy if exists user_select on public.generated_plan_saves;
create policy user_select on public.generated_plan_saves
for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.generated_plan_saves from anon, authenticated;
grant select on table public.generated_plan_saves to authenticated;
grant select, insert, update, delete on table public.generated_plan_saves to service_role;

create or replace function public.save_recorded_generated_week(p_generation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  recorded_plans jsonb;
  recorded_intent text;
  saved_plans jsonb;
  saved_entry jsonb;
  entry_index integer := 0;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_generation_id is null then
    raise exception 'generation id is required' using errcode = '22023';
  end if;

  -- Serialises concurrent saves of the same generation for the same user, so
  -- two racing requests cannot both pass the "already saved?" check.
  perform pg_advisory_xact_lock(
    hashtextextended(current_user_id::text || ':generated-week:' || p_generation_id::text, 0)
  );

  -- Retry idempotency: an already-saved generation returns what it created
  -- the first time instead of creating a second copy.
  select jsonb_agg(
           jsonb_build_object('plan_id', saved.plan_id, 'outfit_id', saved.outfit_id)
           order by saved.planned_date, saved.plan_id
         )
    into saved_plans
  from public.generated_plan_saves saved
  where saved.user_id = current_user_id
    and saved.generation_id = p_generation_id;
  if saved_plans is not null then
    return saved_plans;
  end if;

  -- Only this user's own completed orchestrator run is readable here, so a
  -- generation id belonging to somebody else is simply not found.
  select
    run.output_summary -> 'plans',
    run.input_summary ->> 'intent'
    into recorded_plans, recorded_intent
  from public.agent_runs run
  where run.id = p_generation_id
    and run.user_id = current_user_id
    and run.agent_type = 'wardrobe_orchestrator'
    and run.status = 'complete';

  if not found then
    raise exception 'completed generated plan not found' using errcode = 'P0002';
  end if;
  if recorded_intent is distinct from 'planning' then
    raise exception 'only a planning generation can be saved' using errcode = '22023';
  end if;
  if recorded_plans is null
    or jsonb_typeof(recorded_plans) <> 'array'
    or jsonb_array_length(recorded_plans) not between 1 and 7
  then
    raise exception 'generated plan is missing or incomplete' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(recorded_plans) parsed(element)
    where jsonb_typeof(element) <> 'object'
      or coalesce(element ->> 'date', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      or jsonb_typeof(coalesce(element -> 'items', 'null'::jsonb)) <> 'array'
      or jsonb_array_length(coalesce(element -> 'items', '[]'::jsonb)) = 0
  ) then
    raise exception 'generated plan is malformed' using errcode = '22023';
  end if;

  -- One transaction: save_generated_week raises on any unavailable, archived,
  -- or non-owned item, which rolls back every day of the week together.
  saved_plans := public.save_generated_week(recorded_plans);
  if saved_plans is null
    or jsonb_typeof(saved_plans) <> 'array'
    or jsonb_array_length(saved_plans) <> jsonb_array_length(recorded_plans)
  then
    raise exception 'generated plan did not save completely' using errcode = '22000';
  end if;

  for saved_entry in select element from jsonb_array_elements(saved_plans) parsed(element)
  loop
    insert into public.generated_plan_saves (
      user_id, generation_id, plan_id, outfit_id, planned_date
    ) values (
      current_user_id,
      p_generation_id,
      (saved_entry ->> 'plan_id')::uuid,
      (saved_entry ->> 'outfit_id')::uuid,
      ((recorded_plans -> entry_index) ->> 'date')::date
    );
    entry_index := entry_index + 1;
  end loop;

  -- Keep the stored transcript honest: reloading the conversation must show
  -- this plan as saved rather than offering the action again.
  update public.messages
  set structured_result = jsonb_set(structured_result, '{saved}', 'true'::jsonb, true)
  where user_id = current_user_id
    and structured_result is not null
    and jsonb_typeof(structured_result) = 'object'
    and structured_result ->> 'kind' = 'plan'
    and structured_result ->> 'generationId' = p_generation_id::text;

  return saved_plans;
end;
$$;

revoke all on function public.save_recorded_generated_week(uuid) from public, anon;
grant execute on function public.save_recorded_generated_week(uuid) to authenticated;

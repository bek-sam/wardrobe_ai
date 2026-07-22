-- Wardrobe AI: precomputed outfit-candidate library.
--
-- Additive only: no existing table, column, or function is altered or dropped.
-- Wardrobe edits automatically enqueue a per-user compilation job (debounced to
-- at most one pending job per user); a job walks the active/available wardrobe,
-- greedily fills each role using the existing recommendation scoring functions,
-- and stores a ranked set of outfit combinations the stylist can retrieve and
-- rerank instead of composing an outfit from scratch on every request.

set search_path = public, extensions;

create table if not exists public.wardrobe_compilation_state (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  dirty_since timestamptz,
  -- Increments on every relevant wardrobe_items change and is never reset. A
  -- running compilation job snapshots this at start and compares it at the
  -- end: if it moved, an edit landed mid-run and a follow-up job is queued.
  -- dirty_since alone can't detect that, since it is coalesce-guarded and
  -- freezes at the earliest unresolved change.
  pending_change_count bigint not null default 0,
  last_compiled_at timestamptz,
  compiled_wardrobe_version text,
  candidate_count integer not null default 0,
  scoring_model_version text not null default 'v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wardrobe_compilation_state_candidate_count_check check (candidate_count >= 0),
  constraint wardrobe_compilation_state_pending_change_count_check check (pending_change_count >= 0)
);

create table if not exists public.wardrobe_compilation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'queued',
  trigger_reason text not null default 'item_change',
  items_considered integer,
  candidates_generated integer,
  error_code text,
  error_message text,
  attempt_count integer not null default 0,
  locked_at timestamptz,
  locked_until timestamptz,
  next_attempt_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wardrobe_compilation_jobs_status_check check (status in ('queued', 'running', 'complete', 'failed')),
  constraint wardrobe_compilation_jobs_trigger_reason_check check (trigger_reason in ('item_change', 'manual')),
  constraint wardrobe_compilation_jobs_items_considered_check check (items_considered is null or items_considered >= 0),
  constraint wardrobe_compilation_jobs_candidates_generated_check check (candidates_generated is null or candidates_generated >= 0),
  constraint wardrobe_compilation_jobs_attempt_count_check check (attempt_count >= 0)
);

-- Debounce: at most one queued-or-running compilation job may exist per user.
-- The dirty-marking trigger below relies on this as its ON CONFLICT arbiter.
create unique index if not exists wardrobe_compilation_jobs_user_active_unique
  on public.wardrobe_compilation_jobs (user_id)
  where status in ('queued', 'running');

create index if not exists wardrobe_compilation_jobs_user_status_idx
  on public.wardrobe_compilation_jobs (user_id, status, next_attempt_at);

create table if not exists public.outfit_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  combination_key text not null,
  compiled_wardrobe_version text not null,
  scoring_model_version text not null default 'v1',
  job_id uuid references public.wardrobe_compilation_jobs (id) on delete set null,
  status text not null default 'active',
  generated_by text not null default 'compilation',
  occasion_tags text[] not null default '{}',
  season_tags text[] not null default '{}',
  weather_tags text[] not null default '{}',
  style_tags text[] not null default '{}',
  formality_level smallint,
  warmth_level smallint,
  color_harmony numeric(4, 3),
  layering_quality numeric(4, 3),
  weather_suitability numeric(4, 3),
  occasion_formality numeric(4, 3),
  preference_match numeric(4, 3),
  variety numeric(4, 3),
  total_score numeric(4, 3) not null,
  times_suggested integer not null default 0,
  last_suggested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outfit_candidates_id_user_unique unique (id, user_id),
  constraint outfit_candidates_user_combination_unique unique (user_id, combination_key),
  constraint outfit_candidates_combination_key_not_blank check (btrim(combination_key) <> ''),
  constraint outfit_candidates_status_check check (status in ('active', 'stale', 'archived')),
  constraint outfit_candidates_generated_by_check check (generated_by in ('compilation', 'fallback_llm')),
  constraint outfit_candidates_formality_check check (formality_level is null or formality_level between 1 and 5),
  constraint outfit_candidates_warmth_check check (warmth_level is null or warmth_level between 1 and 5),
  constraint outfit_candidates_color_harmony_check check (color_harmony is null or color_harmony between 0 and 1),
  constraint outfit_candidates_layering_quality_check check (layering_quality is null or layering_quality between 0 and 1),
  constraint outfit_candidates_weather_suitability_check check (weather_suitability is null or weather_suitability between 0 and 1),
  constraint outfit_candidates_occasion_formality_check check (occasion_formality is null or occasion_formality between 0 and 1),
  constraint outfit_candidates_preference_match_check check (preference_match is null or preference_match between 0 and 1),
  constraint outfit_candidates_variety_check check (variety is null or variety between 0 and 1),
  constraint outfit_candidates_total_score_check check (total_score between 0 and 1),
  constraint outfit_candidates_times_suggested_check check (times_suggested >= 0)
);

create index if not exists outfit_candidates_user_status_score_idx
  on public.outfit_candidates (user_id, status, total_score desc);
create index if not exists outfit_candidates_occasion_tags_idx
  on public.outfit_candidates using gin (occasion_tags);
create index if not exists outfit_candidates_season_tags_idx
  on public.outfit_candidates using gin (season_tags);
create index if not exists outfit_candidates_weather_tags_idx
  on public.outfit_candidates using gin (weather_tags);
create index if not exists outfit_candidates_style_tags_idx
  on public.outfit_candidates using gin (style_tags);

create table if not exists public.outfit_candidate_items (
  candidate_id uuid not null,
  item_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (candidate_id, role),
  constraint outfit_candidate_items_candidate_fk foreign key (candidate_id, user_id)
    references public.outfit_candidates (id, user_id) on delete cascade,
  constraint outfit_candidate_items_item_fk foreign key (item_id, user_id)
    references public.wardrobe_items (id, user_id) on delete cascade,
  constraint outfit_candidate_items_candidate_item_unique unique (candidate_id, item_id),
  constraint outfit_candidate_items_role_check check (role in ('top', 'bottom', 'dress', 'layer', 'shoes', 'accessory')),
  constraint outfit_candidate_items_sort_order_check check (sort_order >= 0)
);

create index if not exists outfit_candidate_items_user_item_idx
  on public.outfit_candidate_items (user_id, item_id);

-- Keep new tables deny-by-default until the RLS/grant section below runs.
alter table public.wardrobe_compilation_state enable row level security;
alter table public.wardrobe_compilation_jobs enable row level security;
alter table public.outfit_candidates enable row level security;
alter table public.outfit_candidate_items enable row level security;

drop policy if exists user_select on public.wardrobe_compilation_state;
create policy user_select on public.wardrobe_compilation_state
for select to authenticated
using ((select auth.uid()) = user_id);

-- These are system-authored derived tables: the compilation job (service role)
-- and the owned-claim RPC below are the only writers. Authenticated clients
-- may only read their own rows.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'wardrobe_compilation_jobs',
    'outfit_candidates',
    'outfit_candidate_items'
  ] loop
    execute format('drop policy if exists user_select on public.%I', table_name);
    execute format(
      'create policy user_select on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      table_name
    );
  end loop;
end;
$$;

revoke all on table public.wardrobe_compilation_state from anon, authenticated;
grant select on table public.wardrobe_compilation_state to authenticated;

revoke all on table
  public.wardrobe_compilation_jobs,
  public.outfit_candidates,
  public.outfit_candidate_items
from anon, authenticated;
grant select on table
  public.wardrobe_compilation_jobs,
  public.outfit_candidates,
  public.outfit_candidate_items
to authenticated;

grant select, insert, update, delete on table
  public.wardrobe_compilation_state,
  public.wardrobe_compilation_jobs,
  public.outfit_candidates,
  public.outfit_candidate_items
to service_role;

do $$
declare
  table_name text;
  trigger_name text;
begin
  foreach table_name in array array[
    'wardrobe_compilation_state',
    'wardrobe_compilation_jobs',
    'outfit_candidates'
  ] loop
    trigger_name := 'set_' || table_name || '_updated_at';
    execute format('drop trigger if exists %I on public.%I', trigger_name, table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      trigger_name,
      table_name
    );
  end loop;
end;
$$;

-- Reuse the same role-resolution rule outfit_items already enforces.
create or replace function public.validate_outfit_candidate_item_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.wardrobe_items item
    where item.id = new.item_id
      and item.user_id = new.user_id
      and public.resolve_wardrobe_item_role(item.layer_role, item.category, item.subcategory) = new.role
  ) then
    raise exception 'outfit candidate role must match the wardrobe item role' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_outfit_candidate_item_role on public.outfit_candidate_items;
create trigger validate_outfit_candidate_item_role
before insert or update of item_id, user_id, role on public.outfit_candidate_items
for each row execute function public.validate_outfit_candidate_item_role();

revoke all on function public.validate_outfit_candidate_item_role() from public, anon, authenticated;

-- Any change to a scoring-relevant wardrobe_items column marks the user's
-- library dirty and (re)enqueues a compilation job. wear_count/last_worn_at
-- are deliberately excluded: recency/variety adjustments are re-applied live
-- at retrieval time instead of forcing a recompile on every "mark worn".
create or replace function public.mark_wardrobe_compilation_dirty()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_user_id uuid := coalesce(new.user_id, old.user_id);
begin
  insert into public.wardrobe_compilation_state (user_id, dirty_since, pending_change_count)
  values (affected_user_id, clock_timestamp(), 1)
  on conflict (user_id) do update
    set
      dirty_since = coalesce(
        public.wardrobe_compilation_state.dirty_since,
        excluded.dirty_since
      ),
      pending_change_count = public.wardrobe_compilation_state.pending_change_count + 1;

  insert into public.wardrobe_compilation_jobs (user_id, status, trigger_reason)
  values (affected_user_id, 'queued', 'item_change')
  on conflict (user_id) where status in ('queued', 'running') do nothing;

  -- AFTER-trigger return value is ignored by Postgres; null is idiomatic here.
  return null;
end;
$$;

drop trigger if exists mark_wardrobe_compilation_dirty on public.wardrobe_items;
create trigger mark_wardrobe_compilation_dirty
after insert or update of
  status, availability_status, deleted_at,
  category, subcategory, layer_role,
  primary_color_hex, secondary_color_hex, color_names, pattern, fit, silhouette,
  warmth_level, formality_level, water_resistance,
  season_tags, occasion_tags, weather_tags,
  favorite, metadata_confidence
  or delete on public.wardrobe_items
for each row execute function public.mark_wardrobe_compilation_dirty();

revoke all on function public.mark_wardrobe_compilation_dirty() from public, anon, authenticated;

-- Lets a signed-in user (or the client acting on their behalf right after an
-- upload) claim their own queued/failed compilation job, mirroring
-- claim_owned_import_job. At most one row can ever be queued/running per user,
-- so no job id parameter is needed.
create or replace function public.claim_next_own_wardrobe_compilation_job(
  p_lease_seconds integer default 300
)
returns setof public.wardrobe_compilation_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_lease_seconds is null or p_lease_seconds not between 30 and 1800 then
    raise exception 'invalid_wardrobe_compilation_claim_parameters' using errcode = '22023';
  end if;

  update public.wardrobe_compilation_jobs job
  set
    status = 'failed',
    error_code = 'retry_exhausted',
    error_message = 'Wardrobe compilation exceeded its automatic retry budget.',
    locked_at = null,
    locked_until = null
  where job.user_id = current_user_id
    and job.status in ('queued', 'running', 'failed')
    and job.attempt_count >= 5
    and (job.locked_until is null or job.locked_until <= clock_timestamp())
    and job.error_code is distinct from 'retry_exhausted';

  return query
  with claimable as (
    select job.id
    from public.wardrobe_compilation_jobs job
    where job.user_id = current_user_id
      and job.status in ('queued', 'running', 'failed')
      and job.attempt_count < 5
      and coalesce(job.next_attempt_at, job.created_at) <= clock_timestamp()
      and (job.locked_until is null or job.locked_until <= clock_timestamp())
    order by coalesce(job.next_attempt_at, job.created_at), job.created_at
    for update skip locked
    limit 1
  )
  update public.wardrobe_compilation_jobs job
  set
    status = 'running',
    locked_at = clock_timestamp(),
    locked_until = clock_timestamp() + make_interval(secs => p_lease_seconds),
    started_at = coalesce(job.started_at, clock_timestamp()),
    attempt_count = job.attempt_count + 1
  from claimable
  where job.id = claimable.id
  returning job.*;
end;
$$;

revoke all on function public.claim_next_own_wardrobe_compilation_job(integer) from public, anon, authenticated;
grant execute on function public.claim_next_own_wardrobe_compilation_job(integer) to authenticated;

-- Wardrobe AI: outfit curator agent, style-knowledge-backed analysis cache,
-- and modeled preview job queue.
--
-- Additive only: no existing table, column, or function is altered or
-- dropped. Adds:
--   1. wardrobe_change_events -- an append-only log of per-item/preference
--      changes (created/metadata_changed/cutout_changed/availability_changed/
--      deleted/preference_changed) that the compilation job reads to decide
--      which candidates actually need fresh curator attention, instead of
--      treating every compile as "everything changed."
--   2. outfit_analysis_cache -- a hash-keyed cache of curator verdicts so an
--      unchanged combination of items/preferences/knowledge/model never pays
--      for a second model call.
--   3. outfit_preview_jobs -- a claim-queue (mirrors
--      claim_wardrobe_compilation_jobs) for the modeled-preview worker.
--   4. Curator + preview state columns on outfit_candidates (both strictly
--      1:1 per candidate, so the retriever's hot path reads them with zero
--      extra joins).
--   5. Consent + identity-reference columns on profiles, and a style
--      archetype column on style_profiles.
--
-- item_id on wardrobe_change_events is deliberately NOT a foreign key:
-- DELETE /api/items/[itemId] performs a real hard delete (not a soft delete
-- via deleted_at), and a 'deleted' event must survive that delete long
-- enough for the next compilation job to see which item_id left the library
-- and archive the outfit_candidates rows that referenced it. This mirrors
-- the same justification already used for storage_deletion_queue.user_id.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. wardrobe_change_events
-- ---------------------------------------------------------------------------

create table if not exists public.wardrobe_change_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id uuid,
  change_type text not null,
  -- Point-in-time snapshot marker (wardrobe_items.updated_at::text,
  -- wardrobe_item_images.created_at::text, or style_profiles.updated_at::text
  -- at trigger time) used only for idempotent processing/debugging -- never
  -- an input to the analysis-cache hash, which recomputes item metadata
  -- versions fresh at compile time instead (see outfit_analysis_cache below).
  item_version text not null,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint wardrobe_change_events_change_type_check check (
    change_type in (
      'created', 'metadata_changed', 'cutout_changed',
      'availability_changed', 'deleted', 'preference_changed'
    )
  ),
  -- preference_changed events are user-wide, not item-scoped: item_id is null
  -- exactly (and only) for that change_type.
  constraint wardrobe_change_events_item_id_presence_check check (
    (change_type = 'preference_changed') = (item_id is null)
  ),
  constraint wardrobe_change_events_item_version_not_blank check (btrim(item_version) <> '')
);

create index if not exists wardrobe_change_events_user_unprocessed_idx
  on public.wardrobe_change_events (user_id, created_at)
  where processed_at is null;
create index if not exists wardrobe_change_events_item_idx
  on public.wardrobe_change_events (user_id, item_id, created_at desc);

-- Turn RLS on in the same migration that creates the table (deny-by-default
-- even before policies exist).
alter table public.wardrobe_change_events enable row level security;

drop policy if exists user_select on public.wardrobe_change_events;
create policy user_select on public.wardrobe_change_events
for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.wardrobe_change_events from anon, authenticated;
grant select on table public.wardrobe_change_events to authenticated;
grant select, insert, update, delete on table public.wardrobe_change_events to service_role;

-- Shared helper factored out of the dirty-marking upsert so the two *new*
-- trigger sources below (wardrobe_item_images, style_profiles) don't
-- duplicate it. The *existing* mark_wardrobe_compilation_dirty() trigger
-- function from migration 006 keeps its own inline copy untouched.
create or replace function public.mark_wardrobe_compilation_dirty_for_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.wardrobe_compilation_state (user_id, dirty_since, pending_change_count)
  values (p_user_id, clock_timestamp(), 1)
  on conflict (user_id) do update
    set
      dirty_since = coalesce(public.wardrobe_compilation_state.dirty_since, excluded.dirty_since),
      pending_change_count = public.wardrobe_compilation_state.pending_change_count + 1;

  insert into public.wardrobe_compilation_jobs (user_id, status, trigger_reason)
  values (p_user_id, 'queued', 'item_change')
  on conflict (user_id) where status in ('queued', 'running') do nothing;
end;
$$;

revoke all on function public.mark_wardrobe_compilation_dirty_for_user(uuid) from public, anon, authenticated;

-- Records a change event for every wardrobe_items insert/update-of-scoring-
-- column/delete. Duplicates migration 006's column whitelist deliberately:
-- additive-only means mark_wardrobe_compilation_dirty() itself is left
-- untouched, and a second independent trigger on the same table/columns is
-- legal.
create or replace function public.record_wardrobe_change_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_user_id uuid := coalesce(new.user_id, old.user_id);
  affected_item_id uuid := coalesce(new.id, old.id);
  event_type text;
  version_marker text;
begin
  if tg_op = 'DELETE' then
    event_type := 'deleted';
    version_marker := old.updated_at::text;
  elsif tg_op = 'INSERT' then
    event_type := 'created';
    version_marker := new.updated_at::text;
  elsif new.deleted_at is not null and old.deleted_at is null then
    event_type := 'deleted';
    version_marker := new.updated_at::text;
  elsif new.availability_status is distinct from old.availability_status then
    event_type := 'availability_changed';
    version_marker := new.updated_at::text;
  else
    event_type := 'metadata_changed';
    version_marker := new.updated_at::text;
  end if;

  insert into public.wardrobe_change_events (user_id, item_id, change_type, item_version)
  values (affected_user_id, affected_item_id, event_type, version_marker);

  perform public.mark_wardrobe_compilation_dirty_for_user(affected_user_id);
  return null;
end;
$$;

drop trigger if exists record_wardrobe_change_event on public.wardrobe_items;
create trigger record_wardrobe_change_event
after insert or update of
  status, availability_status, deleted_at,
  category, subcategory, layer_role,
  primary_color_hex, secondary_color_hex, color_names, pattern, fit, silhouette,
  warmth_level, formality_level, water_resistance,
  season_tags, occasion_tags, weather_tags,
  favorite, metadata_confidence
  or delete on public.wardrobe_items
for each row execute function public.record_wardrobe_change_event();

revoke all on function public.record_wardrobe_change_event() from public, anon, authenticated;

-- Fixes a real gap: today, regenerating a cutout or flipping which image is
-- primary never dirties the compiled library or invalidates cached previews.
create or replace function public.record_wardrobe_cutout_change_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind in ('cutout', 'modeled') or new.is_primary then
    insert into public.wardrobe_change_events (user_id, item_id, change_type, item_version)
    values (new.user_id, new.item_id, 'cutout_changed', new.created_at::text);
    perform public.mark_wardrobe_compilation_dirty_for_user(new.user_id);
  end if;
  return null;
end;
$$;

drop trigger if exists record_wardrobe_cutout_change_event on public.wardrobe_item_images;
create trigger record_wardrobe_cutout_change_event
after insert on public.wardrobe_item_images
for each row execute function public.record_wardrobe_cutout_change_event();

revoke all on function public.record_wardrobe_cutout_change_event() from public, anon, authenticated;

-- Also fixes a gap: editing style_profiles today never triggers a recompile,
-- so preference edits silently never rerank the compiled library.
create or replace function public.record_style_profile_change_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.wardrobe_change_events (user_id, item_id, change_type, item_version)
  values (new.user_id, null, 'preference_changed', new.updated_at::text);
  perform public.mark_wardrobe_compilation_dirty_for_user(new.user_id);
  return null;
end;
$$;

drop trigger if exists record_style_profile_change_event on public.style_profiles;
create trigger record_style_profile_change_event
after insert or update on public.style_profiles
for each row execute function public.record_style_profile_change_event();

revoke all on function public.record_style_profile_change_event() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. outfit_analysis_cache
-- ---------------------------------------------------------------------------

create table if not exists public.outfit_analysis_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  analysis_hash text not null,
  candidate_key text not null,
  model text not null,
  prompt_version text not null,
  knowledge_version text not null,
  structured_result jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint outfit_analysis_cache_user_hash_unique unique (user_id, analysis_hash),
  constraint outfit_analysis_cache_hash_not_blank check (btrim(analysis_hash) <> ''),
  constraint outfit_analysis_cache_candidate_key_not_blank check (btrim(candidate_key) <> ''),
  constraint outfit_analysis_cache_structured_result_check check (jsonb_typeof(structured_result) = 'object')
);

create index if not exists outfit_analysis_cache_user_candidate_idx
  on public.outfit_analysis_cache (user_id, candidate_key);
create index if not exists outfit_analysis_cache_expires_idx
  on public.outfit_analysis_cache (expires_at);

alter table public.outfit_analysis_cache enable row level security;

drop policy if exists user_select on public.outfit_analysis_cache;
create policy user_select on public.outfit_analysis_cache
for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.outfit_analysis_cache from anon, authenticated;
grant select on table public.outfit_analysis_cache to authenticated;
grant select, insert, update, delete on table public.outfit_analysis_cache to service_role;

-- ---------------------------------------------------------------------------
-- 3. outfit_preview_jobs
-- ---------------------------------------------------------------------------

create table if not exists public.outfit_preview_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  candidate_id uuid not null,
  priority_reason text not null,
  source_hash text not null,
  status text not null default 'queued',
  attempt_count integer not null default 0,
  error_code text,
  error_message text,
  locked_at timestamptz,
  locked_until timestamptz,
  next_attempt_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outfit_preview_jobs_candidate_fk foreign key (candidate_id, user_id)
    references public.outfit_candidates (id, user_id) on delete cascade,
  constraint outfit_preview_jobs_priority_reason_check check (
    priority_reason in ('new_item', 'user_saved', 'tomorrow_plan', 'user_selected', 'frequently_suggested')
  ),
  constraint outfit_preview_jobs_status_check check (status in ('queued', 'running', 'complete', 'failed', 'superseded')),
  constraint outfit_preview_jobs_attempt_count_check check (attempt_count >= 0),
  constraint outfit_preview_jobs_source_hash_not_blank check (btrim(source_hash) <> '')
);

-- At most one active (queued/running) job per candidate. 'superseded' is used
-- when a later change invalidates a still-queued job before a worker claims
-- it, so the worker never has to distinguish "genuinely failed" from "stale
-- before it started."
create unique index if not exists outfit_preview_jobs_candidate_active_unique
  on public.outfit_preview_jobs (candidate_id)
  where status in ('queued', 'running');
create index if not exists outfit_preview_jobs_worker_idx
  on public.outfit_preview_jobs (status, next_attempt_at, created_at)
  where status in ('queued', 'running', 'failed');
create index if not exists outfit_preview_jobs_user_idx
  on public.outfit_preview_jobs (user_id, status, created_at desc);

alter table public.outfit_preview_jobs enable row level security;

drop policy if exists user_select on public.outfit_preview_jobs;
create policy user_select on public.outfit_preview_jobs
for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.outfit_preview_jobs from anon, authenticated;
grant select on table public.outfit_preview_jobs to authenticated;
grant select, insert, update, delete on table public.outfit_preview_jobs to service_role;

drop trigger if exists set_outfit_preview_jobs_updated_at on public.outfit_preview_jobs;
create trigger set_outfit_preview_jobs_updated_at
before update on public.outfit_preview_jobs
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. outfit_candidates -- curator + preview state (additive columns)
-- ---------------------------------------------------------------------------

alter table public.outfit_candidates drop constraint if exists outfit_candidates_generated_by_check;
alter table public.outfit_candidates add constraint outfit_candidates_generated_by_check
  check (generated_by in ('compilation', 'fallback_llm', 'curator_agent'));

alter table public.outfit_candidates add column if not exists curator_status text not null default 'not_reviewed';
alter table public.outfit_candidates drop constraint if exists outfit_candidates_curator_status_check;
alter table public.outfit_candidates add constraint outfit_candidates_curator_status_check
  check (curator_status in ('not_reviewed', 'selected', 'rejected'));

alter table public.outfit_candidates add column if not exists curator_rejection_reason text;
alter table public.outfit_candidates drop constraint if exists outfit_candidates_curator_rejection_reason_check;
alter table public.outfit_candidates add constraint outfit_candidates_curator_rejection_reason_check check (
  (curator_status = 'rejected') = (curator_rejection_reason is not null)
);

alter table public.outfit_candidates add column if not exists curator_confidence numeric(4, 3);
alter table public.outfit_candidates drop constraint if exists outfit_candidates_curator_confidence_check;
alter table public.outfit_candidates add constraint outfit_candidates_curator_confidence_check
  check (curator_confidence is null or curator_confidence between 0 and 1);

alter table public.outfit_candidates add column if not exists curator_rank integer;
alter table public.outfit_candidates drop constraint if exists outfit_candidates_curator_rank_check;
alter table public.outfit_candidates add constraint outfit_candidates_curator_rank_check
  check (curator_rank is null or curator_rank >= 1);

alter table public.outfit_candidates add column if not exists curator_model text;
alter table public.outfit_candidates add column if not exists curator_prompt_version text;
alter table public.outfit_candidates add column if not exists curator_reviewed_at timestamptz;

alter table public.outfit_candidates add column if not exists preview_status text not null default 'none';
alter table public.outfit_candidates drop constraint if exists outfit_candidates_preview_status_check;
alter table public.outfit_candidates add constraint outfit_candidates_preview_status_check
  check (preview_status in ('none', 'queued', 'generating', 'ready', 'failed'));

alter table public.outfit_candidates add column if not exists preview_bucket text;
alter table public.outfit_candidates drop constraint if exists outfit_candidates_preview_bucket_check;
alter table public.outfit_candidates add constraint outfit_candidates_preview_bucket_check
  check (preview_bucket is null or preview_bucket = 'wardrobe-generated');

alter table public.outfit_candidates add column if not exists preview_storage_path text;
alter table public.outfit_candidates drop constraint if exists outfit_candidates_preview_owner_path_check;
alter table public.outfit_candidates add constraint outfit_candidates_preview_owner_path_check check (
  preview_storage_path is null or split_part(preview_storage_path, '/', 1) = user_id::text
);

alter table public.outfit_candidates add column if not exists preview_source_hash text;
alter table public.outfit_candidates add column if not exists preview_model text;
alter table public.outfit_candidates add column if not exists preview_generated_at timestamptz;
alter table public.outfit_candidates add column if not exists preview_error_code text;

create index if not exists outfit_candidates_curator_status_idx
  on public.outfit_candidates (user_id, status, curator_status, total_score desc);
create index if not exists outfit_candidates_preview_lookup_idx
  on public.outfit_candidates (user_id, status, preview_status, times_suggested desc);

-- ---------------------------------------------------------------------------
-- 5. profiles -- modeled-preview consent, and style_profiles -- archetypes
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists modeled_preview_consent boolean not null default false;
alter table public.profiles add column if not exists modeled_preview_consent_at timestamptz;
alter table public.profiles add column if not exists identity_reference_path text;

alter table public.profiles drop constraint if exists profiles_identity_reference_owner_path_check;
alter table public.profiles add constraint profiles_identity_reference_owner_path_check check (
  identity_reference_path is null or split_part(identity_reference_path, '/', 1) = id::text
);

-- Encodes "consent requires an already-uploaded identity photo" once, at the
-- schema layer, so application code never has to re-check this invariant.
alter table public.profiles drop constraint if exists profiles_modeled_preview_consent_requires_reference_check;
alter table public.profiles add constraint profiles_modeled_preview_consent_requires_reference_check check (
  modeled_preview_consent = false or identity_reference_path is not null
);

-- Read-only curator input; the curator never writes back to style_profiles --
-- its aesthetic output lands on outfit_candidates.style_tags instead.
alter table public.style_profiles add column if not exists style_archetypes text[] not null default '{}';

-- ---------------------------------------------------------------------------
-- 6. New RPCs
-- ---------------------------------------------------------------------------

-- Service-role-safe twin of check_and_increment_usage_window(): that function
-- reads auth.uid(), which is unusable from a worker invoked with no session.
create or replace function public.service_check_and_increment_usage_window(
  p_user_id uuid,
  p_feature text,
  p_limit integer,
  p_period text,
  p_increment integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  utc_date date;
  counter_period_start date;
  next_period_start timestamptz;
  resulting_count integer;
  existing_count integer;
begin
  if p_user_id is null then
    raise exception 'user_id_required' using errcode = '22023';
  end if;
  if p_feature is null or p_feature !~ '^[a-z0-9][a-z0-9_.:-]{0,79}$' then
    raise exception 'invalid_usage_feature' using errcode = '22023';
  end if;
  if p_period is null or p_period not in ('day', 'month') then
    raise exception 'invalid_usage_period' using errcode = '22023';
  end if;
  if p_limit is null or p_increment is null
    or p_limit < 1 or p_limit > 1000000 or p_increment < 1 or p_increment > p_limit
  then
    raise exception 'invalid_usage_limit_or_increment' using errcode = '22023';
  end if;

  utc_date := (clock_timestamp() at time zone 'UTC')::date;
  counter_period_start := case
    when p_period = 'day' then utc_date
    else date_trunc('month', utc_date::timestamp)::date
  end;
  next_period_start := case
    when p_period = 'day' then ((counter_period_start + 1)::timestamp at time zone 'UTC')
    else ((counter_period_start + interval '1 month')::timestamp at time zone 'UTC')
  end;

  perform pg_advisory_xact_lock(hashtextextended(
    p_user_id::text || ':' || p_feature || ':' || p_period || ':' || counter_period_start::text, 0
  ));

  insert into public.feature_usage_counters as counter (user_id, feature, period, period_start, usage_count)
  values (p_user_id, p_feature, p_period, counter_period_start, p_increment)
  on conflict (user_id, feature, period, period_start) do update
  set usage_count = counter.usage_count + excluded.usage_count
  where counter.usage_count + excluded.usage_count <= p_limit
  returning counter.usage_count into resulting_count;

  if resulting_count is null then
    select counter.usage_count into existing_count from public.feature_usage_counters counter
    where counter.user_id = p_user_id and counter.feature = p_feature
      and counter.period = p_period and counter.period_start = counter_period_start;
    return jsonb_build_object(
      'allowed', false, 'feature', p_feature, 'period', p_period, 'limit', p_limit,
      'used', coalesce(existing_count, 0), 'remaining', greatest(0, p_limit - coalesce(existing_count, 0)),
      'reset_at', next_period_start
    );
  end if;

  return jsonb_build_object(
    'allowed', true, 'feature', p_feature, 'period', p_period, 'limit', p_limit,
    'used', resulting_count, 'remaining', greatest(0, p_limit - resulting_count), 'reset_at', next_period_start
  );
end;
$$;

revoke all on function public.service_check_and_increment_usage_window(uuid, text, integer, text, integer)
  from public, anon, authenticated;
grant execute on function public.service_check_and_increment_usage_window(uuid, text, integer, text, integer)
  to service_role;

-- Computes preview freshness itself (server-side, from the candidate's
-- current member items + their latest cutout image) rather than trusting a
-- caller-supplied hash. Dedupes via the partial unique index, suppresses
-- re-enqueue when a ready preview is already fresh, and enforces a per-user
-- queued-job ceiling as a soft cap (returns null instead of erroring, since
-- callers are background paths that must never fail because the preview
-- queue is busy).
create or replace function public.enqueue_outfit_preview_job(
  p_user_id uuid,
  p_candidate_id uuid,
  p_priority_reason text,
  p_max_queued_per_user integer default 5
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  computed_source_hash text;
  current_preview_status text;
  current_preview_hash text;
  queued_count integer;
  new_job_id uuid;
begin
  if p_priority_reason not in ('new_item', 'user_saved', 'tomorrow_plan', 'user_selected', 'frequently_suggested') then
    raise exception 'invalid_preview_priority_reason' using errcode = '22023';
  end if;

  select preview_status, preview_source_hash into current_preview_status, current_preview_hash
  from public.outfit_candidates
  where id = p_candidate_id and user_id = p_user_id and status = 'active'
  for update;
  if not found then
    raise exception 'outfit_candidate_not_found' using errcode = 'PT404';
  end if;

  select md5(string_agg(
    wi.id::text || ':' || wi.updated_at::text || ':' || coalesce(latest_cutout.created_at::text, ''),
    ',' order by wi.id
  ))
  into computed_source_hash
  from public.outfit_candidate_items oci
  join public.wardrobe_items wi on wi.id = oci.item_id and wi.user_id = p_user_id
  left join lateral (
    select max(created_at) as created_at from public.wardrobe_item_images img
    where img.item_id = wi.id and img.user_id = p_user_id and img.kind in ('cutout', 'modeled')
  ) latest_cutout on true
  where oci.candidate_id = p_candidate_id;

  if current_preview_status = 'ready' and current_preview_hash = computed_source_hash then
    return null; -- already fresh; duplicate-preview suppression
  end if;

  select count(*) into queued_count
  from public.outfit_preview_jobs
  where user_id = p_user_id and status in ('queued', 'running');
  if queued_count >= p_max_queued_per_user then
    return null; -- soft cap; never blocks the caller
  end if;

  insert into public.outfit_preview_jobs (user_id, candidate_id, priority_reason, source_hash)
  values (p_user_id, p_candidate_id, p_priority_reason, computed_source_hash)
  on conflict (candidate_id) where status in ('queued', 'running') do nothing
  returning id into new_job_id;

  if new_job_id is not null then
    update public.outfit_candidates set preview_status = 'queued' where id = p_candidate_id;
  end if;

  return new_job_id;
end;
$$;

revoke all on function public.enqueue_outfit_preview_job(uuid, uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.enqueue_outfit_preview_job(uuid, uuid, text, integer) to service_role;

-- Client-callable "generate a preview" wrapper: resolves auth.uid() itself,
-- enforces consent + a rate limit, then delegates to the shared function
-- above with a trusted p_user_id.
create or replace function public.request_outfit_preview(p_candidate_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  consent boolean;
  rate_result jsonb;
  job_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select modeled_preview_consent into consent from public.profiles where id = current_user_id;
  if not coalesce(consent, false) then
    raise exception 'modeled_preview_consent_required' using errcode = '42501';
  end if;

  rate_result := public.consume_rate_limit('outfit_preview_request', 10, interval '1 day', 1);
  if not (rate_result ->> 'allowed')::boolean then
    raise exception 'outfit_preview_rate_limited' using errcode = 'PT429';
  end if;

  job_id := public.enqueue_outfit_preview_job(current_user_id, p_candidate_id, 'user_selected');
  return jsonb_build_object('job_id', job_id, 'status', case when job_id is null then 'already_fresh' else 'queued' end);
end;
$$;

revoke all on function public.request_outfit_preview(uuid) from public, anon;
grant execute on function public.request_outfit_preview(uuid) to authenticated;

create or replace function public.claim_outfit_preview_jobs(
  p_limit integer default 10,
  p_lease_seconds integer default 300
)
returns setof public.outfit_preview_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit is null or p_lease_seconds is null
    or p_limit not between 1 and 50 or p_lease_seconds not between 30 and 1800
  then
    raise exception 'invalid_outfit_preview_claim_parameters' using errcode = '22023';
  end if;

  update public.outfit_preview_jobs job
  set status = 'failed', error_code = 'retry_exhausted',
      error_message = 'Modeled preview generation exceeded its automatic retry budget.',
      locked_at = null, locked_until = null
  where job.status in ('queued', 'running', 'failed')
    and job.attempt_count >= 5
    and (job.locked_until is null or job.locked_until <= clock_timestamp())
    and job.error_code is distinct from 'retry_exhausted';

  return query
  with claimable as (
    select job.id from public.outfit_preview_jobs job
    where job.status in ('queued', 'running', 'failed')
      and job.attempt_count < 5
      and coalesce(job.next_attempt_at, job.created_at) <= clock_timestamp()
      and (job.locked_until is null or job.locked_until <= clock_timestamp())
    order by coalesce(job.next_attempt_at, job.created_at), job.created_at
    for update skip locked
    limit p_limit
  )
  update public.outfit_preview_jobs job
  set status = 'running', locked_at = clock_timestamp(),
      locked_until = clock_timestamp() + make_interval(secs => p_lease_seconds),
      started_at = coalesce(job.started_at, clock_timestamp()), attempt_count = job.attempt_count + 1
  from claimable
  where job.id = claimable.id
  returning job.*;
end;
$$;

revoke all on function public.claim_outfit_preview_jobs(integer, integer) from public, anon, authenticated;
grant execute on function public.claim_outfit_preview_jobs(integer, integer) to service_role;

create or replace function public.finalize_outfit_preview_job(
  p_job_id uuid, p_user_id uuid, p_bucket text, p_storage_path text, p_source_hash text, p_model text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare job public.outfit_preview_jobs;
begin
  select * into job from public.outfit_preview_jobs where id = p_job_id and user_id = p_user_id for update;
  if not found then raise exception 'outfit_preview_job_not_found' using errcode = 'PT404'; end if;
  if job.status <> 'running' or job.locked_until is null or job.locked_until <= clock_timestamp() then
    raise exception 'outfit_preview_job_not_leased' using errcode = '22023';
  end if;

  update public.outfit_candidates
  set preview_status = 'ready', preview_bucket = p_bucket, preview_storage_path = p_storage_path,
      preview_source_hash = p_source_hash, preview_model = p_model,
      preview_generated_at = clock_timestamp(), preview_error_code = null
  where id = job.candidate_id and user_id = p_user_id;

  update public.outfit_preview_jobs
  set status = 'complete', completed_at = clock_timestamp(), locked_at = null, locked_until = null,
      next_attempt_at = null, error_code = null, error_message = null
  where id = p_job_id;
end;
$$;

create or replace function public.fail_outfit_preview_job(
  p_job_id uuid, p_user_id uuid, p_error_code text, p_error_message text, p_next_attempt_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare job public.outfit_preview_jobs;
begin
  select * into job from public.outfit_preview_jobs where id = p_job_id and user_id = p_user_id for update;
  if not found then raise exception 'outfit_preview_job_not_found' using errcode = 'PT404'; end if;

  update public.outfit_candidates
  set preview_status = 'failed', preview_error_code = p_error_code
  where id = job.candidate_id and user_id = p_user_id and preview_status in ('queued', 'generating');

  update public.outfit_preview_jobs
  set status = 'failed', error_code = p_error_code, error_message = p_error_message,
      locked_at = null, locked_until = null, next_attempt_at = p_next_attempt_at
  where id = p_job_id;
end;
$$;

revoke all on function public.finalize_outfit_preview_job(uuid, uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.finalize_outfit_preview_job(uuid, uuid, text, text, text, text) to service_role;
revoke all on function public.fail_outfit_preview_job(uuid, uuid, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.fail_outfit_preview_job(uuid, uuid, text, text, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- 7. Extend prune_wardrobe_operational_data() and seed quota rows
-- ---------------------------------------------------------------------------

create or replace function public.prune_wardrobe_operational_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rate_events_deleted bigint;
  idempotency_keys_deleted bigint;
  usage_counters_deleted bigint;
  deletion_queue_rows_deleted bigint;
  archived_candidates_deleted bigint;
  expired_analysis_cache_deleted bigint;
  stale_change_events_deleted bigint;
  completed_preview_jobs_deleted bigint;
begin
  delete from public.rate_limit_events where occurred_at < now() - interval '32 days';
  get diagnostics rate_events_deleted = row_count;

  delete from public.api_idempotency_keys where expires_at < now();
  get diagnostics idempotency_keys_deleted = row_count;

  delete from public.feature_usage_counters
  where (period = 'day' and period_start < current_date - 400)
     or (period = 'month' and period_start < (date_trunc('month', current_date) - interval '36 months')::date);
  get diagnostics usage_counters_deleted = row_count;

  delete from public.storage_deletion_queue
  where status = 'complete' and completed_at < now() - interval '30 days';
  get diagnostics deletion_queue_rows_deleted = row_count;

  -- Enqueue storage cleanup for previews attached to candidates about to be
  -- pruned, so generated bytes never outlive their metadata row silently.
  insert into public.storage_deletion_queue (user_id, bucket_id, storage_path, reason)
  select user_id, preview_bucket, preview_storage_path, 'archived_outfit_candidate_preview'
  from public.outfit_candidates
  where status = 'archived' and updated_at < now() - interval '1 day' and preview_storage_path is not null
  on conflict (user_id, bucket_id, storage_path) do nothing;

  delete from public.outfit_candidates
  where status = 'archived' and updated_at < now() - interval '1 day';
  get diagnostics archived_candidates_deleted = row_count;

  delete from public.outfit_analysis_cache where expires_at < now();
  get diagnostics expired_analysis_cache_deleted = row_count;

  delete from public.wardrobe_change_events
  where processed_at is not null and processed_at < now() - interval '14 days';
  get diagnostics stale_change_events_deleted = row_count;

  delete from public.outfit_preview_jobs
  where status in ('complete', 'superseded') and updated_at < now() - interval '14 days';
  get diagnostics completed_preview_jobs_deleted = row_count;

  return jsonb_build_object(
    'rate_limit_events_deleted', rate_events_deleted,
    'idempotency_keys_deleted', idempotency_keys_deleted,
    'usage_counters_deleted', usage_counters_deleted,
    'storage_deletion_queue_rows_deleted', deletion_queue_rows_deleted,
    'archived_outfit_candidates_deleted', archived_candidates_deleted,
    'expired_analysis_cache_deleted', expired_analysis_cache_deleted,
    'stale_change_events_deleted', stale_change_events_deleted,
    'completed_preview_jobs_deleted', completed_preview_jobs_deleted
  );
end;
$$;

insert into public.feature_limits (feature, daily_limit)
values ('outfit_curator_calls', 20), ('outfit_preview_generation', 30)
on conflict (feature) do nothing;

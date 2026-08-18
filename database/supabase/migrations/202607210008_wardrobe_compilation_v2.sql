-- Wardrobe AI: wardrobe-compilation atomicity, a real batch worker, and
-- normalized occasion categories.
--
-- Additive only: no existing table, column, or function is dropped. Fixes,
-- relative to migration 006:
--
--   1. Manual "Recompile" previously only claimed an already-queued job and
--      silently did nothing otherwise. request_wardrobe_recompilation() now
--      debounces/queues/reports status, rate-limited against abuse.
--   2. claim_next_own_wardrobe_compilation_job() is scoped to auth.uid() (one
--      user's own job) and stays as-is for the interactive path.
--      claim_wardrobe_compilation_jobs() adds the missing service-role batch
--      claim a real background worker needs, mirroring claim_import_jobs().
--   3. finalize_wardrobe_compilation() replaces a delete-then-insert publish
--      with a versioned publish (candidates for the new version are inserted
--      first; this function atomically flips the version pointer only after
--      verifying the new version's row count, archives the old version, and
--      compare-and-swaps the dirty counter instead of a racy read-then-write).
--   4. occasion_category adds a normalized, structured occasion signal
--      (distinct from the existing free-text occasion_tags) so retrieval can
--      prefilter instead of exact-matching raw user text against tags.
--   5. increment_outfit_candidate_exposure() and record_fallback_outfit_candidate()
--      replace a read-modify-write suggestion counter and a two-call,
--      non-transactional fallback insert with single atomic operations.

set search_path = public, extensions;

alter table public.outfit_candidates
  add column if not exists occasion_category text;

alter table public.outfit_candidates
  drop constraint if exists outfit_candidates_occasion_category_check;
alter table public.outfit_candidates
  add constraint outfit_candidates_occasion_category_check check (
    occasion_category is null or occasion_category in (
      'casual', 'work', 'business', 'interview', 'dinner', 'date', 'wedding',
      'formal_event', 'party', 'concert', 'travel', 'outdoor', 'exercise', 'errands'
    )
  );

create index if not exists outfit_candidates_occasion_category_idx
  on public.outfit_candidates (user_id, status, occasion_category, total_score desc);

-- Manual recompile: debounce/queue/report-status instead of only claiming an
-- already-queued job. Rate-limited via the existing consume_rate_limit bucket
-- mechanism to prevent abusive repeated recompilation.
create or replace function public.request_wardrobe_recompilation()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  existing_job_id uuid;
  new_job_id uuid;
  is_dirty boolean;
  rate_result jsonb;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select job.id into existing_job_id
  from public.wardrobe_compilation_jobs job
  where job.user_id = current_user_id
    and job.status in ('queued', 'running')
  limit 1;

  if existing_job_id is not null then
    return jsonb_build_object('status', 'already_running', 'job_id', existing_job_id);
  end if;

  select (state.dirty_since is not null or state.compiled_wardrobe_version is null)
    into is_dirty
  from public.wardrobe_compilation_state state
  where state.user_id = current_user_id;

  if not found or is_dirty is null then
    is_dirty := true;
  end if;

  if not is_dirty then
    return jsonb_build_object('status', 'up_to_date', 'job_id', null);
  end if;

  rate_result := public.consume_rate_limit(
    'wardrobe_recompile_manual', 5, interval '10 minutes', 1
  );
  if not (rate_result ->> 'allowed')::boolean then
    raise exception 'wardrobe_recompile_rate_limited' using errcode = 'PT429';
  end if;

  insert into public.wardrobe_compilation_jobs (user_id, status, trigger_reason)
  values (current_user_id, 'queued', 'manual')
  on conflict (user_id) where status in ('queued', 'running') do nothing
  returning id into new_job_id;

  if new_job_id is null then
    -- Lost a race with a concurrently created job; report that job instead.
    select job.id into new_job_id
    from public.wardrobe_compilation_jobs job
    where job.user_id = current_user_id
      and job.status in ('queued', 'running')
    limit 1;
  end if;

  return jsonb_build_object('status', 'queued', 'job_id', new_job_id);
end;
$$;

-- Service-role batch claim for a real background worker, mirroring
-- claim_import_jobs()/claim_research_jobs() exactly. The existing
-- claim_next_own_wardrobe_compilation_job() remains the interactive,
-- owned-claim path and is unaffected.
create or replace function public.claim_wardrobe_compilation_jobs(
  p_limit integer default 5,
  p_lease_seconds integer default 300
)
returns setof public.wardrobe_compilation_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit is null
    or p_lease_seconds is null
    or p_limit not between 1 and 50
    or p_lease_seconds not between 30 and 1800
  then
    raise exception 'invalid wardrobe-compilation claim parameters' using errcode = '22023';
  end if;

  update public.wardrobe_compilation_jobs job
  set
    status = 'failed',
    error_code = 'retry_exhausted',
    error_message = 'Wardrobe compilation exceeded its automatic retry budget.',
    locked_at = null,
    locked_until = null
  where job.status in ('queued', 'running', 'failed')
    and job.attempt_count >= 5
    and (job.locked_until is null or job.locked_until <= clock_timestamp())
    and job.error_code is distinct from 'retry_exhausted';

  return query
  with claimable as (
    select job.id
    from public.wardrobe_compilation_jobs job
    where job.status in ('queued', 'running', 'failed')
      and job.attempt_count < 5
      and coalesce(job.next_attempt_at, job.created_at) <= clock_timestamp()
      and (job.locked_until is null or job.locked_until <= clock_timestamp())
    order by coalesce(job.next_attempt_at, job.created_at), job.created_at
    for update skip locked
    limit p_limit
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

-- Atomic finalization: the app inserts every candidate/candidate-item row for
-- p_new_version first (a normal versioned insert, never a delete-then-insert),
-- then calls this once. It verifies the job's lease, verifies the new
-- version's row count actually matches what the app just wrote, flips the
-- published-version pointer, archives the previous version, and
-- compare-and-swaps the dirty counter — all in one transaction. A version is
-- always published once fully written: retrieval re-validates item
-- ownership/availability per request, so a slightly-stale version from
-- mid-run drift is still safe to serve and simply triggers a follow-up job.
create or replace function public.finalize_wardrobe_compilation(
  p_job_id uuid,
  p_user_id uuid,
  p_new_version text,
  p_start_change_count bigint,
  p_candidate_count integer,
  p_items_considered integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.wardrobe_compilation_jobs;
  actual_count integer;
  current_change_count bigint;
  changed_during_run boolean;
  archived_count integer;
begin
  select * into job
  from public.wardrobe_compilation_jobs
  where id = p_job_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'wardrobe_compilation_job_not_found' using errcode = 'PT404';
  end if;
  if job.status <> 'running' or job.locked_until is null or job.locked_until <= clock_timestamp() then
    raise exception 'wardrobe_compilation_job_not_leased' using errcode = '22023';
  end if;

  select count(*) into actual_count
  from public.outfit_candidates
  where user_id = p_user_id and compiled_wardrobe_version = p_new_version;

  if actual_count <> p_candidate_count then
    raise exception 'wardrobe_compilation_candidate_count_mismatch' using errcode = '22023';
  end if;

  select pending_change_count into current_change_count
  from public.wardrobe_compilation_state
  where user_id = p_user_id
  for update;

  changed_during_run := coalesce(current_change_count, 0) <> p_start_change_count;

  insert into public.wardrobe_compilation_state (
    user_id, compiled_wardrobe_version, candidate_count, last_compiled_at
  )
  values (p_user_id, p_new_version, p_candidate_count, clock_timestamp())
  on conflict (user_id) do update set
    compiled_wardrobe_version = excluded.compiled_wardrobe_version,
    candidate_count = excluded.candidate_count,
    last_compiled_at = excluded.last_compiled_at,
    dirty_since = case
      when changed_during_run then public.wardrobe_compilation_state.dirty_since
      else null
    end;

  update public.outfit_candidates
  set status = 'archived'
  where user_id = p_user_id
    and compiled_wardrobe_version <> p_new_version
    and status = 'active';
  get diagnostics archived_count = row_count;

  update public.wardrobe_compilation_jobs
  set
    status = 'complete',
    items_considered = p_items_considered,
    candidates_generated = p_candidate_count,
    completed_at = clock_timestamp(),
    locked_at = null,
    locked_until = null,
    next_attempt_at = null,
    error_code = null,
    error_message = null
  where id = p_job_id;

  if changed_during_run then
    insert into public.wardrobe_compilation_jobs (user_id, status, trigger_reason)
    values (p_user_id, 'queued', 'item_change')
    on conflict (user_id) where status in ('queued', 'running') do nothing;
  end if;

  return jsonb_build_object(
    'published', true,
    'changed_during_run', changed_during_run,
    'archived_count', archived_count,
    'candidate_count', p_candidate_count
  );
end;
$$;

-- Replaces the select-then-update in markOutfitCandidateSuggested(): an
-- atomic increment instead of a read-modify-write race.
create or replace function public.increment_outfit_candidate_exposure(
  p_candidate_id uuid,
  p_user_id uuid
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.outfit_candidates
  set times_suggested = times_suggested + 1, last_suggested_at = clock_timestamp()
  where id = p_candidate_id and user_id = p_user_id;
$$;

-- Replaces the two separate, non-transactional supabase-js calls in
-- recordFallbackOutfitCandidate(): validates every item is owned/active/
-- available, then inserts the candidate and all its candidate_items together
-- so a partial failure can never leave an active candidate with zero items.
create or replace function public.record_fallback_outfit_candidate(
  p_user_id uuid,
  p_combination_key text,
  p_occasion_category text,
  p_occasion_tags text[],
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_candidate_id uuid;
  requested_count integer;
  owned_count integer;
begin
  if p_occasion_category is not null and p_occasion_category not in (
    'casual', 'work', 'business', 'interview', 'dinner', 'date', 'wedding',
    'formal_event', 'party', 'concert', 'travel', 'outdoor', 'exercise', 'errands'
  ) then
    raise exception 'invalid_occasion_category' using errcode = '22023';
  end if;

  requested_count := jsonb_array_length(p_items);
  if requested_count is null or requested_count < 1 or requested_count > 5 then
    raise exception 'invalid_fallback_candidate_item_count' using errcode = '22023';
  end if;

  select count(*) into owned_count
  from jsonb_array_elements(p_items) as entry
  join public.wardrobe_items item
    on item.id = (entry ->> 'item_id')::uuid
    and item.user_id = p_user_id
    and item.status = 'active'
    and item.availability_status = 'available'
    and item.deleted_at is null;

  if owned_count <> requested_count then
    raise exception 'fallback_candidate_item_not_owned_or_unavailable' using errcode = '22023';
  end if;

  insert into public.outfit_candidates (
    user_id, combination_key, compiled_wardrobe_version, status, generated_by,
    occasion_tags, occasion_category, total_score
  )
  select
    p_user_id, p_combination_key, state.compiled_wardrobe_version, 'active', 'fallback_llm',
    coalesce(p_occasion_tags, '{}'), p_occasion_category, 0.6
  from public.wardrobe_compilation_state state
  where state.user_id = p_user_id
    and state.compiled_wardrobe_version is not null
    and state.dirty_since is null
  on conflict (user_id, combination_key) do nothing
  returning id into new_candidate_id;

  if new_candidate_id is null then
    return null;
  end if;

  insert into public.outfit_candidate_items (candidate_id, item_id, user_id, role, sort_order)
  select
    new_candidate_id,
    (entry ->> 'item_id')::uuid,
    p_user_id,
    entry ->> 'role',
    coalesce((entry ->> 'sort_order')::integer, (ordinality - 1)::integer)
  from jsonb_array_elements(p_items) with ordinality as entry;

  return new_candidate_id;
end;
$$;

-- Extends the existing operational-data pruning job with the new archived
-- outfit_candidates rows finalize_wardrobe_compilation() creates. Deleting a
-- candidate cascades to its outfit_candidate_items via the existing FK.
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

  delete from public.outfit_candidates
  where status = 'archived' and updated_at < now() - interval '1 day';
  get diagnostics archived_candidates_deleted = row_count;

  return jsonb_build_object(
    'rate_limit_events_deleted', rate_events_deleted,
    'idempotency_keys_deleted', idempotency_keys_deleted,
    'usage_counters_deleted', usage_counters_deleted,
    'storage_deletion_queue_rows_deleted', deletion_queue_rows_deleted,
    'archived_outfit_candidates_deleted', archived_candidates_deleted
  );
end;
$$;

revoke all on function public.request_wardrobe_recompilation() from public, anon;
grant execute on function public.request_wardrobe_recompilation() to authenticated;

revoke all on function public.claim_wardrobe_compilation_jobs(integer, integer) from public, anon, authenticated;
grant execute on function public.claim_wardrobe_compilation_jobs(integer, integer) to service_role;

revoke all on function public.finalize_wardrobe_compilation(uuid, uuid, text, bigint, integer, integer) from public, anon, authenticated;
grant execute on function public.finalize_wardrobe_compilation(uuid, uuid, text, bigint, integer, integer) to service_role;

revoke all on function public.increment_outfit_candidate_exposure(uuid, uuid) from public, anon, authenticated;
grant execute on function public.increment_outfit_candidate_exposure(uuid, uuid) to service_role;

revoke all on function public.record_fallback_outfit_candidate(uuid, text, text, text[], jsonb) from public, anon, authenticated;
grant execute on function public.record_fallback_outfit_candidate(uuid, text, text, text[], jsonb) to service_role;

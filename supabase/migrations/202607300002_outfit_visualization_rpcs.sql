-- Wardrobe AI: Outfit Studio RPCs -- create/reuse, claim, advance, finalize,
-- fail, feedback, and the staleness triggers.
--
-- Every quota-consuming or state-machine transition lives here rather than in
-- a client table write, so ownership, idempotency, and the paid-generation
-- budget are enforced in one transactional place.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Identity references
-- ---------------------------------------------------------------------------

-- Activating a reference deactivates the previous one and marks every current
-- visualization stale: an image rendered from the old face no longer
-- represents the user. Soft-deletes the replaced row and queues its bytes so
-- the private photo actually leaves storage.
create or replace function public.activate_identity_reference(
  p_reference_id uuid,
  p_consent_version text
)
returns public.profile_identity_references
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target public.profile_identity_references;
  previous public.profile_identity_references;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_consent_version is null or btrim(p_consent_version) = '' then
    raise exception 'consent_version_required' using errcode = '22023';
  end if;

  select * into target
  from public.profile_identity_references
  where id = p_reference_id and user_id = current_user_id and deleted_at is null
  for update;
  if not found then
    raise exception 'identity_reference_not_found' using errcode = 'PT404';
  end if;
  if target.validation_status not in ('pass', 'warn') then
    raise exception 'identity_reference_not_validated' using errcode = '22023';
  end if;

  for previous in
    select * from public.profile_identity_references
    where user_id = current_user_id and is_active and deleted_at is null and id <> p_reference_id
    for update
  loop
    update public.profile_identity_references
    set is_active = false, deleted_at = now()
    where id = previous.id;
    perform public.enqueue_storage_deletion(
      current_user_id, previous.bucket_id, previous.storage_path, 'identity_reference_replaced'
    );
  end loop;

  update public.outfit_visualizations
  set status = 'stale', stale_at = now(), stale_reason = 'identity_reference_replaced'
  where user_id = current_user_id and deleted_at is null and status = 'ready';

  update public.profile_identity_references
  set is_active = true, consent_version = p_consent_version, consented_at = now()
  where id = p_reference_id
  returning * into target;

  -- Keeps the legacy modeled-preview path (profiles.identity_reference_path)
  -- pointing at the same photo, so both pipelines stay consistent during the
  -- overlap period rather than silently diverging.
  update public.profiles
  set identity_reference_path = target.storage_path,
      modeled_preview_consent = true,
      modeled_preview_consent_at = now()
  where id = current_user_id;

  return target;
end;
$$;

revoke all on function public.activate_identity_reference(uuid, text) from public, anon;
grant execute on function public.activate_identity_reference(uuid, text) to authenticated;

-- Revoking consent blocks future generations immediately and optionally
-- removes the reference photo and every generated try-on asset.
create or replace function public.revoke_identity_reference(p_delete_assets boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  reference public.profile_identity_references;
  visualization public.outfit_visualizations;
  removed integer := 0;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- Every non-deleted reference, not just the active one: a photo uploaded and
  -- reviewed but never activated is still a full-body picture of the user's
  -- face sitting in private storage, and "delete my photo" must mean all of
  -- them.
  for reference in
    select * from public.profile_identity_references
    where user_id = current_user_id and deleted_at is null
    for update
  loop
    update public.profile_identity_references
    set is_active = false, deleted_at = now()
    where id = reference.id;
    if p_delete_assets then
      perform public.enqueue_storage_deletion(
        current_user_id, reference.bucket_id, reference.storage_path, 'identity_reference_revoked'
      );
    end if;
  end loop;

  update public.outfit_visualization_jobs
  set status = 'superseded', locked_at = null, locked_until = null
  where user_id = current_user_id and status in ('queued', 'running');

  for visualization in
    select * from public.outfit_visualizations
    where user_id = current_user_id and deleted_at is null
    for update
  loop
    if p_delete_assets and visualization.storage_path is not null then
      perform public.enqueue_storage_deletion(
        current_user_id, visualization.bucket_id, visualization.storage_path, 'consent_revoked'
      );
    end if;
    update public.outfit_visualizations
    set status = 'blocked', error_code = 'consent_revoked',
        error_summary = 'AI try-on consent was revoked.',
        deleted_at = case when p_delete_assets then now() else null end
    where id = visualization.id;
    removed := removed + 1;
  end loop;

  update public.profiles
  set modeled_preview_consent = false, modeled_preview_consent_at = null,
      identity_reference_path = null
  where id = current_user_id;

  return jsonb_build_object('visualizations_blocked', removed, 'assets_deleted', p_delete_assets);
end;
$$;

revoke all on function public.revoke_identity_reference(boolean) from public, anon;
grant execute on function public.revoke_identity_reference(boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Create or reuse a visualization
-- ---------------------------------------------------------------------------

-- The one client-facing entry point into the paid try-on pipeline.
--
-- The caller (an authenticated route handler) has already resolved the source
-- under the viewer's own id, resolved the exact ordered items, and computed
-- the freshness hash. This function is what makes that safe: it re-verifies
-- ownership and availability of every item itself, so a bug in the caller
-- cannot render another user's garment, and it owns the rate limit, the
-- paid-generation quota, the dedupe, and the queue cap transactionally.
--
-- Returns a discriminated outcome. "queue_full" and "quota_exhausted" are
-- never collapsed into "already_fresh": the UI has to be able to tell a user
-- their image is ready from telling them the queue is busy.
create or replace function public.request_outfit_visualization(
  p_source_kind text,
  p_source_id uuid,
  p_source_hash text,
  p_items jsonb,
  p_prompt_version text,
  p_provider text,
  p_model_key text,
  p_capability_version text,
  p_output_size text,
  p_output_quality text,
  p_qa_version text,
  p_localization_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Operational caps, owned by the server. Deliberately constants rather than
  -- parameters: this function is granted to `authenticated`, so any ceiling it
  -- accepted from the caller would be a ceiling the caller could raise.
  max_queued_per_user constant integer := 3;
  rate_limit_per_minute constant integer := 3;
  current_user_id uuid := auth.uid();
  reference public.profile_identity_references;
  existing public.outfit_visualizations;
  item_count integer;
  owned_count integer;
  distinct_roles integer;
  top_count integer;
  bottom_count integer;
  dress_count integer;
  queued_count integer;
  rate_result jsonb;
  quota_result jsonb;
  daily_limit integer;
  new_visualization_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_source_kind not in ('candidate', 'outfit', 'plan', 'composition') then
    raise exception 'invalid_visualization_source_kind' using errcode = '22023';
  end if;
  if p_source_hash is null or btrim(p_source_hash) = '' then
    raise exception 'source_hash_required' using errcode = '22023';
  end if;

  select * into reference
  from public.profile_identity_references
  where user_id = current_user_id and is_active and deleted_at is null;
  if not found then
    return jsonb_build_object('outcome', 'needs_identity');
  end if;
  if reference.consent_version is null then
    return jsonb_build_object('outcome', 'needs_consent', 'consent_version', null);
  end if;

  -- Re-verify the snapshot against owned, active, available items. This is the
  -- authoritative ownership check, independent of whatever the caller resolved.
  select count(*) into item_count from jsonb_array_elements(p_items);
  if item_count = 0 or item_count > 6 then
    raise exception 'invalid_visualization_item_count' using errcode = '22023';
  end if;
  select count(*) into owned_count
  from jsonb_array_elements(p_items) entry
  join public.wardrobe_items item
    on item.id = (entry ->> 'item_id')::uuid
   and item.user_id = current_user_id
   and item.status = 'active'
   and item.availability_status = 'available'
   and item.deleted_at is null;
  if owned_count <> item_count then
    return jsonb_build_object(
      'outcome', 'conflict',
      'reason', 'One or more pieces in this look is no longer available.'
    );
  end if;

  -- The declared role must match the item's actual role. Without this a client
  -- could label its shoes "top" and have the prompt render them as one.
  select count(*) into owned_count
  from jsonb_array_elements(p_items) entry
  join public.wardrobe_items item on item.id = (entry ->> 'item_id')::uuid
  where item.user_id = current_user_id
    and (entry ->> 'role') = coalesce(
      item.layer_role,
      case
        when item.category in ('tops', 'activewear') then 'top'
        when item.category = 'bottoms' then 'bottom'
        when item.category = 'dresses' then 'dress'
        when item.category = 'outerwear' then 'layer'
        when item.category = 'shoes' then 'shoes'
        else 'accessory'
      end
    );
  if owned_count <> item_count then
    return jsonb_build_object(
      'outcome', 'conflict',
      'reason', 'One of these pieces is not the kind of garment it was sent as.'
    );
  end if;

  -- One garment per role, and a real foundation: exactly one dress, or exactly
  -- one top with one bottom. A composition arrives straight from the client,
  -- so without this a user could pay to render themselves wearing only shoes.
  select
    count(distinct entry ->> 'role'),
    count(*) filter (where entry ->> 'role' = 'top'),
    count(*) filter (where entry ->> 'role' = 'bottom'),
    count(*) filter (where entry ->> 'role' = 'dress')
  into distinct_roles, top_count, bottom_count, dress_count
  from jsonb_array_elements(p_items) entry;

  if distinct_roles <> item_count then
    return jsonb_build_object(
      'outcome', 'conflict', 'reason', 'A look can only use one garment per role.'
    );
  end if;
  if not (
    (dress_count = 1 and top_count = 0 and bottom_count = 0)
    or (dress_count = 0 and top_count = 1 and bottom_count = 1)
  ) then
    return jsonb_build_object(
      'outcome', 'conflict',
      'reason', 'A complete look needs one dress, or one top with one bottom.'
    );
  end if;

  -- Fresh reuse before any spend: an identical snapshot under identical
  -- configuration must never start a second paid job.
  select * into existing
  from public.outfit_visualizations
  where user_id = current_user_id
    and source_hash = p_source_hash
    and deleted_at is null
    and status in ('queued', 'validating_inputs', 'generating', 'qa_review', 'localizing', 'ready')
  for update;
  if found then
    return jsonb_build_object(
      'outcome', case when existing.status = 'ready' then 'already_fresh' else 'reused' end,
      'visualization_id', existing.id,
      'status', existing.status
    );
  end if;

  rate_result := public.consume_rate_limit(
    'outfit_visualization_request', rate_limit_per_minute, interval '1 minute', 1
  );
  if not (rate_result ->> 'allowed')::boolean then
    raise exception 'outfit_visualization_rate_limited' using errcode = 'PT429';
  end if;

  select count(*) into queued_count
  from public.outfit_visualization_jobs
  where user_id = current_user_id and status in ('queued', 'running');
  if queued_count >= max_queued_per_user then
    return jsonb_build_object('outcome', 'queue_full', 'reset_at', null);
  end if;

  -- Server-owned budget. Never a parameter: this function is callable by
  -- `authenticated`, so a caller-supplied limit would be no limit at all.
  select limits.daily_limit into daily_limit
  from public.feature_limits limits
  where limits.feature = 'outfit_visualization_generation';
  if daily_limit is null then
    raise exception 'outfit_visualization_budget_not_configured' using errcode = '22023';
  end if;

  quota_result := public.service_check_and_increment_usage_window(
    current_user_id, 'outfit_visualization_generation', daily_limit, 'day', 1
  );
  if not (quota_result ->> 'allowed')::boolean then
    return jsonb_build_object('outcome', 'quota_exhausted', 'reset_at', quota_result ->> 'reset_at');
  end if;

  -- The reuse check above cannot lock a row that does not exist yet, so two
  -- genuinely simultaneous "Try it on" clicks can both reach this insert. The
  -- partial unique index stops the second one from creating a duplicate paid
  -- job; this block turns that collision into the correct user-facing answer
  -- (reuse the winner) instead of a 500, and refunds the quota unit this
  -- request consumed a moment ago but is not going to spend.
  begin
    insert into public.outfit_visualizations (
      user_id, source_kind, source_id, source_hash, status, identity_reference_id,
      prompt_version, provider, model_key, capability_version, output_size, output_quality,
      qa_version, localization_version
    )
    values (
      current_user_id, p_source_kind, p_source_id, p_source_hash, 'queued', reference.id,
      p_prompt_version, p_provider, p_model_key, p_capability_version, p_output_size,
      p_output_quality, p_qa_version, p_localization_version
    )
    returning id into new_visualization_id;
  exception
    when unique_violation then
      update public.feature_usage_counters
      set usage_count = greatest(0, usage_count - 1)
      where user_id = current_user_id
        and feature = 'outfit_visualization_generation'
        and period = 'day'
        and period_start = (clock_timestamp() at time zone 'UTC')::date;

      select * into existing
      from public.outfit_visualizations
      where user_id = current_user_id
        and source_hash = p_source_hash
        and deleted_at is null
        and status in (
          'queued', 'validating_inputs', 'generating', 'qa_review', 'localizing', 'ready'
        );
      if found then
        return jsonb_build_object(
          'outcome', case when existing.status = 'ready' then 'already_fresh' else 'reused' end,
          'visualization_id', existing.id,
          'status', existing.status
        );
      end if;
      raise;
  end;

  insert into public.outfit_visualization_items (
    visualization_id, user_id, item_id, role, sort_order,
    cutout_bucket_id, cutout_storage_path, cutout_sha256
  )
  select
    new_visualization_id, current_user_id, (entry ->> 'item_id')::uuid, entry ->> 'role',
    (entry ->> 'sort_order')::integer, entry ->> 'cutout_bucket_id',
    entry ->> 'cutout_storage_path', entry ->> 'cutout_sha256'
  from jsonb_array_elements(p_items) entry;

  insert into public.outfit_visualization_jobs (visualization_id, user_id)
  values (new_visualization_id, current_user_id);

  return jsonb_build_object(
    'outcome', 'created', 'visualization_id', new_visualization_id, 'status', 'queued'
  );
end;
$$;

revoke all on function public.request_outfit_visualization(
  text, uuid, text, jsonb, text, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.request_outfit_visualization(
  text, uuid, text, jsonb, text, text, text, text, text, text, text, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- Worker lifecycle
-- ---------------------------------------------------------------------------

create or replace function public.claim_outfit_visualization_jobs(
  p_limit integer default 2,
  p_lease_seconds integer default 600,
  p_locked_by text default null
)
returns setof public.outfit_visualization_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit is null or p_lease_seconds is null
    or p_limit not between 1 and 20 or p_lease_seconds not between 60 and 1800
  then
    raise exception 'invalid_visualization_claim_parameters' using errcode = '22023';
  end if;

  -- Retire jobs that have burned their whole retry budget before claiming, so
  -- an unrecoverable job stops occupying the queue and the user sees a
  -- terminal state instead of an endless "generating".
  update public.outfit_visualization_jobs job
  set status = 'failed', last_error_code = 'retry_exhausted',
      last_error_summary = 'Try-on generation exceeded its automatic retry budget.',
      locked_at = null, locked_until = null, locked_by = null
  where job.status in ('queued', 'running', 'failed')
    and job.attempt_count >= job.max_attempts
    and (job.locked_until is null or job.locked_until <= clock_timestamp())
    and job.last_error_code is distinct from 'retry_exhausted';

  update public.outfit_visualizations visualization
  set status = 'failed_terminal', error_code = 'retry_exhausted',
      error_summary = 'Try-on generation exceeded its automatic retry budget.',
      completed_at = coalesce(visualization.completed_at, clock_timestamp())
  from public.outfit_visualization_jobs job
  where job.visualization_id = visualization.id
    and job.last_error_code = 'retry_exhausted'
    and job.status = 'failed'
    and visualization.status not in ('ready', 'failed_terminal', 'superseded', 'blocked');

  return query
  with claimable as (
    select job.id from public.outfit_visualization_jobs job
    where job.status in ('queued', 'running', 'failed')
      and job.attempt_count < job.max_attempts
      and coalesce(job.next_attempt_at, job.created_at) <= clock_timestamp()
      and (job.locked_until is null or job.locked_until <= clock_timestamp())
    order by coalesce(job.next_attempt_at, job.created_at), job.created_at
    for update skip locked
    limit p_limit
  )
  update public.outfit_visualization_jobs job
  set status = 'running', locked_at = clock_timestamp(),
      locked_until = clock_timestamp() + make_interval(secs => p_lease_seconds),
      locked_by = p_locked_by,
      started_at = coalesce(job.started_at, clock_timestamp()),
      attempt_count = job.attempt_count + 1
  from claimable
  where job.id = claimable.id
  returning job.*;
end;
$$;

revoke all on function public.claim_outfit_visualization_jobs(integer, integer, text)
  from public, anon, authenticated;
grant execute on function public.claim_outfit_visualization_jobs(integer, integer, text) to service_role;

-- Interactive counterpart: lets the owning user's own request claim their own
-- queued job. Gated by a deployment flag at the route layer; the RPC itself
-- still refuses to claim anything the caller does not own.
create or replace function public.claim_owned_outfit_visualization_job(
  p_visualization_id uuid,
  p_lease_seconds integer default 600
)
returns setof public.outfit_visualization_jobs
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
  if p_lease_seconds is null or p_lease_seconds not between 60 and 1800 then
    raise exception 'invalid_visualization_claim_parameters' using errcode = '22023';
  end if;

  return query
  with claimable as (
    select job.id from public.outfit_visualization_jobs job
    where job.visualization_id = p_visualization_id
      and job.user_id = current_user_id
      and job.status in ('queued', 'failed')
      and job.attempt_count < job.max_attempts
      and coalesce(job.next_attempt_at, job.created_at) <= clock_timestamp()
      and (job.locked_until is null or job.locked_until <= clock_timestamp())
    for update skip locked
    limit 1
  )
  update public.outfit_visualization_jobs job
  set status = 'running', locked_at = clock_timestamp(),
      locked_until = clock_timestamp() + make_interval(secs => p_lease_seconds),
      locked_by = 'interactive',
      started_at = coalesce(job.started_at, clock_timestamp()),
      attempt_count = job.attempt_count + 1
  from claimable
  where job.id = claimable.id
  returning job.*;
end;
$$;

revoke all on function public.claim_owned_outfit_visualization_job(uuid, integer) from public, anon;
grant execute on function public.claim_owned_outfit_visualization_job(uuid, integer) to authenticated;

-- Moves a leased visualization through validating_inputs -> generating ->
-- qa_review -> localizing so the UI's named progress steps reflect real work
-- rather than a timer.
create or replace function public.advance_outfit_visualization(
  p_visualization_id uuid,
  p_user_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('validating_inputs', 'generating', 'qa_review', 'localizing') then
    raise exception 'invalid_visualization_stage' using errcode = '22023';
  end if;

  update public.outfit_visualizations
  set status = p_status, started_at = coalesce(started_at, clock_timestamp())
  where id = p_visualization_id
    and user_id = p_user_id
    and status in ('queued', 'validating_inputs', 'generating', 'qa_review', 'localizing');
end;
$$;

revoke all on function public.advance_outfit_visualization(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.advance_outfit_visualization(uuid, uuid, text) to service_role;

-- Only reachable after the QA gate accepted the image: `p_qa_status` is
-- written as 'pass' and the row becomes 'ready' in the same transaction that
-- records the asset, so a rejected image can never be observed as ready.
create or replace function public.finalize_outfit_visualization(
  p_job_id uuid,
  p_user_id uuid,
  p_bucket text,
  p_storage_path text,
  p_output_sha256 text,
  p_qa_summary jsonb,
  p_hotspots jsonb,
  p_request_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.outfit_visualization_jobs;
  previous_bucket text;
  previous_path text;
begin
  select * into job from public.outfit_visualization_jobs
  where id = p_job_id and user_id = p_user_id
  for update;
  if not found then
    raise exception 'outfit_visualization_job_not_found' using errcode = 'PT404';
  end if;
  if job.status <> 'running' or job.locked_until is null or job.locked_until <= clock_timestamp() then
    raise exception 'outfit_visualization_job_not_leased' using errcode = '22023';
  end if;

  select bucket_id, storage_path into previous_bucket, previous_path
  from public.outfit_visualizations
  where id = job.visualization_id and user_id = p_user_id;

  -- A regeneration writes to a fresh path, so the object this row is about to
  -- stop pointing at must be queued now or nothing will ever reference it.
  if previous_path is not null and previous_path is distinct from p_storage_path then
    perform public.enqueue_storage_deletion(
      p_user_id, coalesce(previous_bucket, 'wardrobe-generated'), previous_path,
      'visualization_superseded'
    );
  end if;

  update public.outfit_visualizations
  set status = 'ready', bucket_id = p_bucket, storage_path = p_storage_path,
      output_sha256 = p_output_sha256, qa_status = 'pass', qa_summary = p_qa_summary,
      error_code = null, error_summary = null, stale_at = null, stale_reason = null,
      request_id = p_request_id, completed_at = clock_timestamp()
  where id = job.visualization_id and user_id = p_user_id;

  update public.outfit_visualization_items item
  set hotspot = hotspot_entry.value
  from jsonb_array_elements(coalesce(p_hotspots, '[]'::jsonb)) hotspot_entry
  where item.visualization_id = job.visualization_id
    and item.user_id = p_user_id
    and item.item_id = (hotspot_entry.value ->> 'itemId')::uuid;

  update public.outfit_visualization_jobs
  set status = 'complete', completed_at = clock_timestamp(), locked_at = null,
      locked_until = null, locked_by = null, next_attempt_at = null,
      last_error_code = null, last_error_summary = null, request_id = p_request_id
  where id = p_job_id;
end;
$$;

revoke all on function public.finalize_outfit_visualization(
  uuid, uuid, text, text, text, jsonb, jsonb, text
) from public, anon, authenticated;
grant execute on function public.finalize_outfit_visualization(
  uuid, uuid, text, text, text, jsonb, jsonb, text
) to service_role;

-- `p_retryable` decides whether the user sees Retry or a terminal recovery
-- path; the two are never conflated. A terminal failure clears the job so it
-- stops occupying the per-user queue cap.
create or replace function public.fail_outfit_visualization(
  p_job_id uuid,
  p_user_id uuid,
  p_error_code text,
  p_error_summary text,
  p_retryable boolean,
  p_next_attempt_at timestamptz default null,
  p_qa_summary jsonb default null,
  p_request_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare job public.outfit_visualization_jobs;
begin
  select * into job from public.outfit_visualization_jobs
  where id = p_job_id and user_id = p_user_id
  for update;
  if not found then
    raise exception 'outfit_visualization_job_not_found' using errcode = 'PT404';
  end if;

  update public.outfit_visualizations
  set status = case
        when p_error_code in ('consent_revoked', 'moderation_blocked') then 'blocked'
        when p_retryable then 'failed_retryable'
        else 'failed_terminal'
      end,
      error_code = p_error_code,
      error_summary = p_error_summary,
      qa_status = case when p_error_code = 'qa_rejected' then 'fail' else qa_status end,
      qa_summary = coalesce(p_qa_summary, qa_summary),
      request_id = coalesce(p_request_id, request_id),
      completed_at = case when p_retryable then completed_at else clock_timestamp() end
  where id = job.visualization_id and user_id = p_user_id and status <> 'ready';

  update public.outfit_visualization_jobs
  set status = case when p_retryable then 'queued' else 'failed' end,
      last_error_code = p_error_code, last_error_summary = p_error_summary,
      locked_at = null, locked_until = null, locked_by = null,
      next_attempt_at = case when p_retryable then p_next_attempt_at else null end,
      completed_at = case when p_retryable then null else clock_timestamp() end,
      request_id = coalesce(p_request_id, request_id)
  where id = p_job_id;
end;
$$;

revoke all on function public.fail_outfit_visualization(
  uuid, uuid, text, text, boolean, timestamptz, jsonb, text
) from public, anon, authenticated;
grant execute on function public.fail_outfit_visualization(
  uuid, uuid, text, text, boolean, timestamptz, jsonb, text
) to service_role;

-- Retires a job whose inputs disappeared underneath it (the reference photo
-- was replaced mid-flight, the snapshot's items were deleted). Updates BOTH
-- rows in one transaction: marking only the job left the visualization stuck
-- at 'validating_inputs', which the client polls forever because that status
-- is in-flight, with no terminal state and no retry affordance.
create or replace function public.supersede_outfit_visualization(
  p_job_id uuid,
  p_user_id uuid,
  p_reason text default 'inputs_unavailable'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare job public.outfit_visualization_jobs;
begin
  select * into job from public.outfit_visualization_jobs
  where id = p_job_id and user_id = p_user_id
  for update;
  if not found then
    raise exception 'outfit_visualization_job_not_found' using errcode = 'PT404';
  end if;

  update public.outfit_visualization_jobs
  set status = 'superseded', locked_at = null, locked_until = null, locked_by = null,
      completed_at = clock_timestamp(), last_error_code = p_reason
  where id = p_job_id;

  update public.outfit_visualizations
  set status = 'superseded', error_code = p_reason,
      error_summary = 'This try-on''s inputs changed before it could finish.',
      completed_at = clock_timestamp()
  where id = job.visualization_id and user_id = p_user_id and status <> 'ready';
end;
$$;

revoke all on function public.supersede_outfit_visualization(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.supersede_outfit_visualization(uuid, uuid, text) to service_role;

-- Records that a corrective content regeneration was spent. Capped at one by
-- the column constraint, so a bug cannot loop paid corrections.
create or replace function public.record_visualization_correction(
  p_visualization_id uuid,
  p_user_id uuid
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.outfit_visualizations
  set corrective_attempt_count = corrective_attempt_count + 1
  where id = p_visualization_id and user_id = p_user_id and corrective_attempt_count = 0;
$$;

revoke all on function public.record_visualization_correction(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.record_visualization_correction(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Regenerate, feedback, delete
-- ---------------------------------------------------------------------------

-- Re-queues an existing visualization instead of minting a new snapshot: the
-- feedback and QA history stay attached to the same row, which is what keeps
-- a "wrong garment" report debuggable. The paid quota is consumed again,
-- because a regeneration is a new paid call.
create or replace function public.regenerate_outfit_visualization(p_visualization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_queued_per_user constant integer := 3;
  rate_limit_per_minute constant integer := 3;
  current_user_id uuid := auth.uid();
  visualization public.outfit_visualizations;
  snapshot_count integer;
  available_count integer;
  queued_count integer;
  rate_result jsonb;
  quota_result jsonb;
  daily_limit integer;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select * into visualization from public.outfit_visualizations
  where id = p_visualization_id and user_id = current_user_id and deleted_at is null
  for update;
  if not found then
    raise exception 'outfit_visualization_not_found' using errcode = 'PT404';
  end if;
  if not exists (
    select 1 from public.profile_identity_references
    where user_id = current_user_id and id = visualization.identity_reference_id
      and is_active and deleted_at is null
  ) then
    return jsonb_build_object('outcome', 'needs_identity');
  end if;
  if exists (
    select 1 from public.outfit_visualization_jobs
    where visualization_id = p_visualization_id and status in ('queued', 'running')
  ) then
    return jsonb_build_object(
      'outcome', 'reused', 'visualization_id', p_visualization_id, 'status', visualization.status
    );
  end if;

  -- Re-verify the frozen snapshot before spending again. Staleness usually
  -- means a garment became unavailable, and re-rendering the same snapshot
  -- would produce an image presented as current that shows a piece the
  -- deterministic filters would now exclude.
  select count(*) into snapshot_count
  from public.outfit_visualization_items
  where visualization_id = p_visualization_id and user_id = current_user_id;

  select count(*) into available_count
  from public.outfit_visualization_items snapshot
  join public.wardrobe_items item
    on item.id = snapshot.item_id
   and item.user_id = current_user_id
   and item.status = 'active'
   and item.availability_status = 'available'
   and item.deleted_at is null
  where snapshot.visualization_id = p_visualization_id
    and snapshot.user_id = current_user_id;

  if snapshot_count = 0 or available_count <> snapshot_count then
    return jsonb_build_object(
      'outcome', 'conflict',
      'reason', 'A piece in this look is no longer available. Build the look again to try it on.'
    );
  end if;

  rate_result := public.consume_rate_limit(
    'outfit_visualization_request', rate_limit_per_minute, interval '1 minute', 1
  );
  if not (rate_result ->> 'allowed')::boolean then
    raise exception 'outfit_visualization_rate_limited' using errcode = 'PT429';
  end if;

  select count(*) into queued_count from public.outfit_visualization_jobs
  where user_id = current_user_id and status in ('queued', 'running');
  if queued_count >= max_queued_per_user then
    return jsonb_build_object('outcome', 'queue_full', 'reset_at', null);
  end if;

  select limits.daily_limit into daily_limit
  from public.feature_limits limits
  where limits.feature = 'outfit_visualization_generation';
  if daily_limit is null then
    raise exception 'outfit_visualization_budget_not_configured' using errcode = '22023';
  end if;

  quota_result := public.service_check_and_increment_usage_window(
    current_user_id, 'outfit_visualization_generation', daily_limit, 'day', 1
  );
  if not (quota_result ->> 'allowed')::boolean then
    return jsonb_build_object('outcome', 'quota_exhausted', 'reset_at', quota_result ->> 'reset_at');
  end if;

  -- The previous render is about to be replaced by a new object at a fresh
  -- path, so queue its bytes now: once storage_path is overwritten no row
  -- references them and the retention sweep can never reach them.
  if visualization.storage_path is not null then
    perform public.enqueue_storage_deletion(
      current_user_id, visualization.bucket_id, visualization.storage_path,
      'visualization_superseded'
    );
  end if;

  update public.outfit_visualizations
  set status = 'queued', error_code = null, error_summary = null, qa_status = null,
      stale_at = null, stale_reason = null, corrective_attempt_count = 0,
      completed_at = null, bucket_id = null, storage_path = null, output_sha256 = null
  where id = p_visualization_id;

  insert into public.outfit_visualization_jobs (visualization_id, user_id)
  values (p_visualization_id, current_user_id)
  on conflict (visualization_id) where status in ('queued', 'running') do nothing;

  return jsonb_build_object(
    'outcome', 'created', 'visualization_id', p_visualization_id, 'status', 'queued'
  );
end;
$$;

revoke all on function public.regenerate_outfit_visualization(uuid) from public, anon;
grant execute on function public.regenerate_outfit_visualization(uuid) to authenticated;

create or replace function public.record_visualization_feedback(
  p_visualization_id uuid,
  p_reason text,
  p_comment text default null
)
returns public.outfit_visualization_feedback
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  rate_result jsonb;
  saved public.outfit_visualization_feedback;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.outfit_visualizations
    where id = p_visualization_id and user_id = current_user_id and deleted_at is null
  ) then
    raise exception 'outfit_visualization_not_found' using errcode = 'PT404';
  end if;

  rate_result := public.consume_rate_limit(
    'outfit_visualization_feedback', 30, interval '1 hour', 1
  );
  if not (rate_result ->> 'allowed')::boolean then
    raise exception 'outfit_visualization_feedback_rate_limited' using errcode = 'PT429';
  end if;

  insert into public.outfit_visualization_feedback (visualization_id, user_id, reason, comment)
  values (p_visualization_id, current_user_id, p_reason, nullif(btrim(coalesce(p_comment, '')), ''))
  on conflict (visualization_id, user_id, reason) do update
  set comment = excluded.comment, created_at = now()
  returning * into saved;

  return saved;
end;
$$;

revoke all on function public.record_visualization_feedback(uuid, text, text) from public, anon;
grant execute on function public.record_visualization_feedback(uuid, text, text) to authenticated;

-- Soft-deletes a visualization and queues its generated bytes for removal.
create or replace function public.delete_outfit_visualization(p_visualization_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  visualization public.outfit_visualizations;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select * into visualization from public.outfit_visualizations
  where id = p_visualization_id and user_id = current_user_id and deleted_at is null
  for update;
  if not found then return false; end if;

  if visualization.storage_path is not null then
    perform public.enqueue_storage_deletion(
      current_user_id, visualization.bucket_id, visualization.storage_path, 'visualization_deleted'
    );
  end if;
  update public.outfit_visualization_jobs
  set status = 'superseded', locked_at = null, locked_until = null
  where visualization_id = p_visualization_id and status in ('queued', 'running');
  update public.outfit_visualizations set deleted_at = now() where id = p_visualization_id;
  return true;
end;
$$;

revoke all on function public.delete_outfit_visualization(uuid) from public, anon;
grant execute on function public.delete_outfit_visualization(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Staleness -- a rendered image must never silently misrepresent the wardrobe
-- ---------------------------------------------------------------------------

-- Any change to a snapshot member item that could alter how it renders
-- (a new/removed cutout, an availability change, archival, deletion) marks
-- every ready visualization containing it stale. Identity-reference and
-- configuration changes are handled separately: the former in
-- activate_identity_reference(), the latter by the freshness hash, which
-- simply stops matching so the next request creates a new visualization.
create or replace function public.mark_visualizations_stale_for_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_item_id uuid := coalesce(new.item_id, old.item_id);
  affected_user_id uuid := coalesce(new.user_id, old.user_id);
begin
  update public.outfit_visualizations visualization
  set status = 'stale', stale_at = now(), stale_reason = 'wardrobe_item_changed'
  where visualization.user_id = affected_user_id
    and visualization.status = 'ready'
    and visualization.deleted_at is null
    and exists (
      select 1 from public.outfit_visualization_items snapshot
      where snapshot.visualization_id = visualization.id
        and snapshot.item_id = affected_item_id
    );
  return coalesce(new, old);
end;
$$;

drop trigger if exists mark_visualizations_stale_on_cutout_change
  on public.wardrobe_item_images;
create trigger mark_visualizations_stale_on_cutout_change
after insert or update or delete on public.wardrobe_item_images
for each row execute function public.mark_visualizations_stale_for_item();

create or replace function public.mark_visualizations_stale_for_wardrobe_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and new.status is not distinct from old.status
    and new.availability_status is not distinct from old.availability_status
    and new.deleted_at is not distinct from old.deleted_at
  then
    return new;
  end if;

  update public.outfit_visualizations visualization
  set status = 'stale', stale_at = now(), stale_reason = 'wardrobe_item_changed'
  where visualization.user_id = coalesce(new.user_id, old.user_id)
    and visualization.status = 'ready'
    and visualization.deleted_at is null
    and exists (
      select 1 from public.outfit_visualization_items snapshot
      where snapshot.visualization_id = visualization.id
        and snapshot.item_id = coalesce(new.id, old.id)
    );
  return coalesce(new, old);
end;
$$;

drop trigger if exists mark_visualizations_stale_on_item_change on public.wardrobe_items;
create trigger mark_visualizations_stale_on_item_change
after update or delete on public.wardrobe_items
for each row execute function public.mark_visualizations_stale_for_wardrobe_item();

-- ---------------------------------------------------------------------------
-- Account export -- the owner can retrieve every new row
-- ---------------------------------------------------------------------------

-- Metadata only. Generated image *bytes* are not embedded in the JSON export;
-- they live in the private bucket and are already enumerated under
-- 'storage_objects', which the owner downloads through signed URLs.
create or replace function public.export_my_visualization_data()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'profile_identity_references', coalesce((
      select jsonb_agg(to_jsonb(reference) order by reference.created_at)
      from public.profile_identity_references reference where reference.user_id = auth.uid()
    ), '[]'::jsonb),
    'outfit_visualizations', coalesce((
      select jsonb_agg(to_jsonb(visualization) order by visualization.created_at)
      from public.outfit_visualizations visualization where visualization.user_id = auth.uid()
    ), '[]'::jsonb),
    'outfit_visualization_items', coalesce((
      select jsonb_agg(to_jsonb(item) order by item.created_at)
      from public.outfit_visualization_items item where item.user_id = auth.uid()
    ), '[]'::jsonb),
    'outfit_visualization_jobs', coalesce((
      select jsonb_agg(to_jsonb(job) order by job.created_at)
      from public.outfit_visualization_jobs job where job.user_id = auth.uid()
    ), '[]'::jsonb),
    'outfit_visualization_feedback', coalesce((
      select jsonb_agg(to_jsonb(feedback) order by feedback.created_at)
      from public.outfit_visualization_feedback feedback where feedback.user_id = auth.uid()
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.export_my_visualization_data() from public, anon;
grant execute on function public.export_my_visualization_data() to authenticated;

-- ---------------------------------------------------------------------------
-- Retention -- superseded and failed attempts do not keep private bytes
-- ---------------------------------------------------------------------------

-- Keeps the safe debugging metadata (status, error code, QA summary, request
-- id) and drops only the private image itself. Ready visualizations are never
-- pruned here: the user decides when those go.
create or replace function public.prune_outfit_visualization_assets(
  p_retain_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  visualization public.outfit_visualizations;
  queued integer := 0;
begin
  if p_retain_days is null or p_retain_days not between 1 and 365 then
    raise exception 'invalid_retention_window' using errcode = '22023';
  end if;

  for visualization in
    select * from public.outfit_visualizations
    where storage_path is not null
      and status in ('superseded', 'failed_terminal', 'blocked')
      and updated_at < now() - make_interval(days => p_retain_days)
    for update
  loop
    perform public.enqueue_storage_deletion(
      visualization.user_id, visualization.bucket_id, visualization.storage_path,
      'visualization_retention'
    );
    update public.outfit_visualizations
    set bucket_id = null, storage_path = null, output_sha256 = null
    where id = visualization.id;
    queued := queued + 1;
  end loop;

  return jsonb_build_object('visualization_assets_queued', queued);
end;
$$;

revoke all on function public.prune_outfit_visualization_assets(integer)
  from public, anon, authenticated;
grant execute on function public.prune_outfit_visualization_assets(integer) to service_role;

-- The Outfit Studio's service-role worker paths (a discarded raw identity
-- upload, a superseded generated asset) need to queue byte deletion directly
-- rather than only from inside another security-definer function. Additive:
-- public/anon/authenticated remain revoked exactly as before.
grant execute on function public.enqueue_storage_deletion(uuid, text, text, text) to service_role;

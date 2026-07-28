-- Wardrobe AI: make account-deletion status tell the truth.
--
-- Before this migration the flow marked a deletion 'complete' the moment the
-- Auth user was removed, while the user's private images were still sitting in
-- Storage waiting for a background worker. The audit record -- and the copy
-- shown to the person who asked to be forgotten -- therefore claimed a
-- deletion had finished that had not.
--
-- After this migration 'complete' means all three of: the Auth identity is
-- gone, the relational cascade has run, and every queued Storage object has
-- been removed or verified absent. Anything short of that is a distinct,
-- named, resumable state.
--
--   requested                  row exists, manifest not yet enqueued
--   storage_deletion_queued    every owned object is on the queue
--   deleting_auth_user         about to call the Admin API
--   auth_deleted_storage_pending  identity gone, bytes still being removed
--   complete                   all of the above finished
--   failed                     needs operator attention
--
-- Additive: the historical migration is untouched. The status CHECK is widened
-- (never narrowed), so every existing row stays valid.

set search_path = public, extensions;

alter table public.account_deletion_requests
  drop constraint if exists account_deletion_requests_status_check;

alter table public.account_deletion_requests
  add constraint account_deletion_requests_status_check check (
    status in (
      'requested',
      'storage_deletion_queued',
      'deleting_auth_user',
      'auth_deleted_storage_pending',
      'complete',
      'failed'
    )
  );

alter table public.account_deletion_requests
  add column if not exists auth_deleted_at timestamptz,
  add column if not exists storage_objects_completed integer not null default 0,
  -- Set when Storage cleanup has exhausted its retries. The row is kept for an
  -- operator to repair rather than being quietly closed.
  add column if not exists attention_required boolean not null default false;

alter table public.account_deletion_requests
  drop constraint if exists account_deletion_requests_storage_objects_completed_check;
alter table public.account_deletion_requests
  add constraint account_deletion_requests_storage_objects_completed_check
    check (storage_objects_completed >= 0);

-- The active-request index must also treat the new in-flight state as active,
-- so a retried request resumes the same row instead of inserting a second one.
drop index if exists public.account_deletion_requests_active_user_idx;
create unique index if not exists account_deletion_requests_active_user_idx
  on public.account_deletion_requests (user_id)
  where status not in ('complete', 'failed');

-- ---------------------------------------------------------------------------
-- Storage queue: bounded retries and a dead-letter state
-- ---------------------------------------------------------------------------

alter table public.storage_deletion_queue
  drop constraint if exists storage_deletion_queue_status_check;

alter table public.storage_deletion_queue
  add constraint storage_deletion_queue_status_check check (
    status in ('pending', 'processing', 'complete', 'failed', 'dead_letter')
  );

-- 'dead_letter' is deliberately outside the claim predicate
-- (`status in ('pending','failed','processing')`), so an object that cannot be
-- deleted stops consuming worker capacity while staying visible for repair.
comment on column public.storage_deletion_queue.status is
  'pending|processing|complete|failed (retryable)|dead_letter (retries exhausted, awaiting operator)';

-- ---------------------------------------------------------------------------
-- Worker-facing transitions
-- ---------------------------------------------------------------------------

-- Marks one object gone and, when it was part of an account deletion, closes
-- out the parent request if nothing is left outstanding. Doing both in one
-- statement-scoped function means the parent can never be marked complete by a
-- worker that crashed between the two writes.
create or replace function public.complete_storage_deletion_task(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  task public.storage_deletion_queue;
begin
  update public.storage_deletion_queue
  set status = 'complete',
      locked_until = null,
      error_message = null,
      completed_at = clock_timestamp()
  where id = p_task_id and status = 'processing'
  returning * into task;

  if task.id is null then
    return jsonb_build_object('updated', false, 'account_deletion_complete', false);
  end if;

  if task.reason <> 'account_deletion' then
    return jsonb_build_object('updated', true, 'account_deletion_complete', false);
  end if;

  return jsonb_build_object(
    'updated', true,
    'account_deletion_complete', public.finalize_account_deletion_storage(task.user_id)
  );
end;
$$;

-- Records a failed attempt, and retires the object to the dead-letter state
-- once the attempt budget is spent. The parent deletion is then flagged for
-- attention instead of being reported as finished.
create or replace function public.fail_storage_deletion_task(
  p_task_id uuid,
  p_next_attempt_at timestamptz,
  p_max_attempts integer default 8
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  task public.storage_deletion_queue;
  exhausted boolean;
begin
  select * into task from public.storage_deletion_queue where id = p_task_id;
  if task.id is null then
    return jsonb_build_object('updated', false, 'dead_lettered', false);
  end if;

  exhausted := task.attempt_count >= p_max_attempts;

  update public.storage_deletion_queue
  set status = case when exhausted then 'dead_letter' else 'failed' end,
      locked_until = null,
      next_attempt_at = case when exhausted then clock_timestamp() else p_next_attempt_at end,
      -- Fixed string: a provider error could name a bucket or an object path.
      error_message = 'Private object cleanup could not be completed.',
      completed_at = null
  where id = p_task_id and status = 'processing';

  if exhausted and task.reason = 'account_deletion' then
    update public.account_deletion_requests
    set attention_required = true
    where user_id = task.user_id and status <> 'complete';
  end if;

  return jsonb_build_object('updated', true, 'dead_lettered', exhausted);
end;
$$;

-- Closes an account deletion when, and only when, no account-deletion object
-- for that user is still outstanding. Idempotent: calling it repeatedly, or
-- after the request is already complete, changes nothing.
create or replace function public.finalize_account_deletion_storage(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  outstanding integer;
  completed integer;
  finalized integer;
begin
  select
    count(*) filter (where task.status <> 'complete'),
    count(*) filter (where task.status = 'complete')
  into outstanding, completed
  from public.storage_deletion_queue task
  where task.user_id = p_user_id and task.reason = 'account_deletion';

  update public.account_deletion_requests
  set storage_objects_completed = completed
  where user_id = p_user_id and status <> 'complete';

  if outstanding > 0 then
    return false;
  end if;

  -- Only a request that has actually reached the post-Auth-deletion state may
  -- be completed here. An empty queue for a request still at 'requested' means
  -- nothing has been deleted yet, not that everything has.
  update public.account_deletion_requests
  set status = 'complete',
      completed_at = coalesce(completed_at, clock_timestamp()),
      attention_required = false
  where user_id = p_user_id
    and status = 'auth_deleted_storage_pending';

  get diagnostics finalized = row_count;
  return finalized > 0;
end;
$$;

-- Called by the application immediately after the Admin API removed the Auth
-- user. Chooses the honest next state: nothing queued means the deletion truly
-- is finished; anything queued means the bytes are still on their way out.
create or replace function public.mark_account_deletion_auth_deleted(p_user_id uuid)
returns public.account_deletion_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  outstanding integer;
  result public.account_deletion_requests;
begin
  select count(*) into outstanding
  from public.storage_deletion_queue task
  where task.user_id = p_user_id
    and task.reason = 'account_deletion'
    and task.status <> 'complete';

  update public.account_deletion_requests
  set status = case when outstanding = 0 then 'complete' else 'auth_deleted_storage_pending' end,
      auth_deleted_at = coalesce(auth_deleted_at, clock_timestamp()),
      completed_at = case when outstanding = 0 then clock_timestamp() else completed_at end
  where user_id = p_user_id
    and status in ('storage_deletion_queued', 'deleting_auth_user', 'auth_deleted_storage_pending')
  returning * into result;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Operational health and retention
-- ---------------------------------------------------------------------------

-- Aggregates only. No user ids, bucket names, object paths, or error detail --
-- this is exposed on a worker-secret endpoint, and a monitoring dashboard has
-- no business seeing whose files failed to delete.
create or replace function public.storage_deletion_health()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'pending', count(*) filter (where status in ('pending', 'failed')),
    'processing', count(*) filter (where status = 'processing'),
    'dead_letter', count(*) filter (where status = 'dead_letter'),
    'oldest_pending_age_seconds', coalesce(
      extract(epoch from (
        clock_timestamp() - min(created_at) filter (where status in ('pending', 'failed'))
      ))::integer,
      0
    ),
    'failures_last_24h', count(*) filter (
      where status in ('failed', 'dead_letter') and updated_at > clock_timestamp() - interval '24 hours'
    ),
    'account_deletions_awaiting_storage', (
      select count(*) from public.account_deletion_requests
      where status = 'auth_deleted_storage_pending'
    ),
    'account_deletions_needing_attention', (
      select count(*) from public.account_deletion_requests where attention_required
    )
  )
  from public.storage_deletion_queue;
$$;

-- Prunes finished records only. A dead-lettered object, or a deletion still
-- flagged for attention, is never removed: it is the only remaining evidence
-- that something needs repairing.
create or replace function public.prune_completed_account_deletions(
  p_retention_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  requests_deleted integer;
  queue_rows_deleted integer;
begin
  if p_retention_days is null or p_retention_days not between 1 and 3650 then
    raise exception 'invalid_retention_window' using errcode = '22023';
  end if;

  delete from public.storage_deletion_queue
  where status = 'complete'
    and completed_at < clock_timestamp() - make_interval(days => p_retention_days);
  get diagnostics queue_rows_deleted = row_count;

  delete from public.account_deletion_requests
  where status = 'complete'
    and not attention_required
    and completed_at < clock_timestamp() - make_interval(days => p_retention_days);
  get diagnostics requests_deleted = row_count;

  return jsonb_build_object(
    'account_deletion_requests_deleted', requests_deleted,
    'storage_deletion_queue_rows_deleted', queue_rows_deleted
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Step-up enforcement on the destructive RPCs
-- ---------------------------------------------------------------------------

-- Security-definer functions run as their owner and therefore bypass RLS,
-- which means the restrictive MFA policies added in 202607280002 do not cover
-- them. Deletion is the one path where that gap would be unrecoverable, so the
-- check is made explicit here. Replacing the function bodies in a new
-- migration leaves the historical files untouched.
create or replace function public.start_account_deletion()
returns public.account_deletion_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  manifest jsonb;
  storage_object jsonb;
  object_count integer := 0;
  result public.account_deletion_requests;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if not public.mfa_requirement_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  -- Claim the request at 'requested' *before* the manifest is walked, so a
  -- crash partway through enqueueing is distinguishable from a request whose
  -- objects are all safely on the queue. Without this the row would only
  -- appear once every object was enqueued, and a half-finished enqueue would
  -- look exactly like one that never started.
  insert into public.account_deletion_requests (user_id, status)
  values (current_user_id, 'requested')
  on conflict (user_id) where status not in ('complete', 'failed')
  do nothing;

  manifest := public.account_deletion_manifest();

  for storage_object in select * from jsonb_array_elements(manifest -> 'storage_objects')
  loop
    perform public.enqueue_storage_deletion(
      current_user_id,
      storage_object ->> 'bucket_id',
      storage_object ->> 'name',
      'account_deletion'
    );
    object_count := object_count + 1;
  end loop;

  insert into public.account_deletion_requests (
    user_id, status, storage_objects_total, wardrobe_item_count, outfit_count,
    conversation_count, storage_queued_at
  )
  values (
    current_user_id, 'storage_deletion_queued', object_count,
    coalesce((manifest ->> 'wardrobe_item_count')::integer, 0),
    coalesce((manifest ->> 'outfit_count')::integer, 0),
    coalesce((manifest ->> 'conversation_count')::integer, 0),
    clock_timestamp()
  )
  on conflict (user_id) where status not in ('complete', 'failed')
  do update set
    -- Advance out of 'requested' now that every object is queued, but never
    -- regress a retry that had already reached the Auth-deletion step.
    status = case
      when public.account_deletion_requests.status = 'requested' then excluded.status
      else public.account_deletion_requests.status
    end,
    storage_objects_total = excluded.storage_objects_total,
    wardrobe_item_count = excluded.wardrobe_item_count,
    outfit_count = excluded.outfit_count,
    conversation_count = excluded.conversation_count,
    storage_queued_at = coalesce(public.account_deletion_requests.storage_queued_at, excluded.storage_queued_at),
    attempt_count = public.account_deletion_requests.attempt_count + 1
  returning * into result;

  return result;
end;
$$;

create or replace function public.mark_account_deletion_auth_pending()
returns public.account_deletion_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  result public.account_deletion_requests;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if not public.mfa_requirement_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  update public.account_deletion_requests
  set
    status = 'deleting_auth_user',
    auth_deletion_started_at = coalesce(auth_deletion_started_at, clock_timestamp())
  where user_id = current_user_id
    and status in ('requested', 'storage_deletion_queued', 'deleting_auth_user')
  returning * into result;

  if result is null then
    raise exception 'account_deletion_not_ready' using errcode = '22023';
  end if;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke all on function public.complete_storage_deletion_task(uuid) from public, anon, authenticated;
grant execute on function public.complete_storage_deletion_task(uuid) to service_role;

revoke all on function public.fail_storage_deletion_task(uuid, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.fail_storage_deletion_task(uuid, timestamptz, integer) to service_role;

revoke all on function public.finalize_account_deletion_storage(uuid) from public, anon, authenticated;
grant execute on function public.finalize_account_deletion_storage(uuid) to service_role;

revoke all on function public.mark_account_deletion_auth_deleted(uuid) from public, anon, authenticated;
grant execute on function public.mark_account_deletion_auth_deleted(uuid) to service_role;

revoke all on function public.storage_deletion_health() from public, anon, authenticated;
grant execute on function public.storage_deletion_health() to service_role;

revoke all on function public.prune_completed_account_deletions(integer) from public, anon, authenticated;
grant execute on function public.prune_completed_account_deletions(integer) to service_role;

revoke all on function public.start_account_deletion() from public, anon;
grant execute on function public.start_account_deletion() to authenticated;

revoke all on function public.mark_account_deletion_auth_pending() from public, anon;
grant execute on function public.mark_account_deletion_auth_pending() to authenticated;

-- Wardrobe AI: durable, resumable account-deletion workflow.
--
-- Additive only: no existing table, column, or function is altered or dropped.
-- Replaces the previous synchronous "delete every Storage object inline, then
-- delete the Auth user" request with two decoupled, retryable steps:
--
--   1. start_account_deletion() durably records the request and enqueues every
--      owned Storage object into the existing storage_deletion_queue (the same
--      queue the wardrobe-image/import cleanup triggers already use), which
--      the existing claim_storage_deletion_tasks() worker drains in the
--      background with its own retry/backoff.
--   2. The application route deletes the Auth user through the Admin API
--      (unchanged - that step is not expressible as a database RPC), then
--      records completion.
--
-- account_deletion_requests deliberately has no foreign key to profiles, for
-- the same reason as storage_deletion_queue: the audit row must survive the
-- Auth-user cascade so a completed deletion stays observable afterward.

set search_path = public, extensions;

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  status text not null default 'storage_deletion_queued',
  storage_objects_total integer not null default 0,
  wardrobe_item_count integer not null default 0,
  outfit_count integer not null default 0,
  conversation_count integer not null default 0,
  attempt_count integer not null default 0,
  requested_at timestamptz not null default now(),
  storage_queued_at timestamptz,
  auth_deletion_started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_deletion_requests_status_check check (
    status in ('storage_deletion_queued', 'deleting_auth_user', 'complete', 'failed')
  ),
  constraint account_deletion_requests_storage_objects_total_check check (storage_objects_total >= 0),
  constraint account_deletion_requests_attempt_count_check check (attempt_count >= 0)
);

-- At most one active (non-terminal) request per user: a retried DELETE call
-- resumes the same row instead of creating a duplicate.
create unique index if not exists account_deletion_requests_active_user_idx
  on public.account_deletion_requests (user_id)
  where status not in ('complete', 'failed');

create index if not exists account_deletion_requests_user_created_idx
  on public.account_deletion_requests (user_id, created_at desc);

alter table public.account_deletion_requests enable row level security;

drop policy if exists user_select on public.account_deletion_requests;
create policy user_select on public.account_deletion_requests
for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.account_deletion_requests from anon, authenticated;
grant select on table public.account_deletion_requests to authenticated;
grant select, insert, update, delete on table public.account_deletion_requests to service_role;

drop trigger if exists set_account_deletion_requests_updated_at on public.account_deletion_requests;
create trigger set_account_deletion_requests_updated_at
before update on public.account_deletion_requests
for each row execute function public.set_updated_at();

-- Idempotently records the deletion request and enqueues every owned Storage
-- object for background removal. Safe to call repeatedly: enqueue_storage_deletion
-- upserts each object back to 'pending', and the unique active-request index
-- makes this an update, not a duplicate insert, on retry.
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

-- Marks the caller's active request as entering the (non-database) Auth-user
-- deletion step, so a crash between this call and the Admin API call is
-- visible and resumable: the request row stays at 'deleting_auth_user'
-- instead of silently vanishing.
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

  update public.account_deletion_requests
  set
    status = 'deleting_auth_user',
    auth_deletion_started_at = coalesce(auth_deletion_started_at, clock_timestamp())
  where user_id = current_user_id
    and status in ('storage_deletion_queued', 'deleting_auth_user')
  returning * into result;

  if result is null then
    raise exception 'account_deletion_not_ready' using errcode = '22023';
  end if;

  return result;
end;
$$;

revoke all on function public.start_account_deletion() from public, anon;
grant execute on function public.start_account_deletion() to authenticated;

revoke all on function public.mark_account_deletion_auth_pending() from public, anon;
grant execute on function public.mark_account_deletion_auth_pending() to authenticated;

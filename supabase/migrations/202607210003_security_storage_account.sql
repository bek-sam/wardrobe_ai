-- Wardrobe AI: row-level security, private storage, account lifecycle helpers,
-- and grants. RLS is defense in depth; API routes must still authenticate and
-- validate every request.

set search_path = public, extensions;

alter table public.profiles enable row level security;

drop policy if exists user_select on public.profiles;
create policy user_select on public.profiles
for select to authenticated
using ((select auth.uid()) = id);

drop policy if exists user_insert on public.profiles;
create policy user_insert on public.profiles
for insert to authenticated
with check ((select auth.uid()) = id);

drop policy if exists user_update on public.profiles;
create policy user_update on public.profiles
for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'style_profiles',
    'wardrobe_items',
    'wardrobe_item_images',
    'outfits',
    'outfit_items',
    'outfit_plans',
    'outfit_feedback',
    'conversations',
    'messages'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);

    execute format('drop policy if exists user_select on public.%I', table_name);
    execute format(
      'create policy user_select on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      table_name
    );

    execute format('drop policy if exists user_insert on public.%I', table_name);
    execute format(
      'create policy user_insert on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
      table_name
    );

    execute format('drop policy if exists user_update on public.%I', table_name);
    execute format(
      'create policy user_update on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      table_name
    );

    execute format('drop policy if exists user_delete on public.%I', table_name);
    execute format(
      'create policy user_delete on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',
      table_name
    );
  end loop;
end;
$$;

-- Workflow tables are read-only to authenticated clients. Queue creation,
-- owned claims, confirmation/decisions, and worker transitions are limited to
-- RPCs or the server-only service role, preventing direct status resets and
-- retry-budget bypasses.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'import_jobs',
    'import_job_candidates',
    'item_research_runs',
    'research_sources'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists user_select on public.%I', table_name);
    execute format(
      'create policy user_select on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      table_name
    );
    execute format('drop policy if exists user_insert on public.%I', table_name);
    execute format('drop policy if exists user_update on public.%I', table_name);
    execute format('drop policy if exists user_delete on public.%I', table_name);
  end loop;
end;
$$;

-- Wear history is append-only to authenticated clients. The mark-worn RPCs
-- write the log, snapshot its items, and increment counters in one transaction.
alter table public.wear_logs enable row level security;
alter table public.wear_log_items enable row level security;

drop policy if exists user_select on public.wear_logs;
create policy user_select on public.wear_logs
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists user_select on public.wear_log_items;
create policy user_select on public.wear_log_items
for select to authenticated
using ((select auth.uid()) = user_id);

-- Agent traces are server-authored and read-only to the user. Never put hidden
-- reasoning or raw secrets into these summary fields.
alter table public.agent_runs enable row level security;
drop policy if exists user_select on public.agent_runs;
create policy user_select on public.agent_runs
for select to authenticated
using ((select auth.uid()) = user_id);
drop policy if exists user_insert on public.agent_runs;

alter table public.generated_outfit_saves enable row level security;
drop policy if exists user_select on public.generated_outfit_saves;
create policy user_select on public.generated_outfit_saves
for select to authenticated
using ((select auth.uid()) = user_id);

-- Operational records can be inspected by their owner, but mutations go
-- through security-definer RPCs or a service-role worker.
alter table public.api_idempotency_keys enable row level security;
alter table public.rate_limit_events enable row level security;
alter table public.feature_usage_counters enable row level security;
alter table public.feature_limits enable row level security;
alter table public.storage_deletion_queue enable row level security;

drop policy if exists user_select on public.api_idempotency_keys;
create policy user_select on public.api_idempotency_keys
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists user_select on public.rate_limit_events;
create policy user_select on public.rate_limit_events
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists user_select on public.feature_usage_counters;
create policy user_select on public.feature_usage_counters
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists user_select on public.storage_deletion_queue;
create policy user_select on public.storage_deletion_queue
for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.profiles from anon, authenticated;
grant select, insert, update on table public.profiles to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'style_profiles',
    'wardrobe_items',
    'wardrobe_item_images',
    'outfits',
    'outfit_items',
    'outfit_plans',
    'outfit_feedback',
    'conversations',
    'messages'
  ] loop
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
  end loop;
end;
$$;

revoke all on table
  public.import_jobs,
  public.import_job_candidates,
  public.item_research_runs,
  public.research_sources
from anon, authenticated;
grant select on table
  public.import_jobs,
  public.import_job_candidates,
  public.item_research_runs,
  public.research_sources
to authenticated;

-- Outfit composition is created/swapped only through transactional RPCs. Users
-- may still edit outfit metadata or delete the parent (which cascades items).
revoke insert on table public.outfits from authenticated;
revoke insert, update, delete on table public.outfit_items from authenticated;

revoke all on table public.wear_logs, public.wear_log_items from anon, authenticated;
grant select on table public.wear_logs, public.wear_log_items to authenticated;

revoke all on table public.agent_runs from anon, authenticated;
grant select on table public.agent_runs to authenticated;

revoke all on table public.generated_outfit_saves from anon, authenticated;
grant select on table public.generated_outfit_saves to authenticated;

revoke all on table public.api_idempotency_keys, public.rate_limit_events, public.feature_usage_counters, public.storage_deletion_queue from anon, authenticated;
grant select on table public.api_idempotency_keys, public.rate_limit_events, public.feature_usage_counters, public.storage_deletion_queue to authenticated;

-- Global quota configuration is intentionally invisible and immutable to app
-- users; enqueue RPCs read it under their fixed security-definer contracts.
revoke all on table public.feature_limits from anon, authenticated;

-- Make background-worker access explicit instead of relying on project-level
-- default privileges. The service-role JWT remains server-only and bypasses RLS.
grant select, insert, update, delete on table
  public.profiles,
  public.style_profiles,
  public.wardrobe_items,
  public.wardrobe_item_images,
  public.import_jobs,
  public.import_job_candidates,
  public.item_research_runs,
  public.research_sources,
  public.outfits,
  public.outfit_items,
  public.outfit_plans,
  public.wear_logs,
  public.wear_log_items,
  public.outfit_feedback,
  public.conversations,
  public.messages,
  public.agent_runs,
  public.generated_outfit_saves,
  public.api_idempotency_keys,
  public.rate_limit_events,
  public.feature_usage_counters,
  public.feature_limits,
  public.storage_deletion_queue
to service_role;
grant usage, select on sequence public.rate_limit_events_id_seq to service_role;

-- Storage paths always begin with the authenticated user's UUID. Buckets are
-- private; browser access should use user-scoped requests or short-lived signed
-- URLs created by authenticated server routes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('wardrobe-originals', 'wardrobe-originals', false, 26214400, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  ('wardrobe-items', 'wardrobe-items', false, 20971520, array['image/jpeg', 'image/png', 'image/webp']),
  ('wardrobe-labels', 'wardrobe-labels', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  ('wardrobe-generated', 'wardrobe-generated', false, 20971520, array['image/jpeg', 'image/png', 'image/webp']),
  ('profile-references', 'profile-references', false, 20971520, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists wardrobe_user_select on storage.objects;
create policy wardrobe_user_select on storage.objects
for select to authenticated
using (
  bucket_id in ('wardrobe-originals', 'wardrobe-items', 'wardrobe-labels', 'wardrobe-generated', 'profile-references')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists wardrobe_user_insert on storage.objects;
create policy wardrobe_user_insert on storage.objects
for insert to authenticated
with check (
  bucket_id in ('wardrobe-originals', 'wardrobe-items', 'wardrobe-labels', 'wardrobe-generated', 'profile-references')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists wardrobe_user_update on storage.objects;
create policy wardrobe_user_update on storage.objects
for update to authenticated
using (
  bucket_id in ('wardrobe-originals', 'wardrobe-items', 'wardrobe-labels', 'wardrobe-generated', 'profile-references')
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id in ('wardrobe-originals', 'wardrobe-items', 'wardrobe-labels', 'wardrobe-generated', 'profile-references')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists wardrobe_user_delete on storage.objects;
create policy wardrobe_user_delete on storage.objects
for delete to authenticated
using (
  bucket_id in ('wardrobe-originals', 'wardrobe-items', 'wardrobe-labels', 'wardrobe-generated', 'profile-references')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create or replace function public.export_my_account_data()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'schema_version', 1,
    'exported_at', now(),
    'user_id', auth.uid(),
    'profile', (
      select to_jsonb(profile) from public.profiles profile where profile.id = auth.uid()
    ),
    'style_profile', (
      select to_jsonb(style) from public.style_profiles style where style.user_id = auth.uid()
    ),
    'wardrobe_items', coalesce((
      select jsonb_agg(to_jsonb(item) order by item.created_at)
      from public.wardrobe_items item where item.user_id = auth.uid()
    ), '[]'::jsonb),
    'wardrobe_item_images', coalesce((
      select jsonb_agg(to_jsonb(image) order by image.created_at)
      from public.wardrobe_item_images image where image.user_id = auth.uid()
    ), '[]'::jsonb),
    'import_jobs', coalesce((
      select jsonb_agg(to_jsonb(job) order by job.created_at)
      from public.import_jobs job where job.user_id = auth.uid()
    ), '[]'::jsonb),
    'import_job_candidates', coalesce((
      select jsonb_agg(to_jsonb(candidate) order by candidate.created_at)
      from public.import_job_candidates candidate where candidate.user_id = auth.uid()
    ), '[]'::jsonb),
    'item_research_runs', coalesce((
      select jsonb_agg(to_jsonb(run) order by run.created_at)
      from public.item_research_runs run where run.user_id = auth.uid()
    ), '[]'::jsonb),
    'research_sources', coalesce((
      select jsonb_agg(to_jsonb(source) order by source.created_at)
      from public.research_sources source where source.user_id = auth.uid()
    ), '[]'::jsonb),
    'outfits', coalesce((
      select jsonb_agg(to_jsonb(outfit) order by outfit.created_at)
      from public.outfits outfit where outfit.user_id = auth.uid()
    ), '[]'::jsonb),
    'outfit_items', coalesce((
      select jsonb_agg(to_jsonb(item) order by item.created_at)
      from public.outfit_items item where item.user_id = auth.uid()
    ), '[]'::jsonb),
    'outfit_plans', coalesce((
      select jsonb_agg(to_jsonb(plan) order by plan.created_at)
      from public.outfit_plans plan where plan.user_id = auth.uid()
    ), '[]'::jsonb),
    'wear_logs', coalesce((
      select jsonb_agg(to_jsonb(log) order by log.worn_at)
      from public.wear_logs log where log.user_id = auth.uid()
    ), '[]'::jsonb),
    'wear_log_items', coalesce((
      select jsonb_agg(to_jsonb(item) order by item.created_at)
      from public.wear_log_items item where item.user_id = auth.uid()
    ), '[]'::jsonb),
    'outfit_feedback', coalesce((
      select jsonb_agg(to_jsonb(feedback) order by feedback.created_at)
      from public.outfit_feedback feedback where feedback.user_id = auth.uid()
    ), '[]'::jsonb),
    'conversations', coalesce((
      select jsonb_agg(to_jsonb(conversation) order by conversation.created_at)
      from public.conversations conversation where conversation.user_id = auth.uid()
    ), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(to_jsonb(message) order by message.created_at)
      from public.messages message where message.user_id = auth.uid()
    ), '[]'::jsonb),
    'agent_runs', coalesce((
      select jsonb_agg(to_jsonb(run) order by run.created_at)
      from public.agent_runs run where run.user_id = auth.uid()
    ), '[]'::jsonb),
    'generated_outfit_saves', coalesce((
      select jsonb_agg(to_jsonb(saved) order by saved.created_at)
      from public.generated_outfit_saves saved where saved.user_id = auth.uid()
    ), '[]'::jsonb),
    'feature_usage_counters', coalesce((
      select jsonb_agg(to_jsonb(counter) order by counter.period_start, counter.feature)
      from public.feature_usage_counters counter where counter.user_id = auth.uid()
    ), '[]'::jsonb),
    'storage_objects', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'bucket_id', object.bucket_id,
          'name', object.name,
          'created_at', object.created_at,
          'updated_at', object.updated_at,
          'metadata', object.metadata
        ) order by object.bucket_id, object.name
      )
      from storage.objects object
      where object.bucket_id in ('wardrobe-originals', 'wardrobe-items', 'wardrobe-labels', 'wardrobe-generated', 'profile-references')
        and (storage.foldername(object.name))[1] = auth.uid()::text
    ), '[]'::jsonb)
  );
$$;

create or replace function public.list_my_storage_objects()
returns table (
  bucket_id text,
  object_name text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select object.bucket_id, object.name, object.created_at, object.updated_at
  from storage.objects object
  where object.bucket_id in ('wardrobe-originals', 'wardrobe-items', 'wardrobe-labels', 'wardrobe-generated', 'profile-references')
    and (storage.foldername(object.name))[1] = auth.uid()::text
  order by object.bucket_id, object.name;
$$;

create or replace function public.account_deletion_manifest()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'user_id', auth.uid(),
    'wardrobe_item_count', (select count(*) from public.wardrobe_items item where item.user_id = auth.uid()),
    'outfit_count', (select count(*) from public.outfits outfit where outfit.user_id = auth.uid()),
    'conversation_count', (select count(*) from public.conversations conversation where conversation.user_id = auth.uid()),
    'storage_objects', coalesce((
      select jsonb_agg(jsonb_build_object('bucket_id', object.bucket_id, 'name', object.name) order by object.bucket_id, object.name)
      from storage.objects object
      where object.bucket_id in ('wardrobe-originals', 'wardrobe-items', 'wardrobe-labels', 'wardrobe-generated', 'profile-references')
        and (storage.foldername(object.name))[1] = auth.uid()::text
    ), '[]'::jsonb)
  );
$$;

-- This removes relational data only. Account deletion should normally delete
-- manifest-listed files through the Storage API first, then delete auth.users
-- with the Supabase Admin API, which cascades the profile and all owned rows.
create or replace function public.delete_my_relational_data(p_confirmation text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_confirmation is distinct from current_user_id::text then
    raise exception 'confirmation must equal the authenticated user id' using errcode = '22023';
  end if;

  delete from public.profiles where id = current_user_id;
  return found;
end;
$$;

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

  return jsonb_build_object(
    'rate_limit_events_deleted', rate_events_deleted,
    'idempotency_keys_deleted', idempotency_keys_deleted,
    'usage_counters_deleted', usage_counters_deleted,
    'storage_deletion_queue_rows_deleted', deletion_queue_rows_deleted
  );
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.validate_profile_timezone() from public, anon, authenticated;
revoke all on function public.validate_wardrobe_image_parent() from public, anon, authenticated;
revoke all on function public.validate_import_candidate_item() from public, anon, authenticated;
revoke all on function public.protect_wear_counters() from public, anon, authenticated;
revoke all on function public.track_user_confirmed_wardrobe_fields() from public, anon, authenticated;
revoke all on function public.manage_import_job_lease() from public, anon, authenticated;
revoke all on function public.manage_research_run_lease() from public, anon, authenticated;
revoke all on function public.sync_import_job_candidate_count() from public, anon, authenticated;
revoke all on function public.validate_outfit_plan_owner() from public, anon, authenticated;
revoke all on function public.validate_wear_log_owner() from public, anon, authenticated;
revoke all on function public.enqueue_storage_deletion(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.queue_deleted_wardrobe_image() from public, anon, authenticated;
revoke all on function public.queue_deleted_import_assets() from public, anon, authenticated;
revoke all on function public.jsonb_text_array(jsonb) from public, anon, authenticated;
revoke all on function public.valid_image_asset_metadata(jsonb) from public, anon, authenticated;
revoke all on function public.resolve_wardrobe_item_role(text, text, text) from public, anon, authenticated;
revoke all on function public.validate_outfit_item_role() from public, anon, authenticated;
revoke all on function public.valid_research_proposal_value(text, jsonb) from public, anon, authenticated;

revoke all on function public.mark_outfit_worn(uuid, timestamptz, uuid, smallint, smallint, smallint, text, text) from public, anon;
grant execute on function public.mark_outfit_worn(uuid, timestamptz, uuid, smallint, smallint, smallint, text, text) to authenticated;

revoke all on function public.mark_wardrobe_item_worn(uuid, timestamptz, text, text) from public, anon;
grant execute on function public.mark_wardrobe_item_worn(uuid, timestamptz, text, text) to authenticated;

revoke all on function public.consume_rate_limit(text, integer, interval, integer) from public, anon;
grant execute on function public.consume_rate_limit(text, integer, interval, integer) to authenticated;

revoke all on function public.check_and_increment_usage_window(text, integer, text, integer) from public, anon;
grant execute on function public.check_and_increment_usage_window(text, integer, text, integer) to authenticated;

revoke all on function public.check_and_increment_usage(text, integer) from public, anon;
grant execute on function public.check_and_increment_usage(text, integer) to authenticated;

revoke all on function public.enqueue_import_job(text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.enqueue_import_job(text, text, text, text, jsonb) to authenticated;

revoke all on function public.enqueue_research_run(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.enqueue_research_run(uuid, jsonb) to authenticated;

revoke all on function public.claim_api_idempotency_key(text, text, text, interval) from public, anon;
grant execute on function public.claim_api_idempotency_key(text, text, text, interval) to authenticated;

revoke all on function public.complete_api_idempotency_key(uuid, integer, jsonb, text, uuid) from public, anon;
grant execute on function public.complete_api_idempotency_key(uuid, integer, jsonb, text, uuid) to authenticated;

revoke all on function public.fail_api_idempotency_key(uuid, text) from public, anon;
grant execute on function public.fail_api_idempotency_key(uuid, text) to authenticated;

revoke all on function public.confirm_import_job(uuid) from public, anon;
grant execute on function public.confirm_import_job(uuid) to authenticated;

revoke all on function public.accept_research_run(uuid, text[]) from public, anon;
grant execute on function public.accept_research_run(uuid, text[]) to authenticated;

revoke all on function public.reject_research_run(uuid) from public, anon;
grant execute on function public.reject_research_run(uuid) to authenticated;

revoke all on function public.save_generated_outfit(text, text, jsonb, text, numeric, jsonb) from public, anon;
revoke all on function public.save_generated_outfit(text, text, jsonb, text, numeric, jsonb) from authenticated;

revoke all on function public.save_recorded_generated_outfit(uuid) from public, anon;
grant execute on function public.save_recorded_generated_outfit(uuid) to authenticated;

revoke all on function public.save_generated_plan(date, text, jsonb, text, text, numeric, jsonb) from public, anon;
grant execute on function public.save_generated_plan(date, text, jsonb, text, text, numeric, jsonb) to authenticated;

revoke all on function public.save_generated_week(jsonb) from public, anon;
grant execute on function public.save_generated_week(jsonb) to authenticated;

revoke all on function public.swap_outfit_item(uuid, uuid, uuid) from public, anon;
grant execute on function public.swap_outfit_item(uuid, uuid, uuid) to authenticated;

revoke all on function public.create_user_outfit(text, text, text[], jsonb, text, numeric, boolean, jsonb) from public, anon;
grant execute on function public.create_user_outfit(text, text, text[], jsonb, text, numeric, boolean, jsonb) to authenticated;

revoke all on function public.claim_owned_import_job(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_owned_import_job(uuid, integer) to authenticated;

revoke all on function public.claim_owned_research_run(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_owned_research_run(uuid, integer) to authenticated;

revoke all on function public.claim_import_jobs(integer, integer) from public, anon, authenticated;
grant execute on function public.claim_import_jobs(integer, integer) to service_role;

revoke all on function public.claim_import_job(integer) from public, anon, authenticated;
grant execute on function public.claim_import_job(integer) to service_role;

revoke all on function public.claim_research_jobs(integer, integer) from public, anon, authenticated;
grant execute on function public.claim_research_jobs(integer, integer) to service_role;

revoke all on function public.claim_research_job(integer) from public, anon, authenticated;
grant execute on function public.claim_research_job(integer) to service_role;

revoke all on function public.claim_storage_deletion_tasks(integer, integer) from public, anon, authenticated;
grant execute on function public.claim_storage_deletion_tasks(integer, integer) to service_role;

revoke all on function public.export_my_account_data() from public, anon;
grant execute on function public.export_my_account_data() to authenticated;

revoke all on function public.list_my_storage_objects() from public, anon;
grant execute on function public.list_my_storage_objects() to authenticated;

revoke all on function public.account_deletion_manifest() from public, anon;
grant execute on function public.account_deletion_manifest() to authenticated;

revoke all on function public.delete_my_relational_data(text) from public, anon;
grant execute on function public.delete_my_relational_data(text) to authenticated;

revoke all on function public.prune_wardrobe_operational_data() from public, anon, authenticated;
grant execute on function public.prune_wardrobe_operational_data() to service_role;

grant select, insert, update, delete on table public.storage_deletion_queue to service_role;

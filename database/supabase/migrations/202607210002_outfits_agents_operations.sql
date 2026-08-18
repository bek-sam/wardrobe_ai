-- Wardrobe AI: outfits, planning, wear history, feedback, conversations,
-- observability, idempotency, and rate-limit support.

set search_path = public, extensions;

create table if not exists public.outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  source text not null default 'user',
  occasion text,
  season_tags text[] not null default '{}',
  weather_context jsonb,
  explanation text,
  confidence numeric(4, 3),
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outfits_id_user_unique unique (id, user_id),
  constraint outfits_name_not_blank check (btrim(name) <> ''),
  constraint outfits_source_check check (source in ('user', 'ai')),
  constraint outfits_weather_context_check check (weather_context is null or jsonb_typeof(weather_context) = 'object'),
  constraint outfits_confidence_check check (confidence is null or confidence between 0 and 1)
);

create table if not exists public.outfit_items (
  outfit_id uuid not null,
  item_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (outfit_id, item_id),
  constraint outfit_items_outfit_fk foreign key (outfit_id, user_id)
    references public.outfits (id, user_id) on delete cascade,
  constraint outfit_items_item_fk foreign key (item_id, user_id)
    references public.wardrobe_items (id, user_id) on delete cascade,
  constraint outfit_items_outfit_role_unique unique (outfit_id, role),
  constraint outfit_items_role_check check (role in ('top', 'bottom', 'dress', 'layer', 'shoes', 'accessory')),
  constraint outfit_items_sort_order_check check (sort_order >= 0)
);

create table if not exists public.outfit_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  outfit_id uuid references public.outfits (id) on delete set null,
  planned_date date not null,
  start_time time,
  occasion text,
  location_name text,
  event_title text,
  weather_snapshot jsonb,
  status text not null default 'planned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outfit_plans_id_user_unique unique (id, user_id),
  constraint outfit_plans_weather_snapshot_check check (weather_snapshot is null or jsonb_typeof(weather_snapshot) = 'object'),
  constraint outfit_plans_status_check check (status in ('planned', 'worn', 'skipped'))
);

create table if not exists public.wear_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  outfit_id uuid references public.outfits (id) on delete set null,
  outfit_plan_id uuid references public.outfit_plans (id) on delete set null,
  source text not null default 'outfit',
  idempotency_key text,
  worn_at timestamptz not null default now(),
  comfort_rating smallint,
  style_rating smallint,
  weather_rating smallint,
  notes text,
  created_at timestamptz not null default now(),
  constraint wear_logs_id_user_unique unique (id, user_id),
  constraint wear_logs_source_check check (source in ('item', 'outfit', 'plan', 'legacy')),
  constraint wear_logs_comfort_rating_check check (comfort_rating is null or comfort_rating between 1 and 5),
  constraint wear_logs_style_rating_check check (style_rating is null or style_rating between 1 and 5),
  constraint wear_logs_weather_rating_check check (weather_rating is null or weather_rating between 1 and 5),
  constraint wear_logs_idempotency_length_check check (idempotency_key is null or char_length(idempotency_key) between 1 and 200)
);

create table if not exists public.wear_log_items (
  id uuid primary key default gen_random_uuid(),
  wear_log_id uuid not null,
  item_id uuid,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null,
  sort_order integer not null default 0,
  item_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint wear_log_items_log_item_unique unique (wear_log_id, item_id),
  constraint wear_log_items_log_fk foreign key (wear_log_id, user_id)
    references public.wear_logs (id, user_id) on delete cascade,
  constraint wear_log_items_item_fk foreign key (item_id, user_id)
    references public.wardrobe_items (id, user_id) on delete set null (item_id),
  constraint wear_log_items_role_check check (role in ('item', 'top', 'bottom', 'dress', 'layer', 'shoes', 'accessory')),
  constraint wear_log_items_sort_order_check check (sort_order >= 0),
  constraint wear_log_items_snapshot_check check (jsonb_typeof(item_snapshot) = 'object')
);

create table if not exists public.outfit_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  outfit_id uuid not null,
  feedback_type text not null,
  comment text,
  created_at timestamptz not null default now(),
  constraint outfit_feedback_outfit_fk foreign key (outfit_id, user_id)
    references public.outfits (id, user_id) on delete cascade,
  constraint outfit_feedback_type_check check (feedback_type in ('like', 'dislike', 'too_warm', 'too_cold', 'too_formal', 'too_casual', 'color', 'fit', 'repetition', 'other'))
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_id_user_unique unique (id, user_id),
  constraint conversations_title_not_blank check (btrim(title) <> '')
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid not null,
  role text not null,
  content text not null,
  structured_result jsonb,
  created_at timestamptz not null default now(),
  constraint messages_conversation_fk foreign key (conversation_id, user_id)
    references public.conversations (id, user_id) on delete cascade,
  constraint messages_role_check check (role in ('user', 'assistant', 'tool')),
  constraint messages_content_or_result_check check (btrim(content) <> '' or structured_result is not null),
  constraint messages_structured_result_check check (structured_result is null or jsonb_typeof(structured_result) in ('object', 'array'))
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  agent_type text not null,
  status text not null,
  input_summary jsonb not null default '{}'::jsonb,
  output_summary jsonb not null default '{}'::jsonb,
  tool_trace jsonb not null default '[]'::jsonb,
  model text,
  latency_ms integer,
  usage jsonb not null default '{}'::jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  constraint agent_runs_agent_type_not_blank check (btrim(agent_type) <> ''),
  constraint agent_runs_status_check check (status in ('queued', 'running', 'complete', 'failed', 'cancelled')),
  constraint agent_runs_input_summary_check check (jsonb_typeof(input_summary) = 'object'),
  constraint agent_runs_output_summary_check check (jsonb_typeof(output_summary) = 'object'),
  constraint agent_runs_tool_trace_check check (jsonb_typeof(tool_trace) = 'array'),
  constraint agent_runs_usage_check check (jsonb_typeof(usage) = 'object'),
  constraint agent_runs_latency_check check (latency_ms is null or latency_ms >= 0)
);

create table if not exists public.generated_outfit_saves (
  user_id uuid not null references public.profiles (id) on delete cascade,
  generation_id uuid not null references public.agent_runs (id) on delete cascade,
  outfit_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, generation_id),
  constraint generated_outfit_saves_outfit_unique unique (outfit_id),
  constraint generated_outfit_saves_outfit_fk foreign key (outfit_id, user_id)
    references public.outfits (id, user_id) on delete cascade
);

create table if not exists public.api_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  scope text not null,
  idempotency_key text not null,
  request_hash text not null,
  status text not null default 'processing',
  response_status integer,
  response_body jsonb,
  resource_type text,
  resource_id uuid,
  attempt_count integer not null default 1,
  locked_until timestamptz not null default (now() + interval '5 minutes'),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint api_idempotency_keys_user_scope_key_unique unique (user_id, scope, idempotency_key),
  constraint api_idempotency_keys_scope_not_blank check (btrim(scope) <> ''),
  constraint api_idempotency_keys_key_length_check check (char_length(idempotency_key) between 1 and 200),
  constraint api_idempotency_keys_request_hash_not_blank check (btrim(request_hash) <> ''),
  constraint api_idempotency_keys_status_check check (status in ('processing', 'completed', 'failed')),
  constraint api_idempotency_keys_response_status_check check (response_status is null or response_status between 100 and 599),
  constraint api_idempotency_keys_attempt_count_check check (attempt_count > 0),
  constraint api_idempotency_keys_expiry_check check (expires_at > created_at)
);

create table if not exists public.rate_limit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  bucket text not null,
  cost integer not null default 1,
  occurred_at timestamptz not null default clock_timestamp(),
  constraint rate_limit_events_bucket_check check (bucket ~ '^[a-z0-9][a-z0-9_.:-]{0,79}$'),
  constraint rate_limit_events_cost_check check (cost between 1 and 10000)
);

create table if not exists public.feature_usage_counters (
  user_id uuid not null references public.profiles (id) on delete cascade,
  feature text not null,
  period text not null,
  period_start date not null,
  usage_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, feature, period, period_start),
  constraint feature_usage_counters_feature_check check (feature ~ '^[a-z0-9][a-z0-9_.:-]{0,79}$'),
  constraint feature_usage_counters_period_check check (period in ('day', 'month')),
  constraint feature_usage_counters_count_check check (usage_count >= 0)
);

-- Limits for expensive enqueue operations are database-owned configuration.
-- Authenticated callers cannot supply or edit these values through PostgREST.
create table if not exists public.feature_limits (
  feature text primary key,
  daily_limit integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feature_limits_feature_check check (feature ~ '^[a-z0-9][a-z0-9_.:-]{0,79}$'),
  constraint feature_limits_daily_limit_check check (daily_limit between 1 and 1000000)
);

insert into public.feature_limits (feature, daily_limit)
values
  ('image_import', 20),
  ('item_research', 10)
on conflict (feature) do nothing;

create table if not exists public.storage_deletion_queue (
  id uuid primary key default gen_random_uuid(),
  -- Deliberately not a foreign key: queued object cleanup must survive deletion
  -- of the profile/Auth row long enough for a service worker to remove bytes.
  user_id uuid not null,
  bucket_id text not null,
  storage_path text not null,
  reason text not null,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint storage_deletion_queue_user_object_unique unique (user_id, bucket_id, storage_path),
  constraint storage_deletion_queue_bucket_check check (bucket_id in ('wardrobe-originals', 'wardrobe-items', 'wardrobe-labels', 'wardrobe-generated', 'profile-references')),
  constraint storage_deletion_queue_path_not_blank check (btrim(storage_path) <> ''),
  constraint storage_deletion_queue_owner_path_check check (split_part(storage_path, '/', 1) = user_id::text),
  constraint storage_deletion_queue_reason_not_blank check (btrim(reason) <> ''),
  constraint storage_deletion_queue_status_check check (status in ('pending', 'processing', 'complete', 'failed')),
  constraint storage_deletion_queue_attempt_count_check check (attempt_count >= 0)
);

-- Keep every newly created private table deny-by-default until migration 003
-- installs its authenticated owner policies and explicit grants.
alter table public.outfits enable row level security;
alter table public.outfit_items enable row level security;
alter table public.outfit_plans enable row level security;
alter table public.wear_logs enable row level security;
alter table public.wear_log_items enable row level security;
alter table public.outfit_feedback enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.agent_runs enable row level security;
alter table public.generated_outfit_saves enable row level security;
alter table public.api_idempotency_keys enable row level security;
alter table public.rate_limit_events enable row level security;
alter table public.feature_usage_counters enable row level security;
alter table public.feature_limits enable row level security;
alter table public.storage_deletion_queue enable row level security;

create unique index if not exists wear_logs_user_idempotency_unique
  on public.wear_logs (user_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists outfits_user_created_idx on public.outfits (user_id, created_at desc);
create index if not exists outfits_user_favorite_idx on public.outfits (user_id, favorite, updated_at desc);
create index if not exists outfit_items_user_item_idx on public.outfit_items (user_id, item_id);
create index if not exists outfit_plans_user_date_idx on public.outfit_plans (user_id, planned_date, start_time);
create index if not exists wear_logs_user_worn_at_idx on public.wear_logs (user_id, worn_at desc);
create index if not exists wear_log_items_user_item_idx on public.wear_log_items (user_id, item_id, created_at desc);
create index if not exists outfit_feedback_user_outfit_idx on public.outfit_feedback (user_id, outfit_id, created_at desc);
create unique index if not exists outfit_feedback_one_type_per_outfit_idx
  on public.outfit_feedback (user_id, outfit_id, feedback_type);
create index if not exists conversations_user_updated_idx on public.conversations (user_id, updated_at desc);
create index if not exists messages_user_conversation_created_idx on public.messages (user_id, conversation_id, created_at);
create index if not exists agent_runs_user_type_created_idx on public.agent_runs (user_id, agent_type, created_at desc);
create index if not exists generated_outfit_saves_user_created_idx on public.generated_outfit_saves (user_id, created_at desc);
create index if not exists api_idempotency_keys_expiry_idx on public.api_idempotency_keys (expires_at);
create index if not exists rate_limit_events_user_bucket_time_idx on public.rate_limit_events (user_id, bucket, occurred_at desc);
create index if not exists rate_limit_events_occurred_at_idx on public.rate_limit_events (occurred_at);
create index if not exists feature_usage_counters_period_idx
  on public.feature_usage_counters (period, period_start);
create index if not exists storage_deletion_queue_worker_idx
  on public.storage_deletion_queue (next_attempt_at, created_at)
  where status in ('pending', 'failed', 'processing');

create or replace function public.validate_outfit_plan_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.outfit_id is not null and not exists (
    select 1 from public.outfits outfit
    where outfit.id = new.outfit_id and outfit.user_id = new.user_id
  ) then
    raise exception 'planned outfit must belong to the plan owner' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_outfit_plan_owner on public.outfit_plans;
create trigger validate_outfit_plan_owner
before insert or update of outfit_id, user_id on public.outfit_plans
for each row execute function public.validate_outfit_plan_owner();

create or replace function public.validate_wear_log_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.outfit_id is not null and not exists (
    select 1 from public.outfits outfit
    where outfit.id = new.outfit_id and outfit.user_id = new.user_id
  ) then
    raise exception 'worn outfit must belong to the wear-log owner' using errcode = '23514';
  end if;
  if new.outfit_plan_id is not null and not exists (
    select 1 from public.outfit_plans plan
    where plan.id = new.outfit_plan_id and plan.user_id = new.user_id
  ) then
    raise exception 'outfit plan must belong to the wear-log owner' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_wear_log_owner on public.wear_logs;
create trigger validate_wear_log_owner
before insert or update of outfit_id, outfit_plan_id, user_id on public.wear_logs
for each row execute function public.validate_wear_log_owner();

do $$
declare
  table_name text;
  trigger_name text;
begin
  foreach table_name in array array[
    'outfits',
    'outfit_plans',
    'conversations',
    'api_idempotency_keys',
    'feature_usage_counters',
    'feature_limits',
    'storage_deletion_queue'
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

create or replace function public.enqueue_storage_deletion(
  p_user_id uuid,
  p_bucket_id text,
  p_storage_path text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_storage_path is null or btrim(p_storage_path) = '' then
    return;
  end if;

  insert into public.storage_deletion_queue (user_id, bucket_id, storage_path, reason)
  values (p_user_id, p_bucket_id, p_storage_path, p_reason)
  on conflict (user_id, bucket_id, storage_path) do update
  set
    reason = excluded.reason,
    status = 'pending',
    attempt_count = 0,
    next_attempt_at = now(),
    locked_until = null,
    error_message = null,
    completed_at = null;
end;
$$;

create or replace function public.queue_deleted_wardrobe_image()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.wardrobe_item_images image
    where image.bucket_id = old.bucket_id and image.storage_path = old.storage_path
  ) and not exists (
    select 1 from public.import_jobs job
    where job.original_image_bucket = old.bucket_id and job.original_image_path = old.storage_path
  ) and not exists (
    select 1 from public.import_job_candidates candidate
    where (old.bucket_id = 'wardrobe-originals' and candidate.crop_storage_path = old.storage_path)
       or (old.bucket_id = 'wardrobe-generated' and old.storage_path in (
         candidate.cutout_storage_path,
         candidate.failed_cutout_storage_path,
         candidate.modeled_storage_path
       ))
  ) then
    perform public.enqueue_storage_deletion(old.user_id, old.bucket_id, old.storage_path, 'wardrobe_image_deleted');
  end if;
  return old;
end;
$$;

drop trigger if exists queue_deleted_wardrobe_image on public.wardrobe_item_images;
create trigger queue_deleted_wardrobe_image
after delete on public.wardrobe_item_images
for each row execute function public.queue_deleted_wardrobe_image();

drop trigger if exists queue_replaced_wardrobe_image on public.wardrobe_item_images;
create trigger queue_replaced_wardrobe_image
after update of bucket_id, storage_path on public.wardrobe_item_images
for each row
when ((old.bucket_id, old.storage_path) is distinct from (new.bucket_id, new.storage_path))
execute function public.queue_deleted_wardrobe_image();

create or replace function public.queue_deleted_import_assets()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'import_jobs' then
    if not exists (
      select 1 from public.wardrobe_item_images image
      where image.bucket_id = old.original_image_bucket and image.storage_path = old.original_image_path
    ) then
      perform public.enqueue_storage_deletion(old.user_id, old.original_image_bucket, old.original_image_path, 'import_job_deleted');
    end if;
  else
    if not exists (
      select 1 from public.wardrobe_item_images image
      where image.bucket_id = 'wardrobe-originals' and image.storage_path = old.crop_storage_path
    ) then
      perform public.enqueue_storage_deletion(old.user_id, 'wardrobe-originals', old.crop_storage_path, 'import_candidate_deleted');
    end if;
    if not exists (
      select 1 from public.wardrobe_item_images image
      where image.bucket_id = 'wardrobe-generated' and image.storage_path = old.cutout_storage_path
    ) then
      perform public.enqueue_storage_deletion(old.user_id, 'wardrobe-generated', old.cutout_storage_path, 'import_candidate_deleted');
    end if;
    if not exists (
      select 1 from public.wardrobe_item_images image
      where image.bucket_id = 'wardrobe-generated' and image.storage_path = old.failed_cutout_storage_path
    ) then
      perform public.enqueue_storage_deletion(old.user_id, 'wardrobe-generated', old.failed_cutout_storage_path, 'import_candidate_deleted');
    end if;
    if not exists (
      select 1 from public.wardrobe_item_images image
      where image.bucket_id = 'wardrobe-generated' and image.storage_path = old.modeled_storage_path
    ) then
      perform public.enqueue_storage_deletion(old.user_id, 'wardrobe-generated', old.modeled_storage_path, 'import_candidate_deleted');
    end if;
  end if;
  return old;
end;
$$;

drop trigger if exists queue_deleted_import_job_assets on public.import_jobs;
create trigger queue_deleted_import_job_assets
before delete on public.import_jobs
for each row execute function public.queue_deleted_import_assets();

drop trigger if exists queue_deleted_import_candidate_assets on public.import_job_candidates;
create trigger queue_deleted_import_candidate_assets
before delete on public.import_job_candidates
for each row execute function public.queue_deleted_import_assets();

-- Deny default PUBLIC execution immediately. The following security migration
-- grants only the authenticated RPCs; trigger helpers remain non-callable.
revoke all on function public.enqueue_storage_deletion(uuid, text, text, text) from public;
revoke all on function public.queue_deleted_wardrobe_image() from public;
revoke all on function public.queue_deleted_import_assets() from public;

create or replace function public.jsonb_text_array(p_value jsonb)
returns text[]
language sql
immutable
parallel safe
security invoker
set search_path = ''
as $$
  select coalesce(array_agg(element), '{}'::text[])
  from jsonb_array_elements_text(
    case when jsonb_typeof(p_value) = 'array' then p_value else '[]'::jsonb end
  ) as values_list(element);
$$;

create or replace function public.valid_image_asset_metadata(p_value jsonb)
returns boolean
language sql
immutable
parallel safe
security invoker
set search_path = ''
as $$
  select p_value is not null
    and jsonb_typeof(p_value) = 'object'
    and p_value ->> 'mime_type' in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif')
    and coalesce(p_value ->> 'width', '') ~ '^[1-9][0-9]{0,5}$'
    and coalesce(p_value ->> 'height', '') ~ '^[1-9][0-9]{0,5}$'
    and coalesce(p_value ->> 'file_size', '') ~ '^[1-9][0-9]{0,11}$';
$$;

create or replace function public.confirm_import_job(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  job_record public.import_jobs%rowtype;
  candidate_record public.import_job_candidates%rowtype;
  merged_metadata jsonb;
  created_item_id uuid;
  original_image_id uuid;
  crop_image_id uuid;
  cutout_image_id uuid;
  item_ids jsonb := '[]'::jsonb;
  normalized_category text;
  normalized_primary_color text;
  normalized_secondary_color text;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select job.* into job_record
  from public.import_jobs job
  where job.id = p_job_id and job.user_id = current_user_id
  for update;
  if not found then
    raise exception 'import job not found' using errcode = 'P0002';
  end if;

  if job_record.status = 'complete' then
    select coalesce(jsonb_agg(candidate.wardrobe_item_id order by candidate.ordinal), '[]'::jsonb)
      into item_ids
    from public.import_job_candidates candidate
    where candidate.job_id = p_job_id
      and candidate.user_id = current_user_id
      and candidate.wardrobe_item_id is not null;
    return jsonb_build_object('job_id', p_job_id, 'item_ids', item_ids, 'already_confirmed', true);
  end if;

  if job_record.status <> 'review_metadata' then
    raise exception 'import job is not ready for confirmation' using errcode = '55000';
  end if;

  if job_record.original_mime_type not in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif')
    or job_record.original_width is null or job_record.original_width <= 0
    or job_record.original_height is null or job_record.original_height <= 0
    or job_record.original_file_size is null or job_record.original_file_size <= 0
  then
    raise exception 'import job does not have valid original-image metadata' using errcode = '23514';
  end if;

  -- Lock every candidate so review edits and a confirmation cannot race.
  perform candidate.id
  from public.import_job_candidates candidate
  where candidate.job_id = p_job_id and candidate.user_id = current_user_id
  order by candidate.ordinal
  for update;

  if not found then
    raise exception 'import job has no candidates' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.import_job_candidates candidate
    where candidate.job_id = p_job_id
      and candidate.user_id = current_user_id
      and candidate.status not in ('review_metadata', 'approved', 'rejected')
  ) then
    raise exception 'every candidate must be ready, approved, or rejected before confirmation'
      using errcode = '55000';
  end if;

  for candidate_record in
    select candidate.*
    from public.import_job_candidates candidate
    where candidate.job_id = p_job_id
      and candidate.user_id = current_user_id
      and candidate.status in ('review_metadata', 'approved')
    order by candidate.ordinal
  loop
    if candidate_record.wardrobe_item_id is not null then
      item_ids := item_ids || jsonb_build_array(candidate_record.wardrobe_item_id);
      continue;
    end if;

    if candidate_record.cutout_storage_path is null
      or not public.valid_image_asset_metadata(candidate_record.cutout_asset_metadata)
    then
      raise exception 'candidate % does not have a valid cutout asset', candidate_record.id
        using errcode = '23514';
    end if;
    if candidate_record.crop_storage_path is not null
      and not public.valid_image_asset_metadata(candidate_record.crop_asset_metadata)
    then
      raise exception 'candidate % has invalid crop metadata', candidate_record.id
        using errcode = '23514';
    end if;
    if candidate_record.modeled_storage_path is not null
      and not public.valid_image_asset_metadata(candidate_record.modeled_asset_metadata)
    then
      raise exception 'candidate % has invalid modeled-image metadata', candidate_record.id
        using errcode = '23514';
    end if;

    merged_metadata := candidate_record.proposed_metadata || candidate_record.confirmed_metadata;
    normalized_category := coalesce(
      nullif(btrim(merged_metadata ->> 'category'), ''),
      case merged_metadata ->> 'part'
        when 'upperbody' then 'tops'
        when 'wholebody_up' then 'outerwear'
        when 'lowerbody' then 'bottoms'
        when 'accessories_up' then 'accessories'
        when 'shoes' then 'shoes'
        else null
      end,
      'other'
    );
    normalized_primary_color := coalesce(
      nullif(merged_metadata ->> 'primary_color_hex', ''),
      nullif(merged_metadata ->> 'color', '')
    );
    normalized_secondary_color := coalesce(
      nullif(merged_metadata ->> 'secondary_color_hex', ''),
      nullif(merged_metadata ->> 'secondaryColor', '')
    );

    insert into public.wardrobe_items (
      user_id,
      status,
      source,
      name,
      brand,
      product_name,
      model_number,
      barcode,
      category,
      subcategory,
      layer_role,
      primary_color_hex,
      secondary_color_hex,
      color_names,
      pattern,
      fit,
      silhouette,
      materials,
      visible_text,
      size_label,
      season_tags,
      occasion_tags,
      weather_tags,
      warmth_level,
      formality_level,
      water_resistance,
      care_instructions,
      condition,
      metadata_confidence,
      field_confidence,
      ai_metadata,
      user_confirmed_fields,
      user_confirmed_at
    ) values (
      current_user_id,
      'active',
      'import',
      coalesce(nullif(btrim(merged_metadata ->> 'name'), ''), 'New piece'),
      nullif(btrim(merged_metadata ->> 'brand'), ''),
      nullif(btrim(merged_metadata ->> 'product_name'), ''),
      nullif(btrim(merged_metadata ->> 'model_number'), ''),
      nullif(btrim(merged_metadata ->> 'barcode'), ''),
      normalized_category,
      nullif(btrim(merged_metadata ->> 'subcategory'), ''),
      nullif(btrim(merged_metadata ->> 'layer_role'), ''),
      normalized_primary_color,
      normalized_secondary_color,
      public.jsonb_text_array(merged_metadata -> 'color_names'),
      nullif(btrim(merged_metadata ->> 'pattern'), ''),
      nullif(btrim(merged_metadata ->> 'fit'), ''),
      nullif(btrim(merged_metadata ->> 'silhouette'), ''),
      case when jsonb_typeof(merged_metadata -> 'materials') in ('array', 'object')
        then merged_metadata -> 'materials' else '[]'::jsonb end,
      public.jsonb_text_array(merged_metadata -> 'visible_text'),
      nullif(btrim(merged_metadata ->> 'size_label'), ''),
      public.jsonb_text_array(merged_metadata -> 'season_tags'),
      public.jsonb_text_array(merged_metadata -> 'occasion_tags'),
      public.jsonb_text_array(merged_metadata -> 'weather_tags'),
      case when coalesce(merged_metadata ->> 'warmth_level', '') ~ '^[1-5]$'
        then (merged_metadata ->> 'warmth_level')::smallint else null end,
      case when coalesce(merged_metadata ->> 'formality_level', '') ~ '^[1-5]$'
        then (merged_metadata ->> 'formality_level')::smallint else null end,
      nullif(btrim(merged_metadata ->> 'water_resistance'), ''),
      public.jsonb_text_array(merged_metadata -> 'care_instructions'),
      nullif(btrim(merged_metadata ->> 'condition'), ''),
      case when coalesce(merged_metadata ->> 'metadata_confidence', '') ~ '^(0(\.[0-9]+)?|1(\.0+)?)$'
        then (merged_metadata ->> 'metadata_confidence')::numeric else null end,
      candidate_record.field_confidence,
      candidate_record.proposed_metadata,
      array(select jsonb_object_keys(candidate_record.confirmed_metadata)),
      now()
    )
    returning id into created_item_id;

    insert into public.wardrobe_item_images (
      user_id, item_id, kind, bucket_id, storage_path, mime_type,
      width, height, file_size, is_primary
    ) values (
      current_user_id,
      created_item_id,
      'original',
      job_record.original_image_bucket,
      job_record.original_image_path,
      job_record.original_mime_type,
      job_record.original_width,
      job_record.original_height,
      job_record.original_file_size,
      false
    )
    returning id into original_image_id;

    crop_image_id := null;
    if candidate_record.crop_storage_path is not null then
      insert into public.wardrobe_item_images (
        user_id, item_id, kind, bucket_id, storage_path, mime_type,
        width, height, file_size, is_primary, generation_model, parent_image_id
      ) values (
        current_user_id,
        created_item_id,
        'crop',
        'wardrobe-originals',
        candidate_record.crop_storage_path,
        candidate_record.crop_asset_metadata ->> 'mime_type',
        (candidate_record.crop_asset_metadata ->> 'width')::integer,
        (candidate_record.crop_asset_metadata ->> 'height')::integer,
        (candidate_record.crop_asset_metadata ->> 'file_size')::bigint,
        false,
        candidate_record.crop_asset_metadata ->> 'generation_model',
        original_image_id
      )
      returning id into crop_image_id;
    end if;

    insert into public.wardrobe_item_images (
      user_id, item_id, kind, bucket_id, storage_path, mime_type,
      width, height, file_size, is_primary, generation_model, parent_image_id
    ) values (
      current_user_id,
      created_item_id,
      'cutout',
      'wardrobe-generated',
      candidate_record.cutout_storage_path,
      candidate_record.cutout_asset_metadata ->> 'mime_type',
      (candidate_record.cutout_asset_metadata ->> 'width')::integer,
      (candidate_record.cutout_asset_metadata ->> 'height')::integer,
      (candidate_record.cutout_asset_metadata ->> 'file_size')::bigint,
      true,
      candidate_record.cutout_asset_metadata ->> 'generation_model',
      coalesce(crop_image_id, original_image_id)
    )
    returning id into cutout_image_id;

    if candidate_record.modeled_storage_path is not null then
      insert into public.wardrobe_item_images (
        user_id, item_id, kind, bucket_id, storage_path, mime_type,
        width, height, file_size, is_primary, generation_model, parent_image_id
      ) values (
        current_user_id,
        created_item_id,
        'modeled',
        'wardrobe-generated',
        candidate_record.modeled_storage_path,
        candidate_record.modeled_asset_metadata ->> 'mime_type',
        (candidate_record.modeled_asset_metadata ->> 'width')::integer,
        (candidate_record.modeled_asset_metadata ->> 'height')::integer,
        (candidate_record.modeled_asset_metadata ->> 'file_size')::bigint,
        false,
        candidate_record.modeled_asset_metadata ->> 'generation_model',
        cutout_image_id
      );
    end if;

    update public.import_job_candidates
    set
      wardrobe_item_id = created_item_id,
      status = 'approved',
      metadata_approved_at = coalesce(metadata_approved_at, now()),
      error_code = null,
      error_message = null
    where id = candidate_record.id and user_id = current_user_id;

    item_ids := item_ids || jsonb_build_array(created_item_id);
  end loop;

  if jsonb_array_length(item_ids) = 0 then
    raise exception 'import job has no approved candidates to save' using errcode = '23514';
  end if;

  update public.import_jobs
  set
    status = 'complete',
    progress = 100,
    confirmed_at = now(),
    completed_at = now(),
    locked_at = null,
    locked_until = null,
    error_code = null,
    error_message = null
  where id = p_job_id and user_id = current_user_id;

  return jsonb_build_object('job_id', p_job_id, 'item_ids', item_ids, 'already_confirmed', false);
end;
$$;

revoke all on function public.jsonb_text_array(jsonb) from public;
revoke all on function public.valid_image_asset_metadata(jsonb) from public;
revoke all on function public.confirm_import_job(uuid) from public;

create or replace function public.mark_outfit_worn(
  p_outfit_id uuid,
  p_worn_at timestamptz default now(),
  p_outfit_plan_id uuid default null,
  p_comfort_rating smallint default null,
  p_style_rating smallint default null,
  p_weather_rating smallint default null,
  p_notes text default null,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  provided_key text := nullif(btrim(p_idempotency_key), '');
  normalized_key text;
  log_id uuid;
  planned_outfit_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  perform 1
  from public.outfits outfit
  where outfit.id = p_outfit_id and outfit.user_id = current_user_id
  for update;
  if not found then
    raise exception 'outfit not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.outfit_items item
    where item.outfit_id = p_outfit_id and item.user_id = current_user_id
  ) then
    raise exception 'cannot mark an empty outfit as worn' using errcode = '23514';
  end if;

  if p_outfit_plan_id is not null then
    select plan.outfit_id
      into planned_outfit_id
    from public.outfit_plans plan
    where plan.id = p_outfit_plan_id and plan.user_id = current_user_id
    for update;
    if not found then
      raise exception 'outfit plan not found' using errcode = 'P0002';
    end if;
    if planned_outfit_id is not null and planned_outfit_id <> p_outfit_id then
      raise exception 'outfit does not match the selected plan' using errcode = '23514';
    end if;
  end if;

  if provided_key is not null and char_length(provided_key) > 200 then
    raise exception 'idempotency key is too long' using errcode = '22001';
  end if;
  if provided_key is not null then
    normalized_key := 'outfit:' || p_outfit_id::text || ':'
      || encode(extensions.digest(provided_key, 'sha256'), 'hex');
  end if;

  insert into public.wear_logs (
    user_id,
    outfit_id,
    outfit_plan_id,
    source,
    idempotency_key,
    worn_at,
    comfort_rating,
    style_rating,
    weather_rating,
    notes
  ) values (
    current_user_id,
    p_outfit_id,
    p_outfit_plan_id,
    case when p_outfit_plan_id is null then 'outfit' else 'plan' end,
    normalized_key,
    coalesce(p_worn_at, now()),
    p_comfort_rating,
    p_style_rating,
    p_weather_rating,
    p_notes
  )
  on conflict (user_id, idempotency_key) where idempotency_key is not null
  do nothing
  returning id into log_id;

  if log_id is null then
    select existing.id into log_id
    from public.wear_logs existing
    where existing.user_id = current_user_id
      and existing.idempotency_key = normalized_key;
    return log_id;
  end if;

  insert into public.wear_log_items (wear_log_id, item_id, user_id, role, sort_order, item_snapshot)
  select
    log_id,
    outfit_item.item_id,
    current_user_id,
    outfit_item.role,
    outfit_item.sort_order,
    jsonb_build_object(
      'name', wardrobe_item.name,
      'category', wardrobe_item.category,
      'subcategory', wardrobe_item.subcategory,
      'brand', wardrobe_item.brand,
      'primary_color_hex', wardrobe_item.primary_color_hex
    )
  from public.outfit_items outfit_item
  join public.wardrobe_items wardrobe_item
    on wardrobe_item.id = outfit_item.item_id
   and wardrobe_item.user_id = outfit_item.user_id
  where outfit_item.outfit_id = p_outfit_id
    and outfit_item.user_id = current_user_id;

  perform set_config('wardrobe.allow_wear_counter_update', 'on', true);

  update public.wardrobe_items wardrobe_item
  set
    wear_count = wardrobe_item.wear_count + 1,
    last_worn_at = case
      when wardrobe_item.last_worn_at is null or coalesce(p_worn_at, now()) > wardrobe_item.last_worn_at
        then coalesce(p_worn_at, now())
      else wardrobe_item.last_worn_at
    end
  from public.outfit_items outfit_item
  where outfit_item.outfit_id = p_outfit_id
    and outfit_item.user_id = current_user_id
    and wardrobe_item.id = outfit_item.item_id
    and wardrobe_item.user_id = outfit_item.user_id;

  if p_outfit_plan_id is not null then
    update public.outfit_plans
    set status = 'worn', outfit_id = p_outfit_id
    where id = p_outfit_plan_id and user_id = current_user_id;
  end if;

  return log_id;
end;
$$;

create or replace function public.mark_wardrobe_item_worn(
  p_item_id uuid,
  p_worn_at timestamptz default now(),
  p_notes text default null,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  provided_key text := nullif(btrim(p_idempotency_key), '');
  normalized_key text;
  log_id uuid;
  item_record public.wardrobe_items%rowtype;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select item.* into item_record
  from public.wardrobe_items item
  where item.id = p_item_id and item.user_id = current_user_id
  for update;
  if not found then
    raise exception 'wardrobe item not found' using errcode = 'P0002';
  end if;

  if provided_key is not null and char_length(provided_key) > 200 then
    raise exception 'idempotency key is too long' using errcode = '22001';
  end if;
  if provided_key is not null then
    normalized_key := 'item:' || p_item_id::text || ':'
      || encode(extensions.digest(provided_key, 'sha256'), 'hex');
  end if;

  insert into public.wear_logs (user_id, source, idempotency_key, worn_at, notes)
  values (current_user_id, 'item', normalized_key, coalesce(p_worn_at, now()), p_notes)
  on conflict (user_id, idempotency_key) where idempotency_key is not null
  do nothing
  returning id into log_id;

  if log_id is null then
    select existing.id into log_id
    from public.wear_logs existing
    where existing.user_id = current_user_id
      and existing.idempotency_key = normalized_key;
    return log_id;
  end if;

  insert into public.wear_log_items (wear_log_id, item_id, user_id, role, item_snapshot)
  values (
    log_id,
    item_record.id,
    current_user_id,
    'item',
    jsonb_build_object(
      'name', item_record.name,
      'category', item_record.category,
      'subcategory', item_record.subcategory,
      'brand', item_record.brand,
      'primary_color_hex', item_record.primary_color_hex
    )
  );

  perform set_config('wardrobe.allow_wear_counter_update', 'on', true);

  update public.wardrobe_items
  set
    wear_count = wear_count + 1,
    last_worn_at = case
      when last_worn_at is null or coalesce(p_worn_at, now()) > last_worn_at
        then coalesce(p_worn_at, now())
      else last_worn_at
    end
  where id = p_item_id and user_id = current_user_id;

  return log_id;
end;
$$;

create or replace function public.consume_rate_limit(
  p_bucket text,
  p_limit integer,
  p_window interval,
  p_cost integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_time timestamptz := clock_timestamp();
  used_cost bigint;
  reset_time timestamptz;
  was_allowed boolean;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_bucket is null or p_bucket !~ '^[a-z0-9][a-z0-9_.:-]{0,79}$' then
    raise exception 'invalid rate-limit bucket' using errcode = '22023';
  end if;
  if p_limit < 1 or p_limit > 10000 or p_cost < 1 or p_cost > p_limit then
    raise exception 'invalid rate-limit cost or limit' using errcode = '22023';
  end if;
  if p_window < interval '1 second' or p_window > interval '31 days' then
    raise exception 'invalid rate-limit window' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text || ':' || p_bucket, 0));

  select coalesce(sum(event.cost), 0), min(event.occurred_at) + p_window
    into used_cost, reset_time
  from public.rate_limit_events event
  where event.user_id = current_user_id
    and event.bucket = p_bucket
    and event.occurred_at > current_time - p_window;

  was_allowed := used_cost + p_cost <= p_limit;
  if was_allowed then
    insert into public.rate_limit_events (user_id, bucket, cost, occurred_at)
    values (current_user_id, p_bucket, p_cost, current_time);
    used_cost := used_cost + p_cost;
    reset_time := coalesce(reset_time, current_time + p_window);
  else
    reset_time := coalesce(reset_time, current_time + p_window);
  end if;

  return jsonb_build_object(
    'allowed', was_allowed,
    'limit', p_limit,
    'remaining', greatest(0, p_limit - used_cost),
    'reset_at', reset_time
  );
end;
$$;

create or replace function public.check_and_increment_usage_window(
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
  current_user_id uuid := auth.uid();
  utc_date date;
  counter_period_start date;
  next_period_start timestamptz;
  resulting_count integer;
  existing_count integer;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_feature is null or p_feature !~ '^[a-z0-9][a-z0-9_.:-]{0,79}$' then
    raise exception 'invalid usage feature' using errcode = '22023';
  end if;
  if p_period is null or p_period not in ('day', 'month') then
    raise exception 'invalid usage period' using errcode = '22023';
  end if;
  if p_limit is null or p_increment is null
    or p_limit < 1 or p_limit > 1000000 or p_increment < 1 or p_increment > p_limit
  then
    raise exception 'invalid usage limit or increment' using errcode = '22023';
  end if;

  -- Quota boundaries are UTC so changing a profile timezone cannot mint a new
  -- daily/monthly budget. Product-facing dates still use the profile timezone.
  utc_date := (clock_timestamp() at time zone 'UTC')::date;
  counter_period_start := case
    when p_period = 'day' then utc_date
    else date_trunc('month', utc_date::timestamp)::date
  end;
  next_period_start := case
    when p_period = 'day'
      then ((counter_period_start + 1)::timestamp at time zone 'UTC')
    else ((counter_period_start + interval '1 month')::timestamp at time zone 'UTC')
  end;

  perform pg_advisory_xact_lock(hashtextextended(
    current_user_id::text || ':' || p_feature || ':' || p_period || ':' || counter_period_start::text,
    0
  ));

  insert into public.feature_usage_counters as counter (
    user_id, feature, period, period_start, usage_count
  ) values (
    current_user_id, p_feature, p_period, counter_period_start, p_increment
  )
  on conflict (user_id, feature, period, period_start) do update
  set usage_count = counter.usage_count + excluded.usage_count
  where counter.usage_count + excluded.usage_count <= p_limit
  returning counter.usage_count into resulting_count;

  if resulting_count is null then
    select counter.usage_count into existing_count
    from public.feature_usage_counters counter
    where counter.user_id = current_user_id
      and counter.feature = p_feature
      and counter.period = p_period
      and counter.period_start = counter_period_start;

    return jsonb_build_object(
      'allowed', false,
      'feature', p_feature,
      'period', p_period,
      'limit', p_limit,
      'used', coalesce(existing_count, 0),
      'remaining', greatest(0, p_limit - coalesce(existing_count, 0)),
      'reset_at', next_period_start
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'feature', p_feature,
    'period', p_period,
    'limit', p_limit,
    'used', resulting_count,
    'remaining', greatest(0, p_limit - resulting_count),
    'reset_at', next_period_start
  );
end;
$$;

create or replace function public.check_and_increment_usage(
  p_feature text,
  p_limit integer
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.check_and_increment_usage_window(p_feature, p_limit, 'day', 1);
$$;

-- Enqueue is the only authenticated write path into the import queue. The
-- fixed database limit, counter increment, and job insert share one transaction.
create or replace function public.enqueue_import_job(
  p_original_image_bucket text,
  p_original_image_path text,
  p_idempotency_key text,
  p_request_hash text,
  p_input_metadata jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  job_record public.import_jobs%rowtype;
  candidate_rows jsonb := '[]'::jsonb;
  daily_limit integer;
  usage_result jsonb;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_original_image_bucket is distinct from 'wardrobe-originals' then
    raise exception 'invalid_import_image_bucket' using errcode = '22023';
  end if;
  if p_original_image_path is null
    or p_original_image_path <> btrim(p_original_image_path)
    or char_length(p_original_image_path) not between 3 and 1000
    or split_part(p_original_image_path, '/', 1) <> current_user_id::text
    or split_part(p_original_image_path, '/', 2) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or split_part(p_original_image_path, '/', 3) = ''
    or strpos(p_original_image_path, '//') > 0
    or strpos(p_original_image_path, chr(92)) > 0
    or p_original_image_path ~ '(^|/)\.{1,2}(/|$)'
    or p_original_image_path ~ '[[:cntrl:]]'
  then
    raise exception 'invalid_import_image_path' using errcode = '22023';
  end if;
  if p_idempotency_key is null
    or char_length(p_idempotency_key) not between 8 and 200
    or p_idempotency_key ~ '[[:cntrl:]]'
  then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;
  if p_request_hash is null or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_request_hash' using errcode = '22023';
  end if;
  if p_input_metadata is null
    or jsonb_typeof(p_input_metadata) <> 'object'
    or pg_column_size(p_input_metadata) > 8192
  then
    raise exception 'invalid_import_input_metadata' using errcode = '22023';
  end if;

  -- Serialize duplicate submissions before reading the partial unique index.
  perform pg_advisory_xact_lock(hashtextextended(
    current_user_id::text || ':image_import:' || p_idempotency_key,
    0
  ));

  select job.* into job_record
  from public.import_jobs job
  where job.user_id = current_user_id
    and job.idempotency_key = p_idempotency_key
  for update;

  if found then
    if job_record.request_hash is distinct from p_request_hash then
      raise sqlstate 'PT409'
        using message = 'idempotency_key_payload_mismatch',
              detail = 'The idempotency key was already used for a different import payload.';
    end if;

    select coalesce(jsonb_agg(to_jsonb(candidate) order by candidate.ordinal), '[]'::jsonb)
      into candidate_rows
    from public.import_job_candidates candidate
    where candidate.user_id = current_user_id
      and candidate.job_id = job_record.id;

    return to_jsonb(job_record) || jsonb_build_object(
      'import_job_candidates', candidate_rows,
      'already_enqueued', true
    );
  end if;

  -- A syntactically owned path is not enough: only enqueue completed uploads.
  if not exists (
    select 1
    from storage.objects object
    where object.bucket_id = p_original_image_bucket
      and object.name = p_original_image_path
  ) then
    raise sqlstate 'PT404'
      using message = 'import_image_not_found',
            detail = 'No completed private upload exists at the supplied path.';
  end if;

  select limits.daily_limit into daily_limit
  from public.feature_limits limits
  where limits.feature = 'image_import'
  for share;

  if not found then
    raise exception 'image_import_limit_not_configured' using errcode = '55000';
  end if;

  usage_result := public.check_and_increment_usage('image_import', daily_limit);
  if not coalesce((usage_result ->> 'allowed')::boolean, false) then
    raise sqlstate 'PT429'
      using message = 'daily_import_limit_reached',
            detail = usage_result::text,
            hint = 'Retry after the reset_at timestamp in the error details.';
  end if;

  insert into public.import_jobs (
    user_id,
    status,
    original_image_bucket,
    original_image_path,
    idempotency_key,
    request_hash,
    input_metadata
  ) values (
    current_user_id,
    'queued',
    p_original_image_bucket,
    p_original_image_path,
    p_idempotency_key,
    p_request_hash,
    p_input_metadata
  )
  returning * into job_record;

  return to_jsonb(job_record) || jsonb_build_object(
    'import_job_candidates', '[]'::jsonb,
    'already_enqueued', false
  );
end;
$$;

-- Research enqueue validates the owned item and usable clues before consuming
-- the database-owned daily budget. Every successful call creates one run.
create or replace function public.enqueue_research_run(
  p_item_id uuid,
  p_input_clues jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  run_record public.item_research_runs%rowtype;
  daily_limit integer;
  usage_result jsonb;
  has_searchable_clue boolean := false;
  clue_key text;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_item_id is null then
    raise exception 'invalid_item_id' using errcode = '22023';
  end if;
  if p_input_clues is null
    or jsonb_typeof(p_input_clues) <> 'object'
    or pg_column_size(p_input_clues) > 32768
  then
    raise exception 'invalid_research_input_clues' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.wardrobe_items item
    where item.id = p_item_id
      and item.user_id = current_user_id
      and item.deleted_at is null
  ) then
    raise sqlstate 'PT404'
      using message = 'wardrobe_item_not_found',
            detail = 'The item does not exist or is not owned by the authenticated user.';
  end if;

  foreach clue_key in array array[
    'brand', 'productName', 'product_name', 'modelNumber', 'model_number',
    'barcode', 'description', 'userClue', 'user_clue', 'logoText', 'logo_text'
  ] loop
    if jsonb_typeof(p_input_clues -> clue_key) = 'string'
      and btrim(p_input_clues ->> clue_key) <> ''
    then
      has_searchable_clue := true;
      exit;
    end if;
  end loop;

  if not has_searchable_clue then
    select exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(p_input_clues -> 'visibleText') = 'array'
            then p_input_clues -> 'visibleText'
          when jsonb_typeof(p_input_clues -> 'visible_text') = 'array'
            then p_input_clues -> 'visible_text'
          else '[]'::jsonb
        end
      ) visible(value)
      where jsonb_typeof(visible.value) = 'string'
        and btrim(visible.value #>> '{}') <> ''
    ) into has_searchable_clue;
  end if;

  if not has_searchable_clue then
    raise sqlstate 'PT422'
      using message = 'insufficient_research_clues',
            detail = 'Add a brand, label, logo, SKU, barcode, visible text, or user clue.';
  end if;

  select limits.daily_limit into daily_limit
  from public.feature_limits limits
  where limits.feature = 'item_research'
  for share;

  if not found then
    raise exception 'item_research_limit_not_configured' using errcode = '55000';
  end if;

  usage_result := public.check_and_increment_usage('item_research', daily_limit);
  if not coalesce((usage_result ->> 'allowed')::boolean, false) then
    raise sqlstate 'PT429'
      using message = 'daily_research_limit_reached',
            detail = usage_result::text,
            hint = 'Retry after the reset_at timestamp in the error details.';
  end if;

  insert into public.item_research_runs (
    user_id,
    item_id,
    status,
    input_clues
  ) values (
    current_user_id,
    p_item_id,
    'queued',
    p_input_clues
  )
  returning * into run_record;

  return to_jsonb(run_record);
end;
$$;

create or replace function public.claim_api_idempotency_key(
  p_scope text,
  p_idempotency_key text,
  p_request_hash text,
  p_ttl interval default interval '24 hours'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  key_record public.api_idempotency_keys%rowtype;
  current_time timestamptz := clock_timestamp();
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_scope is null or btrim(p_scope) = '' or char_length(p_scope) > 100 then
    raise exception 'invalid idempotency scope' using errcode = '22023';
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    raise exception 'invalid idempotency key' using errcode = '22023';
  end if;
  if p_request_hash is null or btrim(p_request_hash) = '' or char_length(p_request_hash) > 200 then
    raise exception 'invalid request hash' using errcode = '22023';
  end if;
  if p_ttl < interval '1 minute' or p_ttl > interval '7 days' then
    raise exception 'invalid idempotency ttl' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text || ':' || p_scope || ':' || p_idempotency_key, 0));

  delete from public.api_idempotency_keys key
  where key.user_id = current_user_id
    and key.scope = p_scope
    and key.idempotency_key = p_idempotency_key
    and key.expires_at <= current_time;

  select key.* into key_record
  from public.api_idempotency_keys key
  where key.user_id = current_user_id
    and key.scope = p_scope
    and key.idempotency_key = p_idempotency_key
  for update;

  if not found then
    insert into public.api_idempotency_keys (
      user_id, scope, idempotency_key, request_hash, locked_until, expires_at
    ) values (
      current_user_id, p_scope, p_idempotency_key, p_request_hash,
      current_time + interval '5 minutes', current_time + p_ttl
    )
    returning * into key_record;

    return jsonb_build_object('state', 'claimed', 'id', key_record.id);
  end if;

  if key_record.request_hash <> p_request_hash then
    raise exception 'idempotency key was already used with a different request'
      using errcode = '22023';
  end if;

  if key_record.status = 'completed' then
    return jsonb_build_object(
      'state', 'completed',
      'id', key_record.id,
      'response_status', key_record.response_status,
      'response_body', key_record.response_body,
      'resource_type', key_record.resource_type,
      'resource_id', key_record.resource_id
    );
  end if;

  if key_record.status = 'processing' and key_record.locked_until > current_time then
    return jsonb_build_object('state', 'in_progress', 'id', key_record.id, 'locked_until', key_record.locked_until);
  end if;

  update public.api_idempotency_keys
  set
    status = 'processing',
    attempt_count = attempt_count + 1,
    locked_until = current_time + interval '5 minutes',
    expires_at = current_time + p_ttl,
    last_error = null
  where id = key_record.id;

  return jsonb_build_object('state', 'claimed', 'id', key_record.id);
end;
$$;

create or replace function public.complete_api_idempotency_key(
  p_id uuid,
  p_response_status integer,
  p_response_body jsonb default null,
  p_resource_type text default null,
  p_resource_id uuid default null
)
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
  if p_response_status not between 100 and 599 then
    raise exception 'invalid response status' using errcode = '22023';
  end if;

  update public.api_idempotency_keys
  set
    status = 'completed',
    response_status = p_response_status,
    response_body = p_response_body,
    resource_type = p_resource_type,
    resource_id = p_resource_id,
    locked_until = clock_timestamp(),
    last_error = null
  where id = p_id and user_id = current_user_id;

  if not found then
    raise exception 'idempotency record not found' using errcode = 'P0002';
  end if;
  return true;
end;
$$;

create or replace function public.fail_api_idempotency_key(
  p_id uuid,
  p_error text
)
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

  update public.api_idempotency_keys
  set
    status = 'failed',
    locked_until = clock_timestamp(),
    last_error = left(coalesce(p_error, 'request failed'), 2000)
  where id = p_id and user_id = current_user_id;

  if not found then
    raise exception 'idempotency record not found' using errcode = 'P0002';
  end if;
  return true;
end;
$$;

create or replace function public.valid_research_proposal_value(
  p_field text,
  p_value jsonb
)
returns boolean
language sql
immutable
parallel safe
security invoker
set search_path = ''
as $$
  select coalesce(case
    when p_field in ('name', 'brand', 'product_name', 'model_number', 'barcode', 'category', 'subcategory')
      then case when jsonb_typeof(p_value) = 'string'
        then btrim(p_value #>> '{}') <> '' else false end
    when p_field = 'water_resistance'
      then case when jsonb_typeof(p_value) = 'string'
        then (p_value #>> '{}') in ('none', 'water_repellent', 'water_resistant', 'waterproof')
        else false end
    when p_field = 'materials'
      then jsonb_typeof(p_value) in ('array', 'object')
    when p_field in ('season_tags', 'care_instructions')
      then case when jsonb_typeof(p_value) = 'array' then not exists (
        select 1
        from jsonb_array_elements(p_value) proposed(element)
        where jsonb_typeof(element) <> 'string' or btrim(element #>> '{}') = ''
      ) else false end
    else false
  end, false);
$$;

revoke all on function public.valid_research_proposal_value(text, jsonb) from public;

create or replace function public.accept_research_run(
  p_run_id uuid,
  p_fields text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  run_record public.item_research_runs%rowtype;
  item_record public.wardrobe_items%rowtype;
  allowed_fields constant text[] := array[
    'name',
    'brand',
    'product_name',
    'model_number',
    'barcode',
    'category',
    'subcategory',
    'materials',
    'season_tags',
    'water_resistance',
    'care_instructions'
  ];
  selected_fields text[];
  applied_fields text[];
  skipped_fields text[];
  invalid_fields text[];
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select run.* into run_record
  from public.item_research_runs run
  where run.id = p_run_id and run.user_id = current_user_id
  for update;
  if not found then
    raise exception 'research run not found' using errcode = 'P0002';
  end if;

  select item.* into item_record
  from public.wardrobe_items item
  where item.id = run_record.item_id and item.user_id = current_user_id
  for update;
  if not found then
    raise exception 'wardrobe item not found' using errcode = 'P0002';
  end if;

  if run_record.status = 'accepted' then
    return jsonb_build_object(
      'run_id', run_record.id,
      'item_id', run_record.item_id,
      'applied_fields', to_jsonb(run_record.accepted_fields),
      'already_accepted', true
    );
  end if;
  if run_record.status not in ('verified', 'likely', 'uncertain') then
    raise exception 'research run is not ready to accept' using errcode = '55000';
  end if;

  if p_fields is null then
    select coalesce(array_agg(proposed_key order by proposed_key), '{}'::text[])
      into selected_fields
    from jsonb_object_keys(run_record.proposed_changes) proposed(proposed_key)
    where proposed_key = any(allowed_fields);
  else
    if array_position(p_fields, null) is not null or exists (
      select 1 from unnest(p_fields) requested(requested_field)
      where not (requested_field = any(allowed_fields))
    ) then
      raise exception 'requested research field is not allowed' using errcode = '22023';
    end if;

    select coalesce(array_agg(distinct requested_field order by requested_field), '{}'::text[])
      into selected_fields
    from unnest(p_fields) requested(requested_field)
    where run_record.proposed_changes ? requested_field;
  end if;

  select coalesce(array_agg(selected_field order by selected_field), '{}'::text[])
    into applied_fields
  from unnest(selected_fields) selected(selected_field)
  where not (selected_field = any(item_record.user_confirmed_fields))
    and public.valid_research_proposal_value(
      selected_field,
      run_record.proposed_changes -> selected_field
    );

  select coalesce(array_agg(selected_field order by selected_field), '{}'::text[])
    into skipped_fields
  from unnest(selected_fields) selected(selected_field)
  where selected_field = any(item_record.user_confirmed_fields);

  select coalesce(array_agg(selected_field order by selected_field), '{}'::text[])
    into invalid_fields
  from unnest(selected_fields) selected(selected_field)
  where not (selected_field = any(item_record.user_confirmed_fields))
    and not public.valid_research_proposal_value(
      selected_field,
      run_record.proposed_changes -> selected_field
    );

  perform set_config('wardrobe.allow_ai_metadata_update', 'on', true);

  update public.wardrobe_items item
  set
    name = case
      when 'name' = any(applied_fields)
        and jsonb_typeof(run_record.proposed_changes -> 'name') = 'string'
        and btrim(run_record.proposed_changes ->> 'name') <> ''
        then btrim(run_record.proposed_changes ->> 'name')
      else item.name
    end,
    brand = case
      when 'brand' = any(applied_fields)
        and jsonb_typeof(run_record.proposed_changes -> 'brand') = 'string'
        and btrim(run_record.proposed_changes ->> 'brand') <> ''
        then btrim(run_record.proposed_changes ->> 'brand')
      else item.brand
    end,
    product_name = case
      when 'product_name' = any(applied_fields)
        and jsonb_typeof(run_record.proposed_changes -> 'product_name') = 'string'
        and btrim(run_record.proposed_changes ->> 'product_name') <> ''
        then btrim(run_record.proposed_changes ->> 'product_name')
      else item.product_name
    end,
    model_number = case
      when 'model_number' = any(applied_fields)
        and jsonb_typeof(run_record.proposed_changes -> 'model_number') = 'string'
        and btrim(run_record.proposed_changes ->> 'model_number') <> ''
        then btrim(run_record.proposed_changes ->> 'model_number')
      else item.model_number
    end,
    barcode = case
      when 'barcode' = any(applied_fields)
        and jsonb_typeof(run_record.proposed_changes -> 'barcode') = 'string'
        and btrim(run_record.proposed_changes ->> 'barcode') <> ''
        then btrim(run_record.proposed_changes ->> 'barcode')
      else item.barcode
    end,
    category = case
      when 'category' = any(applied_fields)
        and jsonb_typeof(run_record.proposed_changes -> 'category') = 'string'
        and btrim(run_record.proposed_changes ->> 'category') <> ''
        then btrim(run_record.proposed_changes ->> 'category')
      else item.category
    end,
    subcategory = case
      when 'subcategory' = any(applied_fields)
        and jsonb_typeof(run_record.proposed_changes -> 'subcategory') = 'string'
        and btrim(run_record.proposed_changes ->> 'subcategory') <> ''
        then btrim(run_record.proposed_changes ->> 'subcategory')
      else item.subcategory
    end,
    materials = case
      when 'materials' = any(applied_fields)
        and jsonb_typeof(run_record.proposed_changes -> 'materials') in ('array', 'object')
        then run_record.proposed_changes -> 'materials'
      else item.materials
    end,
    season_tags = case
      when 'season_tags' = any(applied_fields)
        and jsonb_typeof(run_record.proposed_changes -> 'season_tags') = 'array'
        then public.jsonb_text_array(run_record.proposed_changes -> 'season_tags')
      else item.season_tags
    end,
    water_resistance = case
      when 'water_resistance' = any(applied_fields)
        and jsonb_typeof(run_record.proposed_changes -> 'water_resistance') = 'string'
        and btrim(run_record.proposed_changes ->> 'water_resistance') <> ''
        then btrim(run_record.proposed_changes ->> 'water_resistance')
      else item.water_resistance
    end,
    care_instructions = case
      when 'care_instructions' = any(applied_fields)
        and jsonb_typeof(run_record.proposed_changes -> 'care_instructions') = 'array'
        then public.jsonb_text_array(run_record.proposed_changes -> 'care_instructions')
      else item.care_instructions
    end
  where item.id = item_record.id and item.user_id = current_user_id;

  update public.item_research_runs
  set
    status = 'accepted',
    accepted_fields = applied_fields,
    accepted_at = now(),
    rejected_at = null,
    completed_at = coalesce(completed_at, now()),
    locked_at = null,
    locked_until = null
  where id = run_record.id and user_id = current_user_id;

  return jsonb_build_object(
    'run_id', run_record.id,
    'item_id', run_record.item_id,
    'applied_fields', to_jsonb(applied_fields),
    'skipped_user_confirmed_fields', to_jsonb(skipped_fields),
    'invalid_proposal_fields', to_jsonb(invalid_fields),
    'already_accepted', false
  );
end;
$$;

create or replace function public.reject_research_run(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  run_record public.item_research_runs%rowtype;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select run.* into run_record
  from public.item_research_runs run
  where run.id = p_run_id and run.user_id = current_user_id
  for update;
  if not found then
    raise exception 'research run not found' using errcode = 'P0002';
  end if;
  if run_record.status = 'accepted' then
    raise exception 'accepted research cannot be rejected automatically' using errcode = '55000';
  end if;
  if run_record.status = 'rejected' then
    return jsonb_build_object('run_id', run_record.id, 'item_id', run_record.item_id, 'already_rejected', true);
  end if;

  update public.item_research_runs
  set
    status = 'rejected',
    accepted_fields = '{}',
    accepted_at = null,
    rejected_at = now(),
    completed_at = coalesce(completed_at, now()),
    locked_at = null,
    locked_until = null
  where id = run_record.id and user_id = current_user_id;

  return jsonb_build_object('run_id', run_record.id, 'item_id', run_record.item_id, 'already_rejected', false);
end;
$$;

revoke all on function public.accept_research_run(uuid, text[]) from public;
revoke all on function public.reject_research_run(uuid) from public;

create or replace function public.save_generated_outfit(
  p_name text,
  p_occasion text,
  p_weather_context jsonb,
  p_explanation text,
  p_confidence numeric,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  created_outfit_id uuid;
  dress_count integer;
  top_count integer;
  bottom_count integer;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_name is null or btrim(p_name) = '' then
    raise exception 'outfit name is required' using errcode = '22023';
  end if;
  if p_weather_context is not null and jsonb_typeof(p_weather_context) <> 'object' then
    raise exception 'weather context must be an object' using errcode = '22023';
  end if;
  if p_confidence is not null and (p_confidence < 0 or p_confidence > 1) then
    raise exception 'confidence must be between zero and one' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) not between 1 and 5
  then
    raise exception 'generated outfit must contain between one and five items' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) parsed(element)
    where jsonb_typeof(element) <> 'object'
  ) then
    raise exception 'every generated outfit item must be an object' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) parsed(element)
    where coalesce(element ->> 'item_id', element ->> 'itemId', element ->> 'id', '')
      !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) then
    raise exception 'generated outfit contains an invalid item id' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) parsed(element)
    where coalesce(element ->> 'role', '') not in ('top', 'bottom', 'dress', 'layer', 'shoes', 'accessory')
  ) then
    raise exception 'generated outfit contains an invalid item role' using errcode = '22023';
  end if;

  if (
    select count(distinct coalesce(element ->> 'item_id', element ->> 'itemId', element ->> 'id'))
    from jsonb_array_elements(p_items) parsed(element)
  ) <> jsonb_array_length(p_items) then
    raise exception 'generated outfit contains duplicate items' using errcode = '23505';
  end if;

  if (
    select count(distinct element ->> 'role')
    from jsonb_array_elements(p_items) parsed(element)
  ) <> jsonb_array_length(p_items) then
    raise exception 'generated outfit contains duplicate roles' using errcode = '23505';
  end if;

  select
    count(*) filter (where element ->> 'role' = 'dress'),
    count(*) filter (where element ->> 'role' = 'top'),
    count(*) filter (where element ->> 'role' = 'bottom')
    into dress_count, top_count, bottom_count
  from jsonb_array_elements(p_items) parsed(element);

  if not (
    (dress_count = 1 and top_count = 0 and bottom_count = 0)
    or (dress_count = 0 and top_count = 1 and bottom_count = 1)
  ) then
    raise exception 'outfit requires one dress or one top and one bottom' using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) parsed(element)
    left join public.wardrobe_items item
      on item.id = coalesce(element ->> 'item_id', element ->> 'itemId', element ->> 'id')::uuid
     and item.user_id = current_user_id
    where item.id is null
       or item.status <> 'active'
       or item.availability_status <> 'available'
       or item.deleted_at is not null
       or public.resolve_wardrobe_item_role(item.layer_role, item.category, item.subcategory)
          is distinct from element ->> 'role'
  ) then
    raise exception 'every outfit item must be owned, active, available, and assigned its resolved role'
      using errcode = '23514';
  end if;

  insert into public.outfits (
    user_id, name, source, occasion, weather_context, explanation, confidence
  ) values (
    current_user_id,
    btrim(p_name),
    'ai',
    nullif(btrim(p_occasion), ''),
    p_weather_context,
    p_explanation,
    p_confidence
  )
  returning id into created_outfit_id;

  insert into public.outfit_items (outfit_id, item_id, user_id, role, sort_order)
  select
    created_outfit_id,
    coalesce(element ->> 'item_id', element ->> 'itemId', element ->> 'id')::uuid,
    current_user_id,
    element ->> 'role',
    (ordinality - 1)::integer
  from jsonb_array_elements(p_items) with ordinality parsed(element, ordinality)
  order by ordinality;

  return created_outfit_id;
end;
$$;

create or replace function public.save_recorded_generated_outfit(p_generation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  saved_outfit_id uuid;
  recorded_outfit jsonb;
  recorded_occasion text;
  recorded_weather jsonb;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_generation_id is null then
    raise exception 'generation id is required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(current_user_id::text || ':generated-outfit:' || p_generation_id::text, 0)
  );

  select saved.outfit_id into saved_outfit_id
  from public.generated_outfit_saves saved
  where saved.user_id = current_user_id
    and saved.generation_id = p_generation_id;
  if found then
    return saved_outfit_id;
  end if;

  select
    run.output_summary -> 'outfit',
    nullif(btrim(run.input_summary ->> 'occasion'), ''),
    coalesce(run.output_summary -> 'weatherContext', '{}'::jsonb)
    into recorded_outfit, recorded_occasion, recorded_weather
  from public.agent_runs run
  where run.id = p_generation_id
    and run.user_id = current_user_id
    and run.agent_type = 'wardrobe_orchestrator'
    and run.status = 'complete';

  if not found or jsonb_typeof(recorded_outfit) <> 'object' then
    raise exception 'completed generated outfit not found' using errcode = 'P0002';
  end if;

  saved_outfit_id := public.save_generated_outfit(
    recorded_outfit ->> 'title',
    recorded_occasion,
    recorded_weather,
    recorded_outfit ->> 'explanation',
    (recorded_outfit ->> 'confidence')::numeric,
    recorded_outfit -> 'items'
  );

  insert into public.generated_outfit_saves (user_id, generation_id, outfit_id)
  values (current_user_id, p_generation_id, saved_outfit_id);

  return saved_outfit_id;
end;
$$;

create or replace function public.save_generated_plan(
  p_date date,
  p_occasion text,
  p_weather_context jsonb,
  p_name text,
  p_explanation text,
  p_confidence numeric,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  created_outfit_id uuid;
  created_plan_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_date is null then
    raise exception 'planned date is required' using errcode = '22023';
  end if;

  created_outfit_id := public.save_generated_outfit(
    p_name,
    p_occasion,
    p_weather_context,
    p_explanation,
    p_confidence,
    p_items
  );

  insert into public.outfit_plans (
    user_id, outfit_id, planned_date, occasion, weather_snapshot, status
  ) values (
    current_user_id,
    created_outfit_id,
    p_date,
    nullif(btrim(p_occasion), ''),
    p_weather_context,
    'planned'
  )
  returning id into created_plan_id;

  return jsonb_build_object('outfit_id', created_outfit_id, 'plan_id', created_plan_id);
end;
$$;

create or replace function public.save_generated_week(p_plans jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  plan_input jsonb;
  saved_plans jsonb := '[]'::jsonb;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_plans is null
    or jsonb_typeof(p_plans) <> 'array'
    or jsonb_array_length(p_plans) not between 1 and 7
  then
    raise exception 'generated week must contain between one and seven plans' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_plans) parsed(element)
    where jsonb_typeof(element) <> 'object'
      or coalesce(element ->> 'date', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      or jsonb_typeof(coalesce(element -> 'items', 'null'::jsonb)) <> 'array'
  ) then
    raise exception 'generated week contains an invalid plan' using errcode = '22023';
  end if;
  if (
    select count(distinct element ->> 'date')
    from jsonb_array_elements(p_plans) parsed(element)
  ) <> jsonb_array_length(p_plans) then
    raise exception 'generated week contains duplicate dates' using errcode = '23505';
  end if;

  for plan_input in select element from jsonb_array_elements(p_plans) parsed(element)
  loop
    saved_plans := saved_plans || jsonb_build_array(
      public.save_generated_plan(
        (plan_input ->> 'date')::date,
        plan_input ->> 'occasion',
        coalesce(plan_input -> 'weather_context', '{}'::jsonb),
        plan_input ->> 'name',
        plan_input ->> 'explanation',
        (plan_input ->> 'confidence')::numeric,
        plan_input -> 'items'
      )
    );
  end loop;

  return saved_plans;
end;
$$;

revoke all on function public.save_generated_outfit(text, text, jsonb, text, numeric, jsonb) from public;
revoke all on function public.save_recorded_generated_outfit(uuid) from public;
revoke all on function public.save_generated_plan(date, text, jsonb, text, text, numeric, jsonb) from public;
revoke all on function public.save_generated_week(jsonb) from public;

create or replace function public.resolve_wardrobe_item_role(
  p_layer_role text,
  p_category text,
  p_subcategory text
)
returns text
language sql
immutable
parallel safe
security invoker
set search_path = ''
as $$
  select coalesce(
    case
      when p_layer_role in ('top', 'bottom', 'dress', 'layer', 'shoes', 'accessory')
        then p_layer_role
      else null
    end,
    case regexp_replace(lower(coalesce(p_subcategory, '')), '[^a-z0-9]', '', 'g')
      when 'upperbody' then 'top'
      when 'top' then 'top'
      when 'tops' then 'top'
      when 'shirt' then 'top'
      when 'shirts' then 'top'
      when 'blouse' then 'top'
      when 'sweater' then 'top'
      when 'knitwear' then 'top'
      when 'tee' then 'top'
      when 'tshirt' then 'top'
      when 'lowerbody' then 'bottom'
      when 'bottom' then 'bottom'
      when 'bottoms' then 'bottom'
      when 'pants' then 'bottom'
      when 'trousers' then 'bottom'
      when 'jeans' then 'bottom'
      when 'skirt' then 'bottom'
      when 'shorts' then 'bottom'
      when 'wholebody' then 'dress'
      when 'dress' then 'dress'
      when 'dresses' then 'dress'
      when 'wholebodyup' then 'layer'
      when 'layer' then 'layer'
      when 'outerwear' then 'layer'
      when 'jacket' then 'layer'
      when 'jackets' then 'layer'
      when 'coat' then 'layer'
      when 'coats' then 'layer'
      when 'shoes' then 'shoes'
      when 'shoe' then 'shoes'
      when 'footwear' then 'shoes'
      when 'accessoriesup' then 'accessory'
      when 'accessory' then 'accessory'
      when 'accessories' then 'accessory'
      else null
    end,
    case regexp_replace(lower(coalesce(p_category, '')), '[^a-z0-9]', '', 'g')
      when 'upperbody' then 'top'
      when 'top' then 'top'
      when 'tops' then 'top'
      when 'shirt' then 'top'
      when 'shirts' then 'top'
      when 'blouse' then 'top'
      when 'sweater' then 'top'
      when 'knitwear' then 'top'
      when 'tee' then 'top'
      when 'tshirt' then 'top'
      when 'lowerbody' then 'bottom'
      when 'bottom' then 'bottom'
      when 'bottoms' then 'bottom'
      when 'pants' then 'bottom'
      when 'trousers' then 'bottom'
      when 'jeans' then 'bottom'
      when 'skirt' then 'bottom'
      when 'shorts' then 'bottom'
      when 'wholebody' then 'dress'
      when 'dress' then 'dress'
      when 'dresses' then 'dress'
      when 'wholebodyup' then 'layer'
      when 'layer' then 'layer'
      when 'outerwear' then 'layer'
      when 'jacket' then 'layer'
      when 'jackets' then 'layer'
      when 'coat' then 'layer'
      when 'coats' then 'layer'
      when 'shoes' then 'shoes'
      when 'shoe' then 'shoes'
      when 'footwear' then 'shoes'
      when 'accessoriesup' then 'accessory'
      when 'accessory' then 'accessory'
      when 'accessories' then 'accessory'
      else null
    end
  );
$$;

create or replace function public.validate_outfit_item_role()
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
    raise exception 'outfit role must match the wardrobe item role' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_outfit_item_role on public.outfit_items;
create trigger validate_outfit_item_role
before insert or update of item_id, user_id, role on public.outfit_items
for each row execute function public.validate_outfit_item_role();

revoke all on function public.validate_outfit_item_role() from public;

create or replace function public.swap_outfit_item(
  p_outfit_id uuid,
  p_remove_item_id uuid,
  p_replacement_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  removed_role text;
  removed_sort_order integer;
  replacement_record public.wardrobe_items%rowtype;
  replacement_role text;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_remove_item_id = p_replacement_item_id then
    raise exception 'replacement must be a different item' using errcode = '22023';
  end if;

  -- Serialize all changes to a given outfit so two swaps cannot race.
  perform 1
  from public.outfits outfit
  where outfit.id = p_outfit_id and outfit.user_id = current_user_id
  for update;
  if not found then
    raise exception 'outfit not found' using errcode = 'P0002';
  end if;

  select outfit_item.role, outfit_item.sort_order
    into removed_role, removed_sort_order
  from public.outfit_items outfit_item
  where outfit_item.outfit_id = p_outfit_id
    and outfit_item.item_id = p_remove_item_id
    and outfit_item.user_id = current_user_id;
  if not found then
    raise exception 'outfit item not found' using errcode = 'P0002';
  end if;

  select item.* into replacement_record
  from public.wardrobe_items item
  where item.id = p_replacement_item_id
    and item.user_id = current_user_id
    and item.status = 'active'
    and item.availability_status = 'available'
    and item.deleted_at is null
  for update;
  if not found then
    raise exception 'replacement item must be owned, active, and available' using errcode = '23514';
  end if;

  replacement_role := public.resolve_wardrobe_item_role(
    replacement_record.layer_role,
    replacement_record.category,
    replacement_record.subcategory
  );
  if replacement_role is distinct from removed_role then
    raise exception 'replacement item must have the same outfit role' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.outfit_items outfit_item
    where outfit_item.outfit_id = p_outfit_id
      and outfit_item.item_id = p_replacement_item_id
      and outfit_item.user_id = current_user_id
  ) then
    raise exception 'replacement item is already in this outfit' using errcode = '23505';
  end if;

  delete from public.outfit_items
  where outfit_id = p_outfit_id
    and item_id = p_remove_item_id
    and user_id = current_user_id;

  insert into public.outfit_items (outfit_id, item_id, user_id, role, sort_order)
  values (p_outfit_id, p_replacement_item_id, current_user_id, removed_role, removed_sort_order);

  update public.outfits
  set updated_at = now()
  where id = p_outfit_id and user_id = current_user_id;

  return jsonb_build_object(
    'outfit_id', p_outfit_id,
    'removed_item_id', p_remove_item_id,
    'replacement_item_id', p_replacement_item_id,
    'role', removed_role,
    'sort_order', removed_sort_order
  );
end;
$$;

create or replace function public.create_user_outfit(
  p_name text,
  p_occasion text,
  p_season_tags text[],
  p_weather_context jsonb,
  p_explanation text,
  p_confidence numeric,
  p_favorite boolean,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  created_outfit public.outfits%rowtype;
  created_items jsonb;
  dress_count integer;
  top_count integer;
  bottom_count integer;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_name is null or btrim(p_name) = '' or char_length(btrim(p_name)) > 160 then
    raise exception 'outfit name must contain at most 160 characters' using errcode = '22023';
  end if;
  if p_occasion is not null and char_length(btrim(p_occasion)) > 160 then
    raise exception 'occasion must contain at most 160 characters' using errcode = '22023';
  end if;
  if p_explanation is not null and char_length(p_explanation) > 1500 then
    raise exception 'explanation must contain at most 1500 characters' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_season_tags), 0) > 50 or exists (
    select 1 from unnest(coalesce(p_season_tags, '{}'::text[])) tag
    where tag is null or btrim(tag) = '' or char_length(btrim(tag)) > 80
  ) then
    raise exception 'season tags are invalid' using errcode = '22023';
  end if;
  if p_weather_context is not null and jsonb_typeof(p_weather_context) <> 'object' then
    raise exception 'weather context must be an object' using errcode = '22023';
  end if;
  if p_confidence is not null and (p_confidence < 0 or p_confidence > 1) then
    raise exception 'confidence must be between zero and one' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) not between 1 and 5
  then
    raise exception 'user outfit must contain between one and five items' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) parsed(element)
    where jsonb_typeof(element) <> 'object'
      or coalesce(element ->> 'item_id', '')
        !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or coalesce(element ->> 'role', '')
        not in ('top', 'bottom', 'dress', 'layer', 'shoes', 'accessory')
      or (
        element ? 'sort_order'
        and coalesce(element ->> 'sort_order', '') !~ '^[0-9]{1,9}$'
      )
  ) then
    raise exception 'user outfit contains an invalid item selection' using errcode = '22023';
  end if;

  if (
    select count(distinct element ->> 'item_id')
    from jsonb_array_elements(p_items) parsed(element)
  ) <> jsonb_array_length(p_items) then
    raise exception 'user outfit contains duplicate items' using errcode = '23505';
  end if;
  if (
    select count(distinct element ->> 'role')
    from jsonb_array_elements(p_items) parsed(element)
  ) <> jsonb_array_length(p_items) then
    raise exception 'user outfit contains duplicate roles' using errcode = '23505';
  end if;

  select
    count(*) filter (where element ->> 'role' = 'dress'),
    count(*) filter (where element ->> 'role' = 'top'),
    count(*) filter (where element ->> 'role' = 'bottom')
    into dress_count, top_count, bottom_count
  from jsonb_array_elements(p_items) parsed(element);

  if not (
    (dress_count = 1 and top_count = 0 and bottom_count = 0)
    or (dress_count = 0 and top_count = 1 and bottom_count = 1)
  ) then
    raise exception 'outfit requires one dress or one top and one bottom' using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) parsed(element)
    left join public.wardrobe_items item
      on item.id = (element ->> 'item_id')::uuid
     and item.user_id = current_user_id
    where item.id is null
       or item.status <> 'active'
       or item.availability_status <> 'available'
       or item.deleted_at is not null
       or public.resolve_wardrobe_item_role(item.layer_role, item.category, item.subcategory)
          is distinct from element ->> 'role'
  ) then
    raise exception 'every outfit item must be owned, active, available, and assigned its resolved role'
      using errcode = '23514';
  end if;

  insert into public.outfits (
    user_id, name, source, occasion, season_tags, weather_context,
    explanation, confidence, favorite
  ) values (
    current_user_id,
    btrim(p_name),
    'user',
    nullif(btrim(p_occasion), ''),
    coalesce(p_season_tags, '{}'::text[]),
    p_weather_context,
    p_explanation,
    p_confidence,
    coalesce(p_favorite, false)
  )
  returning * into created_outfit;

  insert into public.outfit_items (outfit_id, item_id, user_id, role, sort_order)
  select
    created_outfit.id,
    (element ->> 'item_id')::uuid,
    current_user_id,
    element ->> 'role',
    case when element ? 'sort_order'
      then (element ->> 'sort_order')::integer
      else (ordinality - 1)::integer
    end
  from jsonb_array_elements(p_items) with ordinality parsed(element, ordinality)
  order by ordinality;

  select coalesce(jsonb_agg(to_jsonb(outfit_item) order by outfit_item.sort_order), '[]'::jsonb)
    into created_items
  from public.outfit_items outfit_item
  where outfit_item.outfit_id = created_outfit.id
    and outfit_item.user_id = current_user_id;

  return to_jsonb(created_outfit) || jsonb_build_object('outfit_items', created_items);
end;
$$;

revoke all on function public.resolve_wardrobe_item_role(text, text, text) from public;
revoke all on function public.swap_outfit_item(uuid, uuid, uuid) from public;
revoke all on function public.create_user_outfit(text, text, text[], jsonb, text, numeric, boolean, jsonb) from public;

-- Interactive server routes claim only a caller-owned row. The atomic UPDATE
-- serializes competing requests and applies the same lease/retry contract as
-- the service-role batch worker without exposing direct workflow-table writes.
create or replace function public.claim_owned_import_job(
  p_job_id uuid,
  p_lease_seconds integer default 300
)
returns setof public.import_jobs
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
  if p_job_id is null
    or p_lease_seconds is null
    or p_lease_seconds not between 30 and 1800
  then
    raise exception 'invalid_owned_import_claim_parameters' using errcode = '22023';
  end if;

  update public.import_jobs job
  set
    status = 'failed',
    error_code = 'retry_exhausted',
    error_message = 'The import exceeded its automatic retry budget.',
    locked_at = null,
    locked_until = null
  where job.id = p_job_id
    and job.user_id = current_user_id
    and job.status in ('queued', 'analyzing', 'extracting', 'researching', 'failed')
    and job.attempt_count >= 10
    and (job.locked_until is null or job.locked_until <= clock_timestamp())
    and job.error_code is distinct from 'retry_exhausted';

  return query
  update public.import_jobs job
  set
    status = case when job.status in ('queued', 'failed') then 'analyzing' else job.status end,
    locked_at = clock_timestamp(),
    locked_until = clock_timestamp() + make_interval(secs => p_lease_seconds),
    processing_started_at = coalesce(job.processing_started_at, clock_timestamp()),
    attempt_count = job.attempt_count + 1
  where job.id = p_job_id
    and job.user_id = current_user_id
    and job.status in ('queued', 'analyzing', 'extracting', 'researching', 'failed')
    and job.attempt_count < 10
    and coalesce(job.next_attempt_at, job.created_at) <= clock_timestamp()
    and (job.locked_until is null or job.locked_until <= clock_timestamp())
  returning job.*;
end;
$$;

create or replace function public.claim_owned_research_run(
  p_run_id uuid,
  p_lease_seconds integer default 300
)
returns setof public.item_research_runs
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
  if p_run_id is null
    or p_lease_seconds is null
    or p_lease_seconds not between 30 and 1800
  then
    raise exception 'invalid_owned_research_claim_parameters' using errcode = '22023';
  end if;

  update public.item_research_runs run
  set
    status = 'failed',
    error_code = 'retry_exhausted',
    error_message = 'The research run exceeded its automatic retry budget.',
    locked_at = null,
    locked_until = null,
    completed_at = coalesce(run.completed_at, now())
  where run.id = p_run_id
    and run.user_id = current_user_id
    and run.status in ('queued', 'running', 'failed')
    and run.attempt_count >= 5
    and (run.locked_until is null or run.locked_until <= clock_timestamp())
    and run.error_code is distinct from 'retry_exhausted';

  return query
  update public.item_research_runs run
  set
    status = 'running',
    locked_at = clock_timestamp(),
    locked_until = clock_timestamp() + make_interval(secs => p_lease_seconds),
    processing_started_at = coalesce(run.processing_started_at, clock_timestamp()),
    attempt_count = run.attempt_count + 1,
    completed_at = null,
    error_code = null,
    error_message = null
  where run.id = p_run_id
    and run.user_id = current_user_id
    and run.status in ('queued', 'running', 'failed')
    and run.attempt_count < 5
    and coalesce(run.next_attempt_at, run.created_at) <= clock_timestamp()
    and (run.locked_until is null or run.locked_until <= clock_timestamp())
  returning run.*;
end;
$$;

revoke all on function public.claim_owned_import_job(uuid, integer) from public;
revoke all on function public.claim_owned_research_run(uuid, integer) from public;

create or replace function public.claim_import_jobs(
  p_limit integer default 5,
  p_lease_seconds integer default 300
)
returns setof public.import_jobs
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
    raise exception 'invalid import-job claim parameters' using errcode = '22023';
  end if;

  update public.import_jobs job
  set
    status = 'failed',
    error_code = 'retry_exhausted',
    error_message = 'The import exceeded its automatic retry budget.',
    locked_at = null,
    locked_until = null
  where job.status in ('queued', 'analyzing', 'extracting', 'researching', 'failed')
    and job.attempt_count >= 10
    and (job.locked_until is null or job.locked_until <= clock_timestamp())
    and job.error_code is distinct from 'retry_exhausted';

  return query
  with claimable as (
    select job.id
    from public.import_jobs job
    where job.status in ('queued', 'analyzing', 'extracting', 'researching', 'failed')
      and job.attempt_count < 10
      and coalesce(job.next_attempt_at, job.created_at) <= clock_timestamp()
      and (job.locked_until is null or job.locked_until <= clock_timestamp())
    order by coalesce(job.next_attempt_at, job.created_at), job.created_at
    for update skip locked
    limit p_limit
  )
  update public.import_jobs job
  set
    status = case when job.status in ('queued', 'failed') then 'analyzing' else job.status end,
    locked_at = clock_timestamp(),
    locked_until = clock_timestamp() + make_interval(secs => p_lease_seconds),
    processing_started_at = coalesce(job.processing_started_at, clock_timestamp()),
    attempt_count = job.attempt_count + 1
  from claimable
  where job.id = claimable.id
  returning job.*;
end;
$$;

create or replace function public.claim_import_job(
  p_lease_seconds integer default 300
)
returns setof public.import_jobs
language sql
security definer
set search_path = ''
as $$
  select * from public.claim_import_jobs(1, p_lease_seconds);
$$;

create or replace function public.claim_research_jobs(
  p_limit integer default 5,
  p_lease_seconds integer default 300
)
returns setof public.item_research_runs
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
    raise exception 'invalid research-job claim parameters' using errcode = '22023';
  end if;

  update public.item_research_runs run
  set
    status = 'failed',
    error_code = 'retry_exhausted',
    error_message = 'The research run exceeded its automatic retry budget.',
    locked_at = null,
    locked_until = null,
    completed_at = coalesce(run.completed_at, now())
  where run.status in ('queued', 'running', 'failed')
    and run.attempt_count >= 5
    and (run.locked_until is null or run.locked_until <= clock_timestamp())
    and run.error_code is distinct from 'retry_exhausted';

  return query
  with claimable as (
    select run.id
    from public.item_research_runs run
    where run.status in ('queued', 'running', 'failed')
      and run.attempt_count < 5
      and coalesce(run.next_attempt_at, run.created_at) <= clock_timestamp()
      and (run.locked_until is null or run.locked_until <= clock_timestamp())
    order by coalesce(run.next_attempt_at, run.created_at), run.created_at
    for update skip locked
    limit p_limit
  )
  update public.item_research_runs run
  set
    status = 'running',
    locked_at = clock_timestamp(),
    locked_until = clock_timestamp() + make_interval(secs => p_lease_seconds),
    processing_started_at = coalesce(run.processing_started_at, clock_timestamp()),
    attempt_count = run.attempt_count + 1,
    completed_at = null,
    error_code = null,
    error_message = null
  from claimable
  where run.id = claimable.id
  returning run.*;
end;
$$;

create or replace function public.claim_research_job(
  p_lease_seconds integer default 300
)
returns setof public.item_research_runs
language sql
security definer
set search_path = ''
as $$
  select * from public.claim_research_jobs(1, p_lease_seconds);
$$;

create or replace function public.claim_storage_deletion_tasks(
  p_limit integer default 20,
  p_lease_seconds integer default 300
)
returns setof public.storage_deletion_queue
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit is null
    or p_lease_seconds is null
    or p_limit not between 1 and 100
    or p_lease_seconds not between 30 and 1800
  then
    raise exception 'invalid deletion-task claim parameters' using errcode = '22023';
  end if;

  return query
  with claimable as (
    select task.id
    from public.storage_deletion_queue task
    where task.status in ('pending', 'failed', 'processing')
      and task.next_attempt_at <= clock_timestamp()
      and (task.locked_until is null or task.locked_until <= clock_timestamp())
    order by task.next_attempt_at, task.created_at
    for update skip locked
    limit p_limit
  )
  update public.storage_deletion_queue task
  set
    status = 'processing',
    attempt_count = task.attempt_count + 1,
    locked_until = clock_timestamp() + make_interval(secs => p_lease_seconds),
    error_message = null
  from claimable
  where task.id = claimable.id
  returning task.*;
end;
$$;

revoke all on function public.validate_outfit_plan_owner() from public;
revoke all on function public.validate_wear_log_owner() from public;
revoke all on function public.mark_outfit_worn(uuid, timestamptz, uuid, smallint, smallint, smallint, text, text) from public;
revoke all on function public.mark_wardrobe_item_worn(uuid, timestamptz, text, text) from public;
revoke all on function public.consume_rate_limit(text, integer, interval, integer) from public;
revoke all on function public.check_and_increment_usage_window(text, integer, text, integer) from public;
revoke all on function public.check_and_increment_usage(text, integer) from public;
revoke all on function public.enqueue_import_job(text, text, text, text, jsonb) from public;
revoke all on function public.enqueue_research_run(uuid, jsonb) from public;
revoke all on function public.claim_api_idempotency_key(text, text, text, interval) from public;
revoke all on function public.complete_api_idempotency_key(uuid, integer, jsonb, text, uuid) from public;
revoke all on function public.fail_api_idempotency_key(uuid, text) from public;
revoke all on function public.claim_owned_import_job(uuid, integer) from public;
revoke all on function public.claim_owned_research_run(uuid, integer) from public;
revoke all on function public.claim_import_jobs(integer, integer) from public;
revoke all on function public.claim_import_job(integer) from public;
revoke all on function public.claim_research_jobs(integer, integer) from public;
revoke all on function public.claim_research_job(integer) from public;
revoke all on function public.claim_storage_deletion_tasks(integer, integer) from public;

-- Wardrobe AI: identity, wardrobe, import, and research data.
-- All user-owned rows ultimately cascade from public.profiles, whose id is the
-- corresponding auth.users id.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

set search_path = public, extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text,
  display_name text,
  avatar_path text,
  home_location_name text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  timezone text not null default 'UTC',
  temperature_unit text not null default 'celsius',
  locale text not null default 'en',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_latitude_check check (latitude is null or latitude between -90 and 90),
  constraint profiles_longitude_check check (longitude is null or longitude between -180 and 180),
  constraint profiles_temperature_unit_check check (temperature_unit in ('celsius', 'fahrenheit')),
  constraint profiles_avatar_owner_path_check check (avatar_path is null or split_part(avatar_path, '/', 1) = id::text),
  constraint profiles_timezone_not_blank check (btrim(timezone) <> ''),
  constraint profiles_locale_not_blank check (btrim(locale) <> '')
);

create table if not exists public.style_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  style_keywords text[] not null default '{}',
  favorite_colors text[] not null default '{}',
  avoided_colors text[] not null default '{}',
  preferred_fits text[] not null default '{}',
  preferred_formality smallint,
  runs_cold boolean,
  runs_hot boolean,
  modesty_preferences jsonb not null default '{}'::jsonb,
  size_profile jsonb not null default '{}'::jsonb,
  common_activities text[] not null default '{}',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint style_profiles_formality_check check (preferred_formality is null or preferred_formality between 1 and 5),
  constraint style_profiles_temperature_preference_check check (not (runs_cold is true and runs_hot is true)),
  constraint style_profiles_modesty_object_check check (jsonb_typeof(modesty_preferences) = 'object'),
  constraint style_profiles_size_object_check check (jsonb_typeof(size_profile) = 'object')
);

create table if not exists public.wardrobe_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'active',
  source text not null default 'manual',

  name text not null,
  brand text,
  product_name text,
  model_number text,
  barcode text,
  category text not null,
  subcategory text,
  layer_role text,

  primary_color_hex text,
  secondary_color_hex text,
  color_names text[] not null default '{}',
  pattern text,
  fit text,
  silhouette text,
  materials jsonb not null default '[]'::jsonb,
  visible_text text[] not null default '{}',

  size_label text,
  season_tags text[] not null default '{}',
  occasion_tags text[] not null default '{}',
  weather_tags text[] not null default '{}',
  warmth_level smallint,
  formality_level smallint,
  water_resistance text,
  care_instructions text[] not null default '{}',
  condition text,

  favorite boolean not null default false,
  availability_status text not null default 'available',
  wear_count integer not null default 0,
  last_worn_at timestamptz,
  notes text not null default '',

  purchase_price numeric(12, 2),
  currency text,
  purchase_date date,
  retailer text,

  metadata_confidence numeric(4, 3),
  field_confidence jsonb not null default '{}'::jsonb,
  ai_metadata jsonb not null default '{}'::jsonb,
  user_confirmed_fields text[] not null default '{}',
  user_confirmed_at timestamptz,

  -- One-time migration lineage from data/library.json. These fields retain the
  -- source record without making legacy paths authoritative storage URLs.
  legacy_id text,
  legacy_part text,
  legacy_image_path text,
  legacy_modeled_image_path text,
  legacy_import_job_id text,
  legacy_payload jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint wardrobe_items_id_user_unique unique (id, user_id),
  constraint wardrobe_items_name_not_blank check (btrim(name) <> ''),
  constraint wardrobe_items_category_not_blank check (btrim(category) <> ''),
  constraint wardrobe_items_status_check check (status in ('active', 'archived', 'donated', 'sold', 'lost')),
  constraint wardrobe_items_source_check check (source in ('manual', 'photo', 'import', 'research', 'legacy')),
  constraint wardrobe_items_layer_role_check check (
    layer_role is null or layer_role in ('top', 'bottom', 'dress', 'layer', 'shoes', 'accessory')
  ),
  constraint wardrobe_items_primary_hex_check check (primary_color_hex is null or primary_color_hex ~* '^#[0-9a-f]{6}$'),
  constraint wardrobe_items_secondary_hex_check check (secondary_color_hex is null or secondary_color_hex ~* '^#[0-9a-f]{6}$'),
  constraint wardrobe_items_materials_check check (jsonb_typeof(materials) in ('array', 'object')),
  constraint wardrobe_items_field_confidence_check check (jsonb_typeof(field_confidence) = 'object'),
  constraint wardrobe_items_ai_metadata_check check (jsonb_typeof(ai_metadata) = 'object'),
  constraint wardrobe_items_warmth_check check (warmth_level is null or warmth_level between 1 and 5),
  constraint wardrobe_items_formality_check check (formality_level is null or formality_level between 1 and 5),
  constraint wardrobe_items_water_resistance_check check (
    water_resistance is null
    or water_resistance in ('none', 'water_repellent', 'water_resistant', 'waterproof')
  ),
  constraint wardrobe_items_availability_check check (availability_status in ('available', 'laundry', 'packed', 'loaned', 'repair')),
  constraint wardrobe_items_wear_count_check check (wear_count >= 0),
  constraint wardrobe_items_purchase_price_check check (purchase_price is null or purchase_price >= 0),
  constraint wardrobe_items_currency_check check (currency is null or currency ~ '^[A-Z]{3}$'),
  constraint wardrobe_items_confidence_check check (metadata_confidence is null or metadata_confidence between 0 and 1)
);

create table if not exists public.wardrobe_item_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id uuid not null,
  kind text not null,
  bucket_id text not null default 'wardrobe-items',
  storage_path text not null,
  mime_type text not null,
  width integer not null,
  height integer not null,
  file_size bigint not null,
  is_primary boolean not null default false,
  generation_model text,
  parent_image_id uuid references public.wardrobe_item_images (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint wardrobe_item_images_id_item_user_unique unique (id, item_id, user_id),
  constraint wardrobe_item_images_item_fk foreign key (item_id, user_id)
    references public.wardrobe_items (id, user_id) on delete cascade,
  constraint wardrobe_item_images_kind_check check (kind in ('original', 'crop', 'cutout', 'label', 'modeled', 'thumbnail')),
  constraint wardrobe_item_images_bucket_check check (bucket_id in ('wardrobe-originals', 'wardrobe-items', 'wardrobe-labels', 'wardrobe-generated', 'profile-references')),
  constraint wardrobe_item_images_path_not_blank check (btrim(storage_path) <> ''),
  constraint wardrobe_item_images_owner_path_check check (split_part(storage_path, '/', 1) = user_id::text),
  constraint wardrobe_item_images_mime_check check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif')),
  constraint wardrobe_item_images_dimensions_check check (width > 0 and height > 0),
  constraint wardrobe_item_images_file_size_check check (file_size > 0),
  -- The same original outfit photo may be lineage for several detected items.
  constraint wardrobe_item_images_item_storage_unique unique (item_id, bucket_id, storage_path)
);

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'queued',
  original_image_bucket text not null default 'wardrobe-originals',
  original_image_path text not null,
  original_mime_type text,
  original_width integer,
  original_height integer,
  original_file_size bigint,
  progress integer not null default 0,
  candidate_count integer not null default 0,
  error_code text,
  error_message text,
  attempt_count integer not null default 0,
  idempotency_key text,
  request_hash text,
  input_metadata jsonb not null default '{}'::jsonb,
  locked_at timestamptz,
  locked_until timestamptz,
  next_attempt_at timestamptz,
  processing_started_at timestamptz,
  confirmed_at timestamptz,
  completed_at timestamptz,

  legacy_job_id text,
  legacy_payload jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint import_jobs_id_user_unique unique (id, user_id),
  constraint import_jobs_status_check check (status in ('queued', 'analyzing', 'review_crop', 'extracting', 'review_metadata', 'researching', 'complete', 'failed', 'cancelled')),
  constraint import_jobs_bucket_check check (original_image_bucket = 'wardrobe-originals'),
  constraint import_jobs_path_not_blank check (btrim(original_image_path) <> ''),
  constraint import_jobs_owner_path_check check (split_part(original_image_path, '/', 1) = user_id::text),
  constraint import_jobs_progress_check check (progress between 0 and 100),
  constraint import_jobs_candidate_count_check check (candidate_count >= 0),
  constraint import_jobs_attempt_count_check check (attempt_count >= 0),
  constraint import_jobs_dimensions_check check ((original_width is null or original_width > 0) and (original_height is null or original_height > 0)),
  constraint import_jobs_file_size_check check (original_file_size is null or original_file_size > 0),
  constraint import_jobs_input_metadata_check check (jsonb_typeof(input_metadata) = 'object'),
  constraint import_jobs_idempotency_length_check check (idempotency_key is null or char_length(idempotency_key) between 1 and 200)
);

create table if not exists public.import_job_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  job_id uuid not null,
  ordinal smallint not null,
  status text not null default 'detected',
  bounding_box jsonb not null,
  proposed_metadata jsonb not null default '{}'::jsonb,
  confirmed_metadata jsonb not null default '{}'::jsonb,
  field_confidence jsonb not null default '{}'::jsonb,
  user_hint text,
  crop_storage_path text,
  crop_asset_metadata jsonb,
  cutout_storage_path text,
  cutout_asset_metadata jsonb,
  failed_cutout_storage_path text,
  modeled_storage_path text,
  modeled_asset_metadata jsonb,
  crop_approved_at timestamptz,
  metadata_approved_at timestamptz,
  rejected_at timestamptz,
  extraction_attempt_count integer not null default 0,
  modeled_attempt_count integer not null default 0,
  regeneration_prompt text,
  chroma_key text,
  cleanup_tolerance integer not null default 46,
  cleanup_diagnostics jsonb,
  error_code text,
  error_message text,
  wardrobe_item_id uuid references public.wardrobe_items (id) on delete set null,
  legacy_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint import_job_candidates_id_user_unique unique (id, user_id),
  constraint import_job_candidates_job_fk foreign key (job_id, user_id)
    references public.import_jobs (id, user_id) on delete cascade,
  constraint import_job_candidates_job_ordinal_unique unique (job_id, ordinal),
  constraint import_job_candidates_ordinal_check check (ordinal >= 0),
  constraint import_job_candidates_status_check check (status in ('detected', 'review_crop', 'extracting', 'review_cutout', 'review_metadata', 'researching', 'approved', 'rejected', 'failed')),
  constraint import_job_candidates_bounding_box_check check (jsonb_typeof(bounding_box) = 'object'),
  constraint import_job_candidates_proposed_metadata_check check (jsonb_typeof(proposed_metadata) = 'object'),
  constraint import_job_candidates_confirmed_metadata_check check (jsonb_typeof(confirmed_metadata) = 'object'),
  constraint import_job_candidates_field_confidence_check check (jsonb_typeof(field_confidence) = 'object'),
  constraint import_job_candidates_attempts_check check (extraction_attempt_count >= 0 and modeled_attempt_count >= 0),
  constraint import_job_candidates_prompt_length_check check (regeneration_prompt is null or char_length(regeneration_prompt) <= 2000),
  constraint import_job_candidates_chroma_key_check check (chroma_key is null or chroma_key ~* '^#[0-9a-f]{6}$'),
  constraint import_job_candidates_cleanup_tolerance_check check (cleanup_tolerance between 18 and 110),
  constraint import_job_candidates_cleanup_diagnostics_check check (cleanup_diagnostics is null or jsonb_typeof(cleanup_diagnostics) = 'object'),
  constraint import_job_candidates_crop_asset_metadata_check check (crop_asset_metadata is null or jsonb_typeof(crop_asset_metadata) = 'object'),
  constraint import_job_candidates_cutout_asset_metadata_check check (cutout_asset_metadata is null or jsonb_typeof(cutout_asset_metadata) = 'object'),
  constraint import_job_candidates_modeled_asset_metadata_check check (modeled_asset_metadata is null or jsonb_typeof(modeled_asset_metadata) = 'object'),
  constraint import_job_candidates_crop_owner_path_check check (crop_storage_path is null or split_part(crop_storage_path, '/', 1) = user_id::text),
  constraint import_job_candidates_cutout_owner_path_check check (cutout_storage_path is null or split_part(cutout_storage_path, '/', 1) = user_id::text),
  constraint import_job_candidates_failed_cutout_owner_path_check check (failed_cutout_storage_path is null or split_part(failed_cutout_storage_path, '/', 1) = user_id::text),
  constraint import_job_candidates_modeled_owner_path_check check (modeled_storage_path is null or split_part(modeled_storage_path, '/', 1) = user_id::text)
);

create table if not exists public.item_research_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id uuid not null,
  status text not null default 'queued',
  input_clues jsonb not null default '{}'::jsonb,
  confidence numeric(4, 3),
  summary text not null default '',
  proposed_changes jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  model text,
  error_code text,
  error_message text,
  attempt_count integer not null default 0,
  locked_at timestamptz,
  locked_until timestamptz,
  next_attempt_at timestamptz,
  processing_started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_fields text[] not null default '{}',
  accepted_at timestamptz,
  rejected_at timestamptz,
  constraint item_research_runs_id_user_unique unique (id, user_id),
  constraint item_research_runs_item_fk foreign key (item_id, user_id)
    references public.wardrobe_items (id, user_id) on delete cascade,
  constraint item_research_runs_status_check check (status in ('queued', 'running', 'verified', 'likely', 'uncertain', 'not_found', 'failed', 'accepted', 'rejected')),
  constraint item_research_runs_input_clues_check check (jsonb_typeof(input_clues) = 'object'),
  constraint item_research_runs_confidence_check check (confidence is null or confidence between 0 and 1),
  constraint item_research_runs_proposed_changes_check check (jsonb_typeof(proposed_changes) = 'object'),
  constraint item_research_runs_evidence_check check (jsonb_typeof(evidence) in ('object', 'array')),
  constraint item_research_runs_decision_check check (accepted_at is null or rejected_at is null),
  constraint item_research_runs_attempt_count_check check (attempt_count >= 0)
);

create table if not exists public.research_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  research_run_id uuid not null,
  title text not null,
  url text not null,
  domain text not null,
  source_type text not null,
  supports_fields text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint research_sources_run_fk foreign key (research_run_id, user_id)
    references public.item_research_runs (id, user_id) on delete cascade,
  constraint research_sources_title_not_blank check (btrim(title) <> ''),
  constraint research_sources_url_check check (url ~* '^https?://'),
  constraint research_sources_domain_not_blank check (btrim(domain) <> ''),
  constraint research_sources_type_check check (source_type in ('official_brand', 'retailer', 'marketplace', 'other')),
  constraint research_sources_run_url_unique unique (research_run_id, url)
);

-- Turn RLS on in the same migration that creates each private table. Policies
-- and client grants arrive in migration 003; until then access is deny-by-default.
alter table public.profiles enable row level security;
alter table public.style_profiles enable row level security;
alter table public.wardrobe_items enable row level security;
alter table public.wardrobe_item_images enable row level security;
alter table public.import_jobs enable row level security;
alter table public.import_job_candidates enable row level security;
alter table public.item_research_runs enable row level security;
alter table public.research_sources enable row level security;

create unique index if not exists wardrobe_items_user_legacy_id_unique
  on public.wardrobe_items (user_id, legacy_id)
  where legacy_id is not null;

create unique index if not exists wardrobe_item_images_one_primary_per_item
  on public.wardrobe_item_images (item_id)
  where is_primary;

create unique index if not exists import_jobs_user_idempotency_unique
  on public.import_jobs (user_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists wardrobe_items_user_active_created_idx
  on public.wardrobe_items (user_id, created_at desc)
  where deleted_at is null;
create index if not exists wardrobe_items_user_category_idx
  on public.wardrobe_items (user_id, category)
  where deleted_at is null;
create index if not exists wardrobe_items_user_availability_idx
  on public.wardrobe_items (user_id, availability_status)
  where deleted_at is null;
create index if not exists wardrobe_items_user_last_worn_idx
  on public.wardrobe_items (user_id, last_worn_at nulls first)
  where deleted_at is null;
create index if not exists wardrobe_items_user_wear_count_idx
  on public.wardrobe_items (user_id, wear_count, created_at)
  where deleted_at is null;
create index if not exists wardrobe_items_user_name_lower_idx
  on public.wardrobe_items (user_id, lower(name))
  where deleted_at is null;
create index if not exists wardrobe_items_color_names_gin on public.wardrobe_items using gin (color_names);
create index if not exists wardrobe_items_season_tags_gin on public.wardrobe_items using gin (season_tags);
create index if not exists wardrobe_items_occasion_tags_gin on public.wardrobe_items using gin (occasion_tags);
create index if not exists wardrobe_items_weather_tags_gin on public.wardrobe_items using gin (weather_tags);
create index if not exists wardrobe_item_images_user_item_idx on public.wardrobe_item_images (user_id, item_id, created_at);
create index if not exists import_jobs_user_status_created_idx on public.import_jobs (user_id, status, created_at desc);
create index if not exists import_jobs_worker_queue_idx
  on public.import_jobs (next_attempt_at, created_at)
  where status in ('queued', 'analyzing', 'extracting', 'researching', 'failed');
create index if not exists import_job_candidates_user_job_idx on public.import_job_candidates (user_id, job_id, ordinal);
create index if not exists import_job_candidates_status_idx on public.import_job_candidates (job_id, status);
create index if not exists item_research_runs_user_item_created_idx on public.item_research_runs (user_id, item_id, created_at desc);
create index if not exists item_research_runs_worker_queue_idx
  on public.item_research_runs (next_attempt_at, created_at)
  where status in ('queued', 'running', 'failed');
create index if not exists research_sources_user_run_idx on public.research_sources (user_id, research_run_id);

create or replace function public.validate_profile_timezone()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from pg_catalog.pg_timezone_names timezone_name
    where timezone_name.name = new.timezone
  ) then
    raise exception 'unknown IANA timezone: %', new.timezone using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_profile_timezone on public.profiles;
create trigger validate_profile_timezone
before insert or update of timezone on public.profiles
for each row execute function public.validate_profile_timezone();

revoke all on function public.validate_profile_timezone() from public;

create or replace function public.validate_wardrobe_image_parent()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.parent_image_id is not null and not exists (
    select 1
    from public.wardrobe_item_images parent
    where parent.id = new.parent_image_id
      and parent.user_id = new.user_id
      and parent.item_id = new.item_id
  ) then
    raise exception 'parent image must belong to the same user and wardrobe item'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_wardrobe_image_parent on public.wardrobe_item_images;
create trigger validate_wardrobe_image_parent
before insert or update of parent_image_id, item_id, user_id
on public.wardrobe_item_images
for each row execute function public.validate_wardrobe_image_parent();

revoke all on function public.validate_wardrobe_image_parent() from public;

create or replace function public.validate_import_candidate_item()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.wardrobe_item_id is not null and not exists (
    select 1
    from public.wardrobe_items item
    where item.id = new.wardrobe_item_id
      and item.user_id = new.user_id
  ) then
    raise exception 'saved wardrobe item must belong to the import owner'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_import_candidate_item on public.import_job_candidates;
create trigger validate_import_candidate_item
before insert or update of wardrobe_item_id, user_id
on public.import_job_candidates
for each row execute function public.validate_import_candidate_item();

revoke all on function public.validate_import_candidate_item() from public;

create or replace function public.protect_wear_counters()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is not null
    and (new.wear_count, new.last_worn_at) is distinct from (old.wear_count, old.last_worn_at)
    and coalesce(current_setting('wardrobe.allow_wear_counter_update', true), 'off') <> 'on'
  then
    raise exception 'wear counters must be changed through a mark-worn operation'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_wear_counters on public.wardrobe_items;
create trigger protect_wear_counters
before update of wear_count, last_worn_at
on public.wardrobe_items
for each row execute function public.protect_wear_counters();

revoke all on function public.protect_wear_counters() from public;

create or replace function public.track_user_confirmed_wardrobe_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  tracked_fields constant text[] := array[
    'name', 'brand', 'product_name', 'model_number', 'barcode', 'category', 'subcategory',
    'layer_role', 'primary_color_hex', 'secondary_color_hex', 'color_names', 'pattern',
    'fit', 'silhouette', 'materials', 'visible_text', 'size_label', 'season_tags',
    'occasion_tags', 'weather_tags', 'warmth_level', 'formality_level',
    'water_resistance', 'care_instructions', 'condition', 'notes', 'purchase_price',
    'currency', 'purchase_date', 'retailer'
  ];
  confirmed_now text[];
begin
  if auth.uid() is null or auth.uid() <> new.user_id
    or coalesce(current_setting('wardrobe.allow_ai_metadata_update', true), 'off') = 'on'
  then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.source not in ('manual', 'photo') then
      return new;
    end if;
    select coalesce(array_agg(field_name order by field_name), '{}'::text[])
      into confirmed_now
    from unnest(tracked_fields) field_list(field_name)
    where to_jsonb(new) -> field_name is not null
      and to_jsonb(new) -> field_name <> 'null'::jsonb
      and to_jsonb(new) -> field_name not in ('""'::jsonb, '[]'::jsonb, '{}'::jsonb);
  else
    select coalesce(array_agg(field_name order by field_name), '{}'::text[])
      into confirmed_now
    from unnest(tracked_fields) field_list(field_name)
    where to_jsonb(new) -> field_name is distinct from to_jsonb(old) -> field_name;
  end if;

  if cardinality(confirmed_now) > 0 then
    select coalesce(array_agg(distinct field_name order by field_name), '{}'::text[])
      into new.user_confirmed_fields
    from unnest(coalesce(new.user_confirmed_fields, '{}'::text[]) || confirmed_now)
      all_fields(field_name)
    where field_name is not null and btrim(field_name) <> '';
    new.user_confirmed_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists track_user_confirmed_wardrobe_fields on public.wardrobe_items;
create trigger track_user_confirmed_wardrobe_fields
before insert or update on public.wardrobe_items
for each row execute function public.track_user_confirmed_wardrobe_fields();

revoke all on function public.track_user_confirmed_wardrobe_fields() from public;

create or replace function public.manage_import_job_lease()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status in ('review_crop', 'review_metadata', 'complete', 'failed', 'cancelled') then
    new.locked_at := null;
    new.locked_until := null;
  end if;
  if new.status in ('complete', 'cancelled') then
    new.completed_at := coalesce(new.completed_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists manage_import_job_lease on public.import_jobs;
create trigger manage_import_job_lease
before insert or update of status on public.import_jobs
for each row execute function public.manage_import_job_lease();

create or replace function public.manage_research_run_lease()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status in ('verified', 'likely', 'uncertain', 'not_found', 'failed', 'accepted', 'rejected') then
    new.locked_at := null;
    new.locked_until := null;
    new.completed_at := coalesce(new.completed_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists manage_research_run_lease on public.item_research_runs;
create trigger manage_research_run_lease
before insert or update of status on public.item_research_runs
for each row execute function public.manage_research_run_lease();

revoke all on function public.manage_import_job_lease() from public;
revoke all on function public.manage_research_run_lease() from public;

create or replace function public.sync_import_job_candidate_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    update public.import_jobs job
    set candidate_count = (
      select count(*)::integer
      from public.import_job_candidates candidate
      where candidate.job_id = old.job_id
    )
    where job.id = old.job_id;
    return old;
  elsif tg_op = 'INSERT' then
    update public.import_jobs job
    set candidate_count = (
      select count(*)::integer
      from public.import_job_candidates candidate
      where candidate.job_id = new.job_id
    )
    where job.id = new.job_id;
    return new;
  end if;

  update public.import_jobs job
  set candidate_count = (
    select count(*)::integer
    from public.import_job_candidates candidate
    where candidate.job_id = old.job_id
  )
  where job.id = old.job_id;

  if new.job_id is distinct from old.job_id then
    update public.import_jobs job
    set candidate_count = (
      select count(*)::integer
      from public.import_job_candidates candidate
      where candidate.job_id = new.job_id
    )
    where job.id = new.job_id;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_import_job_candidate_count on public.import_job_candidates;
create trigger sync_import_job_candidate_count
after insert or delete
on public.import_job_candidates
for each row execute function public.sync_import_job_candidate_count();

drop trigger if exists sync_import_job_candidate_count_on_move on public.import_job_candidates;
create trigger sync_import_job_candidate_count_on_move
after update of job_id
on public.import_job_candidates
for each row execute function public.sync_import_job_candidate_count();

revoke all on function public.sync_import_job_candidate_count() from public;

do $$
declare
  table_name text;
  trigger_name text;
begin
  foreach table_name in array array[
    'profiles',
    'style_profiles',
    'wardrobe_items',
    'import_jobs',
    'import_job_candidates',
    'item_research_runs'
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

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  inferred_first_name text;
  inferred_display_name text;
begin
  inferred_first_name := nullif(btrim(coalesce(
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'given_name',
    ''
  )), '');
  inferred_display_name := nullif(btrim(coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'full_name',
    inferred_first_name,
    ''
  )), '');

  insert into public.profiles (id, first_name, display_name)
  values (new.id, inferred_first_name, inferred_display_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public;

drop trigger if exists on_auth_user_created_wardrobe on auth.users;
create trigger on_auth_user_created_wardrobe
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Make the migration safe for projects that already contain auth users.
insert into public.profiles (id, first_name, display_name)
select
  user_row.id,
  nullif(btrim(coalesce(user_row.raw_user_meta_data ->> 'first_name', user_row.raw_user_meta_data ->> 'given_name', '')), ''),
  nullif(btrim(coalesce(user_row.raw_user_meta_data ->> 'display_name', user_row.raw_user_meta_data ->> 'full_name', '')), '')
from auth.users user_row
on conflict (id) do nothing;

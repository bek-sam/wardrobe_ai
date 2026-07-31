-- Wardrobe AI: Outfit Studio -- identity references and outfit visualizations.
--
-- Additive only. No existing table, column, function, or policy is dropped or
-- narrowed; the legacy outfit_candidates preview columns and
-- outfit_preview_jobs queue keep working untouched, and a later, separately
-- approved migration can deprecate them once this pipeline is proven.
--
-- The core design decision this migration encodes: a visualization belongs to
-- an *immutable ordered outfit snapshot*, not to an outfit_candidates row. A
-- candidate, a saved outfit, a plan, and a throwaway studio composition all
-- normalize into the same snapshot, so one pipeline serves every source and
-- the source can change later without rewriting what was rendered.
--
-- Adds:
--   1. profile_identity_references -- versioned, validated, one-active-per-user
--      identity photos with explicit consent metadata.
--   2. outfit_visualizations -- one row per (snapshot, configuration) attempt.
--   3. outfit_visualization_items -- the immutable ordered snapshot + hotspots.
--   4. outfit_visualization_jobs -- durable claim/lease queue for the worker.
--   5. outfit_visualization_feedback -- bounded structured feedback.
--   6. RPCs: request/claim/advance/finalize/fail/regenerate/feedback.
--   7. Staleness triggers, account export coverage, retention pruning.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. profile_identity_references
-- ---------------------------------------------------------------------------

create table if not exists public.profile_identity_references (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  bucket_id text not null,
  storage_path text not null,
  sha256 text not null,
  normalized_mime text not null,
  width integer not null,
  height integer not null,
  validation_status text not null default 'pending',
  validation_summary jsonb not null default '{}'::jsonb,
  is_active boolean not null default false,
  consent_version text,
  consented_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- Lets outfit_visualizations carry a composite ownership foreign key.
  constraint profile_identity_references_id_user_unique unique (id, user_id),
  constraint profile_identity_references_bucket_check
    check (bucket_id = 'profile-references'),
  -- The path is server-constructed, but the constraint means even a
  -- service-role bug cannot file one user's photo under another's prefix.
  constraint profile_identity_references_owner_path_check
    check (split_part(storage_path, '/', 1) = user_id::text),
  constraint profile_identity_references_validation_status_check
    check (validation_status in ('pending', 'pass', 'warn', 'fail')),
  constraint profile_identity_references_sha256_check
    check (sha256 ~ '^[0-9a-f]{64}$'),
  constraint profile_identity_references_mime_check
    check (normalized_mime = 'image/png'),
  constraint profile_identity_references_dimensions_check
    check (width between 64 and 12000 and height between 64 and 12000),
  -- Activation requires a passing/warning validation *and* recorded consent,
  -- so an unreviewed or failed photo can never become the active reference.
  constraint profile_identity_references_active_requires_consent_check check (
    is_active = false
    or (
      validation_status in ('pass', 'warn')
      and consent_version is not null
      and consented_at is not null
      and deleted_at is null
    )
  )
);

-- One active, non-deleted reference per user, enforced by the database rather
-- than by application discipline.
create unique index if not exists profile_identity_references_one_active_idx
  on public.profile_identity_references (user_id)
  where is_active and deleted_at is null;
create index if not exists profile_identity_references_user_idx
  on public.profile_identity_references (user_id, created_at desc);

alter table public.profile_identity_references enable row level security;

drop policy if exists user_select on public.profile_identity_references;
create policy user_select on public.profile_identity_references
for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.profile_identity_references from anon, authenticated;
grant select on table public.profile_identity_references to authenticated;
grant select, insert, update, delete on table public.profile_identity_references to service_role;

drop trigger if exists set_profile_identity_references_updated_at
  on public.profile_identity_references;
create trigger set_profile_identity_references_updated_at
before update on public.profile_identity_references
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. outfit_visualizations
-- ---------------------------------------------------------------------------

create table if not exists public.outfit_visualizations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  source_kind text not null,
  -- Deliberately not a foreign key: a visualization must survive its source
  -- being deleted, because the snapshot in outfit_visualization_items is the
  -- real subject and the user may still be looking at the image. Ownership is
  -- still enforced -- the creating RPC resolves the source under the caller's
  -- own id before writing this column.
  source_id uuid,
  source_hash text not null,
  status text not null default 'queued',
  identity_reference_id uuid not null,
  prompt_version text not null,
  provider text not null,
  model_key text not null,
  capability_version text not null,
  output_size text not null,
  output_quality text not null,
  qa_version text not null,
  localization_version text not null,
  bucket_id text,
  storage_path text,
  output_sha256 text,
  qa_status text,
  qa_summary jsonb,
  error_code text,
  error_summary text,
  attempt_count integer not null default 0,
  corrective_attempt_count integer not null default 0,
  request_id text,
  stale_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  stale_at timestamptz,
  deleted_at timestamptz,
  -- Lets the snapshot/job/feedback children carry composite ownership keys.
  constraint outfit_visualizations_id_user_unique unique (id, user_id),
  constraint outfit_visualizations_identity_fk
    foreign key (identity_reference_id, user_id)
    references public.profile_identity_references (id, user_id) on delete cascade,
  constraint outfit_visualizations_source_kind_check
    check (source_kind in ('candidate', 'outfit', 'plan', 'composition')),
  constraint outfit_visualizations_status_check check (
    status in (
      'queued', 'validating_inputs', 'generating', 'qa_review', 'localizing',
      'ready', 'stale', 'failed_retryable', 'failed_terminal', 'blocked', 'superseded'
    )
  ),
  constraint outfit_visualizations_qa_status_check
    check (qa_status is null or qa_status in ('pass', 'correctable', 'fail')),
  constraint outfit_visualizations_bucket_check
    check (bucket_id is null or bucket_id = 'wardrobe-generated'),
  constraint outfit_visualizations_owner_path_check check (
    storage_path is null or split_part(storage_path, '/', 1) = user_id::text
  ),
  -- A ready visualization must actually have bytes behind it.
  constraint outfit_visualizations_ready_has_asset_check check (
    status not in ('ready', 'stale')
    or (bucket_id is not null and storage_path is not null and output_sha256 is not null)
  ),
  constraint outfit_visualizations_source_hash_not_blank
    check (btrim(source_hash) <> ''),
  constraint outfit_visualizations_attempt_counts_check
    check (attempt_count >= 0 and corrective_attempt_count between 0 and 1)
);

-- At most one live visualization per (user, source hash): this is what makes
-- concurrent identical "Try it on" clicks collapse into a single paid job.
create unique index if not exists outfit_visualizations_active_hash_idx
  on public.outfit_visualizations (user_id, source_hash)
  where deleted_at is null
    and status in ('queued', 'validating_inputs', 'generating', 'qa_review', 'localizing', 'ready');
create index if not exists outfit_visualizations_user_idx
  on public.outfit_visualizations (user_id, created_at desc)
  where deleted_at is null;
create index if not exists outfit_visualizations_source_idx
  on public.outfit_visualizations (user_id, source_kind, source_id)
  where deleted_at is null;

alter table public.outfit_visualizations enable row level security;

drop policy if exists user_select on public.outfit_visualizations;
create policy user_select on public.outfit_visualizations
for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.outfit_visualizations from anon, authenticated;
grant select on table public.outfit_visualizations to authenticated;
grant select, insert, update, delete on table public.outfit_visualizations to service_role;

drop trigger if exists set_outfit_visualizations_updated_at on public.outfit_visualizations;
create trigger set_outfit_visualizations_updated_at
before update on public.outfit_visualizations
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. outfit_visualization_items -- the immutable snapshot
-- ---------------------------------------------------------------------------

create table if not exists public.outfit_visualization_items (
  visualization_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id uuid not null,
  role text not null,
  sort_order integer not null,
  cutout_bucket_id text not null,
  cutout_storage_path text not null,
  cutout_sha256 text not null,
  hotspot jsonb,
  created_at timestamptz not null default now(),
  primary key (visualization_id, item_id),
  constraint outfit_visualization_items_visualization_fk
    foreign key (visualization_id, user_id)
    references public.outfit_visualizations (id, user_id) on delete cascade,
  -- Composite ownership FK: a service-role bug cannot attach one user's
  -- wardrobe item to another user's visualization.
  constraint outfit_visualization_items_item_fk
    foreign key (item_id, user_id)
    references public.wardrobe_items (id, user_id) on delete cascade,
  constraint outfit_visualization_items_role_check
    check (role in ('top', 'bottom', 'dress', 'layer', 'shoes', 'accessory')),
  constraint outfit_visualization_items_sort_order_check
    check (sort_order between 0 and 7),
  constraint outfit_visualization_items_cutout_sha_check
    check (cutout_sha256 ~ '^[0-9a-f]{64}$'),
  constraint outfit_visualization_items_owner_path_check
    check (split_part(cutout_storage_path, '/', 1) = user_id::text)
);

-- One garment per role per snapshot; the foundation rule is enforced above
-- this, in the deterministic outfit validator.
create unique index if not exists outfit_visualization_items_role_unique
  on public.outfit_visualization_items (visualization_id, role);
create index if not exists outfit_visualization_items_item_idx
  on public.outfit_visualization_items (user_id, item_id);

alter table public.outfit_visualization_items enable row level security;

drop policy if exists user_select on public.outfit_visualization_items;
create policy user_select on public.outfit_visualization_items
for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.outfit_visualization_items from anon, authenticated;
grant select on table public.outfit_visualization_items to authenticated;
grant select, insert, update, delete on table public.outfit_visualization_items to service_role;

-- ---------------------------------------------------------------------------
-- 4. outfit_visualization_jobs
-- ---------------------------------------------------------------------------

create table if not exists public.outfit_visualization_jobs (
  id uuid primary key default gen_random_uuid(),
  visualization_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'queued',
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  next_attempt_at timestamptz,
  locked_at timestamptz,
  locked_until timestamptz,
  locked_by text,
  last_error_code text,
  last_error_summary text,
  request_id text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outfit_visualization_jobs_visualization_fk
    foreign key (visualization_id, user_id)
    references public.outfit_visualizations (id, user_id) on delete cascade,
  constraint outfit_visualization_jobs_status_check
    check (status in ('queued', 'running', 'complete', 'failed', 'superseded')),
  constraint outfit_visualization_jobs_attempts_check
    check (attempt_count >= 0 and max_attempts between 1 and 10)
);

create unique index if not exists outfit_visualization_jobs_active_unique
  on public.outfit_visualization_jobs (visualization_id)
  where status in ('queued', 'running');
create index if not exists outfit_visualization_jobs_worker_idx
  on public.outfit_visualization_jobs (status, next_attempt_at, created_at)
  where status in ('queued', 'running', 'failed');
create index if not exists outfit_visualization_jobs_user_idx
  on public.outfit_visualization_jobs (user_id, status, created_at desc);

alter table public.outfit_visualization_jobs enable row level security;

drop policy if exists user_select on public.outfit_visualization_jobs;
create policy user_select on public.outfit_visualization_jobs
for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.outfit_visualization_jobs from anon, authenticated;
grant select on table public.outfit_visualization_jobs to authenticated;
grant select, insert, update, delete on table public.outfit_visualization_jobs to service_role;

drop trigger if exists set_outfit_visualization_jobs_updated_at
  on public.outfit_visualization_jobs;
create trigger set_outfit_visualization_jobs_updated_at
before update on public.outfit_visualization_jobs
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. outfit_visualization_feedback
-- ---------------------------------------------------------------------------

create table if not exists public.outfit_visualization_feedback (
  id uuid primary key default gen_random_uuid(),
  visualization_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null,
  comment text,
  created_at timestamptz not null default now(),
  constraint outfit_visualization_feedback_visualization_fk
    foreign key (visualization_id, user_id)
    references public.outfit_visualizations (id, user_id) on delete cascade,
  constraint outfit_visualization_feedback_reason_check check (
    reason in (
      'looks_like_me', 'does_not_look_like_me', 'wrong_garment',
      'missing_garment', 'bad_anatomy', 'styling_not_for_me', 'other'
    )
  ),
  constraint outfit_visualization_feedback_comment_check
    check (comment is null or char_length(comment) between 1 and 600)
);

create unique index if not exists outfit_visualization_feedback_unique
  on public.outfit_visualization_feedback (visualization_id, user_id, reason);
create index if not exists outfit_visualization_feedback_user_idx
  on public.outfit_visualization_feedback (user_id, created_at desc);

alter table public.outfit_visualization_feedback enable row level security;

drop policy if exists user_select on public.outfit_visualization_feedback;
create policy user_select on public.outfit_visualization_feedback
for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.outfit_visualization_feedback from anon, authenticated;
grant select on table public.outfit_visualization_feedback to authenticated;
grant select, insert, update, delete on table public.outfit_visualization_feedback to service_role;

-- ---------------------------------------------------------------------------
-- 6. wardrobe_item_images.content_sha256 -- real content hashing for freshness
-- ---------------------------------------------------------------------------

-- Freshness must not rest on timestamps alone: a cutout re-uploaded
-- byte-for-byte identically should not force a second paid generation, and a
-- cutout whose bytes changed without its row being touched must. Nullable and
-- populated lazily by the snapshot resolver the first time an image is used
-- for a visualization, so no backfill job and no rewrite of the import
-- pipeline is required.
alter table public.wardrobe_item_images
  add column if not exists content_sha256 text;
alter table public.wardrobe_item_images
  drop constraint if exists wardrobe_item_images_content_sha256_check;
alter table public.wardrobe_item_images
  add constraint wardrobe_item_images_content_sha256_check
  check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$');

-- ---------------------------------------------------------------------------
-- 7. Server-owned budgets
-- ---------------------------------------------------------------------------

-- These belong in feature_limits, not in an RPC argument. request_outfit_
-- visualization() is callable by `authenticated`, so any limit it accepted as
-- a parameter would be a limit the client could raise. Every other paid path
-- in this schema reads its ceiling from here; the try-on paths now do too.
insert into public.feature_limits (feature, daily_limit)
values
  ('outfit_visualization_generation', 10),
  ('identity_reference_assessment', 10)
on conflict (feature) do nothing;

-- ---------------------------------------------------------------------------
-- 8. MFA assurance -- every new user-owned table joins the restrictive policy
-- ---------------------------------------------------------------------------

do $$
declare
  target text;
  new_tables constant text[] := array[
    'profile_identity_references',
    'outfit_visualizations',
    'outfit_visualization_items',
    'outfit_visualization_jobs',
    'outfit_visualization_feedback'
  ];
begin
  foreach target in array new_tables loop
    if to_regclass('public.' || quote_ident(target)) is null then
      raise exception 'mfa policy target missing: %', target;
    end if;
    execute format('drop policy if exists require_mfa_assurance on public.%I', target);
    execute format(
      'create policy require_mfa_assurance on public.%I as restrictive for all '
      || 'to authenticated using (public.mfa_requirement_satisfied()) '
      || 'with check (public.mfa_requirement_satisfied())',
      target
    );
  end loop;
end;
$$;

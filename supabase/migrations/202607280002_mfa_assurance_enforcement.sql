-- Wardrobe AI: enforce MFA in the database, not only in the interface.
--
-- Redirecting an under-assured session to /mfa/verify protects the UI and
-- nothing else. An access token issued after the first factor is a perfectly
-- valid `authenticated` credential, so anyone holding one could talk straight
-- to PostgREST or the Storage API and read a wardrobe, its images, sizes,
-- location, and wear history -- with the second factor never involved. That
-- is the gap this migration closes.
--
-- Mechanism: one security-definer predicate plus a RESTRICTIVE policy on every
-- user-owned table and on the private buckets. Restrictive policies are ANDed
-- with the existing permissive owner policies, so ownership rules are
-- untouched and this can only ever subtract access, never add it.
--
-- Users with no verified factor are unaffected and keep working at aal1.

set search_path = public, extensions;

-- Reads auth.mfa_factors, which `authenticated` cannot select from directly --
-- hence security definer. It discloses nothing: the answer is a boolean about
-- the caller's own session, and it is not parameterised, so it cannot be
-- turned into a probe for another account's factors.
create or replace function public.mfa_requirement_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      -- Not an end user (service_role, or an unauthenticated request). The
      -- table's own policies already decide those cases; this predicate must
      -- not be the thing that blocks a background worker.
      when (select auth.uid()) is null then true
      -- No verified factor: nothing to step up to, so aal1 is the ceiling and
      -- demanding aal2 would lock the account out of its own data.
      when not exists (
        select 1
        from auth.mfa_factors factor
        where factor.user_id = (select auth.uid())
          and factor.status::text = 'verified'
      ) then true
      -- Verified factor exists: the session must actually have satisfied it.
      else coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
    end;
$$;

-- Executable only by the role whose policies reference it. Policy expressions
-- run as the invoking role, so `authenticated` genuinely needs EXECUTE; `anon`
-- and PUBLIC do not, and are revoked.
revoke all on function public.mfa_requirement_satisfied() from public, anon;
grant execute on function public.mfa_requirement_satisfied() to authenticated;

-- Explicit, reviewed list. Deliberately not driven by a catalogue query: a
-- future table must be added here consciously, and no extension or
-- third-party schema object can be swept up by accident.
--
-- Omitted on purpose:
--   feature_limits          server-owned budgets, no user_id, read-only
--   auth_action_challenges  no authenticated access at all
--   auth_rate_limits        no authenticated access at all
do $$
declare
  target text;
  user_owned_tables constant text[] := array[
    'profiles',
    'style_profiles',
    'wardrobe_items',
    'wardrobe_item_images',
    'wardrobe_change_events',
    'wardrobe_compilation_jobs',
    'wardrobe_compilation_state',
    'import_jobs',
    'import_job_candidates',
    'item_research_runs',
    'research_sources',
    'outfits',
    'outfit_items',
    'outfit_plans',
    'outfit_feedback',
    'outfit_candidates',
    'outfit_candidate_items',
    'outfit_analysis_cache',
    'outfit_preview_jobs',
    'wear_logs',
    'wear_log_items',
    'conversations',
    'messages',
    'agent_runs',
    'generated_outfit_saves',
    'generated_plan_saves',
    'feature_usage_counters',
    'rate_limit_events',
    'api_idempotency_keys',
    'storage_deletion_queue',
    'account_deletion_requests',
    'legal_acceptances',
    'auth_events'
  ];
begin
  foreach target in array user_owned_tables loop
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

-- Private Storage. Scoped by bucket so the restriction cannot spill onto any
-- other bucket: for rows outside our five buckets the predicate short-circuits
-- to true and the existing policies decide alone.
drop policy if exists wardrobe_require_mfa_assurance on storage.objects;
create policy wardrobe_require_mfa_assurance on storage.objects
as restrictive
for all
to authenticated
using (
  bucket_id not in (
    'wardrobe-originals', 'wardrobe-items', 'wardrobe-labels',
    'wardrobe-generated', 'profile-references'
  )
  or public.mfa_requirement_satisfied()
)
with check (
  bucket_id not in (
    'wardrobe-originals', 'wardrobe-items', 'wardrobe-labels',
    'wardrobe-generated', 'profile-references'
  )
  or public.mfa_requirement_satisfied()
);

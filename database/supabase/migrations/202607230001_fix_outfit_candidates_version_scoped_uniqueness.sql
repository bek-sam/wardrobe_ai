-- Fixes a real version-isolation bug in the compiled-wardrobe pipeline.
--
-- outfit_candidates_user_combination_unique (migration 006) is unique on
-- (user_id, combination_key) alone. writeCandidates() in
-- src/jobs/compile-wardrobe.ts upserts every generated candidate with
-- onConflict "user_id,combination_key" against a brand-new
-- compiled_wardrobe_version -- so a combination that already exists under the
-- *previous* published version doesn't get a new row for the new version, it
-- gets its existing row's compiled_wardrobe_version overwritten in place. That
-- silently violates the "insert alongside the prior version, then atomically
-- flip" contract finalize_wardrobe_compilation() (migration 008) documents
-- and relies on:
--
--   - The candidate is moved out of the still-published old version before
--     finalize() can atomically flip anything, so a crash between the upsert
--     and finalize() can leave the old version short a row it used to serve.
--   - discardUnpublishedVersion()'s cleanup on a failed attempt deletes rows
--     that were really moved out of the previously published version, not
--     rows that belong only to the failed attempt.
--   - The upsert never sets status back to 'active'. If a row was archived
--     (e.g. the outfit temporarily disappeared from a prior compile) and its
--     combination reappears, the move-in-place upsert leaves it archived.
--     finalize_wardrobe_compilation() still counts it in p_candidate_count
--     (it matches the new compiled_wardrobe_version), but retrieval requires
--     status = 'active' and never serves it.
--
-- Fix: scope the uniqueness to (user_id, compiled_wardrobe_version,
-- combination_key) so writing the new version's candidates always inserts
-- genuinely new rows, never mutates a row that belongs to another version.
-- src/jobs/compile-wardrobe.ts is updated in the same change to match this
-- constraint and to explicitly copy forward curator_*/preview_*/style_tags/
-- times_suggested/last_suggested_at from the prior published version for
-- combinations the run didn't touch, since an upsert can no longer do that
-- "for free" by reusing the old row.

set search_path = public, extensions;

alter table public.outfit_candidates
  drop constraint if exists outfit_candidates_user_combination_unique;
alter table public.outfit_candidates
  add constraint outfit_candidates_user_version_combination_unique
  unique (user_id, compiled_wardrobe_version, combination_key);

-- Preserves efficient lookup for the still-legitimate "current active
-- candidate for this combination" query pattern (e.g.
-- generate-outfit-previews.ts's matchOutfitToCandidateAndEnqueue), which
-- relies on status = 'active' -- not this index -- to guarantee at most one
-- row per (user_id, combination_key) at any given time.
create index if not exists outfit_candidates_user_combination_idx
  on public.outfit_candidates (user_id, combination_key);

-- record_fallback_outfit_candidate() upserts against the same constraint;
-- update its ON CONFLICT target to match.
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
  on conflict (user_id, compiled_wardrobe_version, combination_key) do nothing
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

revoke all on function public.record_fallback_outfit_candidate(uuid, text, text, text[], jsonb) from public, anon, authenticated;
grant execute on function public.record_fallback_outfit_candidate(uuid, text, text, text[], jsonb) to service_role;

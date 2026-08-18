-- ---------------------------------------------------------------------------
-- Fix: record_fallback_outfit_candidate() raised 42883 on every call
-- ---------------------------------------------------------------------------
--
-- The item insert read `from jsonb_array_elements(p_items) with ordinality as
-- entry`. Adding WITH ORDINALITY gives that alias *two* columns, so the bare
-- name `entry` no longer resolves to the jsonb value -- it resolves to the
-- whole row. `entry ->> 'item_id'` therefore asked for `record ->> unknown`
-- and the function failed with
-- `operator does not exist: record ->> unknown`.
--
-- The candidate row is inserted before that statement, so the failure rolled
-- the entire function back: no candidate, no items, nothing recorded. The
-- caller in src/lib/ai/agents/retrieve-outfit-candidate/record-fallback.ts
-- deliberately ignores errors so that library growth can never break a user's
-- outfit response, which is why this stayed silent -- fallback candidates have
-- simply never been persisted since the function was introduced in
-- 202607210008_wardrobe_compilation_v2.sql, and both later rewrites
-- (202607230001, 202607240003) carried the same FROM clause forward.
--
-- The fix is the explicitly-named alias already used by the other two
-- ordinality call sites in 202607210002_outfits_agents_operations.sql
-- (`parsed(element, ordinality)`), which names the value column so it cannot
-- be confused with the row. Nothing else changes: the ownership check, the
-- occasion_categories write from 202607240003, the conflict handling, and the
-- privileges are all preserved exactly.

set search_path = public, extensions;

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
    occasion_tags, occasion_category, occasion_categories, total_score
  )
  select
    p_user_id, p_combination_key, state.compiled_wardrobe_version, 'active', 'fallback_llm',
    coalesce(p_occasion_tags, '{}'), p_occasion_category,
    case when p_occasion_category is null then '{}' else array[p_occasion_category] end,
    0.6
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
    (parsed.element ->> 'item_id')::uuid,
    p_user_id,
    parsed.element ->> 'role',
    coalesce((parsed.element ->> 'sort_order')::integer, (parsed.ordinality - 1)::integer)
  from jsonb_array_elements(p_items) with ordinality parsed(element, ordinality);

  return new_candidate_id;
end;
$$;

revoke all on function public.record_fallback_outfit_candidate(uuid, text, text, text[], jsonb)
  from public, anon, authenticated;
grant execute on function public.record_fallback_outfit_candidate(uuid, text, text, text[], jsonb)
  to service_role;

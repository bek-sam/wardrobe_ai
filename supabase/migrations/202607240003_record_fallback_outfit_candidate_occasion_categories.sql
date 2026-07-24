-- record_fallback_outfit_candidate() was never updated when
-- occasion_categories (202607240001) was added: it only ever wrote the
-- single-valued occasion_category, leaving occasion_categories at its '{}'
-- default forever. fetch-candidate-pool.ts's retrieval filter queries
-- occasion_categories via .contains(...), so every fallback-recorded
-- outfit was permanently unretrievable by occasion. A fallback candidate is
-- recorded for exactly one occasion request at a time, so the correct
-- occasion_categories value is a single-element array of the same category
-- (or '{}' when no category was supplied), matching how the
-- normally-compiled path (upsert-candidate-rows.ts) treats it as a real
-- array field.

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

-- Fixes a second instance of the same bug patched in 202607220002, this time
-- in the pre-existing (migration 006) mark_wardrobe_compilation_dirty(): its
-- AFTER DELETE trigger on wardrobe_items fires while a user's account is
-- being deleted (profiles row cascades to wardrobe_items), and unconditionally
-- upserts into wardrobe_compilation_state, whose user_id references
-- profiles(id). By the time the cascade reaches wardrobe_items, the profiles
-- row is already gone in the same statement, so the insert violates the FK
-- and account deletion fails with a 500 for any user who owns a wardrobe
-- item -- effectively everyone. Same fix: no-op when the owning profile no
-- longer exists.

set search_path = public, extensions;

create or replace function public.mark_wardrobe_compilation_dirty()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_user_id uuid := coalesce(new.user_id, old.user_id);
begin
  if not exists (select 1 from public.profiles where id = affected_user_id) then
    return null;
  end if;

  insert into public.wardrobe_compilation_state (user_id, dirty_since, pending_change_count)
  values (affected_user_id, clock_timestamp(), 1)
  on conflict (user_id) do update
    set
      dirty_since = coalesce(
        public.wardrobe_compilation_state.dirty_since,
        excluded.dirty_since
      ),
      pending_change_count = public.wardrobe_compilation_state.pending_change_count + 1;

  insert into public.wardrobe_compilation_jobs (user_id, status, trigger_reason)
  values (affected_user_id, 'queued', 'item_change')
  on conflict (user_id) where status in ('queued', 'running') do nothing;

  -- AFTER-trigger return value is ignored by Postgres; null is idiomatic here.
  return null;
end;
$$;

revoke all on function public.mark_wardrobe_compilation_dirty() from public, anon, authenticated;

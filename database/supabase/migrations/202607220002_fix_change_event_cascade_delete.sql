-- Fixes a real bug introduced in 202607220001: record_wardrobe_change_event(),
-- record_wardrobe_cutout_change_event(), and record_style_profile_change_event()
-- all insert into wardrobe_change_events (user_id references profiles(id) on
-- delete cascade) and call mark_wardrobe_compilation_dirty_for_user(), which
-- upserts into wardrobe_compilation_state (user_id also references profiles).
--
-- Deleting a Supabase Auth user cascades to profiles, which cascades to
-- wardrobe_items / wardrobe_item_images / style_profiles, which fires these
-- AFTER triggers -- but by the time a child row's cascade delete runs, the
-- parent profiles row is already gone within the same statement, so the new
-- insert against a user_id that no longer exists in profiles violates the FK
-- immediately (foreign keys are checked NOT DEFERRED by default here). This
-- turned account deletion into a hard 500 for any user who ever owned a
-- wardrobe item, image, or style profile -- i.e. effectively everyone.
--
-- Fix: each trigger function now no-ops (returns without writing anything)
-- when the owning profile no longer exists. That's also the semantically
-- correct behavior during account deletion: there is no point recording a
-- change event or queuing a compilation job for a user who is being deleted
-- in the same transaction.

set search_path = public, extensions;

create or replace function public.record_wardrobe_change_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_user_id uuid := coalesce(new.user_id, old.user_id);
  affected_item_id uuid := coalesce(new.id, old.id);
  event_type text;
  version_marker text;
begin
  if not exists (select 1 from public.profiles where id = affected_user_id) then
    return null;
  end if;

  if tg_op = 'DELETE' then
    event_type := 'deleted';
    version_marker := old.updated_at::text;
  elsif tg_op = 'INSERT' then
    event_type := 'created';
    version_marker := new.updated_at::text;
  elsif new.deleted_at is not null and old.deleted_at is null then
    event_type := 'deleted';
    version_marker := new.updated_at::text;
  elsif new.availability_status is distinct from old.availability_status then
    event_type := 'availability_changed';
    version_marker := new.updated_at::text;
  else
    event_type := 'metadata_changed';
    version_marker := new.updated_at::text;
  end if;

  insert into public.wardrobe_change_events (user_id, item_id, change_type, item_version)
  values (affected_user_id, affected_item_id, event_type, version_marker);

  perform public.mark_wardrobe_compilation_dirty_for_user(affected_user_id);
  return null;
end;
$$;

revoke all on function public.record_wardrobe_change_event() from public, anon, authenticated;

create or replace function public.record_wardrobe_cutout_change_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where id = new.user_id) then
    return null;
  end if;

  if new.kind in ('cutout', 'modeled') or new.is_primary then
    insert into public.wardrobe_change_events (user_id, item_id, change_type, item_version)
    values (new.user_id, new.item_id, 'cutout_changed', new.created_at::text);
    perform public.mark_wardrobe_compilation_dirty_for_user(new.user_id);
  end if;
  return null;
end;
$$;

revoke all on function public.record_wardrobe_cutout_change_event() from public, anon, authenticated;

create or replace function public.record_style_profile_change_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where id = new.user_id) then
    return null;
  end if;

  insert into public.wardrobe_change_events (user_id, item_id, change_type, item_version)
  values (new.user_id, null, 'preference_changed', new.updated_at::text);
  perform public.mark_wardrobe_compilation_dirty_for_user(new.user_id);
  return null;
end;
$$;

revoke all on function public.record_style_profile_change_event() from public, anon, authenticated;

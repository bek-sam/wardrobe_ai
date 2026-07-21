-- Keep recent-conversation ordering accurate whenever a visible or tool
-- message is appended. This invariant belongs in the database so background
-- writers and future chat routes cannot forget to advance the parent thread.

create or replace function public.touch_conversation_from_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
  set updated_at = greatest(updated_at, now())
  where id = new.conversation_id
    and user_id = new.user_id;
  return new;
end;
$$;

drop trigger if exists touch_conversation_from_message on public.messages;
create trigger touch_conversation_from_message
after insert on public.messages
for each row execute function public.touch_conversation_from_message();

revoke all on function public.touch_conversation_from_message() from public, anon, authenticated;

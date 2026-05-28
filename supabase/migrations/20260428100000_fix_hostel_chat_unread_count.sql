-- Fix unread count always returning 0 when no read-state row exists (coalesce with now() excluded all messages).
-- Safe to re-run on databases that already applied 20260428000000_hostel_chat_unread.sql.

create or replace function public.get_hostel_chat_unread_count()
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_group_count integer := 0;
  v_dm_count integer := 0;
begin
  if v_user is null then
    return 0;
  end if;

  select count(*)::integer into v_group_count
  from public.hostel_group_messages gm
  where gm.sender_id <> v_user
    and public.hostel_user_can_access_chat(gm.hostel_id, v_user)
    and gm.created_at > coalesce(
      (
        select rs.last_read_at
        from public.hostel_chat_read_state rs
        where rs.user_id = v_user
          and rs.hostel_id = gm.hostel_id
          and rs.conversation_id is null
        limit 1
      ),
      '-infinity'::timestamptz
    );

  select count(*)::integer into v_dm_count
  from public.hostel_dm_messages dm
  inner join public.hostel_dm_conversations c on c.id = dm.conversation_id
  where dm.sender_id <> v_user
    and (c.participant_low = v_user or c.participant_high = v_user)
    and dm.created_at > coalesce(
      (
        select rs.last_read_at
        from public.hostel_chat_read_state rs
        where rs.user_id = v_user
          and rs.conversation_id = dm.conversation_id
        limit 1
      ),
      '-infinity'::timestamptz
    );

  return v_group_count + v_dm_count;
end;
$$;

grant execute on function public.get_hostel_chat_unread_count() to authenticated;

-- Insert read-state rows (last_read_at = now()) for any hostel/conversation missing a baseline.
create or replace function public.initialize_hostel_chat_read_baseline()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_hostel_id uuid;
  v_conv record;
begin
  if v_user is null then
    return;
  end if;

  for v_hostel_id in
    select h.id
    from public.hostels h
    where public.hostel_user_can_access_chat(h.id, v_user)
  loop
    insert into public.hostel_chat_read_state (user_id, hostel_id, conversation_id, last_read_at)
    values (v_user, v_hostel_id, null, now())
    on conflict (user_id, hostel_id) where conversation_id is null
    do nothing;
  end loop;

  for v_conv in
    select c.id, c.hostel_id
    from public.hostel_dm_conversations c
    where c.participant_low = v_user or c.participant_high = v_user
  loop
    insert into public.hostel_chat_read_state (user_id, hostel_id, conversation_id, last_read_at)
    values (v_user, v_conv.hostel_id, v_conv.id, now())
    on conflict (user_id, conversation_id) where conversation_id is not null
    do nothing;
  end loop;
end;
$$;

grant execute on function public.initialize_hostel_chat_read_baseline() to authenticated;

NOTIFY pgrst, 'reload schema';

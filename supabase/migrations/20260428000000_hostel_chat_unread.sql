-- Track per-user read state for hostel group and direct chats; expose unread counts via RPC.

create table public.hostel_chat_read_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  hostel_id uuid not null references public.hostels(id) on delete cascade,
  conversation_id uuid references public.hostel_dm_conversations(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index hostel_chat_read_group_idx
  on public.hostel_chat_read_state (user_id, hostel_id)
  where conversation_id is null;

create unique index hostel_chat_read_dm_idx
  on public.hostel_chat_read_state (user_id, conversation_id)
  where conversation_id is not null;

create index hostel_chat_read_state_user_idx
  on public.hostel_chat_read_state (user_id);

alter table public.hostel_chat_read_state enable row level security;

create policy "Users read own chat read state"
  on public.hostel_chat_read_state for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users upsert own chat read state"
  on public.hostel_chat_read_state for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users update own chat read state"
  on public.hostel_chat_read_state for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

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

create or replace function public.mark_hostel_chat_read(
  p_hostel_id uuid,
  p_conversation_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if not public.hostel_user_can_access_chat(p_hostel_id, v_user) then
    raise exception 'no chat access for this hostel';
  end if;

  if p_conversation_id is null then
    insert into public.hostel_chat_read_state (user_id, hostel_id, conversation_id, last_read_at)
    values (v_user, p_hostel_id, null, now())
    on conflict (user_id, hostel_id) where conversation_id is null
    do update set last_read_at = excluded.last_read_at;
  else
    if not exists (
      select 1
      from public.hostel_dm_conversations c
      where c.id = p_conversation_id
        and c.hostel_id = p_hostel_id
        and (c.participant_low = v_user or c.participant_high = v_user)
    ) then
      raise exception 'not a participant in this conversation';
    end if;

    insert into public.hostel_chat_read_state (user_id, hostel_id, conversation_id, last_read_at)
    values (v_user, p_hostel_id, p_conversation_id, now())
    on conflict (user_id, conversation_id) where conversation_id is not null
    do update set last_read_at = excluded.last_read_at;
  end if;
end;
$$;

grant execute on function public.mark_hostel_chat_read(uuid, uuid) to authenticated;

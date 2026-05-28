-- Hostel-scoped direct messaging between active members and property owners.

create or replace function public.hostel_user_can_access_chat(p_hostel_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.hostels h
    where h.id = p_hostel_id
      and h.owner_id = p_user_id
      and h.is_active = true
  )
  or exists (
    select 1
    from public.hostel_members hm
    where hm.hostel_id = p_hostel_id
      and hm.user_id = p_user_id
      and hm.status = 'active'
  );
$$;

grant execute on function public.hostel_user_can_access_chat(uuid, uuid) to authenticated;

create table public.hostel_dm_conversations (
  id uuid primary key default gen_random_uuid(),
  hostel_id uuid not null references public.hostels(id) on delete cascade,
  participant_low uuid not null references auth.users(id) on delete cascade,
  participant_high uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint hostel_dm_participant_order check (participant_low::text < participant_high::text)
);

create unique index hostel_dm_conversations_unique_idx
  on public.hostel_dm_conversations (hostel_id, participant_low, participant_high);

create index hostel_dm_conversations_hostel_idx
  on public.hostel_dm_conversations (hostel_id);

create table public.hostel_dm_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.hostel_dm_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

create index hostel_dm_messages_conversation_created_idx
  on public.hostel_dm_messages (conversation_id, created_at desc);

create or replace function public.validate_hostel_dm_conversation_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.hostel_user_can_access_chat(new.hostel_id, new.participant_low) then
    raise exception 'participant_low cannot access chat for this hostel';
  end if;
  if not public.hostel_user_can_access_chat(new.hostel_id, new.participant_high) then
    raise exception 'participant_high cannot access chat for this hostel';
  end if;
  return new;
end;
$$;

create trigger validate_hostel_dm_conversation_members_trg
  before insert on public.hostel_dm_conversations
  for each row execute function public.validate_hostel_dm_conversation_members();

create or replace function public.ensure_hostel_dm_conversation(p_hostel_id uuid, p_peer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_low uuid;
  v_high uuid;
  v_conv_id uuid;
begin
  if v_caller is null or p_peer_id is null or v_caller = p_peer_id then
    raise exception 'invalid participants';
  end if;
  if not public.hostel_user_can_access_chat(p_hostel_id, v_caller) then
    raise exception 'no chat access for caller';
  end if;
  if not public.hostel_user_can_access_chat(p_hostel_id, p_peer_id) then
    raise exception 'peer has no chat access';
  end if;

  if v_caller::text < p_peer_id::text then
    v_low := v_caller;
    v_high := p_peer_id;
  else
    v_low := p_peer_id;
    v_high := v_caller;
  end if;

  insert into public.hostel_dm_conversations (hostel_id, participant_low, participant_high)
  values (p_hostel_id, v_low, v_high)
  on conflict (hostel_id, participant_low, participant_high) do nothing
  returning id into v_conv_id;

  if v_conv_id is null then
    select c.id into v_conv_id
    from public.hostel_dm_conversations c
    where c.hostel_id = p_hostel_id
      and c.participant_low = v_low
      and c.participant_high = v_high;
  end if;

  return v_conv_id;
end;
$$;

grant execute on function public.ensure_hostel_dm_conversation(uuid, uuid) to authenticated;

create or replace function public.list_active_hostel_peers(p_hostel_id uuid)
returns table (user_id uuid, full_name text, avatar_url text, is_hostel_owner boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_owner_id uuid;
begin
  if v_caller is null then
    return;
  end if;
  if not public.hostel_user_can_access_chat(p_hostel_id, v_caller) then
    return;
  end if;

  select h.owner_id into v_owner_id
  from public.hostels h
  where h.id = p_hostel_id;

  return query
  select p.user_id, p.full_name, p.avatar_url, (p.user_id = v_owner_id) as is_hostel_owner
  from public.profiles p
  where p.user_id <> v_caller
    and (
      p.user_id = v_owner_id
      or exists (
        select 1 from public.hostel_members hm
        where hm.hostel_id = p_hostel_id
          and hm.user_id = p.user_id
          and hm.status = 'active'
      )
    )
  order by is_hostel_owner desc, p.full_name;
end;
$$;

grant execute on function public.list_active_hostel_peers(uuid) to authenticated;

alter table public.hostel_dm_conversations enable row level security;
alter table public.hostel_dm_messages enable row level security;

create policy "Participants read dm conversations"
  on public.hostel_dm_conversations for select
  to authenticated
  using (
    auth.uid() = participant_low or auth.uid() = participant_high
  );

create policy "Participants create dm conversations"
  on public.hostel_dm_conversations for insert
  to authenticated
  with check (
    (auth.uid() = participant_low or auth.uid() = participant_high)
    and public.hostel_user_can_access_chat(hostel_id, auth.uid())
  );

create policy "Participants read dm messages"
  on public.hostel_dm_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.hostel_dm_conversations c
      where c.id = conversation_id
        and (c.participant_low = auth.uid() or c.participant_high = auth.uid())
    )
  );

create policy "Participants send dm messages"
  on public.hostel_dm_messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.hostel_dm_conversations c
      where c.id = conversation_id
        and (c.participant_low = auth.uid() or c.participant_high = auth.uid())
    )
  );

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.hostel_dm_messages;
  end if;
exception
  when duplicate_object then null;
end $$;

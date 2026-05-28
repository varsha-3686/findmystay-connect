-- Per-hostel group thread: property owner + active members only.

create table public.hostel_group_messages (
  id uuid primary key default gen_random_uuid(),
  hostel_id uuid not null references public.hostels(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

create index hostel_group_messages_hostel_created_idx
  on public.hostel_group_messages (hostel_id, created_at asc);

create or replace function public.list_active_hostel_roster(p_hostel_id uuid)
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
  where p.user_id = v_owner_id
     or exists (
       select 1 from public.hostel_members hm
       where hm.hostel_id = p_hostel_id
         and hm.user_id = p.user_id
         and hm.status = 'active'
     )
  order by is_hostel_owner desc, p.full_name;
end;
$$;

grant execute on function public.list_active_hostel_roster(uuid) to authenticated;

alter table public.hostel_group_messages enable row level security;

create policy "Chat members read group messages"
  on public.hostel_group_messages for select
  to authenticated
  using (public.hostel_user_can_access_chat(hostel_id, auth.uid()));

create policy "Chat members send group messages"
  on public.hostel_group_messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and public.hostel_user_can_access_chat(hostel_id, auth.uid())
  );

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.hostel_group_messages;
  end if;
exception
  when duplicate_object then null;
end $$;

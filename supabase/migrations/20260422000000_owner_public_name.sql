-- Public-safe owner display name on listings (avoids leaking profiles via RLS).
alter table public.hostels
  add column if not exists owner_public_name text;

update public.hostels h
set owner_public_name = trim(p.full_name)
from public.profiles p
where p.user_id = h.owner_id
  and trim(coalesce(p.full_name, '')) <> ''
  and (h.owner_public_name is null or trim(h.owner_public_name) = '');

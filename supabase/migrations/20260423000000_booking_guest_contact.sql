-- Guest address captured at booking time; visible to property owners via bookings RLS.
alter table public.bookings
  add column if not exists address text;

comment on column public.bookings.address is 'Guest address at time of booking; visible to property owner only';

-- Align pending booking dedupe with room_types model.
drop index if exists bookings_pending_unique_request_idx;

create unique index if not exists bookings_pending_unique_request_idx
  on public.bookings (
    user_id,
    hostel_id,
    coalesce(room_type_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(move_in_date, '1900-01-01'::date)
  )
  where status = 'pending';

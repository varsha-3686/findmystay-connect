-- Restrict fraud report inserts to hostels the user has booked or used laundry at.

drop policy if exists "Users insert own fraud alerts" on public.fraud_alerts;

create policy "Users insert own fraud alerts"
  on public.fraud_alerts for insert
  to authenticated
  with check (
    reported_by = auth.uid()
    and (
      exists (
        select 1 from public.bookings b
        where b.user_id = auth.uid()
          and b.hostel_id = fraud_alerts.hostel_id
      )
      or exists (
        select 1 from public.laundry_orders lo
        where lo.user_id = auth.uid()
          and lo.hostel_id is not null
          and lo.hostel_id = fraud_alerts.hostel_id
      )
    )
  );

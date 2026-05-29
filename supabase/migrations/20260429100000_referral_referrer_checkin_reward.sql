-- Credit referrer (code owner) ₹100 when referred friend is checked in.

create or replace function public.credit_user_wallet(p_user_id uuid, p_cash_rupees numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_points numeric := p_cash_rupees * 10;
begin
  if p_user_id is null or p_cash_rupees <= 0 then
    return;
  end if;

  insert into public.user_wallet (user_id, reward_points, cash_value, updated_at)
  values (p_user_id, v_points, p_cash_rupees, now())
  on conflict (user_id)
  do update set
    reward_points = public.user_wallet.reward_points + excluded.reward_points,
    cash_value = public.user_wallet.cash_value + excluded.cash_value,
    updated_at = now();
end;
$$;

create or replace function public.process_referral_booking_reward(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest_id uuid;
  v_referrer_id uuid;
  v_referral_id uuid;
  v_reward_rupees numeric := 100;
begin
  select b.user_id into v_guest_id
  from public.bookings b
  where b.id = p_booking_id
    and b.status = 'checked_in';

  if v_guest_id is null then
    return;
  end if;

  select r.id, r.referrer_user_id
  into v_referral_id, v_referrer_id
  from public.referrals r
  where r.referred_user_id = v_guest_id
    and r.booking_reward_paid_at is null
    and r.status in ('pending', 'completed')
  order by r.created_at asc
  limit 1
  for update;

  if v_referral_id is null or v_referrer_id is null then
    return;
  end if;

  perform public.credit_user_wallet(v_referrer_id, v_reward_rupees);

  update public.referrals
  set
    booking_reward_paid_at = now(),
    reward_booking_id = p_booking_id,
    reward_points = v_reward_rupees * 10,
    status = 'rewarded'
  where id = v_referral_id;
end;
$$;

create or replace function public.trg_referral_booking_reward()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
    and new.status = 'checked_in'
    and (old.status is distinct from new.status)
  then
    perform public.process_referral_booking_reward(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists referral_booking_reward_trg on public.bookings;

create trigger referral_booking_reward_trg
  after update of status on public.bookings
  for each row
  execute function public.trg_referral_booking_reward();

-- Backfill: pending referrals where friend already checked in but reward not paid
do $$
declare
  v_booking_id uuid;
begin
  for v_booking_id in
    select b.id
    from public.bookings b
    inner join public.referrals r on r.referred_user_id = b.user_id
    where b.status = 'checked_in'
      and r.booking_reward_paid_at is null
      and r.status in ('pending', 'completed')
    order by b.updated_at asc nulls last, b.created_at asc
  loop
    perform public.process_referral_booking_reward(v_booking_id);
  end loop;
end;
$$;

NOTIFY pgrst, 'reload schema';

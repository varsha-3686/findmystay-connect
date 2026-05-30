-- Allow admins to read all referrals and wallet balances for oversight.

create policy "Admin reads all referrals"
  on public.referrals for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admin reads all wallets"
  on public.user_wallet for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

NOTIFY pgrst, 'reload schema';

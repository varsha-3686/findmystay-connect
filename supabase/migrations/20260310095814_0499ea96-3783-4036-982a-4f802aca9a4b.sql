
-- Referrals table
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL,
  referred_user_id uuid,
  referral_code text NOT NULL UNIQUE,
  reward_points integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referrals" ON public.referrals
  FOR SELECT TO authenticated
  USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);

CREATE POLICY "Users can insert referrals" ON public.referrals
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = referrer_user_id);

CREATE POLICY "System can update referrals" ON public.referrals
  FOR UPDATE TO authenticated
  USING (auth.uid() = referrer_user_id OR has_role(auth.uid(), 'admin'));

-- Lifestyle clicks table
CREATE TABLE public.lifestyle_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  service_name text NOT NULL,
  redirect_url text NOT NULL,
  points_awarded integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.lifestyle_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own clicks" ON public.lifestyle_clicks
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert clicks" ON public.lifestyle_clicks
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- User wallet table
CREATE TABLE public.user_wallet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  reward_points integer NOT NULL DEFAULT 0,
  cash_value numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_wallet ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet" ON public.user_wallet
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wallet" ON public.user_wallet
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own wallet" ON public.user_wallet
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

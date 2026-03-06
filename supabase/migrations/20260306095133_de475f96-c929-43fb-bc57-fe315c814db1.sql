
CREATE TABLE public.otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact text NOT NULL,
  otp_code text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Allow anyone to interact via edge function (service role)
-- No direct client access needed

-- Rate limiting index
CREATE INDEX idx_otp_contact_created ON public.otp_codes (contact, created_at DESC);

-- Cleanup function for expired OTPs
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.otp_codes WHERE expires_at < now() - interval '1 hour';
$$;

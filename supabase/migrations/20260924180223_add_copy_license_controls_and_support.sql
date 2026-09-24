ALTER TABLE public.copy_followers
  ADD COLUMN IF NOT EXISTS pairing_code_id uuid REFERENCES public.copy_pairing_codes(id),
  ADD COLUMN IF NOT EXISTS license_activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS license_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS license_status text NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS license_generation integer NOT NULL DEFAULT 0;

ALTER TABLE public.copy_followers
  DROP CONSTRAINT IF EXISTS copy_followers_license_status_check;

ALTER TABLE public.copy_followers
  ADD CONSTRAINT copy_followers_license_status_check
  CHECK (license_status IN ('inactive','active','revoked','expired'));

CREATE INDEX IF NOT EXISTS copy_followers_pairing_code_id_idx
  ON public.copy_followers(pairing_code_id);

CREATE TABLE IF NOT EXISTS public.copy_support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type text NOT NULL DEFAULT 'PAIRING_RESET',
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.copy_support_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.copy_support_requests FROM anon, authenticated;
GRANT ALL ON TABLE public.copy_support_requests TO service_role;

CREATE INDEX IF NOT EXISTS copy_support_requests_user_created_idx
  ON public.copy_support_requests(auth_user_id, created_at DESC);

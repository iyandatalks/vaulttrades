ALTER TABLE public.copy_customer_registrations
  ADD COLUMN IF NOT EXISTS broker_referral_status text NOT NULL DEFAULT 'pending'
    CHECK (broker_referral_status IN ('pending','verified','review_required')),
  ADD COLUMN IF NOT EXISTS broker_referral_mt5_login text,
  ADD COLUMN IF NOT EXISTS broker_referral_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS broker_referral_verified_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS onboarding_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_notification_id uuid;

CREATE TABLE IF NOT EXISTS public.copy_profile_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  action_href text NOT NULL DEFAULT '/copy',
  notification_type text NOT NULL DEFAULT 'copy_onboarding',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS copy_profile_notifications_user_created_idx
  ON public.copy_profile_notifications (auth_user_id, created_at DESC);

ALTER TABLE public.copy_profile_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their own copy profile notifications" ON public.copy_profile_notifications;
CREATE POLICY "Users read their own copy profile notifications"
  ON public.copy_profile_notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = auth_user_id);

COMMENT ON TABLE public.copy_profile_notifications IS
  'Private in-profile notices for copy trading onboarding; inserts and read-state changes are performed by trusted server routes.';

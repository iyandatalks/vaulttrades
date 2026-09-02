-- Fix scanner automation RPC functions so output-column names do not collide
-- with scanner_automation.configs column references.

CREATE OR REPLACE FUNCTION public.get_scanner_automation_config(p_auth_user_id uuid)
RETURNS TABLE (
  auth_user_id uuid,
  enabled boolean,
  observe_mode boolean,
  forex_enabled boolean,
  crypto_enabled boolean,
  enabled_strategies text[],
  trade_time_start time,
  trade_time_end time,
  timezone text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, scanner_automation
AS $$
  SELECT c.auth_user_id, c.enabled, c.observe_mode, c.forex_enabled,
         c.crypto_enabled, c.enabled_strategies, c.trade_time_start,
         c.trade_time_end, c.timezone, c.created_at, c.updated_at
  FROM scanner_automation.configs AS c
  WHERE c.auth_user_id = p_auth_user_id
    AND (auth.uid() = p_auth_user_id OR auth.role() = 'service_role');
$$;

CREATE OR REPLACE FUNCTION public.provision_scanner_automation_config(p_auth_user_id uuid)
RETURNS TABLE (
  auth_user_id uuid,
  enabled boolean,
  observe_mode boolean,
  forex_enabled boolean,
  crypto_enabled boolean,
  enabled_strategies text[],
  trade_time_start time,
  trade_time_end time,
  timezone text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, scanner_automation
AS $$
BEGIN
  IF NOT (auth.uid() = p_auth_user_id OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO scanner_automation.configs AS c (
    auth_user_id, enabled, observe_mode, forex_enabled, crypto_enabled,
    enabled_strategies, trade_time_start, trade_time_end, timezone
  )
  VALUES (
    p_auth_user_id, false, true, true, false,
    ARRAY['autoFibRetrace']::text[], '00:00:00', '23:59:59',
    'Africa/Johannesburg'
  )
  ON CONFLICT (auth_user_id) DO NOTHING;

  RETURN QUERY SELECT * FROM public.get_scanner_automation_config(p_auth_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_scanner_automation_config(
  p_auth_user_id uuid,
  p_enabled boolean DEFAULT NULL,
  p_observe_mode boolean DEFAULT NULL,
  p_forex_enabled boolean DEFAULT NULL,
  p_crypto_enabled boolean DEFAULT NULL,
  p_enabled_strategies text[] DEFAULT NULL
)
RETURNS TABLE (
  auth_user_id uuid,
  enabled boolean,
  observe_mode boolean,
  forex_enabled boolean,
  crypto_enabled boolean,
  enabled_strategies text[],
  trade_time_start time,
  trade_time_end time,
  timezone text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, scanner_automation
AS $$
BEGIN
  IF NOT (auth.uid() = p_auth_user_id OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  PERFORM public.provision_scanner_automation_config(p_auth_user_id);

  UPDATE scanner_automation.configs AS c
  SET enabled = COALESCE(p_enabled, c.enabled),
      observe_mode = COALESCE(p_observe_mode, c.observe_mode),
      forex_enabled = COALESCE(p_forex_enabled, c.forex_enabled),
      crypto_enabled = COALESCE(p_crypto_enabled, c.crypto_enabled),
      enabled_strategies = COALESCE(p_enabled_strategies, c.enabled_strategies),
      trade_time_start = '00:00:00',
      trade_time_end = '23:59:59',
      timezone = 'Africa/Johannesburg',
      updated_at = now()
  WHERE c.auth_user_id = p_auth_user_id;

  RETURN QUERY SELECT * FROM public.get_scanner_automation_config(p_auth_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_enabled_scanner_automation_configs()
RETURNS TABLE (
  auth_user_id uuid,
  enabled boolean,
  observe_mode boolean,
  forex_enabled boolean,
  crypto_enabled boolean,
  enabled_strategies text[]
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, scanner_automation
AS $$
  SELECT c.auth_user_id, c.enabled, c.observe_mode, c.forex_enabled,
         c.crypto_enabled, c.enabled_strategies
  FROM scanner_automation.configs AS c
  WHERE c.enabled = true
    AND auth.role() = 'service_role';
$$;

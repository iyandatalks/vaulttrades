-- VaultTrades Copy Trading: enforce the conflict targets used by the
-- master event ingestion and customer pairing/fan-out APIs.

ALTER TABLE public.copy_trade_events
  ADD CONSTRAINT copy_trade_events_external_event_id_key
  UNIQUE (external_event_id);

ALTER TABLE public.copy_trade_executions
  ADD CONSTRAINT copy_trade_executions_event_follower_key
  UNIQUE (event_id, follower_id);

ALTER TABLE public.copy_followers
  ADD CONSTRAINT copy_followers_auth_user_id_key
  UNIQUE (auth_user_id);

ALTER TABLE public.copy_links
  ADD CONSTRAINT copy_links_master_follower_key
  UNIQUE (master_id, follower_id);

ALTER TABLE public.copy_pairing_codes
  ADD CONSTRAINT copy_pairing_codes_code_hash_key
  UNIQUE (code_hash);

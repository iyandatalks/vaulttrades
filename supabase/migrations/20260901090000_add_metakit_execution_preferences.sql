alter table if exists public.automated_trader_accounts
  add column if not exists enabled_instruments text[] not null default array['XAUUSD']::text[];

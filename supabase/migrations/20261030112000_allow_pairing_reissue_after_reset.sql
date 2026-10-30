-- A reset revokes the prior pairing code. Permit one replacement code
-- for the same subscription period and MT5 account after revocation.
drop index if exists public.copy_pairing_codes_one_per_period_uidx;

create unique index if not exists copy_pairing_codes_one_per_period_uidx
  on public.copy_pairing_codes(auth_user_id, subscription_start_at, mt5_login)
  where subscription_start_at is not null
    and mt5_login is not null
    and revoked_at is null;

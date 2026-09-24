alter table public.copy_pairing_codes
  add column if not exists subscription_start_at timestamptz,
  add column if not exists subscription_end_at timestamptz,
  add column if not exists mt5_login text;

alter table public.copy_followers
  drop constraint if exists copy_followers_license_status_check;

alter table public.copy_followers
  add constraint copy_followers_license_status_check
  check (license_status in ('inactive','active','revoked','expired','disabled','suspended'));

alter table public.copy_customer_registrations
  drop constraint if exists copy_customer_registrations_auth_user_id_key;

create unique index if not exists copy_customer_registrations_user_mt5_uidx
  on public.copy_customer_registrations(auth_user_id, mt5_login);

create index if not exists copy_pairing_codes_user_period_idx
  on public.copy_pairing_codes(auth_user_id, subscription_start_at);

create unique index if not exists copy_pairing_codes_one_per_period_uidx
  on public.copy_pairing_codes(auth_user_id, subscription_start_at)
  where subscription_start_at is not null;

create index if not exists copy_followers_mt_login_idx
  on public.copy_followers(mt_login);

create table if not exists public.copy_revoked_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  follower_id uuid references public.copy_followers(id) on delete set null,
  revoked_at timestamptz not null default now(),
  reason text not null default 'revoked'
    check (reason in ('revoked','expired','disabled','suspended')),
  created_at timestamptz not null default now()
);

alter table public.copy_revoked_tokens enable row level security;
revoke all on table public.copy_revoked_tokens from anon, authenticated;
grant all on table public.copy_revoked_tokens to service_role;

create index if not exists copy_revoked_tokens_user_idx
  on public.copy_revoked_tokens(auth_user_id, revoked_at desc);
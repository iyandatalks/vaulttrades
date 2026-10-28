create table if not exists public.copy_broker_referrals (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null default '',
  partner_id uuid references public.partners(id) on delete set null,
  partner_name text not null,
  broker_user_id text not null,
  status text not null default 'pending' check (status in ('pending','verified','review_required')),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists copy_broker_referrals_partner_idx on public.copy_broker_referrals(partner_id);
create index if not exists copy_broker_referrals_broker_user_id_idx on public.copy_broker_referrals(broker_user_id);

alter table public.copy_broker_referrals enable row level security;
revoke all on public.copy_broker_referrals from anon, authenticated;
grant all on public.copy_broker_referrals to service_role;

alter table public.copy_customer_registrations
  drop column if exists broker_referral_partner_id,
  drop column if exists broker_referral_partner_name,
  drop column if exists broker_referral_user_id,
  drop column if exists broker_referral_submitted_at;

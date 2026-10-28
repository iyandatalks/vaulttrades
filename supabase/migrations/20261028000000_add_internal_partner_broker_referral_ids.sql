alter table public.copy_customer_registrations
  add column if not exists broker_referral_partner_id uuid references public.partners(id) on delete set null,
  add column if not exists broker_referral_partner_name text,
  add column if not exists broker_referral_user_id text,
  add column if not exists broker_referral_submitted_at timestamptz;

create index if not exists copy_customer_registrations_broker_referral_partner_idx
  on public.copy_customer_registrations (broker_referral_partner_id);

create index if not exists copy_customer_registrations_broker_referral_user_id_idx
  on public.copy_customer_registrations (broker_referral_user_id)
  where broker_referral_user_id is not null;

create table if not exists public.reseller_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references public.users(id) on delete restrict,
  customer_auth_user_id uuid not null,
  customer_email text not null,
  reseller_user_id uuid not null references public.users(id) on delete restrict,
  reseller_auth_user_id uuid not null,
  reseller_code text not null,
  reseller_website text not null,
  plan_code text not null check (plan_code in ('nexus','nexus_plus','vortex')),
  expected_mrr_amount numeric(10,2) not null check (expected_mrr_amount > 0),
  declared_mrr_amount numeric(10,2) not null check (declared_mrr_amount > 0),
  reseller_transaction_reference text not null,
  reseller_payment_date date not null,
  reseller_payment_time time,
  reseller_payment_status text not null default 'awaiting_reseller_confirmation'
    check (reseller_payment_status in ('awaiting_reseller_confirmation','confirmed_by_reseller','rejected_by_reseller')),
  vaulttrades_payment_status text not null default 'pending'
    check (vaulttrades_payment_status in ('pending','verified','failed')),
  vaulttrades_payment_transaction_id uuid references public.payment_transactions(id) on delete set null,
  reseller_confirmed_by uuid,
  reseller_confirmed_at timestamptz,
  reseller_rejection_reason text,
  terms_accepted_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists reseller_purchase_orders_transaction_reference_uidx
  on public.reseller_purchase_orders (lower(btrim(reseller_transaction_reference)));

create index if not exists reseller_purchase_orders_reseller_status_idx
  on public.reseller_purchase_orders (reseller_auth_user_id, reseller_payment_status, created_at desc);

create index if not exists reseller_purchase_orders_customer_idx
  on public.reseller_purchase_orders (customer_auth_user_id, created_at desc);

alter table public.reseller_purchase_orders enable row level security;
revoke all on public.reseller_purchase_orders from anon, authenticated;
grant all on public.reseller_purchase_orders to service_role;

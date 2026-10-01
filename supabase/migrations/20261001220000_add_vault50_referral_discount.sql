create table if not exists public.referral_discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_percent numeric(5,2) not null check (discount_percent > 0 and discount_percent < 100),
  discount_cycles integer not null check (discount_cycles between 1 and 999),
  new_customers_only boolean not null default true,
  eligible_product_codes text[] not null default '{}',
  active boolean not null default true,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.referral_discount_plans (
  id uuid primary key default gen_random_uuid(),
  discount_code_id uuid not null references public.referral_discount_codes(id) on delete cascade,
  product_code text not null,
  paypal_plan_id text not null,
  original_price numeric(12,2) not null,
  discounted_price numeric(12,2) not null,
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  unique(discount_code_id, product_code)
);

create table if not exists public.referral_discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  discount_code_id uuid not null references public.referral_discount_codes(id),
  customer_user_id uuid not null references public.users(id),
  referrer_user_id uuid references public.users(id),
  product_code text not null,
  paypal_subscription_id text,
  original_price numeric(12,2) not null,
  discount_percent numeric(5,2) not null,
  discounted_price numeric(12,2) not null,
  discount_cycles integer not null,
  status text not null default 'pending' check (status in ('pending','active','completed','cancelled','reversed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists referral_discount_redemptions_customer_idx
  on public.referral_discount_redemptions(customer_user_id, product_code, status);

create index if not exists referral_discount_redemptions_paypal_idx
  on public.referral_discount_redemptions(paypal_subscription_id);

insert into public.referral_discount_codes
  (code, discount_percent, discount_cycles, new_customers_only, eligible_product_codes, active)
values
  ('VAULT50', 50, 6, true, array['analyzer_monthly','automated_trader_monthly'], true)
on conflict (code) do update
set discount_percent = excluded.discount_percent,
    discount_cycles = excluded.discount_cycles,
    new_customers_only = excluded.new_customers_only,
    eligible_product_codes = excluded.eligible_product_codes,
    active = excluded.active,
    updated_at = now();

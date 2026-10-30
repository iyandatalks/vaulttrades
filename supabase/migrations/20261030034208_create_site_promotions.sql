create table if not exists public.site_promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null check (char_length(btrim(description)) between 1 and 500),
  category text not null check (category in ('Prop Firm','Broker','VaultTrades Product','Tool','Other')),
  image_url text,
  cta_text text not null default 'Explore' check (char_length(btrim(cta_text)) between 1 and 60),
  target_url text not null check (target_url ~* '^https?://|^/'),
  is_active boolean not null default false,
  display_order integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_promotions_valid_window check (ends_at is null or starts_at is null or ends_at > starts_at)
);
alter table public.site_promotions enable row level security;
revoke all on public.site_promotions from anon, authenticated;
grant all on public.site_promotions to service_role;

insert into public.site_promotions
(title,description,category,image_url,cta_text,target_url,is_active,display_order)
select * from (values
 ('Get Funded. Trade Bigger.','Access an Instant Funded Account. Sign up through our link and claim your exclusive discount code to access bigger trading capital.','Prop Firm',null::text,'Explore Funded Accounts','/partners',true,1),
 ('Find Your Trading Broker','Open an account with one of our recommended brokers and get started with a trading setup that suits your needs.','Broker',null::text,'Explore Brokers','/partners',true,2),
 ('Upgrade Your Trading','Explore VaultTrades tools and products designed to support structured analysis, risk management and execution.','VaultTrades Product',null::text,'Explore Products','/partners',true,3)
) as seed(title,description,category,image_url,cta_text,target_url,is_active,display_order)
where not exists (select 1 from public.site_promotions);

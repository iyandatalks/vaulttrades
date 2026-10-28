create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  category text not null check (category in ('Broker','Prop Firm','Tool','VaultTrades Product')),
  referral_code text,
  referral_url text not null,
  cta_text text not null default 'Explore',
  description text not null,
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists partners_public_directory_idx on public.partners (is_published, category, sort_order, name);
alter table public.partners enable row level security;
drop policy if exists "Public can view published partners" on public.partners;
create policy "Public can view published partners" on public.partners for select to anon, authenticated using (is_published = true);
revoke all on public.partners from anon, authenticated;
grant select on public.partners to anon, authenticated;

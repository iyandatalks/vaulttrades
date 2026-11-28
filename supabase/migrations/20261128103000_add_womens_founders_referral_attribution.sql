alter table public.womens_provincial_founders_leads
  add column if not exists referral_code text,
  add column if not exists referrer_user_id uuid references public.users(id) on delete set null;

create index if not exists womens_founders_referrer_idx
  on public.womens_provincial_founders_leads(referrer_user_id)
  where referrer_user_id is not null;

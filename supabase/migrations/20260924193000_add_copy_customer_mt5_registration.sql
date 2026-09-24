create table if not exists public.copy_customer_registrations (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  mt5_login text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.copy_customer_registrations enable row level security;
revoke all on table public.copy_customer_registrations from anon, authenticated;
grant all on table public.copy_customer_registrations to service_role;

create index if not exists copy_customer_registrations_email_idx
  on public.copy_customer_registrations(email);

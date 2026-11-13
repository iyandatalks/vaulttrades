create table public.member_ea_licensing_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  member_email text not null,
  broker_name text not null default 'XM',
  broker_server text,
  mt5_login text not null,
  product_code text not null check (product_code in ('nexus', 'nexus_plus', 'vortex')),
  status text not null default 'submitted' check (status in ('submitted', 'in_progress', 'ready', 'rejected', 'cancelled')),
  admin_notes text,
  download_storage_path text,
  license_generated_at timestamptz,
  reviewed_by uuid references auth.users(id),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_ea_licensing_mt5_format check (mt5_login ~ '^[0-9]{4,12}$'),
  constraint member_ea_licensing_broker_name_length check (char_length(btrim(broker_name)) between 2 and 80)
);

create index member_ea_licensing_user_status_idx
  on public.member_ea_licensing_requests (user_id, status, submitted_at desc);

create index member_ea_licensing_admin_queue_idx
  on public.member_ea_licensing_requests (status, submitted_at asc);

create unique index member_ea_licensing_active_request_unique
  on public.member_ea_licensing_requests (user_id, product_code, mt5_login)
  where status in ('submitted', 'in_progress', 'ready');

alter table public.member_ea_licensing_requests enable row level security;

revoke all on table public.member_ea_licensing_requests from anon, authenticated;
grant all on table public.member_ea_licensing_requests to service_role;

create table public.member_website_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  member_email text not null,
  domain_preference text not null check (domain_preference in ('vaulttrades_subdomain', 'custom_domain')),
  preferred_name_1 text,
  preferred_name_2 text,
  preferred_name_3 text,
  custom_domain text,
  status text not null default 'submitted' check (status in ('submitted', 'in_progress', 'ready', 'rejected', 'cancelled')),
  admin_notes text,
  assigned_domain text,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint website_name_1_valid check (preferred_name_1 is null or preferred_name_1 ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$'),
  constraint website_name_2_valid check (preferred_name_2 is null or preferred_name_2 ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$'),
  constraint website_name_3_valid check (preferred_name_3 is null or preferred_name_3 ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$'),
  constraint website_custom_domain_valid check (custom_domain is null or custom_domain ~* '^[a-z0-9.-]+\.[a-z]{2,}$'),
  constraint website_request_preferences_required check (
    (domain_preference = 'vaulttrades_subdomain' and preferred_name_1 is not null and preferred_name_2 is not null and preferred_name_3 is not null)
    or (domain_preference = 'custom_domain' and custom_domain is not null)
  )
);

create index member_website_requests_user_status_idx
  on public.member_website_requests (user_id, status, submitted_at desc);

create index member_website_requests_admin_queue_idx
  on public.member_website_requests (status, submitted_at asc);

create unique index member_website_requests_one_open_per_user
  on public.member_website_requests (user_id)
  where status in ('submitted', 'in_progress', 'ready');

alter table public.member_website_requests enable row level security;
revoke all on table public.member_website_requests from anon, authenticated;
grant all on table public.member_website_requests to service_role;

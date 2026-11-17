create table if not exists public.partner_portal_access_overrides (
  auth_user_id uuid primary key,
  decision text not null check (decision in ('grant','revoke')),
  reason text not null default '',
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.partner_portal_access_overrides enable row level security;
revoke all on public.partner_portal_access_overrides from anon, authenticated;
grant all on public.partner_portal_access_overrides to service_role;

create table if not exists public.admin_access_management_audit (
  id uuid primary key default gen_random_uuid(),
  target_auth_user_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  performed_by uuid not null,
  created_at timestamptz not null default now()
);
alter table public.admin_access_management_audit enable row level security;
revoke all on public.admin_access_management_audit from anon, authenticated;
grant all on public.admin_access_management_audit to service_role;

create index if not exists admin_access_management_audit_target_idx
  on public.admin_access_management_audit (target_auth_user_id, created_at desc);
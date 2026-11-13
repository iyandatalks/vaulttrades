alter table public.member_ea_licensing_requests
  add column if not exists license_resource_name text,
  add column if not exists license_resource_url text,
  add column if not exists license_assigned_at timestamptz,
  add column if not exists license_assigned_by uuid references auth.users(id);

create table if not exists public.member_knowledge_resources (
  id uuid primary key default gen_random_uuid(),
  section_id text not null,
  title text not null,
  description text,
  resource_kind text not null default 'External link',
  resource_url text not null,
  plan_codes text[] not null default '{}',
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_knowledge_resources_title_len check (char_length(btrim(title)) between 2 and 140),
  constraint member_knowledge_resources_url_https check (resource_url ~* '^https://')
);
create index if not exists member_knowledge_resources_section_idx
  on public.member_knowledge_resources(section_id, is_published, sort_order, created_at);

create table if not exists public.member_community_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  meeting_url text not null,
  is_published boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_community_events_time_check check (ends_at > starts_at),
  constraint member_community_events_url_https check (meeting_url ~* '^https://')
);
create index if not exists member_community_events_month_idx
  on public.member_community_events(starts_at, is_published);

create table if not exists public.member_portal_settings (
  setting_key text primary key,
  setting_value text not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
insert into public.member_portal_settings(setting_key,setting_value)
values ('admin_whatsapp_number','27746653633')
on conflict (setting_key) do nothing;

alter table public.member_knowledge_resources enable row level security;
alter table public.member_community_events enable row level security;
alter table public.member_portal_settings enable row level security;

revoke all on public.member_knowledge_resources, public.member_community_events, public.member_portal_settings from anon, authenticated;
grant all on public.member_knowledge_resources, public.member_community_events, public.member_portal_settings to service_role;
grant select, update on public.member_ea_licensing_requests to service_role;

create table if not exists public.admin_inbox_notifications (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  title text not null,
  body text not null,
  severity text not null default 'normal' check (severity in ('normal','warning','critical')),
  auth_user_id uuid null,
  customer_email text null,
  related_id uuid null,
  action_href text not null default '/admin/copy-support',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz null
);

alter table public.admin_inbox_notifications enable row level security;
revoke all on public.admin_inbox_notifications from anon, authenticated;
grant all on public.admin_inbox_notifications to service_role;

create index if not exists admin_inbox_notifications_created_at_idx
  on public.admin_inbox_notifications(created_at desc);
create index if not exists admin_inbox_notifications_unread_idx
  on public.admin_inbox_notifications(read_at) where read_at is null;

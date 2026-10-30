create table if not exists public.admin_analyzer_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_secret text not null,
  user_agent text,
  device_label text not null default 'Android Chrome',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz,
  last_error_at timestamptz
);

create index if not exists admin_analyzer_push_subscriptions_user_idx
  on public.admin_analyzer_push_subscriptions(auth_user_id, enabled);

alter table public.admin_analyzer_push_subscriptions enable row level security;
revoke all on public.admin_analyzer_push_subscriptions from anon, authenticated, public;
grant all on public.admin_analyzer_push_subscriptions to service_role;

create table if not exists public.admin_analyzer_push_events (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null unique,
  strategy_id text not null,
  symbol text not null,
  timeframe text not null,
  direction text not null check (direction in ('BUY','SELL','NO TRADE')),
  entry numeric,
  stop_loss numeric,
  take_profit numeric,
  title text not null,
  body text not null,
  delivery_status text not null default 'queued' check (delivery_status in ('queued','sent','failed','skipped')),
  delivery_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists admin_analyzer_push_events_user_created_idx
  on public.admin_analyzer_push_events(auth_user_id, created_at desc);

alter table public.admin_analyzer_push_events enable row level security;
revoke all on public.admin_analyzer_push_events from anon, authenticated, public;
grant all on public.admin_analyzer_push_events to service_role;

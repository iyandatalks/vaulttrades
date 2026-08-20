create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('paypal', 'yoco')),
  event_id text not null,
  event_type text not null,
  processed_at timestamptz not null default now()
);

create unique index if not exists webhook_events_provider_event_idx
  on public.webhook_events(provider, event_id);

alter table public.webhook_events enable row level security;

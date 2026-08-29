create schema if not exists scanner_automation;

revoke all on schema scanner_automation from public, anon, authenticated;
grant usage on schema scanner_automation to service_role;

create table if not exists scanner_automation.configs (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  observe_mode boolean not null default true,
  forex_enabled boolean not null default true,
  crypto_enabled boolean not null default true,
  enabled_strategies text[] not null default '{}'::text[],
  trade_time_start time not null default '01:30:00',
  trade_time_end time not null default '08:45:00',
  timezone text not null default 'Africa/Johannesburg',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scanner_automation_configs_time_order check (trade_time_start < trade_time_end)
);

create table if not exists scanner_automation.runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique,
  execution_identity text not null default 'vaulttrades-scheduled-scanner',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'RUNNING',
  markets_evaluated integer not null default 0,
  strategies_evaluated integer not null default 0,
  signals_detected integer not null default 0,
  signals_published integer not null default 0,
  duplicate_signals integer not null default 0,
  observe_only boolean not null default true,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  constraint scanner_automation_runs_status_check check (status in ('RUNNING','COMPLETED','FAILED','SKIPPED'))
);

create index if not exists scanner_automation_runs_started_at_idx on scanner_automation.runs (started_at desc);
create index if not exists scanner_automation_configs_enabled_idx on scanner_automation.configs (enabled) where enabled = true;

alter table scanner_automation.configs enable row level security;
alter table scanner_automation.runs enable row level security;

revoke all on table scanner_automation.configs, scanner_automation.runs from public, anon, authenticated;
grant select, insert, update, delete on table scanner_automation.configs to service_role;
grant select, insert, update on table scanner_automation.runs to service_role;

create policy scanner_automation_configs_service_only on scanner_automation.configs
  for all to service_role using (true) with check (true);

create policy scanner_automation_runs_service_only on scanner_automation.runs
  for all to service_role using (true) with check (true);

create or replace function scanner_automation.touch_config_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function scanner_automation.touch_config_updated_at() from public, anon, authenticated;

drop trigger if exists scanner_automation_configs_updated_at on scanner_automation.configs;
create trigger scanner_automation_configs_updated_at
before update on scanner_automation.configs
for each row execute function scanner_automation.touch_config_updated_at();

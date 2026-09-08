alter table public.automated_trader_execution_queue
  add column if not exists auth_user_id uuid,
  add column if not exists execution_mode text not null default 'OBSERVE',
  add column if not exists claimed_by text;

update public.automated_trader_execution_queue
set
  auth_user_id = coalesce(auth_user_id, nullif(payload->>'auth_user_id', '')::uuid),
  execution_mode = coalesce(nullif(payload->>'execution_mode', ''), execution_mode, 'OBSERVE');

alter table public.automated_trader_execution_queue
  alter column auth_user_id set not null;

alter table public.automated_trader_execution_queue
  add constraint automated_trader_execution_queue_execution_mode_check
  check (execution_mode in ('OBSERVE', 'LIVE'));

create index if not exists idx_automated_trader_execution_queue_claim
  on public.automated_trader_execution_queue (auth_user_id, execution_mode, status, created_at);

create or replace function public.claim_mt5_execution_job(
  p_user_id uuid,
  p_worker_id text,
  p_execution_mode text default 'LIVE'
)
returns setof public.automated_trader_execution_queue
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_execution_mode not in ('OBSERVE', 'LIVE') then
    raise exception 'Invalid execution mode';
  end if;

  select q.id
    into v_id
  from public.automated_trader_execution_queue q
  where q.auth_user_id = p_user_id
    and q.execution_mode = p_execution_mode
    and q.status = 'queued'
  order by q.created_at asc
  for update skip locked
  limit 1;

  if v_id is null then
    return;
  end if;

  return query
  update public.automated_trader_execution_queue q
  set status = 'claimed',
      claimed_at = now(),
      claimed_by = p_worker_id
  where q.id = v_id
  returning q.*;
end;
$$;

grant execute on function public.claim_mt5_execution_job(uuid, text, text) to service_role;

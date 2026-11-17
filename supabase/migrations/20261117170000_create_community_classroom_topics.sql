create table if not exists public.community_classroom_topics (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 2 and 140),
  content text not null default '',
  youtube_url text,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_classroom_topics_published_order_idx
  on public.community_classroom_topics (is_published, sort_order, created_at);

alter table public.community_classroom_topics enable row level security;
revoke all on public.community_classroom_topics from anon, authenticated;
grant all on public.community_classroom_topics to service_role;

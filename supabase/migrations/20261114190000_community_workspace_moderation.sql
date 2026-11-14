-- Community comments are moderated through the server-side Community API.
-- Existing community tables (announcements, discussion posts and member names)
-- are also accessed only through the service-role API.

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_discussion_posts(id) on delete cascade,
  auth_user_id uuid not null,
  display_name text not null,
  body text not null check (char_length(btrim(body)) between 1 and 3000),
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_comments_post_idx
  on public.community_comments(post_id, moderation_status, created_at);

alter table public.community_comments enable row level security;

revoke all on public.community_comments,
  public.community_announcements,
  public.community_discussion_posts,
  public.community_member_names
  from anon, authenticated, public;

grant all on public.community_comments,
  public.community_announcements,
  public.community_discussion_posts,
  public.community_member_names
  to service_role;

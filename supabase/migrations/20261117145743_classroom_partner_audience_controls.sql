alter table public.community_classroom_topics
  add column if not exists audience_type text not null default 'all_approved'
    check (audience_type in ('all_approved','all_partners','selected_partners')),
  add column if not exists allowed_auth_user_ids uuid[] not null default '{}';

create index if not exists community_classroom_topics_audience_type_idx
  on public.community_classroom_topics (audience_type, is_published);

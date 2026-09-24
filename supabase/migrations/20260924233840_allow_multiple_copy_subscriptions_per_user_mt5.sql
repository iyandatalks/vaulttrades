drop index if exists public.copy_followers_auth_user_unique_idx;

create unique index if not exists copy_followers_user_mt5_unique_idx
  on public.copy_followers(auth_user_id, mt_login)
  where mt_login is not null;
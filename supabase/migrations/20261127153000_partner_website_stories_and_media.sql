alter table public.member_website_requests
  add column if not exists story_title text,
  add column if not exists story_body text,
  add column if not exists story_image_url text,
  add column if not exists story_updated_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('partner-website-media', 'partner-website-media', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

update public.member_website_requests
set story_title = 'My journey started with a lesson in experience.',
    story_body = 'I entered trading believing it could create a different future. Like many people who begin without enough experience, I made mistakes, lost money and became discouraged. I also explored other business opportunities, but found that many depended heavily on selling without giving me a clear structure to build around.

Over time, I came to see that trading and digital business both require more than excitement. They need a process: learning, planning, risk awareness, disciplined execution and honest review. That is the thinking behind the VaultTrades ecosystem.

This opportunity is about giving people a structured way to explore trading, digital tools and a business pathway—then decide for themselves whether it fits their goals and circumstances.',
    story_image_url = '/images/VaultTrades_Merchandise_picture.png',
    story_updated_at = now(),
    updated_at = now()
where lower(assigned_domain) = 'makemoneyonline.vaulttradesve.com'
  and story_body is null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'member-ea-downloads',
  'member-ea-downloads',
  false,
  20971520,
  array['application/octet-stream', 'application/zip', 'application/x-zip-compressed']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.member_website_requests
  add column if not exists general_contact_whatsapp text;

update public.member_website_requests
set general_contact_whatsapp = '0630687676',
    updated_at = now()
where user_id = 'ea2e5171-ac5d-42d8-ad5c-8a035fa9488e'
  and lower(assigned_domain) = 'makemoneyonline.vaulttradesve.com';
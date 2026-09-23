-- Founders Mentorship becomes the once-off second customer product.
-- The shared customer tools (Journal, AI Coach and Funded Account Wealth Builder)
-- are granted in application access whenever any paid product entitlement is active.

alter table public.user_feature_access
  drop constraint if exists user_feature_access_feature_code_check;

alter table public.user_feature_access
  add constraint user_feature_access_feature_code_check
  check (
    feature_code = any (
      array[
        'analyzer'::text,
        'referral'::text,
        'signals'::text,
        'targetjournal'::text,
        'indicator'::text,
        'automation'::text,
        'ai_coach'::text,
        'founder_dashboard'::text,
        'founders_mentorship'::text
      ]
    )
  );

insert into public.products (
  code,
  name,
  is_active,
  price_usd,
  created_at,
  updated_at,
  billing_mode,
  entitlements,
  duration_months
) values (
  'founders_mentorship_once',
  'Founders Mentorship',
  true,
  53.00,
  now(),
  now(),
  'once_off',
  '["founders_mentorship"]'::jsonb,
  null
)
on conflict (code) do update set
  name = excluded.name,
  is_active = true,
  price_usd = excluded.price_usd,
  billing_mode = excluded.billing_mode,
  entitlements = excluded.entitlements,
  duration_months = excluded.duration_months,
  updated_at = now();

update public.products
set name = 'Copy Trading',
    updated_at = now()
where code = 'automated_trader_monthly';

insert into public.product_bundle_map (
  purchased_product_code,
  entitlement_code,
  created_at
) values (
  'founders_mentorship_once',
  'founders_mentorship',
  now()
)
on conflict do nothing;

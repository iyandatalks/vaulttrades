create unique index if not exists referral_commissions_subscription_id_uidx on public.referral_commissions(subscription_id) where subscription_id is not null;

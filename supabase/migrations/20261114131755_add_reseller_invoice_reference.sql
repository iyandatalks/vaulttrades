alter table public.reseller_purchase_orders
  add column if not exists reseller_invoice_number text null;

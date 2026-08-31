import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const [{ data: subscription }, { data: accounts }, { data: product }] = await Promise.all([
    admin.from("automated_trader_subscriptions").select("id,status,provider,provider_subscription_id,current_period_start,current_period_end,cancel_at_period_end").eq("auth_user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("automated_trader_accounts").select("id,metakit_account_id,account_name,mt_login,broker_name,broker_server,account_type,status,balance,equity,currency,last_sync_at,is_execution_account").eq("auth_user_id", user.id).order("created_at", { ascending: false }),
    admin.from("products").select("code,name,price_usd,billing_mode,duration_months,is_active").eq("code", "automated_trader_m15").maybeSingle(),
  ]);

  const active = subscription?.status === "active" && (!subscription.current_period_end || new Date(subscription.current_period_end).getTime() > Date.now());
  return NextResponse.json({ active, subscription: subscription ?? null, accounts: accounts ?? [], product: product ?? null, paymentConfigured: Boolean(process.env.PAYPAL_AUTOMATED_TRADER_PLAN_ID) });
}

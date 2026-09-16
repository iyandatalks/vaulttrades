import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { paypalRequest } from "../../../../lib/paypal";
import { getPayPalProduct } from "../../../../lib/paypal-products";

const RETURN_BASE = "https://vaulttrades.vercel.app/automated-trader";
const PRODUCT = getPayPalProduct("automated_trader_monthly")!;

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "You must be logged in." }, { status: 401 });

    const admin = createAdminClient();
    const { data: profile } = await admin.from("users").select("id,email").eq("auth_user_id", user.id).maybeSingle();
    if (!profile) return NextResponse.json({ error: "VaultTrades profile was not found." }, { status: 400 });

    const result = await paypalRequest("/v1/billing/subscriptions", {
      method: "POST",
      headers: { "PayPal-Request-Id": `vaulttrades-auto-${user.id}-${Date.now()}` },
      body: JSON.stringify({
        plan_id: PRODUCT.planId,
        custom_id: user.id,
        application_context: {
          brand_name: "VaultTrades",
          user_action: "SUBSCRIBE_NOW",
          return_url: `${RETURN_BASE}?payment=success`,
          cancel_url: `${RETURN_BASE}?payment=cancelled`,
        },
      }),
    });

    const approvalUrl = result.links?.find((link: any) => link.rel === "approve")?.href;
    if (!approvalUrl) return NextResponse.json({ error: "Unable to start secure checkout. Please contact VaultTrades support." }, { status: 502 });

    const now = new Date();
    const end = new Date(now);
    end.setMonth(end.getMonth() + 1);
    await admin.from("automated_trader_subscriptions").upsert({
      auth_user_id: user.id,
      product_code: PRODUCT.code,
      status: "pending",
      provider: "paypal",
      provider_subscription_id: String(result.id),
      current_period_start: now.toISOString(),
      current_period_end: end.toISOString(),
      last_provider_event: "CHECKOUT.CREATED",
      updated_at: now.toISOString(),
    }, { onConflict: "provider,provider_subscription_id" });

    await admin.from("product_licenses").upsert({
      user_id: profile.id,
      email: profile.email,
      purchased_product_code: PRODUCT.code,
      entitlement_code: PRODUCT.entitlement,
      status: "pending",
      payment_reference: String(result.id),
      start_at: now.toISOString(),
      end_at: end.toISOString(),
      platform: "mt5",
      source_payment_snapshot: { provider: "paypal", plan_id: PRODUCT.planId, subscription_id: String(result.id), product_code: PRODUCT.code, amount: PRODUCT.price, currency: "USD" },
      updated_at: now.toISOString(),
    }, { onConflict: "payment_reference,entitlement_code" });

    return NextResponse.json({ subscriptionId: result.id, approveUrl: approvalUrl, product: { code: PRODUCT.code, name: PRODUCT.name, price: PRODUCT.price } });
  } catch (error) {
    console.error("Automated Trader PayPal subscription error", error);
    return NextResponse.json({ error: "Unable to start secure checkout. Please contact VaultTrades support." }, { status: 500 });
  }
}

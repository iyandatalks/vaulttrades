import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { paypalRequest } from "../../../../lib/paypal";

const RETURN_BASE = "https://vaulttrades.vercel.app/automated-trader";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "You must be logged in." }, { status: 401 });

    const planId = process.env.PAYPAL_AUTOMATED_TRADER_PLAN_ID;
    if (!planId) return NextResponse.json({ error: "Automated Trader billing is not configured yet. The PayPal recurring plan ID must be added by the administrator." }, { status: 503 });

    const admin = createAdminClient();
    const { data: profile } = await admin.from("users").select("id,email").eq("auth_user_id", user.id).maybeSingle();
    if (!profile) return NextResponse.json({ error: "VaultTrades profile was not found." }, { status: 400 });

    const result = await paypalRequest("/v1/billing/subscriptions", {
      method: "POST",
      headers: { "PayPal-Request-Id": `vaulttrades-auto-${user.id}-${Date.now()}` },
      body: JSON.stringify({
        plan_id: planId,
        custom_id: user.id,
        application_context: {
          brand_name: "VaultTrades",
          user_action: "SUBSCRIBE_NOW",
          return_url: `${RETURN_BASE}?payment=success`,
          cancel_url: `${RETURN_BASE}?payment=cancelled`
        }
      })
    });

    const approvalUrl = result.links?.find((link: any) => link.rel === "approve")?.href;
    if (!approvalUrl) return NextResponse.json({ error: "PayPal did not return an approval URL." }, { status: 502 });

    await admin.from("automated_trader_subscriptions").upsert({
      auth_user_id: user.id,
      status: "pending",
      provider: "paypal",
      provider_subscription_id: String(result.id),
      last_provider_event: "CHECKOUT.CREATED",
      updated_at: new Date().toISOString()
    }, { onConflict: "provider,provider_subscription_id" });

    return NextResponse.json({ subscriptionId: result.id, approveUrl: approvalUrl });
  } catch (error) {
    console.error("Automated Trader PayPal subscription error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to start Automated Trader subscription." }, { status: 500 });
  }
}

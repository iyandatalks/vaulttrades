import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { paypalRequest } from "../../../../lib/paypal";
import { getPayPalProduct } from "../../../../lib/paypal-products";

const BASE_URL = "https://vaulttrades.vercel.app";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "You must be logged in before starting payment." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const productCode = String(body?.productCode || "analyzer_monthly");
    const product = getPayPalProduct(productCode);
    if (!product) return NextResponse.json({ error: "Invalid VaultTrades product." }, { status: 400 });
    if (product.billingMode === "once_off") {
      return NextResponse.json({ error: "This product uses its PayPal one-off payment link." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin.from("users").select("id,email").eq("auth_user_id", user.id).maybeSingle();
    if (profileError || !profile) return NextResponse.json({ error: "VaultTrades profile was not found." }, { status: 400 });

    const result = await paypalRequest("/v1/billing/subscriptions", {
      method: "POST",
      headers: { "PayPal-Request-Id": `vaulttrades-${product.code}-${user.id}-${Date.now()}` },
      body: JSON.stringify({
        plan_id: product.planId,
        custom_id: user.id,
        application_context: {
          brand_name: "VaultTrades",
          user_action: "SUBSCRIBE_NOW",
          return_url: `${BASE_URL}${product.returnPath}`,
          cancel_url: `${BASE_URL}/subscription?product=${encodeURIComponent(product.code)}&payment=cancelled`,
        },
      }),
    });

    const approve = result.links?.find((link: any) => link.rel === "approve")?.href;
    if (!approve) return NextResponse.json({ error: "PayPal did not return an approval URL." }, { status: 502 });

    const now = new Date();
    const end = new Date(now);
    end.setMonth(end.getMonth() + 1);
    const { error: licenseError } = await admin.from("product_licenses").upsert({
      user_id: profile.id,
      email: profile.email,
      purchased_product_code: product.code,
      entitlement_code: product.entitlement,
      status: "pending",
      payment_reference: String(result.id),
      start_at: now.toISOString(),
      end_at: end.toISOString(),
      platform: product.entitlement === "automation" ? "mt5" : "web",
      source_payment_snapshot: { provider: "paypal", plan_id: product.planId, subscription_id: String(result.id), product_code: product.code, amount: product.price, currency: "USD" },
      updated_at: now.toISOString(),
    }, { onConflict: "payment_reference,entitlement_code" });
    if (licenseError) {
      console.error("Unable to create pending VaultTrades product license", licenseError);
      return NextResponse.json({ error: "Unable to prepare your VaultTrades subscription." }, { status: 500 });
    }

    return NextResponse.json({ subscriptionId: result.id, approveUrl: approve, product: { code: product.code, name: product.name, price: product.price, entitlement: product.entitlement } });
  } catch (error) {
    console.error("PayPal create-subscription error", error);
    return NextResponse.json({ error: "Unable to start PayPal subscription." }, { status: 500 });
  }
}

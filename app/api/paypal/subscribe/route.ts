import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { paypalRequest } from "../../../../lib/paypal";
import { getPayPalProduct } from "../../../../lib/paypal-products";
import { COPY_TRADING_ENTITLEMENT } from "../../../../lib/copy-access";
import { validateReferralDiscount, getOrCreateReferralPayPalPlan } from "../../../../lib/referral-discount";

const BASE_URL = "https://vaulttradesve.com";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "You must be logged in." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const productCode = String(body?.productCode || "");
    const referralCode = String(body?.referralCode || "").trim().toUpperCase();
    const product = getPayPalProduct(productCode);
    if (!product) return NextResponse.json({ error: "Invalid VaultTrades product." }, { status: 400 });

    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("users")
      .select("id,email")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: "VaultTrades profile was not found." }, { status: 400 });
    }

    const email = String(user.email || profile.email || "").trim().toLowerCase();
    let mt5Login = "";
    let referralDiscount: Awaited<ReturnType<typeof validateReferralDiscount>> | null = null;
    let paypalPlanId = product.planId;

    if (referralCode) {
      referralDiscount = await validateReferralDiscount({ userId: user.id, productCode: product.code, code: referralCode });
      paypalPlanId = await getOrCreateReferralPayPalPlan({
        campaignId: referralDiscount.campaignId,
        productCode: product.code,
        basePlanId: product.planId,
        originalPrice: referralDiscount.originalPrice,
        discountedPrice: referralDiscount.discountedPrice,
      });
    }

    if (product.code === "automated_trader_monthly") {
      mt5Login = String(body?.mt5Login || "").trim();

      if (!/^\d{4,12}$/.test(mt5Login)) {
        return NextResponse.json({
          error: "MT5_ID_REQUIRED",
          message: "Enter your MT5 account ID before purchasing Copy Trading.",
        }, { status: 400 });
      }

      if (!email) {
        return NextResponse.json({
          error: "EMAIL_REQUIRED",
          message: "Your VaultTrades account must have an email address before purchasing Copy Trading.",
        }, { status: 400 });
      }

      const { data: existingActiveLicense } = await admin
        .from("product_licenses")
        .select("id,start_at,end_at,status,mt_login")
        .eq("user_id", profile.id)
        .eq("entitlement_code", COPY_TRADING_ENTITLEMENT)
        .eq("mt_login", mt5Login)
        .eq("status", "active")
        .order("end_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingActiveLicense?.end_at && new Date(existingActiveLicense.end_at).getTime() > Date.now()) {
        return NextResponse.json({
          error: "COPY_SUBSCRIPTION_ALREADY_ACTIVE",
          message: "This MT5 account already has an active VaultTrades Copy Trading subscription. Use that subscription or purchase a separate subscription for another MT5 account.",
        }, { status: 409 });
      }
    }

    const result = await paypalRequest("/v1/billing/subscriptions", {
      method: "POST",
      headers: { "PayPal-Request-Id": `vaulttrades-${product.code}-${user.id}-${Date.now()}` },
      body: JSON.stringify({
        plan_id: paypalPlanId,
        custom_id: user.id,
        application_context: {
          brand_name: "VaultTrades",
          user_action: "SUBSCRIBE_NOW",
          return_url: `${BASE_URL}${product.returnPath}`,
          cancel_url: `${BASE_URL}/subscription?product=${encodeURIComponent(product.code)}&payment=cancelled`,
        },
      }),
    });

    const approvalUrl = result.links?.find((link: any) => link.rel === "approve")?.href;
    if (!approvalUrl) {
      return NextResponse.json({ error: "Unable to start secure checkout. Please contact VaultTrades support." }, { status: 502 });
    }

    if (product.code === "automated_trader_monthly") {
      const { error: registrationError } = await admin
        .from("copy_customer_registrations")
        .upsert({
          auth_user_id: user.id,
          email,
          mt5_login: mt5Login,
          updated_at: new Date().toISOString(),
        }, { onConflict: "auth_user_id,mt5_login" });

      if (registrationError) {
        return NextResponse.json({
          error: "MT5_REGISTRATION_FAILED",
          message: "Unable to save your MT5 account details. Please try again.",
        }, { status: 500 });
      }
    }

    const now = new Date();
    const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (referralDiscount) {
      await admin.from("referral_discount_redemptions").insert({
        discount_code_id: referralDiscount.campaignId,
        customer_user_id: profile.id,
        referrer_user_id: (await admin.from("users").select("id").eq("referral_code", referralDiscount.referrerCode).maybeSingle()).data?.id ?? null,
        product_code: product.code,
        paypal_subscription_id: String(result.id),
        original_price: referralDiscount.originalPrice,
        discount_percent: referralDiscount.discountPercent,
        discounted_price: referralDiscount.discountedPrice,
        discount_cycles: referralDiscount.discountCycles,
        status: "pending",
        updated_at: new Date().toISOString()
      });
    }

    await admin.from("product_licenses").upsert({
      user_id: profile.id,
      email,
      purchased_product_code: product.code,
      entitlement_code: product.entitlement,
      status: "pending",
      payment_reference: String(result.id),
      start_at: now.toISOString(),
      end_at: end.toISOString(),
      mt_login: product.code === "automated_trader_monthly" ? mt5Login : null,
      platform: product.code === "automated_trader_monthly" ? "mt5" : "web",
      source_payment_snapshot: {
        provider: "paypal",
        plan_id: paypalPlanId,
        base_plan_id: product.planId,
        subscription_id: String(result.id),
        product_code: product.code,
        amount: referralDiscount?.discountedPrice ?? product.price,
        original_amount: product.price,
        discount_code: referralDiscount?.code ?? null,
        discount_percent: referralDiscount?.discountPercent ?? 0,
        discount_cycles: referralDiscount?.discountCycles ?? 0,
        referrer_code: referralDiscount?.referrerCode ?? null,
        currency: "USD",
        mt5_login: product.code === "automated_trader_monthly" ? mt5Login : undefined,
        entitlement_code: product.entitlement,
      },
      updated_at: now.toISOString(),
    }, { onConflict: "payment_reference" });

    return NextResponse.json({
      subscriptionId: result.id,
      approveUrl: approvalUrl,
      product: { code: product.code, name: product.name, price: product.price },
      discount: referralDiscount ? { code: referralDiscount.code, originalPrice: referralDiscount.originalPrice, discountPercent: referralDiscount.discountPercent, discountedPrice: referralDiscount.discountedPrice, discountCycles: referralDiscount.discountCycles } : null,
      mt5Login: product.code === "automated_trader_monthly" ? mt5Login : null,
    });
  } catch (error) {
    console.error("VaultTrades PayPal subscription error", error);
    return NextResponse.json({ error: "Unable to start secure checkout. Please contact VaultTrades support." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server";
import { createAdminClient } from "../../../../../lib/supabase/admin";
import { validateReferralDiscount } from "../../../../../lib/referral-discount";
import { getPayPalProduct } from "../../../../../lib/paypal-products";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "You must be logged in." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const productCode = String(body?.productCode || "");
    const code = String(body?.code || "").trim().toUpperCase();
    const discount = await validateReferralDiscount({ userId: user.id, productCode, code });
    const product = getPayPalProduct(productCode);
    if (!product?.referralPaymentUrl) {
      return NextResponse.json({ error: "The discounted payment link is not configured for this product." }, { status: 500 });
    }

    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("users")
      .select("id,email")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: "VaultTrades profile was not found." }, { status: 400 });
    }

    const referrer = await admin
      .from("users")
      .select("id")
      .eq("referral_code", discount.referrerCode)
      .maybeSingle();

    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: existingPending } = await admin
      .from("referral_discount_redemptions")
      .select("id")
      .eq("customer_user_id", profile.id)
      .eq("product_code", productCode)
      .eq("status", "pending")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingPending?.id) {
      await admin.from("referral_discount_redemptions").update({
        discount_code_id: discount.campaignId,
        referrer_user_id: referrer.data?.id ?? null,
        original_price: discount.originalPrice,
        discount_percent: discount.discountPercent,
        discounted_price: discount.discountedPrice,
        discount_cycles: discount.discountCycles,
        updated_at: new Date().toISOString(),
      }).eq("id", existingPending.id);
    } else {
      await admin.from("referral_discount_redemptions").insert({
        discount_code_id: discount.campaignId,
        customer_user_id: profile.id,
        referrer_user_id: referrer.data?.id ?? null,
        product_code: productCode,
        paypal_subscription_id: null,
        original_price: discount.originalPrice,
        discount_percent: discount.discountPercent,
        discounted_price: discount.discountedPrice,
        discount_cycles: discount.discountCycles,
        status: "pending",
        updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      valid: true,
      paymentUrl: product.referralPaymentUrl,
      discount,
    });
  } catch (error) {
    console.error("VaultTrades referral payment preparation error", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unable to prepare the discounted payment."
    }, { status: 400 });
  }
}

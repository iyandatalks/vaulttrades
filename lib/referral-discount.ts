import { createAdminClient } from "./supabase/admin";
import { getPayPalProduct } from "./paypal-products";
import { paypalRequest } from "./paypal";

export const VAULT50_CODE = "VAULT50";
export const VAULT50_DISCOUNT_PERCENT = 50;
export const VAULT50_CYCLES = 6;

export async function validateReferralDiscount(params: {
  userId: string;
  productCode: string;
  code: string;
}) {
  const code = params.code.trim().toUpperCase();
  const product = getPayPalProduct(params.productCode);
  if (!product) throw new Error("Invalid VaultTrades product.");
  if (product.billingMode !== "monthly") throw new Error("This discount is only available on monthly VaultTrades subscriptions.");

  const admin = createAdminClient();
  const { data: campaign } = await admin
    .from("referral_discount_codes")
    .select("*")
    .eq("code", code)
    .eq("active", true)
    .maybeSingle();

  if (!campaign) throw new Error("Invalid or inactive referral discount code.");
  if (campaign.expires_at && new Date(campaign.expires_at).getTime() <= Date.now()) throw new Error("This referral discount has expired.");
  if (campaign.starts_at && new Date(campaign.starts_at).getTime() > Date.now()) throw new Error("This referral discount is not active yet.");
  if (!(campaign.eligible_product_codes || []).includes(product.code)) throw new Error("This discount is not available for the selected product.");

  const { data: customer } = await admin
    .from("users")
    .select("id,email,referred_by,role")
    .eq("auth_user_id", params.userId)
    .maybeSingle();

  if (!customer) throw new Error("VaultTrades profile was not found.");
  if (customer.referred_by) {
    const { data: referrer } = await admin
      .from("users")
      .select("id,email,referral_code,role")
      .eq("referral_code", String(customer.referred_by).toUpperCase())
      .maybeSingle();
    if (!referrer || referrer.id === customer.id) throw new Error("Your referral link is not valid.");
  } else {
    throw new Error("This offer requires you to sign up through a valid VaultTrades referral link first.");
  }

  if (campaign.new_customers_only) {
    const { data: existingLicense } = await admin
      .from("product_licenses")
      .select("id,status,end_at")
      .eq("user_id", customer.id)
      .eq("entitlement_code", product.entitlement)
      .in("status", ["active","pending"])
      .limit(1)
      .maybeSingle();
    if (existingLicense) throw new Error("This referral discount is for new customers and cannot be applied to an existing subscription.");
  }

  const originalPrice = Number(product.price);
  const discountedPrice = Number((originalPrice * (1 - Number(campaign.discount_percent) / 100)).toFixed(2));

  return {
    campaignId: campaign.id,
    code: campaign.code,
    productCode: product.code,
    productName: product.name,
    originalPrice,
    discountPercent: Number(campaign.discount_percent),
    discountAmount: Number((originalPrice - discountedPrice).toFixed(2)),
    discountedPrice,
    discountCycles: Number(campaign.discount_cycles),
    currency: "USD",
    referrerCode: String(customer.referred_by).toUpperCase(),
  };
}

export async function getOrCreateReferralPayPalPlan(params: {
  campaignId: string;
  productCode: string;
  basePlanId: string;
  originalPrice: number;
  discountedPrice: number;
}) {
  const admin = createAdminClient();
  const existing = await admin
    .from("referral_discount_plans")
    .select("paypal_plan_id")
    .eq("discount_code_id", params.campaignId)
    .eq("product_code", params.productCode)
    .maybeSingle();

  if (existing.data?.paypal_plan_id) return existing.data.paypal_plan_id;

  const basePlan = await paypalRequest(`/v1/billing/plans/${encodeURIComponent(params.basePlanId)}`, { method: "GET" });
  const productId = String(basePlan.product_id || "");
  if (!productId) throw new Error("The existing PayPal plan does not expose a product ID.");

  const created = await paypalRequest("/v1/billing/plans", {
    method: "POST",
    headers: { "PayPal-Request-Id": `vaulttrades-vault50-${params.productCode}` },
    body: JSON.stringify({
      product_id: productId,
      name: `VaultTrades VAULT50 - ${params.productCode}`,
      description: "VaultTrades referral subscription: 50% off for the first 6 monthly billing cycles, then regular pricing.",
      billing_cycles: [
        {
          frequency: { interval_unit: "MONTH", interval_count: 1 },
          tenure_type: "TRIAL",
          sequence: 1,
          total_cycles: 6,
          pricing_scheme: { fixed_price: { value: params.discountedPrice.toFixed(2), currency_code: "USD" } }
        },
        {
          frequency: { interval_unit: "MONTH", interval_count: 1 },
          tenure_type: "REGULAR",
          sequence: 2,
          total_cycles: 0,
          pricing_scheme: { fixed_price: { value: params.originalPrice.toFixed(2), currency_code: "USD" } }
        }
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        payment_failure_threshold: 1
      }
    })
  });

  const planId = String(created.id || "");
  if (!planId) throw new Error("PayPal did not return the referral plan ID.");

  await admin.from("referral_discount_plans").upsert({
    discount_code_id: params.campaignId,
    product_code: params.productCode,
    paypal_plan_id: planId,
    original_price: params.originalPrice,
    discounted_price: params.discountedPrice,
    currency: "USD",
    updated_at: new Date().toISOString()
  }, { onConflict: "discount_code_id,product_code" });

  return planId;
}

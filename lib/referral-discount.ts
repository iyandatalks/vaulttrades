import { createAdminClient } from "./supabase/admin";
import { getPayPalProduct } from "./paypal-products";

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


export async function validateReferralDiscount(_params: {
  userId: string;
  productCode: string;
  code: string;
}) {
  throw new Error("Referral discounts are no longer offered. Qualifying referrals receive a standard 20% commission instead.");
}

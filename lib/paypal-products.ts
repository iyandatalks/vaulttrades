export type VaultTradesPayPalProduct = {
  code: "analyzer_monthly" | "automated_trader_monthly" | "founders_mentorship_once";
  name: string;
  price: number;
  planId: string;
  entitlement: "analyzer" | "automation" | "founders_mentorship";
  billingMode: "monthly" | "once_off";
  returnPath: string;
};

export const PAYPAL_PRODUCTS: Record<string, VaultTradesPayPalProduct> = {
  analyzer_monthly: {
    code: "analyzer_monthly",
    name: "Analyzer",
    price: 73.99,
    planId: "P-7SU27254MK962725RNGROPDQ",
    entitlement: "analyzer",
    billingMode: "monthly",
    returnPath: "/subscription/paypal/success?product=analyzer_monthly",
  },
  automated_trader_monthly: {
    code: "automated_trader_monthly",
    name: "Copy Trading",
    price: 99.99,
    planId: "P-0YR675118F424491GNJ7LAEQ",
    entitlement: "automation",
    billingMode: "monthly",
    returnPath: "/copy?payment=success",
  },
  founders_mentorship_once: {
    code: "founders_mentorship_once",
    name: "Founders Mentorship",
    price: 53.00,
    planId: "P-7PG440523L908841RNJ2GXQQ",
    entitlement: "founders_mentorship",
    billingMode: "once_off",
    returnPath: "/founders-mentorship/booking?payment=success",
  },
};

export function getPayPalProduct(code: string) {
  return PAYPAL_PRODUCTS[code] ?? null;
}

export function getPayPalProductByPlanId(planId: string) {
  return Object.values(PAYPAL_PRODUCTS).find((product) => product.planId === planId) ?? null;
}

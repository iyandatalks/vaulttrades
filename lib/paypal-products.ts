export type VaultTradesPayPalProduct = {
  code: "analyzer_monthly" | "automated_trader_monthly";
  name: string;
  price: number;
  planId: string;
  entitlement: "analyzer" | "automation";
  returnPath: string;
};

export const PAYPAL_PRODUCTS: Record<string, VaultTradesPayPalProduct> = {
  analyzer_monthly: {
    code: "analyzer_monthly",
    name: "Analyzer",
    price: 73.99,
    planId: "P-7SU27254MK962725RNGROPDQ",
    entitlement: "analyzer",
    returnPath: "/subscription/paypal/success?product=analyzer_monthly",
  },
  automated_trader_monthly: {
    code: "automated_trader_monthly",
    name: "Automated Trader",
    price: 99.99,
    planId: "P-0YR675118F424491GNJ7LAEQ",
    entitlement: "automation",
    returnPath: "/copy?payment=success",
  },
};

export function getPayPalProduct(code: string) {
  return PAYPAL_PRODUCTS[code] ?? null;
}

export function getPayPalProductByPlanId(planId: string) {
  return Object.values(PAYPAL_PRODUCTS).find((product) => product.planId === planId) ?? null;
}

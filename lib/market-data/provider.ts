export type MarketType = "FOREX" | "INDICES" | "CRYPTO" | "STOCKS" | "SYNTHETIC";

export type MarketDataProviderId = "TWELVE_DATA" | "SYNTHETIC_BROKER";

export type MarketProviderRoute = {
  marketType: MarketType;
  provider: MarketDataProviderId;
  available: boolean;
  reason?: string;
};

/**
 * Market selection is deliberately independent from strategy selection.
 * Strategy determines the evidence/indicators; market type determines which
 * data provider is allowed to supply the OHLCV stream.
 */
export function getMarketProviderRoute(marketType: MarketType): MarketProviderRoute {
  if (marketType === "SYNTHETIC") {
    return {
      marketType,
      provider: "SYNTHETIC_BROKER",
      available: false,
      reason: "Synthetic/Broker market data is not connected yet. Twelve Data is not used for synthetic indices.",
    };
  }

  return {
    marketType,
    provider: "TWELVE_DATA",
    available: true,
  };
}

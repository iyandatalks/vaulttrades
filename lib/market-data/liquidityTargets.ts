export type LiquidityCandle = {
  datetime?: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type LiquidityLevel = {
  price: number;
  side: "BUY_SIDE" | "SELL_SIDE";
  source: "CONFIRMED_SWING" | "EQUAL_HIGHS" | "EQUAL_LOWS";
  touches: number;
  pivotTime: string | null;
};

export type LiquidityTargets = {
  referencePrice: number;
  buySide: LiquidityLevel | null;
  sellSide: LiquidityLevel | null;
  definition: "CONFIRMED_SWING_LIQUIDITY_V1";
  pivotLength: number;
  lookback: number;
};

/**
 * Shared liquidity-target definition for all Analyzer strategies.
 *
 * Only confirmed pivots are eligible: a pivot must have pivotLength completed
 * candles on both sides. The last pivotLength candles are excluded from pivot
 * confirmation, so a forming swing cannot make the target jump intrabar.
 * Strategy-specific entry confirmation is intentionally not handled here.
 */
export function resolveLiquidityTargets(
  candles: LiquidityCandle[],
  currentPrice?: number | null,
  pivotLength = 3,
  lookback = 150,
): LiquidityTargets {
  const lastClose = candles.at(-1)?.close ?? null;
  const referencePrice = typeof currentPrice === "number" && Number.isFinite(currentPrice)
    ? currentPrice
    : lastClose ?? 0;
  const safePivotLength = Math.max(2, Math.floor(pivotLength));
  const safeLookback = Math.max(safePivotLength * 2 + 1, Math.floor(lookback));
  const start = Math.max(safePivotLength, candles.length - safeLookback);
  const end = candles.length - safePivotLength;
  const highs: Array<{ price: number; time: string | null }> = [];
  const lows: Array<{ price: number; time: string | null }> = [];

  for (let i = start; i < end; i++) {
    const candidate = candles[i];
    let isHigh = true;
    let isLow = true;
    for (let offset = 1; offset <= safePivotLength; offset++) {
      if (candidate.high <= candles[i - offset].high || candidate.high <= candles[i + offset].high) isHigh = false;
      if (candidate.low >= candles[i - offset].low || candidate.low >= candles[i + offset].low) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) highs.push({ price: candidate.high, time: candidate.datetime ?? null });
    if (isLow) lows.push({ price: candidate.low, time: candidate.datetime ?? null });
  }

  const buyCandidates = highs.filter(level => level.price > referencePrice).sort((a, b) => a.price - b.price);
  const sellCandidates = lows.filter(level => level.price < referencePrice).sort((a, b) => b.price - a.price);

  const clusterTolerance = (() => {
    const recent = candles.slice(-14);
    if (!recent.length) return Math.max(Math.abs(referencePrice) * 0.0001, 0.00001);
    const averageRange = recent.reduce((sum, c) => sum + Math.max(0, c.high - c.low), 0) / recent.length;
    return Math.max(averageRange * 0.08, Math.abs(referencePrice) * 0.00001, 0.000001);
  })();

  const toLevel = (
    candidates: Array<{ price: number; time: string | null }>,
    side: "BUY_SIDE" | "SELL_SIDE",
  ): LiquidityLevel | null => {
    const nearest = candidates[0];
    if (!nearest) return null;
    const touches = candidates.filter(level => Math.abs(level.price - nearest.price) <= clusterTolerance).length;
    const clustered = touches >= 2;
    return {
      price: nearest.price,
      side,
      source: clustered ? side === "BUY_SIDE" ? "EQUAL_HIGHS" : "EQUAL_LOWS" : "CONFIRMED_SWING",
      touches,
      pivotTime: nearest.time,
    };
  };

  return {
    referencePrice,
    buySide: toLevel(buyCandidates, "BUY_SIDE"),
    sellSide: toLevel(sellCandidates, "SELL_SIDE"),
    definition: "CONFIRMED_SWING_LIQUIDITY_V1",
    pivotLength: safePivotLength,
    lookback: safeLookback,
  };
}

export type LifecycleDirection = "BUY" | "SELL" | "NONE";
export type LifecycleStatus = "WATCH" | "ENTRY_ZONE" | "ACTIVE" | "TP1_HIT" | "SL_HIT" | "CYCLE_COMPLETE";

export const AB_FIB_ENTRY_PCTS = [82.0, 78.6, 68.1, 61.8] as const;

export interface LifecycleInput {
  direction: LifecycleDirection;
  currentPrice: number;
  projectedEntry: number | null;
  actualEntry: number | null;
  projectedStopLoss: number | null;
  projectedTp1: number | null;
  projectedTp2: number | null;
  projectedFinalTp: number | null;
  priorStatus?: LifecycleStatus | null;
  tp1AlreadyHit?: boolean;
  stopAlreadyHit?: boolean;
  cycleComplete?: boolean;
}

export interface LifecycleResult {
  status: LifecycleStatus;
  message: string;
  projectedEntry: number | null;
  actualEntry: number | null;
  projectedStopLoss: number | null;
  projectedTp1: number | null;
  projectedTp2: number | null;
  projectedFinalTp: number | null;
  tp1Hit: boolean;
  stopHit: boolean;
}

export function isAllowedAbFibPercentage(value: number): boolean {
  return AB_FIB_ENTRY_PCTS.some((pct) => Math.abs(pct - value) < 0.0001);
}

export function selectAllowedAbFibLevel(
  levels: Array<{ pct: number; price: number }>,
  direction: "BUY" | "SELL",
  currentPrice: number,
): { pct: number; price: number } | null {
  const allowed = levels
    .filter((level) => Number.isFinite(level.price) && isAllowedAbFibPercentage(level.pct))
    .sort((a, b) => b.pct - a.pct);
  if (!allowed.length) return null;

  // The projection is a strategy price, never the current price. Prefer the
  // closest eligible retracement that is still on the entry side of market.
  const candidates = direction === "BUY"
    ? allowed.filter((level) => level.price < currentPrice)
    : allowed.filter((level) => level.price > currentPrice);

  if (candidates.length) {
    return candidates.reduce((best, level) => {
      const bestDistance = Math.abs(best.price - currentPrice);
      const distance = Math.abs(level.price - currentPrice);
      return distance < bestDistance ? level : best;
    });
  }

  // If price has already crossed the permitted entry ladder, do not chase it.
  // Keep the final permitted level as the last projection only when it remains
  // a valid source level; callers must still decide whether the setup is stale.
  const finalLevel = allowed.find((level) => Math.abs(level.pct - 61.8) < 0.0001);
  return finalLevel ?? allowed[allowed.length - 1];
}

export function evaluateTradeLifecycle(input: LifecycleInput): LifecycleResult {
  const tp1Hit = Boolean(input.tp1AlreadyHit) || Boolean(
    input.projectedTp1 !== null &&
    (input.direction === "BUY" ? input.currentPrice >= input.projectedTp1 : input.currentPrice <= input.projectedTp1),
  );
  const stopHit = Boolean(input.stopAlreadyHit) || Boolean(
    input.projectedStopLoss !== null &&
    (input.direction === "BUY" ? input.currentPrice <= input.projectedStopLoss : input.currentPrice >= input.projectedStopLoss),
  );

  if (input.cycleComplete) {
    return { ...input, status: "CYCLE_COMPLETE", message: "CYCLE COMPLETE", tp1Hit, stopHit };
  }
  if (stopHit) {
    return { ...input, status: "SL_HIT", message: "STOP LOSS HIT — CYCLE COMPLETE", tp1Hit, stopHit };
  }
  if (tp1Hit && input.actualEntry !== null) {
    return { ...input, status: "TP1_HIT", message: `TP1 HIT — ${input.direction}`, tp1Hit, stopHit };
  }
  if (input.actualEntry !== null) {
    return { ...input, status: "ACTIVE", message: `MARKET IS ACTIVE — ${input.direction}`, tp1Hit, stopHit };
  }
  if (input.projectedEntry !== null) {
    const touched = input.direction === "BUY"
      ? input.currentPrice <= input.projectedEntry
      : input.currentPrice >= input.projectedEntry;
    return { ...input, status: touched ? "ENTRY_ZONE" : "WATCH", message: touched ? `${input.direction} — ENTRY ZONE` : `WATCH — ${input.direction}`, tp1Hit, stopHit };
  }
  return { ...input, status: "WATCH", message: "WATCH", tp1Hit, stopHit };
}

export type LifecycleDirection = "BUY" | "SELL" | "NONE";

export type LifecycleStatus = "WATCH" | "ENTRY_ZONE" | "ACTIVE" | "TP1_HIT" | "TP2_HIT" | "SL_HIT" | "INVALIDATED" | "CYCLE_COMPLETE";

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
  priorDirection?: LifecycleDirection | null;
  oppositeConfirmed?: boolean;
  tp1AlreadyHit?: boolean;
  tp2AlreadyHit?: boolean;
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
  tp2Hit: boolean;
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
  const candidates = direction === "BUY"
    ? allowed.filter((level) => level.price < currentPrice)
    : allowed.filter((level) => level.price > currentPrice);
  if (candidates.length) {
    return candidates.reduce((best, level) =>
      Math.abs(level.price - currentPrice) < Math.abs(best.price - currentPrice) ? level : best,
    );
  }
  return allowed.find((level) => Math.abs(level.pct - 61.8) < 0.0001) ?? allowed[allowed.length - 1];
}

/**
 * AUTHORITATIVE TRADE LIFECYCLE.
 * TP1-TP4 are projected/reference levels only.
 * A confirmed lifecycle ends only on actual SL or a confirmed opposite setup.
 */
export function evaluateTradeLifecycle(input: LifecycleInput): LifecycleResult {
  const stopHit = Boolean(input.stopAlreadyHit) || Boolean(
    input.actualEntry !== null && input.projectedStopLoss !== null &&
      (input.direction === "BUY" ? input.currentPrice <= input.projectedStopLoss : input.currentPrice >= input.projectedStopLoss),
  );

  const oppositeConfirmed = Boolean(input.oppositeConfirmed) &&
    input.priorDirection !== null && input.priorDirection !== undefined &&
    input.direction !== "NONE" && input.direction !== input.priorDirection;

  if (oppositeConfirmed) {
    return { ...input, status: "INVALIDATED", message: `${input.priorDirection} INVALIDATED — CONFIRMED OPPOSITE ${input.direction} SETUP`, tp1Hit: false, tp2Hit: false, stopHit: false };
  }

  if (input.cycleComplete) {
    return { ...input, status: "CYCLE_COMPLETE", message: "CYCLE COMPLETE", tp1Hit: false, tp2Hit: false, stopHit };
  }

  if (stopHit && input.actualEntry !== null) {
    return { ...input, status: "INVALIDATED", message: `STOP LOSS HIT — ${input.direction} LIFECYCLE INVALIDATED`, tp1Hit: false, tp2Hit: false, stopHit: true };
  }

  if (input.actualEntry !== null) {
    return { ...input, status: "ACTIVE", message: `ACTIVE TRADE — ${input.direction} — WAITING FOR OPPOSITE CONFIRMED SETUP`, tp1Hit: false, tp2Hit: false, stopHit: false };
  }

  if (input.projectedEntry !== null) {
    const touched = input.direction === "BUY" ? input.currentPrice <= input.projectedEntry : input.currentPrice >= input.projectedEntry;
    return { ...input, status: touched ? "ENTRY_ZONE" : "WATCH", message: touched ? `${input.direction} — PROJECTED ENTRY ZONE` : `WATCH — ${input.direction}`, tp1Hit: false, tp2Hit: false, stopHit: false };
  }

  return { ...input, status: "WATCH", message: "WATCH", tp1Hit: false, tp2Hit: false, stopHit: false };
}

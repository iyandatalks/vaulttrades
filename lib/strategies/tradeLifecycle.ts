export type LifecycleDirection = "BUY" | "SELL" | "NONE";
// TP2_HIT is retained as a legacy compatibility status for the existing AI Scanner route.
// Adaptive Execution uses TP1_HIT as the actual lifecycle completion target.
export type LifecycleStatus = "WATCH" | "ENTRY_ZONE" | "ACTIVE" | "TP1_HIT" | "TP2_HIT" | "SL_HIT" | "CYCLE_COMPLETE";
export const AB_FIB_ENTRY_PCTS = [82.0, 78.6, 68.1, 61.8] as const;
export interface LifecycleInput { direction: LifecycleDirection; currentPrice: number; projectedEntry: number | null; actualEntry: number | null; projectedStopLoss: number | null; projectedTp1: number | null; projectedTp2: number | null; projectedFinalTp: number | null; priorStatus?: LifecycleStatus | null; tp1AlreadyHit?: boolean; tp2AlreadyHit?: boolean; stopAlreadyHit?: boolean; cycleComplete?: boolean; }
export interface LifecycleResult { status: LifecycleStatus; message: string; projectedEntry: number | null; actualEntry: number | null; projectedStopLoss: number | null; projectedTp1: number | null; projectedTp2: number | null; projectedFinalTp: number | null; tp1Hit: boolean; tp2Hit: boolean; stopHit: boolean; }
export function isAllowedAbFibPercentage(value: number): boolean { return AB_FIB_ENTRY_PCTS.some((pct) => Math.abs(pct - value) < 0.0001); }
export function selectAllowedAbFibLevel(levels: Array<{ pct: number; price: number }>, direction: "BUY" | "SELL", currentPrice: number): { pct: number; price: number } | null { const allowed = levels.filter((level) => Number.isFinite(level.price) && isAllowedAbFibPercentage(level.pct)).sort((a, b) => b.pct - a.pct); if (!allowed.length) return null; const candidates = direction === "BUY" ? allowed.filter((level) => level.price < currentPrice) : allowed.filter((level) => level.price > currentPrice); if (candidates.length) return candidates.reduce((best, level) => Math.abs(level.price - currentPrice) < Math.abs(best.price - currentPrice) ? level : best); return allowed.find((level) => Math.abs(level.pct - 61.8) < 0.0001) ?? allowed[allowed.length - 1]; }
/** TP1 is the actual lifecycle completion target. TP2/TP3/TP4 remain projection/reference targets only. */
export function evaluateTradeLifecycle(input: LifecycleInput): LifecycleResult {
  const stopHit = Boolean(input.stopAlreadyHit) || Boolean(input.projectedStopLoss !== null && (input.direction === "BUY" ? input.currentPrice <= input.projectedStopLoss : input.currentPrice >= input.projectedStopLoss));
  const projectedTp1Reached = Boolean(input.projectedTp1 !== null && (input.direction === "BUY" ? input.currentPrice >= input.projectedTp1 : input.currentPrice <= input.projectedTp1));
  const tp1Hit = Boolean(input.tp1AlreadyHit) || (input.actualEntry !== null && projectedTp1Reached);
  const tp2Hit = Boolean(input.tp2AlreadyHit) || (input.actualEntry !== null && input.projectedTp2 !== null && (input.direction === "BUY" ? input.currentPrice >= input.projectedTp2 : input.currentPrice <= input.projectedTp2));
  if (input.cycleComplete) return { ...input, status: "CYCLE_COMPLETE", message: "CYCLE COMPLETE", tp1Hit, tp2Hit, stopHit };
  if (stopHit && input.actualEntry !== null) return { ...input, status: "SL_HIT", message: "STOP LOSS HIT — CYCLE COMPLETE", tp1Hit, tp2Hit, stopHit };
  if (tp1Hit && input.actualEntry !== null) return { ...input, status: "TP1_HIT", message: `TP1 HIT — ${input.direction} — CYCLE COMPLETE`, tp1Hit, tp2Hit, stopHit };
  if (input.actualEntry !== null) return { ...input, status: "ACTIVE", message: `ACTIVE TRADE — ${input.direction} — TP1 LIFECYCLE`, tp1Hit, tp2Hit, stopHit };
  if (input.projectedEntry !== null) {
    if (stopHit || projectedTp1Reached || input.tp1AlreadyHit) return { ...input, status: "CYCLE_COMPLETE", message: "PROJECTED SETUP EXPIRED — PRICE PASSED THE PROJECTED TP1/INVALIDATION BEFORE CONFIRMED ENTRY", tp1Hit, tp2Hit: false, stopHit };
    const touched = input.direction === "BUY" ? input.currentPrice <= input.projectedEntry : input.currentPrice >= input.projectedEntry;
    return { ...input, status: touched ? "ENTRY_ZONE" : "WATCH", message: touched ? `${input.direction} — PROJECTED ENTRY ZONE` : `WATCH — ${input.direction}`, tp1Hit, tp2Hit, stopHit };
  }
  return { ...input, status: "WATCH", message: "WATCH", tp1Hit, tp2Hit, stopHit };
}
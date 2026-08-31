import { evaluateAdaptiveExecution, DEFAULT_ADAPTIVE_EXECUTION_CONFIG, type AdaptiveCandle, type AdaptiveExecutionResult } from "./adaptiveExecution";
import type { StrategyAnalysis } from "./types";

/** Canonical decision engine: both agreed strategies are evaluated on M15. M5 is not required. */
export type M15Signal = "BUY" | "SELL" | "NONE";
export type M15State = "WAITING" | "DEVELOPING" | "BUY" | "SELL" | "NO_TRADE";

export interface M15DualConfig {
  minScore: number;
  fibLookback: number;
  fibPreferred: number;
  fibSecond: number;
  fibLastResort: number;
  fibStop: number;
  tp1Fib: number;
  tp2Fib: number;
  tp3Fib: number;
  atrLength: number;
  displacementAtr: number;
  requireLiquiditySweep: boolean;
}

export const DEFAULT_M15_DUAL_CONFIG: M15DualConfig = {
  minScore: 70, fibLookback: 48, fibPreferred: 68.1, fibSecond: 78.6,
  fibLastResort: 88, fibStop: 125, tp1Fib: 38.2, tp2Fib: 0,
  tp3Fib: -23.6, atrLength: 14, displacementAtr: 0.6,
  requireLiquiditySweep: false,
};

export interface M15FibResult extends StrategyAnalysis {
  strategy: "AUTO_FIB";
  fibLevel: number | null;
  anchorHigh: number | null;
  anchorLow: number | null;
  midpoint: number | null;
  liquiditySweep: boolean;
  retest: boolean;
  displacement: boolean;
}

export interface M15DualResult {
  timeframe: "M15";
  signal: M15Signal;
  state: M15State;
  confidence: number;
  firstStrategy: AdaptiveExecutionResult;
  secondStrategy: M15FibResult;
  agreement: boolean;
  entry: number | null;
  stopLoss: number | null;
  tp1: number | null;
  tp2: number | null;
  tp3: number | null;
  riskReward: number | null;
  evidence: string[];
  missingConditions: string[];
  invalidation: string[];
  message: string;
}

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function evaluateM15AutoFib(c: AdaptiveCandle[], cfg: M15DualConfig): M15FibResult {
  const cur = c.at(-1)!;
  const lookback = Math.max(10, Math.min(cfg.fibLookback, c.length));
  const window = c.slice(-lookback);
  const hi = Math.max(...window.map(x => x.high));
  const lo = Math.min(...window.map(x => x.low));
  const mid = (hi + lo) / 2;
  const range = hi - lo;
  const atr = c.length >= cfg.atrLength ? Math.max(...c.slice(-cfg.atrLength).map(x => x.high - x.low)) : null;
  const bullSweep = cur.low < lo && cur.close > lo;
  const bearSweep = cur.high > hi && cur.close < hi;
  const bullRetest = cur.low <= lo + range * 0.05 && cur.close > lo;
  const bearRetest = cur.high >= hi - range * 0.05 && cur.close < hi;
  const bullDisp = finite(atr) && cur.close > cur.open && cur.close - cur.open >= atr * cfg.displacementAtr;
  const bearDisp = finite(atr) && cur.close < cur.open && cur.open - cur.close >= atr * cfg.displacementAtr;
  const selected = cur.close >= mid ? cfg.fibPreferred : cfg.fibSecond;
  const bullQualified = bullSweep && bullRetest && bullDisp;
  const bearQualified = bearSweep && bearRetest && bearDisp;
  const signal: M15Signal = bullQualified ? "BUY" : bearQualified ? "SELL" : "NONE";
  const confidence = signal === "NONE" ? 0 : 75;
  const entry = signal === "NONE" ? null : cur.close;
  const sl = signal === "BUY" ? lo - (finite(atr) ? atr : 0) : signal === "SELL" ? hi + (finite(atr) ? atr : 0) : null;
  const risk = finite(entry) && finite(sl) ? Math.abs(entry - sl) : null;

  // Narrow nullable values explicitly before arithmetic. This keeps the runtime
  // trading calculations unchanged while making the type contract unambiguous.
  const tp1 = finite(entry) && finite(risk)
    ? signal === "BUY" ? entry + risk * 2
      : signal === "SELL" ? entry - risk * 2
      : null
    : null;
  const tp2 = finite(entry) && finite(risk)
    ? signal === "BUY" ? entry + risk * 3
      : signal === "SELL" ? entry - risk * 3
      : null
    : null;
  const tp3 = finite(entry) && finite(risk)
    ? signal === "BUY" ? entry + risk * 4
      : signal === "SELL" ? entry - risk * 4
      : null
    : null;
  const rr = finite(risk) && risk > 0 && finite(entry) && finite(tp1) ? Math.abs(tp1 - entry) / risk : null;

  return {
    strategy: "AUTO_FIB", strategyId: "autoFibRetrace",
    strategyName: "Vault Auto Fib Retrace + TP Ladder | M15 Engine",
    state: signal === "BUY" ? "BUY" : signal === "SELL" ? "SELL" : confidence >= 50 ? "DEVELOPING" : "WAITING",
    signal, confidence, entry, stopLoss: sl, tp1, tp2, finalTp: tp3, riskReward: rr,
    evidence: [], missingConditions: [],
    invalidation: ["M15 close through active Fib stop/invalidation level"],
    confluence: [bullSweep || bearSweep ? "Liquidity sweep" : "No liquidity sweep", cur.close >= mid ? "Upper half of range" : "Lower half of range"],
    timeframe: "M15", message: signal === "NONE" ? "No confirmed M15 Auto Fib entry." : `${signal} confirmed by M15 Auto Fib sequence.`,
    fibLevel: selected, anchorHigh: hi, anchorLow: lo, midpoint: mid,
    liquiditySweep: signal === "BUY" ? bullSweep : signal === "SELL" ? bearSweep : false,
    retest: signal === "BUY" ? bullRetest : signal === "SELL" ? bearRetest : false,
    displacement: signal === "BUY" ? bullDisp : signal === "SELL" ? bearDisp : false,
  };
}

/**
 * Canonical M15 orchestration for both strategies. Strategy 1 uses the existing
 * adaptive execution engine; Strategy 2 uses the M15-native Auto Fib engine.
 * Contradictory confirmed directions are blocked rather than averaged away.
 */
export function evaluateM15DualEngine(c: AdaptiveCandle[], cfg: M15DualConfig = DEFAULT_M15_DUAL_CONFIG): M15DualResult {
  const first = evaluateAdaptiveExecution(c, { ...DEFAULT_ADAPTIVE_EXECUTION_CONFIG, scoreThreshold: cfg.minScore, atrLength: cfg.atrLength });
  const second = evaluateM15AutoFib(c, cfg);
  const primarySignal: M15Signal = first.direction === "BUY" || first.direction === "SELL" ? first.direction : "NONE";
  const agreement = first.confirmed && second.signal !== "NONE" && primarySignal === second.signal;
  const conflict = first.confirmed && second.signal !== "NONE" && primarySignal !== second.signal;
  const signal: M15Signal = conflict ? "NONE" : agreement ? second.signal : first.confirmed ? primarySignal : second.signal;
  const secondConfidence = finite(second.confidence) ? second.confidence : 0;
  const confidence = agreement ? Math.min(100, Math.round((first.score + secondConfidence) / 2 + 10)) : Math.max(first.score, secondConfidence);
  const useFib = agreement || !first.confirmed;
  const entry = signal === "NONE" ? null : useFib ? second.entry : first.entry;
  const stopLoss = signal === "NONE" ? null : useFib ? second.stopLoss : first.stopLoss;
  const tp1 = signal === "NONE" ? null : useFib ? second.tp1 : first.tp1;
  const tp2 = signal === "NONE" ? null : useFib ? second.tp2 : first.tp2;
  const tp3 = signal === "NONE" ? null : useFib ? second.finalTp : first.tp4;
  const riskReward = finite(entry) && finite(stopLoss) && finite(tp1) && Math.abs(entry - stopLoss) > 0 ? Math.abs(tp1 - entry) / Math.abs(entry - stopLoss) : null;
  const evidence = [...second.evidence];
  const missing = [...second.missingConditions];
  if (first.confirmed) evidence.push(`Strategy 1 M15 score ${first.score}/100`); else missing.push("Strategy 1 M15 confirmation");
  if (agreement) evidence.push("Both strategies agree on M15 direction");
  if (conflict) missing.push("Strategy agreement — conflicting directions");
  const state: M15State = conflict ? "NO_TRADE" : signal === "BUY" ? "BUY" : signal === "SELL" ? "SELL" : confidence >= 50 ? "DEVELOPING" : "WAITING";
  return {
    timeframe: "M15", signal, state, confidence, firstStrategy: first, secondStrategy: second,
    agreement, entry, stopLoss, tp1, tp2, tp3, riskReward, evidence,
    missingConditions: missing,
    invalidation: ["M15 structure invalidation", "Active stop-loss breach", "Conflicting strategy direction"],
    message: conflict ? "NO TRADE: the two M15 strategy engines disagree." : agreement ? `M15 ${signal} confirmed by both strategies.` : signal === "NONE" ? "WAIT: no confirmed M15 signal." : `M15 ${signal} confirmed by one strategy; agreement is not present.`,
  };
}

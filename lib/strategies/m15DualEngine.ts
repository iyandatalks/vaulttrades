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

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const fibBuy = (hi: number, lo: number, pct: number) => hi - (hi - lo) * pct / 100;
const fibSell = (hi: number, lo: number, pct: number) => lo + (hi - lo) * pct / 100;

function atr(c: AdaptiveCandle[], n: number): number | null {
  if (c.length < n + 1) return null;
  const tr = c.slice(1).map((x, i) => {
    const p = c[i].close;
    return Math.max(x.high - x.low, Math.abs(x.high - p), Math.abs(x.low - p));
  });
  const t = tr.slice(-n);
  return t.length === n ? t.reduce((a, b) => a + b, 0) / n : null;
}

function emptyFib(): M15FibResult {
  return {
    strategy: "AUTO_FIB", strategyId: "autoFibRetrace",
    strategyName: "Vault Auto Fib Retrace + TP Ladder | M15 Engine",
    state: "WAITING", signal: "NONE", confidence: 0, entry: null,
    stopLoss: null, tp1: null, tp2: null, finalTp: null, riskReward: null,
    evidence: [], missingConditions: [], invalidation: [], confluence: [],
    timeframe: "M15", message: "Waiting for a valid M15 Auto Fib sequence.",
    fibLevel: null, anchorHigh: null, anchorLow: null, midpoint: null,
    liquiditySweep: false, retest: false, displacement: false,
  };
}

/** M15-native Auto Fib sequence: structure -> retrace -> displacement -> entry. */
export function evaluateM15AutoFib(c: AdaptiveCandle[], cfg: M15DualConfig = DEFAULT_M15_DUAL_CONFIG): M15FibResult {
  if (c.length < Math.max(cfg.fibLookback, cfg.atrLength + 5)) return emptyFib();
  const cur = c[c.length - 1];
  const w = c.slice(-cfg.fibLookback);
  const hi = Math.max(...w.map(x => x.high));
  const lo = Math.min(...w.map(x => x.low));
  const a = atr(c, cfg.atrLength);
  if (!finite(hi) || !finite(lo) || !finite(a) || hi <= lo || a <= 0) return emptyFib();

  const prev = c[c.length - 2];
  const mid = (hi + lo) / 2;
  const range = hi - lo;
  const recent = c.slice(-6, -1);
  const bullStructure = cur.close > Math.max(...recent.map(x => x.high));
  const bearStructure = cur.close < Math.min(...recent.map(x => x.low));
  const bullSweep = prev.low < lo + range * 0.12 && cur.close > prev.high;
  const bearSweep = prev.high > hi - range * 0.12 && cur.close < prev.low;
  const b68 = fibBuy(hi, lo, cfg.fibPreferred), b78 = fibBuy(hi, lo, cfg.fibSecond), b88 = fibBuy(hi, lo, cfg.fibLastResort);
  const s68 = fibSell(hi, lo, cfg.fibPreferred), s78 = fibSell(hi, lo, cfg.fibSecond), s88 = fibSell(hi, lo, cfg.fibLastResort);
  const bullRetest = (cur.low <= b68 && cur.close > b68) || (cur.low <= b78 && cur.close > b78) || (cur.low <= b88 && cur.close > b88);
  const bearRetest = (cur.high >= s68 && cur.close < s68) || (cur.high >= s78 && cur.close < s78) || (cur.high >= s88 && cur.close < s88);
  const bullDisp = cur.close > cur.open && cur.close - cur.open >= a * cfg.displacementAtr;
  const bearDisp = cur.close < cur.open && cur.open - cur.close >= a * cfg.displacementAtr;
  const buyScore = (bullStructure ? 25 : 0) + (bullRetest ? 25 : 0) + (bullDisp ? 20 : 0) + (bullSweep ? 15 : 0) + (cur.close >= mid ? 15 : 0);
  const sellScore = (bearStructure ? 25 : 0) + (bearRetest ? 25 : 0) + (bearDisp ? 20 : 0) + (bearSweep ? 15 : 0) + (cur.close <= mid ? 15 : 0);

  let signal: M15Signal = "NONE";
  let selected: number | null = null;
  const evidence: string[] = [];
  const missing: string[] = [];
  if (buyScore >= cfg.minScore && buyScore > sellScore && (!cfg.requireLiquiditySweep || bullSweep)) {
    signal = "BUY"; selected = cur.low <= b68 ? b68 : cur.low <= b78 ? b78 : b88;
    evidence.push("M15 bullish structure", "M15 Fib pullback/retest", "M15 bullish displacement");
    if (bullSweep) evidence.push("M15 liquidity sweep");
  } else if (sellScore >= cfg.minScore && sellScore > buyScore && (!cfg.requireLiquiditySweep || bearSweep)) {
    signal = "SELL"; selected = cur.high >= s68 ? s68 : cur.high >= s78 ? s78 : s88;
    evidence.push("M15 bearish structure", "M15 Fib pullback/retest", "M15 bearish displacement");
    if (bearSweep) evidence.push("M15 liquidity sweep");
  } else {
    if (!bullStructure && !bearStructure) missing.push("M15 structure break");
    if (!bullRetest && !bearRetest) missing.push("Fib pullback/retest");
    if (!bullDisp && !bearDisp) missing.push("M15 displacement candle");
  }

  const confidence = Math.max(buyScore, sellScore);
  const entry = signal === "NONE" ? null : cur.close;
  const sl = signal === "BUY" ? fibBuy(hi, lo, cfg.fibStop) : signal === "SELL" ? fibSell(hi, lo, cfg.fibStop) : null;
  const tp1 = signal === "BUY" ? fibBuy(hi, lo, cfg.tp1Fib) : signal === "SELL" ? fibSell(hi, lo, cfg.tp1Fib) : null;
  const tp2 = signal === "BUY" ? fibBuy(hi, lo, cfg.tp2Fib) : signal === "SELL" ? fibSell(hi, lo, cfg.tp2Fib) : null;
  const tp3 = signal === "BUY" ? fibBuy(hi, lo, cfg.tp3Fib) : signal === "SELL" ? fibSell(hi, lo, cfg.tp3Fib) : null;
  const risk = finite(entry) && finite(sl) ? Math.abs(entry - sl) : null;
  const rr = finite(risk) && risk > 0 && finite(entry) && finite(tp1) ? Math.abs(tp1 - entry) / risk : null;

  return {
    strategy: "AUTO_FIB", strategyId: "autoFibRetrace",
    strategyName: "Vault Auto Fib Retrace + TP Ladder | M15 Engine",
    state: signal === "BUY" ? "BUY" : signal === "SELL" ? "SELL" : confidence >= 50 ? "DEVELOPING" : "WAITING",
    signal, confidence, entry, stopLoss: sl, tp1, tp2, finalTp: tp3, riskReward: rr,
    evidence, missingConditions: missing,
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
  const agreement = first.confirmed && second.signal !== "NONE" && first.direction === second.signal;
  const conflict = first.confirmed && second.signal !== "NONE" && first.direction !== second.signal;
  const signal: M15Signal = conflict ? "NONE" : agreement ? second.signal : first.confirmed ? first.direction : second.signal;
  const confidence = agreement ? Math.min(100, Math.round((first.score + second.confidence) / 2 + 10)) : Math.max(first.score, second.confidence);
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

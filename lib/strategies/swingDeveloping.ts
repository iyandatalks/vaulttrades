/**
 * VaultTrades — Swing Developing Strategy | FULL SWING STATE REBUILT
 * Source of truth: Library file `Swing_Developing_Strategy_FULL_SWING_STATE_REBUILT.pine`.
 *
 * State flow:
 * H1 direction -> M15 alignment -> HH/HL or LH/LL -> pullback -> structure hold
 * -> recovery/rejection -> break of latest confirmed swing -> SMI confirmation
 * -> ONE active swing trade -> TP/SL -> reset.
 *
 * DIRECTION / PULLBACK / ENTRY_READY are setup states only.
 * BUY / SELL is the final trade event. No repeated candle signals while a
 * swing trade is active.
 */
import type { StrategyRuleSet } from "./types";

export const SWING_DEVELOPING_ID = "swingDeveloping" as const;
export const SWING_DEVELOPING_NAME = "Swing Developing Strategy" as const;

export type SwingCandle = {
  time?: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type SwingStage =
  | "WAIT"
  | "DIRECTION"
  | "PULLBACK"
  | "ENTRY_READY"
  | "ENTER_LONG"
  | "ENTER_SHORT"
  | "LONG_ACTIVE"
  | "SHORT_ACTIVE";

export interface SwingDevelopingSettings {
  emaFastLen: number;
  emaSlowLen: number;
  emaTrendLen: number;
  smiLength: number;
  smiSmooth1: number;
  smiSmooth2: number;
  smiOB: number;
  smiOS: number;
  requireEMA100: boolean;
  requirePullback: boolean;
  structurePivotLen: number;
  requireStructureBreak: boolean;
  requireStructureHold: boolean;
  requireRejectionCandle: boolean;
  atrLength: number;
  stopATRBuffer: number;
  targetRR: number;
};

export interface SwingDevelopingInput {
  h1: SwingCandle[];
  m15: SwingCandle[];
  current?: SwingCandle;
  settings?: Partial<SwingDevelopingSettings>;
};

export interface SwingState {
  close: number;
  ema9: number;
  ema15: number;
  ema100: number;
  smi: number;
  bullish: boolean;
  bearish: boolean;
  above100: boolean;
  below100: boolean;
  longDirection: boolean;
  shortDirection: boolean;
};

export interface SwingDevelopingResult {
  strategyId: typeof SWING_DEVELOPING_ID;
  strategyName: typeof SWING_DEVELOPING_NAME;
  direction: "LONG" | "SHORT" | "NEUTRAL";
  stage: SwingStage;
  signal: "BUY" | "SELL" | "NONE";
  isNewSignal: boolean;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  riskReward: number | null;
  confidence: null;
  activeTrade: "LONG" | "SHORT" | "NONE";
  h1: SwingState;
  m15: SwingState;
  structure: {
    bull: boolean;
    bear: boolean;
    swingHigh: number | null;
    previousSwingHigh: number | null;
    swingLow: number | null;
    previousSwingLow: number | null;
    heldLong: boolean;
    heldShort: boolean;
    breakLong: boolean;
    breakShort: boolean;
  };
  pullback: { long: boolean; short: boolean; active: boolean };
  recovery: { long: boolean; short: boolean; longTrigger: boolean; shortTrigger: boolean };
  momentum: { long: boolean; short: boolean; h1SMI: number; m15SMI: number };
  states: {
    longSetupDeveloping: boolean;
    shortSetupDeveloping: boolean;
    longWatch: boolean;
    shortWatch: boolean;
    longEntryReady: boolean;
    shortEntryReady: boolean;
    longEntry: boolean;
    shortEntry: boolean;
    longSignal: boolean;
    shortSignal: boolean;
  };
  evidence: string[];
  invalidation: string[];
  message: string;
};

const DEFAULTS: SwingDevelopingSettings = {
  emaFastLen: 9,
  emaSlowLen: 15,
  emaTrendLen: 100,
  smiLength: 7,
  smiSmooth1: 2,
  smiSmooth2: 2,
  smiOB: 40,
  smiOS: -40,
  requireEMA100: true,
  requirePullback: true,
  structurePivotLen: 3,
  requireStructureBreak: true,
  requireStructureHold: true,
  requireRejectionCandle: true,
  atrLength: 14,
  stopATRBuffer: 0.25,
  targetRR: 2,
};

function ema(values: number[], length: number): number[] {
  if (!values.length) return [];
  const out = new Array<number>(values.length);
  const alpha = 2 / (length + 1);
  out[0] = values[0];
  for (let i = 1; i < values.length; i += 1) {
    out[i] = alpha * values[i] + (1 - alpha) * out[i - 1];
  }
  return out;
}

function highest(values: number[], length: number, index: number): number {
  let result = -Infinity;
  for (let i = Math.max(0, index - length + 1); i <= index; i += 1) result = Math.max(result, values[i]);
  return result;
}

function lowest(values: number[], length: number, index: number): number {
  let result = Infinity;
  for (let i = Math.max(0, index - length + 1); i <= index; i += 1) result = Math.min(result, values[i]);
  return result;
}

function smi(candles: SwingCandle[], length: number, smooth1: number, smooth2: number): number[] {
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const relative: number[] = [];
  const distance: number[] = [];
  for (let i = 0; i < candles.length; i += 1) {
    const hh = highest(highs, length, i);
    const ll = lowest(lows, length, i);
    relative.push(candles[i].close - (hh + ll) / 2);
    distance.push((hh - ll) / 2);
  }
  const rs = ema(ema(relative, smooth1), smooth2);
  const ds = ema(ema(distance, smooth1), smooth2);
  return rs.map((value, i) => (ds[i] === 0 ? 0 : (100 * value) / ds[i]));
}

function atr(candles: SwingCandle[], length: number): number[] {
  if (!candles.length) return [];
  const tr = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    return Math.max(c.high - c.low, Math.abs(c.high - candles[i - 1].close), Math.abs(c.low - candles[i - 1].close));
  });
  return ema(tr, length);
}

function pivotHigh(candles: SwingCandle[], index: number, length: number): number | null {
  const pivot = index - length;
  if (pivot < length || pivot + length >= candles.length) return null;
  const value = candles[pivot].high;
  for (let i = pivot - length; i <= pivot + length; i += 1) {
    if (candles[i].high > value) return null;
  }
  return value;
}

function pivotLow(candles: SwingCandle[], index: number, length: number): number | null {
  const pivot = index - length;
  if (pivot < length || pivot + length >= candles.length) return null;
  const value = candles[pivot].low;
  for (let i = pivot - length; i <= pivot + length; i += 1) {
    if (candles[i].low < value) return null;
  }
  return value;
}

function buildStates(candles: SwingCandle[], settings: SwingDevelopingSettings): SwingState[] {
  const closes = candles.map((c) => c.close);
  const e9 = ema(closes, settings.emaFastLen);
  const e15 = ema(closes, settings.emaSlowLen);
  const e100 = ema(closes, settings.emaTrendLen);
  const smiValues = smi(candles, settings.smiLength, settings.smiSmooth1, settings.smiSmooth2);
  return candles.map((c, i) => {
    const bullish = e9[i] > e15[i];
    const bearish = e9[i] < e15[i];
    const above100 = c.close > e100[i];
    const below100 = c.close < e100[i];
    return {
      close: c.close,
      ema9: e9[i],
      ema15: e15[i],
      ema100: e100[i],
      smi: smiValues[i],
      bullish,
      bearish,
      above100,
      below100,
      longDirection: bullish && (!settings.requireEMA100 || above100),
      shortDirection: bearish && (!settings.requireEMA100 || below100),
    };
  });
}

const EMPTY_STATE = (): SwingState => ({
  close: 0,
  ema9: 0,
  ema15: 0,
  ema100: 0,
  smi: 0,
  bullish: false,
  bearish: false,
  above100: false,
  below100: false,
  longDirection: false,
  shortDirection: false,
});

export function analyzeSwingDeveloping(input: SwingDevelopingInput): SwingDevelopingResult {
  const settings = { ...DEFAULTS, ...(input.settings ?? {}) };
  const h1States = buildStates(input.h1, settings);
  const m15States = buildStates(input.m15, settings);
  const h1 = h1States[h1States.length - 1];
  const m15 = m15States[m15States.length - 1];

  if (!h1 || !m15 || input.m15.length < settings.structurePivotLen * 2 + 2) {
    return {
      strategyId: SWING_DEVELOPING_ID,
      strategyName: SWING_DEVELOPING_NAME,
      direction: "NEUTRAL",
      stage: "WAIT",
      signal: "NONE",
      isNewSignal: false,
      entryPrice: null,
      stopLoss: null,
      takeProfit: null,
      riskReward: null,
      confidence: null,
      activeTrade: "NONE",
      h1: h1 ?? EMPTY_STATE(),
      m15: m15 ?? EMPTY_STATE(),
      structure: { bull: false, bear: false, swingHigh: null, previousSwingHigh: null, swingLow: null, previousSwingLow: null, heldLong: false, heldShort: false, breakLong: false, breakShort: false },
      pullback: { long: false, short: false, active: false },
      recovery: { long: false, short: false, longTrigger: false, shortTrigger: false },
      momentum: { long: false, short: false, h1SMI: h1?.smi ?? 0, m15SMI: m15?.smi ?? 0 },
      states: { longSetupDeveloping: false, shortSetupDeveloping: false, longWatch: false, shortWatch: false, longEntryReady: false, shortEntryReady: false, longEntry: false, shortEntry: false, longSignal: false, shortSignal: false },
      evidence: ["Insufficient H1/M15 data."],
      invalidation: ["Provide sufficient M15 candles to establish confirmed pivots."],
      message: "WAIT — insufficient H1/M15 structure data.",
    };
  }

  const n = input.m15.length;
  const atrValues = atr(input.m15, settings.atrLength);
  let swingHigh: number | null = null;
  let previousSwingHigh: number | null = null;
  let swingLow: number | null = null;
  let previousSwingLow: number | null = null;
  let longArmed = false;
  let shortArmed = false;
  let activeTrade: "LONG" | "SHORT" | "NONE" = "NONE";
  let activeEntry: number | null = null;
  let activeStop: number | null = null;
  let activeTarget: number | null = null;
  let activeEntryIndex = -1;
  let lastLongEntry = false;
  let lastShortEntry = false;

  let current = {
    bullStructure: false,
    bearStructure: false,
    pullbackLong: false,
    pullbackShort: false,
    heldLong: false,
    heldShort: false,
    recoveryLong: false,
    recoveryShort: false,
    longBreak: false,
    shortBreak: false,
    longEntry: false,
    shortEntry: false,
    longWatch: false,
    shortWatch: false,
    longReady: false,
    shortReady: false,
    longSignal: false,
    shortSignal: false,
  };

  for (let i = 0; i < n; i += 1) {
    const candle = input.m15[i];
    const state = m15States[i];
    const ph = pivotHigh(input.m15, i, settings.structurePivotLen);
    const pl = pivotLow(input.m15, i, settings.structurePivotLen);
    if (ph !== null) {
      previousSwingHigh = swingHigh;
      swingHigh = ph;
    }
    if (pl !== null) {
      previousSwingLow = swingLow;
      swingLow = pl;
    }

    const bullStructure = swingHigh !== null && previousSwingHigh !== null && swingLow !== null && previousSwingLow !== null && swingHigh > previousSwingHigh && swingLow > previousSwingLow;
    const bearStructure = swingHigh !== null && previousSwingHigh !== null && swingLow !== null && previousSwingLow !== null && swingHigh < previousSwingHigh && swingLow < previousSwingLow;
    const pullbackLong = candle.low <= Math.max(state.ema9, state.ema15) && candle.high >= Math.min(state.ema9, state.ema15);
    const pullbackShort = candle.high >= Math.min(state.ema9, state.ema15) && candle.low <= Math.max(state.ema9, state.ema15);
    const heldLong = swingLow === null || candle.low > swingLow;
    const heldShort = swingHigh === null || candle.high < swingHigh;
    const validLong = !settings.requireStructureHold || heldLong;
    const validShort = !settings.requireStructureHold || heldShort;
    const bullishRejection = candle.close > candle.open && candle.close > state.ema9;
    const bearishRejection = candle.close < candle.open && candle.close < state.ema9;
    const recoveryLong = candle.close > state.ema9 && candle.close > state.ema15 && (!settings.requireRejectionCandle || bullishRejection);
    const recoveryShort = candle.close < state.ema9 && candle.close < state.ema15 && (!settings.requireRejectionCandle || bearishRejection);

    if (bullStructure && (!settings.requirePullback || pullbackLong) && validLong) {
      longArmed = true;
      shortArmed = false;
    }
    if (bearStructure && (!settings.requirePullback || pullbackShort) && validShort) {
      shortArmed = true;
      longArmed = false;
    }
    if (!validLong) longArmed = false;
    if (!validShort) shortArmed = false;

    const bullBreak = swingHigh !== null && candle.close > swingHigh && (i === 0 || input.m15[i - 1].close <= swingHigh);
    const bearBreak = swingLow !== null && candle.close < swingLow && (i === 0 || input.m15[i - 1].close >= swingLow);
    const longEntry = longArmed && bullStructure && validLong && (!settings.requireStructureBreak || bullBreak) && recoveryLong && state.smi >= settings.smiOB;
    const shortEntry = shortArmed && bearStructure && validShort && (!settings.requireStructureBreak || bearBreak) && recoveryShort && state.smi <= settings.smiOS;

    if (longEntry) longArmed = false;
    if (shortEntry) shortArmed = false;

    const newLongTrade = activeTrade === "NONE" && longEntry;
    const newShortTrade = activeTrade === "NONE" && shortEntry;

    if (newLongTrade) {
      const entry = state.close;
      const stop = swingLow !== null ? swingLow - (atrValues[i] ?? 0) * settings.stopATRBuffer : entry - (atrValues[i] ?? 0);
      const risk = entry - stop;
      if (risk > 0) {
        activeTrade = "LONG";
        activeEntry = entry;
        activeStop = stop;
        activeTarget = entry + risk * settings.targetRR;
        activeEntryIndex = i;
      }
    } else if (newShortTrade) {
      const entry = state.close;
      const stop = swingHigh !== null ? swingHigh + (atrValues[i] ?? 0) * settings.stopATRBuffer : entry + (atrValues[i] ?? 0);
      const risk = stop - entry;
      if (risk > 0) {
        activeTrade = "SHORT";
        activeEntry = entry;
        activeStop = stop;
        activeTarget = entry - risk * settings.targetRR;
        activeEntryIndex = i;
      }
    }

    const longTargetHit = activeTrade === "LONG" && i > activeEntryIndex && activeTarget !== null && candle.high >= activeTarget;
    const longStopHit = activeTrade === "LONG" && i > activeEntryIndex && activeStop !== null && candle.low <= activeStop;
    const shortTargetHit = activeTrade === "SHORT" && i > activeEntryIndex && activeTarget !== null && candle.low <= activeTarget;
    const shortStopHit = activeTrade === "SHORT" && i > activeEntryIndex && activeStop !== null && candle.high >= activeStop;

    if (longTargetHit || longStopHit || shortTargetHit || shortStopHit) {
      activeTrade = "NONE";
      activeEntry = null;
      activeStop = null;
      activeTarget = null;
      activeEntryIndex = -1;
    }

    const longSignal = newLongTrade && activeTrade === "LONG" && !lastLongEntry;
    const shortSignal = newShortTrade && activeTrade === "SHORT" && !lastShortEntry;
    lastLongEntry = longEntry;
    lastShortEntry = shortEntry;

    current = {
      bullStructure,
      bearStructure,
      pullbackLong,
      pullbackShort,
      heldLong,
      heldShort,
      recoveryLong,
      recoveryShort,
      longBreak: bullBreak,
      shortBreak: bearBreak,
      longEntry,
      shortEntry,
      longWatch: h1.longDirection && state.longDirection && longArmed,
      shortWatch: h1.shortDirection && state.shortDirection && shortArmed,
      longReady: activeTrade === "NONE" && h1.longDirection && state.longDirection && longArmed && recoveryLong && validLong && !bullBreak,
      shortReady: activeTrade === "NONE" && h1.shortDirection && state.shortDirection && shortArmed && recoveryShort && validShort && !bearBreak,
      longSignal,
      shortSignal,
    };
  }

  const direction: "LONG" | "SHORT" | "NEUTRAL" = activeTrade === "LONG" || current.longSignal || current.longWatch || current.longReady ? "LONG" : activeTrade === "SHORT" || current.shortSignal || current.shortWatch || current.shortReady ? "SHORT" : "NEUTRAL";
  const stage: SwingStage = activeTrade === "LONG" ? "LONG_ACTIVE" : activeTrade === "SHORT" ? "SHORT_ACTIVE" : current.longSignal ? "ENTER_LONG" : current.shortSignal ? "ENTER_SHORT" : current.longReady ? "ENTRY_READY" : current.shortReady ? "ENTRY_READY" : current.longWatch ? "PULLBACK" : current.shortWatch ? "PULLBACK" : direction === "LONG" || direction === "SHORT" ? "DIRECTION" : "WAIT";
  const signal: "BUY" | "SELL" | "NONE" = current.longSignal ? "BUY" : current.shortSignal ? "SELL" : "NONE";
  const risk = activeEntry !== null && activeStop !== null ? Math.abs(activeEntry - activeStop) : null;
  const evidence: string[] = [];
  const invalidation: string[] = [];

  if (h1.longDirection) evidence.push("H1 bullish direction confirmed.");
  if (h1.shortDirection) evidence.push("H1 bearish direction confirmed.");
  if (m15.longDirection && h1.longDirection) evidence.push("M15 bullish direction aligned with H1.");
  if (m15.shortDirection && h1.shortDirection) evidence.push("M15 bearish direction aligned with H1.");
  if (current.bullStructure) evidence.push("M15 HH/HL structure confirmed.");
  if (current.bearStructure) evidence.push("M15 LH/LL structure confirmed.");
  if (current.pullbackLong) evidence.push("M15 bullish EMA 9/15 pullback detected.");
  if (current.pullbackShort) evidence.push("M15 bearish EMA 9/15 pullback detected.");
  if (current.recoveryLong) evidence.push("Bullish recovery/rejection confirmed above EMA 9/15.");
  if (current.recoveryShort) evidence.push("Bearish recovery/rejection confirmed below EMA 9/15.");
  if (current.longBreak) evidence.push("Latest confirmed M15 swing high broken.");
  if (current.shortBreak) evidence.push("Latest confirmed M15 swing low broken.");
  if (current.longEntry && m15.smi >= settings.smiOB) evidence.push(`M15 SMI ${m15.smi.toFixed(1)} >= ${settings.smiOB}.`);
  if (current.shortEntry && m15.smi <= settings.smiOS) evidence.push(`M15 SMI ${m15.smi.toFixed(1)} <= ${settings.smiOS}.`);
  if (current.longSignal) evidence.push("NEW BUY swing trade event confirmed.");
  if (current.shortSignal) evidence.push("NEW SELL swing trade event confirmed.");

  if (!h1.longDirection && !h1.shortDirection) invalidation.push("H1 direction not established.");
  if (direction === "LONG" && !current.bullStructure) invalidation.push("M15 bullish structure not confirmed.");
  if (direction === "SHORT" && !current.bearStructure) invalidation.push("M15 bearish structure not confirmed.");
  if (direction === "LONG" && !current.pullbackLong) invalidation.push("Required bullish EMA 9/15 pullback is absent.");
  if (direction === "SHORT" && !current.pullbackShort) invalidation.push("Required bearish EMA 9/15 pullback is absent.");
  if (direction === "LONG" && !current.heldLong) invalidation.push("Bullish structure was invalidated by a break of the protected swing low.");
  if (direction === "SHORT" && !current.heldShort) invalidation.push("Bearish structure was invalidated by a break of the protected swing high.");

  let message = "WAIT — no valid swing state.";
  if (activeTrade === "LONG") message = "LONG ACTIVE — no second signal until TP or SL.";
  else if (activeTrade === "SHORT") message = "SHORT ACTIVE — no second signal until TP or SL.";
  else if (current.longSignal) message = "BUY SWING ENTRY — H1 + M15 alignment, structure break, recovery and SMI confirmation.";
  else if (current.shortSignal) message = "SELL SWING ENTRY — H1 + M15 alignment, structure break, recovery and SMI confirmation.";
  else if (current.longReady) message = "LONG ENTRY READY — recovery confirmed; wait for the latest M15 swing-high break and SMI confirmation.";
  else if (current.shortReady) message = "SHORT ENTRY READY — recovery confirmed; wait for the latest M15 swing-low break and SMI confirmation.";
  else if (current.longWatch) message = "LONG PULLBACK — structure is intact; wait for recovery.";
  else if (current.shortWatch) message = "SHORT PULLBACK — structure is intact; wait for recovery.";
  else if (direction === "LONG") message = "LONG DIRECTION — H1 + M15 aligned; wait for HH/HL, pullback and confirmation.";
  else if (direction === "SHORT") message = "SHORT DIRECTION — H1 + M15 aligned; wait for LH/LL, pullback and confirmation.";

  return {
    strategyId: SWING_DEVELOPING_ID,
    strategyName: SWING_DEVELOPING_NAME,
    direction,
    stage,
    signal,
    isNewSignal: signal !== "NONE",
    entryPrice: activeEntry,
    stopLoss: activeStop,
    takeProfit: activeTarget,
    riskReward: risk !== null && risk > 0 && activeTarget !== null && activeEntry !== null ? Math.abs(activeTarget - activeEntry) / risk : null,
    confidence: null,
    activeTrade,
    h1,
    m15,
    structure: {
      bull: current.bullStructure,
      bear: current.bearStructure,
      swingHigh,
      previousSwingHigh,
      swingLow,
      previousSwingLow,
      heldLong: current.heldLong,
      heldShort: current.heldShort,
      breakLong: current.longBreak,
      breakShort: current.shortBreak,
    },
    pullback: { long: current.pullbackLong, short: current.pullbackShort, active: current.longWatch || current.shortWatch },
    recovery: { long: current.recoveryLong, short: current.recoveryShort, longTrigger: current.recoveryLong, shortTrigger: current.recoveryShort },
    momentum: { long: m15.smi >= settings.smiOB, short: m15.smi <= settings.smiOS, h1SMI: h1.smi, m15SMI: m15.smi },
    states: {
      longSetupDeveloping: activeTrade === "NONE" && h1.longDirection && m15.longDirection && !current.longWatch,
      shortSetupDeveloping: activeTrade === "NONE" && h1.shortDirection && m15.shortDirection && !current.shortWatch,
      longWatch: current.longWatch,
      shortWatch: current.shortWatch,
      longEntryReady: current.longReady,
      shortEntryReady: current.shortReady,
      longEntry: current.longEntry,
      shortEntry: current.shortEntry,
      longSignal: current.longSignal,
      shortSignal: current.shortSignal,
    },
    evidence,
    invalidation,
    message,
  };
}

export const swingDevelopingRules: StrategyRuleSet = {
  id: SWING_DEVELOPING_ID,
  name: SWING_DEVELOPING_NAME,
  description: "FULL SWING STATE REBUILT: H1 + M15 alignment, confirmed market structure, pullback, protected structure, recovery, structural break and SMI 7-2-2 confirmation with one active trade state.",
  source: "PINE_SCRIPT",
  timeframes: ["H1", "M15"],
  sequence: [
    "H1 primary swing direction",
    "M15 directional alignment",
    "M15 HH/HL or LH/LL structure",
    "EMA 9/15 pullback",
    "Protected structure hold",
    "Recovery / rejection",
    "Break of latest confirmed swing",
    "M15 SMI confirmation",
    "ONE BUY/SELL swing trade",
    "TP or SL resets trade state",
  ],
  mandatoryRules: [
    "H1 EMA 9/15 determines primary direction with optional EMA 100 filter.",
    "M15 must agree with H1.",
    "M15 structure must form HH/HL for long or LH/LL for short.",
    "Required pullback must occur before the entry sequence can arm.",
    "Protected swing structure must remain valid.",
    "Recovery/rejection must confirm after the pullback.",
    "Entry uses the latest confirmed M15 swing break, not an old swing level.",
    "M15 SMI >= +40 confirms long; M15 SMI <= -40 confirms short.",
    "Only one swing trade may be active at a time.",
    "No repeated BUY/SELL candle signals while the trade is active.",
    "Active trade resets only after TP or SL.",
  ],
  optionalConfluence: ["EMA 100 filter, rejection candle, structure hold and structure-break requirements follow Pine inputs."],
  invalidationRules: [
    "H1/M15 directional disagreement",
    "Protected swing structure failure",
    "Missing required pullback",
    "Missing recovery/rejection",
    "Missing structural break",
    "Missing SMI confirmation",
  ],
  executionRules: [
    "DIRECTION, PULLBACK and ENTRY READY are non-entry states.",
    "BUY/SELL is the only final entry event.",
    "An active LONG or SHORT blocks additional entry signals until TP/SL.",
  ],
  riskRules: [
    "Long stop = latest protected M15 swing low minus ATR buffer.",
    "Short stop = latest protected M15 swing high plus ATR buffer.",
    "Target = entry +/- risk * targetRR.",
    "Default target is 1:2 RR, matching the rebuilt Pine source.",
  ],
  aiInstructions: [
    "Treat the swing engine as a state machine, not a per-candle signal generator.",
    "Never convert DIRECTION, PULLBACK or ENTRY READY into an immediate trade.",
    "Do not issue another BUY/SELL while activeTrade is LONG or SHORT.",
    "Use the latest confirmed swing break as the structural trigger.",
  ],
};

export const swingDevelopingStrategy = {
  id: SWING_DEVELOPING_ID,
  name: SWING_DEVELOPING_NAME,
  description: swingDevelopingRules.description,
  timeframes: ["H1", "M15"] as const,
  analyze: analyzeSwingDeveloping,
  rules: swingDevelopingRules,
};

export default swingDevelopingStrategy;

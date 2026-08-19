/**
 * VaultTrades — Swing Developing Strategy
 *
 * Source: supplied Pine Script v6 "Swing Developing Strategy".
 *
 * Core progression:
 * H1 direction → M15 alignment → EMA 9/15 pullback → recovery
 * → M15 SMI 7-2-2 confirmation → new BUY/SELL signal.
 *
 * The source Pine strategy does not define SL/TP/RR, so this module
 * deliberately does not invent risk-management rules.
 */

export const SWING_DEVELOPING_ID = "swingDeveloping" as const;
export const SWING_DEVELOPING_NAME = "Swing Developing Strategy" as const;

export type SwingDirection = "LONG" | "SHORT" | "NEUTRAL";
export type SwingStage =
  | "WAIT"
  | "DIRECTION"
  | "PULLBACK"
  | "ENTRY_READY"
  | "ENTER_LONG"
  | "ENTER_SHORT";

export interface SwingCandle {
  time?: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

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
}

export interface SwingDevelopingInput {
  h1: SwingCandle[];
  m15: SwingCandle[];
  current?: SwingCandle;
  settings?: Partial<SwingDevelopingSettings>;
}

export interface SwingTimeframeState {
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
}

export interface SwingDevelopingResult {
  strategyId: typeof SWING_DEVELOPING_ID;
  strategyName: typeof SWING_DEVELOPING_NAME;
  direction: SwingDirection;
  stage: SwingStage;
  signal: "BUY" | "SELL" | "NONE";
  isNewSignal: boolean;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  riskReward: number | null;
  confidence: number;
  h1: SwingTimeframeState;
  m15: SwingTimeframeState;
  pullback: { long: boolean; short: boolean; active: boolean };
  recovery: {
    long: boolean;
    short: boolean;
    longTrigger: boolean;
    shortTrigger: boolean;
  };
  momentum: {
    long: boolean;
    short: boolean;
    h1SMI: number;
    m15SMI: number;
  };
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
}

const DEFAULT_SETTINGS: SwingDevelopingSettings = {
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
};

function ema(values: number[], length: number): number[] {
  if (!values.length || length <= 0) return [];
  const result = new Array<number>(values.length);
  const alpha = 2 / (length + 1);
  result[0] = values[0];
  for (let i = 1; i < values.length; i += 1) {
    result[i] = alpha * values[i] + (1 - alpha) * result[i - 1];
  }
  return result;
}

function rollingHighest(values: number[], length: number): number[] {
  return values.map((_, i) => {
    let value = -Infinity;
    for (let j = Math.max(0, i - length + 1); j <= i; j += 1) {
      value = Math.max(value, values[j]);
    }
    return value;
  });
}

function rollingLowest(values: number[], length: number): number[] {
  return values.map((_, i) => {
    let value = Infinity;
    for (let j = Math.max(0, i - length + 1); j <= i; j += 1) {
      value = Math.min(value, values[j]);
    }
    return value;
  });
}

function calculateSMI(
  candles: SwingCandle[],
  length: number,
  smooth1: number,
  smooth2: number,
): number[] {
  if (!candles.length) return [];
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const closes = candles.map((c) => c.close);
  const hh = rollingHighest(highs, length);
  const ll = rollingLowest(lows, length);
  const relative = closes.map((close, i) => close - (hh[i] + ll[i]) / 2);
  const distance = hh.map((high, i) => (high - ll[i]) / 2);
  const relativeSmoothed = ema(ema(relative, smooth1), smooth2);
  const distanceSmoothed = ema(ema(distance, smooth1), smooth2);
  return relativeSmoothed.map((value, i) => {
    const denominator = distanceSmoothed[i];
    return denominator === 0 ? 0 : (100 * value) / denominator;
  });
}

function buildStates(
  candles: SwingCandle[],
  settings: SwingDevelopingSettings,
): SwingTimeframeState[] {
  if (!candles.length) return [];
  const closes = candles.map((c) => c.close);
  const e9 = ema(closes, settings.emaFastLen);
  const e15 = ema(closes, settings.emaSlowLen);
  const e100 = ema(closes, settings.emaTrendLen);
  const smi = calculateSMI(candles, settings.smiLength, settings.smiSmooth1, settings.smiSmooth2);

  return candles.map((candle, i) => {
    const bullish = e9[i] > e15[i];
    const bearish = e9[i] < e15[i];
    const above100 = candle.close > e100[i];
    const below100 = candle.close < e100[i];
    return {
      close: candle.close,
      ema9: e9[i],
      ema15: e15[i],
      ema100: e100[i],
      smi: smi[i],
      bullish,
      bearish,
      above100,
      below100,
      longDirection: bullish && (!settings.requireEMA100 || above100),
      shortDirection: bearish && (!settings.requireEMA100 || below100),
    };
  });
}

function emptyState(): SwingTimeframeState {
  return {
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
  };
}

export function analyzeSwingDeveloping(input: SwingDevelopingInput): SwingDevelopingResult {
  const settings = { ...DEFAULT_SETTINGS, ...(input.settings ?? {}) };
  const h1States = buildStates(input.h1, settings);
  const m15States = buildStates(input.m15, settings);
  const h1 = h1States.at(-1);
  const m15 = m15States.at(-1);
  const previousM15 = m15States.at(-2);

  if (!h1 || !m15) {
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
      confidence: 0,
      h1: h1 ?? emptyState(),
      m15: m15 ?? emptyState(),
      pullback: { long: false, short: false, active: false },
      recovery: { long: false, short: false, longTrigger: false, shortTrigger: false },
      momentum: { long: false, short: false, h1SMI: h1?.smi ?? 0, m15SMI: m15?.smi ?? 0 },
      states: {
        longSetupDeveloping: false,
        shortSetupDeveloping: false,
        longWatch: false,
        shortWatch: false,
        longEntryReady: false,
        shortEntryReady: false,
        longEntry: false,
        shortEntry: false,
        longSignal: false,
        shortSignal: false,
      },
      evidence: ["Insufficient H1/M15 data."],
      invalidation: ["Provide sufficient H1 and M15 candles."],
      message: "WAIT — insufficient H1/M15 data.",
    };
  }

  const longDirection = h1.longDirection && m15.longDirection;
  const shortDirection = h1.shortDirection && m15.shortDirection;

  const pullbackLong = m15.close <= m15.ema9 || m15.close <= m15.ema15;
  const pullbackShort = m15.close >= m15.ema9 || m15.close >= m15.ema15;

  const longWatch = longDirection && (settings.requirePullback ? pullbackLong : false);
  const shortWatch = shortDirection && (settings.requirePullback ? pullbackShort : false);

  const longRecovery = m15.close > m15.ema9;
  const shortRecovery = m15.close < m15.ema9;

  const previousLongWatch = previousM15
    ? previousM15.longDirection && (previousM15.close <= previousM15.ema9 || previousM15.close <= previousM15.ema15)
    : false;
  const previousShortWatch = previousM15
    ? previousM15.shortDirection && (previousM15.close >= previousM15.ema9 || previousM15.close >= previousM15.ema15)
    : false;

  const longRecoveryTrigger = previousLongWatch && longRecovery;
  const shortRecoveryTrigger = previousShortWatch && shortRecovery;

  const longMomentum = m15.smi >= settings.smiOB;
  const shortMomentum = m15.smi <= settings.smiOS;

  const longEntry = longDirection && longRecoveryTrigger && longMomentum;
  const shortEntry = shortDirection && shortRecoveryTrigger && shortMomentum;

  const previousLongEntry = previousM15
    ? previousM15.longDirection && previousLongWatch && previousM15.close > previousM15.ema9 && previousM15.smi >= settings.smiOB
    : false;
  const previousShortEntry = previousM15
    ? previousM15.shortDirection && previousShortWatch && previousM15.close < previousM15.ema9 && previousM15.smi <= settings.smiOS
    : false;

  const longSignal = longEntry && !previousLongEntry;
  const shortSignal = shortEntry && !previousShortEntry;

  const longEntryReady = longWatch && !longRecovery;
  const shortEntryReady = shortWatch && !shortRecovery;
  const longSetupDeveloping = longDirection && !longWatch;
  const shortSetupDeveloping = shortDirection && !shortWatch;

  let direction: SwingDirection = "NEUTRAL";
  let stage: SwingStage = "WAIT";
  let signal: "BUY" | "SELL" | "NONE" = "NONE";

  if (longSignal) {
    direction = "LONG";
    stage = "ENTER_LONG";
    signal = "BUY";
  } else if (shortSignal) {
    direction = "SHORT";
    stage = "ENTER_SHORT";
    signal = "SELL";
  } else if (longEntryReady) {
    direction = "LONG";
    stage = "ENTRY_READY";
  } else if (shortEntryReady) {
    direction = "SHORT";
    stage = "ENTRY_READY";
  } else if (longWatch) {
    direction = "LONG";
    stage = "PULLBACK";
  } else if (shortWatch) {
    direction = "SHORT";
    stage = "PULLBACK";
  } else if (longSetupDeveloping) {
    direction = "LONG";
    stage = "DIRECTION";
  } else if (shortSetupDeveloping) {
    direction = "SHORT";
    stage = "DIRECTION";
  }

  const evidence: string[] = [];
  const invalidation: string[] = [];

  if (h1.longDirection) evidence.push("H1 bullish direction confirmed by EMA 9/15 and EMA 100 filter.");
  if (h1.shortDirection) evidence.push("H1 bearish direction confirmed by EMA 9/15 and EMA 100 filter.");
  if (m15.longDirection) evidence.push("M15 bullish direction aligned with H1.");
  if (m15.shortDirection) evidence.push("M15 bearish direction aligned with H1.");
  if (longWatch) evidence.push("M15 bullish EMA 9/15 pullback detected.");
  if (shortWatch) evidence.push("M15 bearish EMA 9/15 pullback detected.");
  if (longRecoveryTrigger) evidence.push("M15 recovered above EMA 9 after the bullish pullback.");
  if (shortRecoveryTrigger) evidence.push("M15 recovered below EMA 9 after the bearish pullback.");
  if (longMomentum) evidence.push(`M15 SMI ${m15.smi.toFixed(1)} >= ${settings.smiOB}.`);
  if (shortMomentum) evidence.push(`M15 SMI ${m15.smi.toFixed(1)} <= ${settings.smiOS}.`);
  if (longSignal) evidence.push("New BUY transition confirmed by the complete Swing Developing entry condition.");
  if (shortSignal) evidence.push("New SELL transition confirmed by the complete Swing Developing entry condition.");

  if (!longDirection && !shortDirection) {
    invalidation.push("H1 and M15 are not fully aligned.");
  }
  if (longDirection && !longWatch) {
    invalidation.push("Wait for the M15 bullish EMA 9/15 pullback.");
  }
  if (shortDirection && !shortWatch) {
    invalidation.push("Wait for the M15 bearish EMA 9/15 pullback.");
  }
  if (longEntryReady) {
    invalidation.push(`Wait for recovery above EMA 9 and M15 SMI >= ${settings.smiOB}.`);
  }
  if (shortEntryReady) {
    invalidation.push(`Wait for recovery below EMA 9 and M15 SMI <= ${settings.smiOS}.`);
  }

  const confidence = longSignal || shortSignal
    ? 100
    : longEntryReady || shortEntryReady
      ? 90
      : longWatch || shortWatch
        ? 75
        : longDirection || shortDirection
          ? 60
          : 0;

  let message = "WAIT";
  if (longSignal) {
    message = "ENTER LONG — H1/M15 alignment, pullback, recovery and bullish SMI confirmation are complete.";
  } else if (shortSignal) {
    message = "ENTER SHORT — H1/M15 alignment, pullback, recovery and bearish SMI confirmation are complete.";
  } else if (longEntryReady) {
    message = "LONG ENTRY READY — wait for recovery above EMA 9 with bullish M15 SMI confirmation.";
  } else if (shortEntryReady) {
    message = "SHORT ENTRY READY — wait for recovery below EMA 9 with bearish M15 SMI confirmation.";
  } else if (longWatch) {
    message = "LONG PULLBACK — bullish swing setup is developing.";
  } else if (shortWatch) {
    message = "SHORT PULLBACK — bearish swing setup is developing.";
  } else if (longSetupDeveloping) {
    message = "LONG DIRECTION — wait for the M15 pullback.";
  } else if (shortSetupDeveloping) {
    message = "SHORT DIRECTION — wait for the M15 pullback.";
  }

  return {
    strategyId: SWING_DEVELOPING_ID,
    strategyName: SWING_DEVELOPING_NAME,
    direction,
    stage,
    signal,
    isNewSignal: longSignal || shortSignal,
    entryPrice: longSignal || shortSignal ? (input.current?.close ?? m15.close) : null,
    stopLoss: null,
    takeProfit: null,
    riskReward: null,
    confidence,
    h1,
    m15,
    pullback: {
      long: pullbackLong,
      short: pullbackShort,
      active: longWatch || shortWatch,
    },
    recovery: {
      long: longRecovery,
      short: shortRecovery,
      longTrigger: longRecoveryTrigger,
      shortTrigger: shortRecoveryTrigger,
    },
    momentum: {
      long: longMomentum,
      short: shortMomentum,
      h1SMI: h1.smi,
      m15SMI: m15.smi,
    },
    states: {
      longSetupDeveloping,
      shortSetupDeveloping,
      longWatch,
      shortWatch,
      longEntryReady,
      shortEntryReady,
      longEntry,
      shortEntry,
      longSignal,
      shortSignal,
    },
    evidence,
    invalidation,
    message,
  };
}

export const swingDevelopingStrategy = {
  id: SWING_DEVELOPING_ID,
  name: SWING_DEVELOPING_NAME,
  description: "H1 + M15 swing direction with EMA 9/15 pullback, recovery through EMA 9 and M15 SMI 7-2-2 confirmation.",
  timeframes: ["H1", "M15"] as const,
  analyze: analyzeSwingDeveloping,
};

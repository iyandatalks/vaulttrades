export const PREFERRED_TRADE_TIMEFRAMES = ["M5", "M15"] as const;
export type PreferredTradeTimeframe = (typeof PREFERRED_TRADE_TIMEFRAMES)[number];
export type AdaptiveDirection = "BUY" | "SELL" | "NO TRADE";

export type AdaptiveCandle = {
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
};

export type AdaptiveWeights = {
  trend: number;
  momentum: number;
  strength: number;
  structure: number;
  trigger: number;
};

export type AdaptiveExecutionConfig = {
  fastEmaLength: number;
  mediumEmaLength: number;
  slowEmaLength: number;
  contextEmaLength: number;
  rsiLength: number;
  rsiBullThreshold: number;
  rsiBearThreshold: number;
  macdFastLength: number;
  macdSlowLength: number;
  macdSignalLength: number;
  adxLength: number;
  adxMinimum: number;
  structureLookback: number;
  atrLength: number;
  atrMultiplier: number;
  atrStopMultiplier: number;
  scoreThreshold: number;
  tp1RR: number;
  tp2RR: number;
  tp3RR: number;
  tp4RR: number;
  weights: AdaptiveWeights;
};

export type AdaptiveComponentScores = {
  trend: number;
  momentum: number;
  strength: number;
  structure: number;
  trigger: number;
};

export type AdaptiveExecutionResult = {
  direction: AdaptiveDirection;
  score: number;
  scores: AdaptiveComponentScores;
  confirmed: boolean;
  atr: number | null;
  entry: number | null;
  stopLoss: number | null;
  risk: number | null;
  tp1: number | null;
  tp2: number | null;
  tp3: number | null;
  tp4: number | null;
  trend: "BULLISH" | "BEARISH" | "NEUTRAL";
  momentum: "BULLISH" | "BEARISH" | "NEUTRAL";
  strength: "BULLISH" | "BEARISH" | "NEUTRAL";
  structure: "BULLISH" | "BEARISH" | "NONE";
  trigger: "BUY" | "SELL" | "NEUTRAL";
};

export type AdaptiveMtfResult = {
  preferredTimeframe: PreferredTradeTimeframe | null;
  direction: AdaptiveDirection;
  executable: boolean;
  m15: AdaptiveExecutionResult;
  m5: AdaptiveExecutionResult;
  reason: string;
};

export const DEFAULT_ADAPTIVE_EXECUTION_CONFIG: AdaptiveExecutionConfig = {
  fastEmaLength: 20,
  mediumEmaLength: 50,
  slowEmaLength: 100,
  contextEmaLength: 200,
  rsiLength: 14,
  rsiBullThreshold: 50,
  rsiBearThreshold: 50,
  macdFastLength: 12,
  macdSlowLength: 26,
  macdSignalLength: 9,
  adxLength: 14,
  adxMinimum: 20,
  structureLookback: 5,
  atrLength: 14,
  atrMultiplier: 1.5,
  atrStopMultiplier: 1.5,
  scoreThreshold: 70,
  tp1RR: 2,
  tp2RR: 3,
  tp3RR: 4,
  tp4RR: 5,
  weights: {
    trend: 25,
    momentum: 20,
    strength: 15,
    structure: 25,
    trigger: 15,
  },
};

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function ema(values: number[], length: number): number | null {
  if (values.length < length || length < 1) return null;
  const alpha = 2 / (length + 1);
  let result = values.slice(0, length).reduce((sum, value) => sum + value, 0) / length;
  for (let i = length; i < values.length; i += 1) {
    result = values[i] * alpha + result * (1 - alpha);
  }
  return result;
}

function rsi(values: number[], length: number): number | null {
  if (values.length <= length || length < 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= length; i += 1) {
    const change = values[i] - values[i - 1];
    if (change >= 0) gain += change;
    else loss -= change;
  }
  gain /= length;
  loss /= length;
  for (let i = length + 1; i < values.length; i += 1) {
    const change = values[i] - values[i - 1];
    const currentGain = Math.max(change, 0);
    const currentLoss = Math.max(-change, 0);
    gain = (gain * (length - 1) + currentGain) / length;
    loss = (loss * (length - 1) + currentLoss) / length;
  }
  if (loss === 0) return 100;
  return 100 - 100 / (1 + gain / loss);
}

function trueRanges(candles: AdaptiveCandle[]): number[] {
  return candles.map((candle, index) => {
    if (index === 0) return candle.high - candle.low;
    const previousClose = candles[index - 1].close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose),
    );
  });
}

function wilder(values: number[], length: number): number | null {
  if (values.length < length || length < 1) return null;
  let result = values.slice(0, length).reduce((sum, value) => sum + value, 0) / length;
  for (let i = length; i < values.length; i += 1) {
    result = (result * (length - 1) + values[i]) / length;
  }
  return result;
}

function atr(candles: AdaptiveCandle[], length: number): number | null {
  return wilder(trueRanges(candles), length);
}

function macd(values: number[], fast: number, slow: number, signal: number) {
  if (values.length < slow + signal) return null;
  const fastAlpha = 2 / (fast + 1);
  const slowAlpha = 2 / (slow + 1);
  let fastEma = values.slice(0, fast).reduce((sum, value) => sum + value, 0) / fast;
  let slowEma = values.slice(0, slow).reduce((sum, value) => sum + value, 0) / slow;
  const macdValues: number[] = [];
  for (let i = fast; i < slow; i += 1) fastEma = values[i] * fastAlpha + fastEma * (1 - fastAlpha);
  macdValues.push(fastEma - slowEma);
  for (let i = slow; i < values.length; i += 1) {
    fastEma = values[i] * fastAlpha + fastEma * (1 - fastAlpha);
    slowEma = values[i] * slowAlpha + slowEma * (1 - slowAlpha);
    macdValues.push(fastEma - slowEma);
  }
  if (macdValues.length < signal) return null;
  const signalLine = ema(macdValues, signal);
  return signalLine == null ? null : { line: macdValues.at(-1)!, signal: signalLine };
}

function dmi(candles: AdaptiveCandle[], length: number) {
  if (candles.length < length + 1) return null;
  const tr = trueRanges(candles);
  const plusDm: number[] = [0];
  const minusDm: number[] = [0];
  for (let i = 1; i < candles.length; i += 1) {
    const up = candles[i].high - candles[i - 1].high;
    const down = candles[i - 1].low - candles[i].low;
    plusDm.push(up > down && up > 0 ? up : 0);
    minusDm.push(down > up && down > 0 ? down : 0);
  }
  const smoothedTr = wilder(tr, length);
  const smoothedPlus = wilder(plusDm, length);
  const smoothedMinus = wilder(minusDm, length);
  if (!finite(smoothedTr) || !finite(smoothedPlus) || !finite(smoothedMinus) || smoothedTr === 0) return null;
  const plusDi = 100 * smoothedPlus / smoothedTr;
  const minusDi = 100 * smoothedMinus / smoothedTr;
  const dx = 100 * Math.abs(plusDi - minusDi) / Math.max(plusDi + minusDi, Number.EPSILON);
  return { plusDi, minusDi, adx: dx };
}

function adaptiveTrigger(candles: AdaptiveCandle[], length: number, multiplier: number) {
  const offsetAtr = atr(candles, length);
  if (!finite(offsetAtr)) return { direction: 0 as -1 | 0 | 1, stop: null as number | null };
  let stop: number | null = null;
  let direction: -1 | 0 | 1 = 0;
  for (const candle of candles) {
    const candidateBullStop = candle.close - offsetAtr * multiplier;
    const candidateBearStop = candle.close + offsetAtr * multiplier;
    if (direction <= 0) {
      if (stop !== null && candle.close > stop) {
        direction = 1;
        stop = candidateBullStop;
      } else {
        stop = Math.min(stop ?? candidateBullStop, candidateBearStop);
      }
    }
    if (direction >= 0) {
      if (stop !== null && candle.close < stop) {
        direction = -1;
        stop = candidateBearStop;
      } else {
        stop = Math.max(stop ?? candidateBearStop, candidateBullStop);
      }
    }
  }
  return { direction, stop };
}

function scoreDirection(
  direction: "BUY" | "SELL",
  values: { trend: boolean; momentum: boolean; strength: boolean; structure: boolean; trigger: boolean },
  weights: AdaptiveWeights,
): AdaptiveComponentScores {
  return {
    trend: values.trend ? weights.trend : 0,
    momentum: values.momentum ? weights.momentum : 0,
    strength: values.strength ? weights.strength : 0,
    structure: values.structure ? weights.structure : 0,
    trigger: values.trigger ? weights.trigger : 0,
  };
}

export function evaluateAdaptiveExecution(
  candles: AdaptiveCandle[],
  config: AdaptiveExecutionConfig = DEFAULT_ADAPTIVE_EXECUTION_CONFIG,
): AdaptiveExecutionResult {
  const empty: AdaptiveExecutionResult = {
    direction: "NO TRADE",
    score: 0,
    scores: { trend: 0, momentum: 0, strength: 0, structure: 0, trigger: 0 },
    confirmed: false,
    atr: null,
    entry: null,
    stopLoss: null,
    risk: null,
    tp1: null,
    tp2: null,
    tp3: null,
    tp4: null,
    trend: "NEUTRAL",
    momentum: "NEUTRAL",
    strength: "NEUTRAL",
    structure: "NONE",
    trigger: "NEUTRAL",
  };
  if (candles.length < Math.max(config.contextEmaLength, config.macdSlowLength + config.macdSignalLength, config.adxLength + 1) || candles.some(c => ![c.open, c.high, c.low, c.close].every(finite))) return empty;

  const closes = candles.map(c => c.close);
  const current = closes.at(-1)!;
  const fast = ema(closes, config.fastEmaLength);
  const medium = ema(closes, config.mediumEmaLength);
  const slow = ema(closes, config.slowEmaLength);
  const context = ema(closes, config.contextEmaLength);
  const currentRsi = rsi(closes, config.rsiLength);
  const currentMacd = macd(closes, config.macdFastLength, config.macdSlowLength, config.macdSignalLength);
  const currentDmi = dmi(candles, config.adxLength);
  const currentAtr = atr(candles, config.atrLength);
  const trigger = adaptiveTrigger(candles, config.atrLength, config.atrMultiplier);
  if (![fast, medium, slow, context, currentRsi, currentAtr].every(finite) || !currentMacd || !currentDmi) return empty;

  const bullTrend = fast > medium && medium > slow && current > context;
  const bearTrend = fast < medium && medium < slow && current < context;
  const bullMomentum = currentRsi > config.rsiBullThreshold && currentMacd.line > currentMacd.signal;
  const bearMomentum = currentRsi < config.rsiBearThreshold && currentMacd.line < currentMacd.signal;
  const bullStrength = currentDmi.adx >= config.adxMinimum && currentDmi.plusDi > currentDmi.minusDi;
  const bearStrength = currentDmi.adx >= config.adxMinimum && currentDmi.minusDi > currentDmi.plusDi;
  const previous = candles.slice(-(config.structureLookback + 1), -1);
  const previousHigh = Math.max(...previous.map(c => c.high));
  const previousLow = Math.min(...previous.map(c => c.low));
  const bullStructure = current > previousHigh;
  const bearStructure = current < previousLow;
  const bullTrigger = trigger.direction === 1 && current > (trigger.stop ?? Number.POSITIVE_INFINITY);
  const bearTrigger = trigger.direction === -1 && current < (trigger.stop ?? Number.NEGATIVE_INFINITY);

  const bullScores = scoreDirection("BUY", { trend: bullTrend, momentum: bullMomentum, strength: bullStrength, structure: bullStructure, trigger: bullTrigger }, config.weights);
  const bearScores = scoreDirection("SELL", { trend: bearTrend, momentum: bearMomentum, strength: bearStrength, structure: bearStructure, trigger: bearTrigger }, config.weights);
  const bullScore = Object.values(bullScores).reduce((sum, value) => sum + value, 0);
  const bearScore = Object.values(bearScores).reduce((sum, value) => sum + value, 0);
  const direction: AdaptiveDirection = bullScore >= config.scoreThreshold && bullScore > bearScore ? "BUY" : bearScore >= config.scoreThreshold && bearScore > bullScore ? "SELL" : "NO TRADE";
  const score = direction === "BUY" ? bullScore : direction === "SELL" ? bearScore : Math.max(bullScore, bearScore);
  const confirmed = direction !== "NO TRADE";
  const entry = confirmed ? current : null;
  const risk = confirmed ? currentAtr * config.atrStopMultiplier : null;
  const stopLoss = confirmed && risk !== null ? direction === "BUY" ? entry! - risk : entry! + risk : null;
  const tp = confirmed && risk !== null ? {
    tp1: direction === "BUY" ? entry! + risk * config.tp1RR : entry! - risk * config.tp1RR,
    tp2: direction === "BUY" ? entry! + risk * config.tp2RR : entry! - risk * config.tp2RR,
    tp3: direction === "BUY" ? entry! + risk * config.tp3RR : entry! - risk * config.tp3RR,
    tp4: direction === "BUY" ? entry! + risk * config.tp4RR : entry! - risk * config.tp4RR,
  } : { tp1: null, tp2: null, tp3: null, tp4: null };

  return {
    direction,
    score,
    scores: direction === "BUY" ? bullScores : direction === "SELL" ? bearScores : bullScore >= bearScore ? bullScores : bearScores,
    confirmed,
    atr: currentAtr,
    entry,
    stopLoss,
    risk,
    ...tp,
    trend: bullTrend ? "BULLISH" : bearTrend ? "BEARISH" : "NEUTRAL",
    momentum: bullMomentum ? "BULLISH" : bearMomentum ? "BEARISH" : "NEUTRAL",
    strength: bullStrength ? "BULLISH" : bearStrength ? "BEARISH" : "NEUTRAL",
    structure: bullStructure ? "BULLISH" : bearStructure ? "BEARISH" : "NONE",
    trigger: trigger.direction === 1 ? "BUY" : trigger.direction === -1 ? "SELL" : "NEUTRAL",
  };
}

export function evaluatePreferredM15M5(
  m15Candles: AdaptiveCandle[],
  m5Candles: AdaptiveCandle[],
  config: AdaptiveExecutionConfig = DEFAULT_ADAPTIVE_EXECUTION_CONFIG,
): AdaptiveMtfResult {
  const m15 = evaluateAdaptiveExecution(m15Candles, config);
  const m5 = evaluateAdaptiveExecution(m5Candles, config);
  const aligned = m15.confirmed && m5.confirmed && m15.direction === m5.direction;
  const direction: AdaptiveDirection = aligned ? m5.direction : "NO TRADE";
  return {
    preferredTimeframe: aligned ? "M5" : m15.confirmed ? "M15" : null,
    direction,
    executable: aligned,
    m15,
    m5,
    reason: aligned
      ? `M15 ${m15.direction} confirmation aligned with M5 ${m5.direction} execution.`
      : m15.confirmed
        ? `M15 ${m15.direction} confirmation is present; M5 execution confirmation is not aligned.`
        : "M15 confirmation is not established.",
  };
}

export function isPreferredTradeTimeframe(value: unknown): value is PreferredTradeTimeframe {
  return typeof value === "string" && (value.toUpperCase() === "M5" || value.toUpperCase() === "M15");
}

import type { StrategyRuleSet } from "./types";

export const adaptiveAutomatedRules: StrategyRuleSet = {
  id: "adaptiveAutomated",
  name: "Adaptive Automated",
  description: "Independent automation copy of the current Adaptive Execution strategy for the Signal Tab.",
  source: "PINE_SCRIPT",
  timeframes: ["M5", "M15"],
  sequence: [
    "Evaluate the selected timeframe independently.",
    "Apply Adaptive strategy conditions.",
    "Apply Entry Confirmation for that timeframe.",
    "Publish only a newly confirmed entry to scanner_signals.",
    "TP1 is the actual simulated lifecycle target; TP2-TP4 are reference targets.",
  ],
  mandatoryRules: [
    "Trend: EMA20 > EMA50 > EMA100 and price > EMA200 for BUY; inverse for SELL.",
    "Momentum: RSI14 above 50 and MACD12/26/9 bullish for BUY; inverse for SELL.",
    "Strength: ADX14 >= 20 with +DI > -DI for BUY; inverse for SELL.",
    "Structure: close breaks the previous five-bar high/low.",
    "ATR adaptive trigger contributes 15 points when direction is confirmed.",
    "Confirmation threshold is 70/100.",
    "M5 and M15 are independently evaluable execution timeframes; one timeframe does not invalidate a confirmed signal on the other.",
  ],
  optionalConfluence: ["Session context", "Volume/institutional activity", "Higher-timeframe context above M15"],
  invalidationRules: [
    "Score falls below confirmation threshold before a new execution event.",
    "Price reaches the active ATR stop.",
  ],
  executionRules: [
    "Selected timeframe close is the entry.",
    "BUY SL = entry - (ATR14 × 1.5).",
    "SELL SL = entry + (ATR14 × 1.5).",
    "TP1 = 2R.",
    "TP2 = 3R, TP3 = 4R and TP4 = 5R are reference projections only.",
  ],
  riskRules: [
    "Risk is the distance between entry and the 1.5 ATR stop.",
    "TP1 is the actual simulated trade completion target.",
    "Position sizing is not embedded in the signal engine.",
  ],
  aiInstructions: [
    "This is an independent automation copy of Adaptive Execution.",
    "Do not require M5 and M15 to agree before publishing a valid confirmed signal.",
    "Do not manufacture a signal when the selected timeframe has not independently confirmed.",
    "Keep TP2-TP4 labelled as reference projections.",
  ],
};

export type AdaptiveAutomatedDirection = "BUY" | "SELL" | "NO TRADE";
export type AdaptiveAutomatedCandle = { open: number; high: number; low: number; close: number; volume?: number | null };
export type AdaptiveAutomatedWeights = { trend: number; momentum: number; strength: number; structure: number; trigger: number };
export type AdaptiveAutomatedConfig = {
  fastEmaLength: number; mediumEmaLength: number; slowEmaLength: number; contextEmaLength: number;
  rsiLength: number; rsiBullThreshold: number; rsiBearThreshold: number;
  macdFastLength: number; macdSlowLength: number; macdSignalLength: number;
  adxLength: number; adxMinimum: number; structureLookback: number;
  atrLength: number; atrMultiplier: number; atrStopMultiplier: number; scoreThreshold: number;
  tp1RR: number; tp2RR: number; tp3RR: number; tp4RR: number; weights: AdaptiveAutomatedWeights;
};
export type AdaptiveAutomatedComponentScores = { trend: number; momentum: number; strength: number; structure: number; trigger: number };
export type AdaptiveAutomatedResult = {
  direction: AdaptiveAutomatedDirection; score: number; scores: AdaptiveAutomatedComponentScores; confirmed: boolean;
  atr: number | null; entry: number | null; stopLoss: number | null; risk: number | null;
  tp1: number | null; tp2: number | null; tp3: number | null; tp4: number | null;
  trend: "BULLISH" | "BEARISH" | "NEUTRAL"; momentum: "BULLISH" | "BEARISH" | "NEUTRAL";
  strength: "BULLISH" | "BEARISH" | "NEUTRAL"; structure: "BULLISH" | "BEARISH" | "NONE";
  trigger: "BUY" | "SELL" | "NEUTRAL";
};

export const DEFAULT_ADAPTIVE_AUTOMATED_CONFIG: AdaptiveAutomatedConfig = {
  fastEmaLength: 20, mediumEmaLength: 50, slowEmaLength: 100, contextEmaLength: 200,
  rsiLength: 14, rsiBullThreshold: 50, rsiBearThreshold: 50,
  macdFastLength: 12, macdSlowLength: 26, macdSignalLength: 9,
  adxLength: 14, adxMinimum: 20, structureLookback: 5,
  atrLength: 14, atrMultiplier: 1.5, atrStopMultiplier: 1.5, scoreThreshold: 70,
  tp1RR: 2, tp2RR: 3, tp3RR: 4, tp4RR: 5,
  weights: { trend: 25, momentum: 20, strength: 15, structure: 25, trigger: 15 },
};

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function ema(values: number[], length: number): number | null {
  if (values.length < length || length < 1) return null;
  const alpha = 2 / (length + 1);
  let result = values.slice(0, length).reduce((sum, value) => sum + value, 0) / length;
  for (let i = length; i < values.length; i += 1) result = values[i] * alpha + result * (1 - alpha);
  return result;
}
function rmaSeries(values: number[], length: number): Array<number | null> {
  const output: Array<number | null> = Array(values.length).fill(null);
  if (values.length < length || length < 1) return output;
  let result = values.slice(0, length).reduce((sum, value) => sum + value, 0) / length;
  output[length - 1] = result;
  for (let i = length; i < values.length; i += 1) { result = (result * (length - 1) + values[i]) / length; output[i] = result; }
  return output;
}
function rsi(values: number[], length: number): number | null {
  if (values.length <= length || length < 1) return null;
  const gains: number[] = []; const losses: number[] = [];
  for (let i = 1; i < values.length; i += 1) { const change = values[i] - values[i - 1]; gains.push(Math.max(change, 0)); losses.push(Math.max(-change, 0)); }
  const avgGain = rmaSeries(gains, length).at(-1); const avgLoss = rmaSeries(losses, length).at(-1);
  if (!finite(avgGain) || !finite(avgLoss)) return null;
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}
function trueRanges(candles: AdaptiveAutomatedCandle[]): number[] {
  return candles.map((candle, index) => {
    if (index === 0) return candle.high - candle.low;
    const previousClose = candles[index - 1].close;
    return Math.max(candle.high - candle.low, Math.abs(candle.high - previousClose), Math.abs(candle.low - previousClose));
  });
}
function atrSeries(candles: AdaptiveAutomatedCandle[], length: number): Array<number | null> { return rmaSeries(trueRanges(candles), length); }
function macd(values: number[], fast: number, slow: number, signal: number) {
  if (values.length < slow + signal) return null;
  const fastAlpha = 2 / (fast + 1); const slowAlpha = 2 / (slow + 1);
  let fastEma = values.slice(0, fast).reduce((sum, value) => sum + value, 0) / fast;
  let slowEma = values.slice(0, slow).reduce((sum, value) => sum + value, 0) / slow;
  const lineSeries: number[] = [];
  for (let i = fast; i < slow; i += 1) fastEma = values[i] * fastAlpha + fastEma * (1 - fastAlpha);
  lineSeries.push(fastEma - slowEma);
  for (let i = slow; i < values.length; i += 1) { fastEma = values[i] * fastAlpha + fastEma * (1 - fastAlpha); slowEma = values[i] * slowAlpha + slowEma * (1 - slowAlpha); lineSeries.push(fastEma - slowEma); }
  const signalLine = ema(lineSeries, signal); const line = lineSeries.at(-1);
  return finite(line) && finite(signalLine) ? { line, signal: signalLine } : null;
}
function dmi(candles: AdaptiveAutomatedCandle[], length: number) {
  if (candles.length < length * 2) return null;
  const tr = trueRanges(candles);
  const plusDm = candles.map((_, i) => { if (i === 0) return 0; const up = candles[i].high - candles[i - 1].high; const down = candles[i - 1].low - candles[i].low; return up > down && up > 0 ? up : 0; });
  const minusDm = candles.map((_, i) => { if (i === 0) return 0; const up = candles[i].high - candles[i - 1].high; const down = candles[i - 1].low - candles[i].low; return down > up && down > 0 ? down : 0; });
  const smoothedTr = rmaSeries(tr, length); const smoothedPlus = rmaSeries(plusDm, length); const smoothedMinus = rmaSeries(minusDm, length);
  const dx: Array<number | null> = candles.map((_, i) => {
    const trValue = smoothedTr[i]; const plusValue = smoothedPlus[i]; const minusValue = smoothedMinus[i];
    if (!finite(trValue) || !finite(plusValue) || !finite(minusValue) || trValue === 0) return null;
    const plusDi = 100 * plusValue / trValue; const minusDi = 100 * minusValue / trValue; const denominator = plusDi + minusDi;
    return denominator === 0 ? 0 : 100 * Math.abs(plusDi - minusDi) / denominator;
  });
  const adxSeries = rmaSeries(dx.map(value => value ?? 0), length); const last = candles.length - 1;
  const trValue = smoothedTr[last]; const plusValue = smoothedPlus[last]; const minusValue = smoothedMinus[last]; const adx = adxSeries[last];
  if (!finite(trValue) || !finite(plusValue) || !finite(minusValue) || !finite(adx) || trValue === 0) return null;
  return { plusDi: 100 * plusValue / trValue, minusDi: 100 * minusValue / trValue, adx };
}
function adaptiveTrigger(candles: AdaptiveAutomatedCandle[], length: number, multiplier: number) {
  const atrs = atrSeries(candles, length); let stop: number | null = null; let direction: -1 | 0 | 1 = 0;
  for (let i = 0; i < candles.length; i += 1) {
    const currentAtr = atrs[i]; if (!finite(currentAtr)) continue;
    const close = candles[i].close; const candidateBullStop = close - currentAtr * multiplier; const candidateBearStop = close + currentAtr * multiplier;
    if (direction <= 0) { if (close > (stop ?? candidateBullStop)) { direction = 1; stop = candidateBullStop; } else stop = Math.min(stop ?? candidateBullStop, candidateBearStop); }
    if (direction >= 0) { if (close < (stop ?? candidateBearStop)) { direction = -1; stop = candidateBearStop; } else stop = Math.max(stop ?? candidateBearStop, candidateBullStop); }
  }
  return { direction, stop };
}
function score(values: { trend: boolean; momentum: boolean; strength: boolean; structure: boolean; trigger: boolean }, weights: AdaptiveAutomatedWeights): AdaptiveAutomatedComponentScores {
  return { trend: values.trend ? weights.trend : 0, momentum: values.momentum ? weights.momentum : 0, strength: values.strength ? weights.strength : 0, structure: values.structure ? weights.structure : 0, trigger: values.trigger ? weights.trigger : 0 };
}
function total(values: AdaptiveAutomatedComponentScores) { return values.trend + values.momentum + values.strength + values.structure + values.trigger; }
function emptyResult(): AdaptiveAutomatedResult {
  return { direction: "NO TRADE", score: 0, scores: { trend: 0, momentum: 0, strength: 0, structure: 0, trigger: 0 }, confirmed: false, atr: null, entry: null, stopLoss: null, risk: null, tp1: null, tp2: null, tp3: null, tp4: null, trend: "NEUTRAL", momentum: "NEUTRAL", strength: "NEUTRAL", structure: "NONE", trigger: "NEUTRAL" };
}

/** Independent automation copy of the current Adaptive Execution evaluator. */
export function evaluateAdaptiveAutomated(candles: AdaptiveAutomatedCandle[], config: AdaptiveAutomatedConfig = DEFAULT_ADAPTIVE_AUTOMATED_CONFIG): AdaptiveAutomatedResult {
  const minimumBars = Math.max(config.contextEmaLength, config.macdSlowLength + config.macdSignalLength, config.adxLength * 2, config.structureLookback + 1, config.atrLength + 1);
  if (candles.length < minimumBars || candles.some(c => ![c.open, c.high, c.low, c.close].every(finite))) return emptyResult();
  const closes = candles.map(c => c.close); const current = closes.at(-1)!;
  const fast = ema(closes, config.fastEmaLength); const medium = ema(closes, config.mediumEmaLength); const slow = ema(closes, config.slowEmaLength); const context = ema(closes, config.contextEmaLength);
  const currentRsi = rsi(closes, config.rsiLength); const currentMacd = macd(closes, config.macdFastLength, config.macdSlowLength, config.macdSignalLength); const currentDmi = dmi(candles, config.adxLength); const currentAtr = atrSeries(candles, config.atrLength).at(-1); const trigger = adaptiveTrigger(candles, config.atrLength, config.atrMultiplier);
  if (fast == null || medium == null || slow == null || context == null || currentRsi == null || currentAtr == null || currentMacd == null || currentDmi == null) return emptyResult();
  const bullTrend = fast > medium && medium > slow && current > context; const bearTrend = fast < medium && medium < slow && current < context;
  const bullMomentum = currentRsi > config.rsiBullThreshold && currentMacd.line > currentMacd.signal; const bearMomentum = currentRsi < config.rsiBearThreshold && currentMacd.line < currentMacd.signal;
  const bullStrength = currentDmi.adx >= config.adxMinimum && currentDmi.plusDi > currentDmi.minusDi; const bearStrength = currentDmi.adx >= config.adxMinimum && currentDmi.minusDi > currentDmi.plusDi;
  const previous = candles.slice(-(config.structureLookback + 1), -1); const previousHigh = Math.max(...previous.map(c => c.high)); const previousLow = Math.min(...previous.map(c => c.low));
  const bullStructure = current > previousHigh; const bearStructure = current < previousLow;
  const bullTrigger = trigger.direction === 1 && current > (trigger.stop ?? Number.POSITIVE_INFINITY); const bearTrigger = trigger.direction === -1 && current < (trigger.stop ?? Number.NEGATIVE_INFINITY);
  const bullScores = score({ trend: bullTrend, momentum: bullMomentum, strength: bullStrength, structure: bullStructure, trigger: bullTrigger }, config.weights); const bearScores = score({ trend: bearTrend, momentum: bearMomentum, strength: bearStrength, structure: bearStructure, trigger: bearTrigger }, config.weights);
  const bullScore = total(bullScores); const bearScore = total(bearScores);
  const direction: AdaptiveAutomatedDirection = bullScore >= config.scoreThreshold && bullScore > bearScore ? "BUY" : bearScore >= config.scoreThreshold && bearScore > bullScore ? "SELL" : "NO TRADE";
  const scoreValue = direction === "BUY" ? bullScore : direction === "SELL" ? bearScore : Math.max(bullScore, bearScore); const confirmed = direction !== "NO TRADE";
  const entry = confirmed ? current : null; const risk = confirmed ? currentAtr * config.atrStopMultiplier : null; const stopLoss = confirmed && risk !== null ? direction === "BUY" ? entry! - risk : entry! + risk : null;
  const tp1 = confirmed && risk !== null ? direction === "BUY" ? entry! + risk * config.tp1RR : entry! - risk * config.tp1RR : null;
  const tp2 = confirmed && risk !== null ? direction === "BUY" ? entry! + risk * config.tp2RR : entry! - risk * config.tp2RR : null;
  const tp3 = confirmed && risk !== null ? direction === "BUY" ? entry! + risk * config.tp3RR : entry! - risk * config.tp3RR : null;
  const tp4 = confirmed && risk !== null ? direction === "BUY" ? entry! + risk * config.tp4RR : entry! - risk * config.tp4RR : null;
  return { direction, score: scoreValue, scores: direction === "BUY" ? bullScores : direction === "SELL" ? bearScores : bullScore >= bearScore ? bullScores : bearScores, confirmed, atr: currentAtr, entry, stopLoss, risk, tp1, tp2, tp3, tp4, trend: bullTrend ? "BULLISH" : bearTrend ? "BEARISH" : "NEUTRAL", momentum: bullMomentum ? "BULLISH" : bearMomentum ? "BEARISH" : "NEUTRAL", strength: bullStrength ? "BULLISH" : bearStrength ? "BEARISH" : "NEUTRAL", structure: bullStructure ? "BULLISH" : bearStructure ? "BEARISH" : "NONE", trigger: trigger.direction === 1 ? "BUY" : trigger.direction === -1 ? "SELL" : "NEUTRAL" };
}

export default adaptiveAutomatedRules;

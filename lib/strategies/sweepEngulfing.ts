/**
 * VaultTrades — Sweep & Engulfing
 * Source of truth: supplied Pine Script v6 "Sweep and Engulfing".
 * Institutional liquidity sweep + strong displacement/engulfing + opposing liquidity.
 *
 * TradingView drawing/table/alert primitives are represented as structured
 * strategy state for VaultTrades. Entry, risk and target rules are preserved.
 */

export const SWEEP_ENGULFING_ID = "sweepEngulfing" as const;
export const SWEEP_ENGULFING_NAME = "Sweep and Engulfing" as const;

export type SweepDirection = "LONG" | "SHORT" | "NONE";
export type StructureBias = "Bullish" | "Bearish" | "Neutral";
export type StructureEvent = "BULL BOS" | "BEAR BOS" | "BULL CHOCH" | "BEAR CHOCH" | "NONE";

export interface SweepCandle { open: number; high: number; low: number; close: number; volume?: number; time?: number | string; }

export interface SweepEngulfingSettings {
  enableEngine: boolean; minimumRR: number; stopLossMethod: "ATR" | "Sweep"; atrLength: number; atrMultiplier: number; tpMultiplier: number;
  externalSwingLength: number; internalSwingLength: number; trendEMA: number; requireLiquiditySweep: boolean; sweepConfirmationBody: boolean;
  sweepValidityBars: number; volumeLength: number; volumeSpikeMultiplier: number; minimumVolumeScore: number; requireVolumeConfirmation: boolean;
  requireEngulfing: boolean; useEMAFilter: boolean; invertStrategy: boolean; previousCandleDirection: "Same Direction" | "Opposite Direction" | "Any";
  engulfBodyMultiplier: number; engulfATRMultiplier: number; requireFullBodyEngulf: boolean; srLookback: number; srToleranceATR: number; srMinimumScore: number;
}

export const DEFAULT_SWEEP_ENGULFING_SETTINGS: SweepEngulfingSettings = {
  enableEngine: true, minimumRR: 1.63, stopLossMethod: "ATR", atrLength: 14, atrMultiplier: 1.8, tpMultiplier: 2.0,
  externalSwingLength: 10, internalSwingLength: 3, trendEMA: 200, requireLiquiditySweep: true, sweepConfirmationBody: true,
  sweepValidityBars: 3, volumeLength: 20, volumeSpikeMultiplier: 1.5, minimumVolumeScore: 70, requireVolumeConfirmation: false,
  requireEngulfing: true, useEMAFilter: true, invertStrategy: false, previousCandleDirection: "Same Direction",
  engulfBodyMultiplier: 1.2, engulfATRMultiplier: 0.5, requireFullBodyEngulf: true, srLookback: 50, srToleranceATR: 0.25, srMinimumScore: 40,
};

export interface SweepStructureState {
  bias: StructureBias; trend: -1 | 0 | 1; event: StructureEvent;
  bullishBOS: boolean; bearishBOS: boolean; bullishCHOCH: boolean; bearishCHOCH: boolean; bullishMSS: boolean; bearishMSS: boolean;
  externalHigh: number | null; externalLow: number | null; previousExternalHigh: number | null; previousExternalLow: number | null;
  higherHigh: boolean; lowerHigh: boolean; higherLow: boolean; lowerLow: boolean;
  strongHigh: boolean; weakHigh: boolean; strongLow: boolean; weakLow: boolean;
}

export interface SweepLiquidityState {
  bullishSweepConfirmed: boolean; bearishSweepConfirmed: boolean; bullishSweepActive: boolean; bearishSweepActive: boolean;
  bullishSweepPrice: number | null; bearishSweepPrice: number | null;
}

export interface SweepEngulfingResult {
  strategyId: typeof SWEEP_ENGULFING_ID; strategyName: typeof SWEEP_ENGULFING_NAME; direction: SweepDirection;
  signal: "BUY" | "SELL" | "WAIT"; isNewSignal: boolean; entryPrice: number | null; stopLoss: number | null;
  target1: number | null; target2: number | null; target3: number | null; riskReward: number | null;
  structure: SweepStructureState; liquidity: SweepLiquidityState;
  engulfing: { bullish: boolean; bearish: boolean; body: number; previousBody: number; bodyVsATR: number; bodyExpansion: boolean };
  volume: { averageVolume: number; relativeVolume: number; institutionalVolume: boolean; volumeScore: number; volumeConfirmed: boolean };
  opposingLiquidity: number | null;
  support: { level: number | null; strength: number; status: string; touch: boolean; reaction: boolean };
  resistance: { level: number | null; strength: number; status: string; touch: boolean; reaction: boolean };
  confidence: number; evidence: string[]; invalidation: string[]; message: string;
}

interface InternalState {
  externalHigh: number | null; externalLow: number | null; previousExternalHigh: number | null; previousExternalLow: number | null;
  externalHighBar: number | null; externalLowBar: number | null; previousExternalHighBar: number | null; previousExternalLowBar: number | null;
  structureTrend: -1 | 0 | 1; bullishSweepBar: number | null; bearishSweepBar: number | null;
  bullishSweepPrice: number | null; bearishSweepPrice: number | null; previousFinalLong: boolean; previousFinalShort: boolean;
}

function sma(values: number[], length: number, index: number): number {
  const start = Math.max(0, index - length + 1); let total = 0; let count = 0;
  for (let i = start; i <= index; i += 1) { const v = values[i]; if (Number.isFinite(v)) { total += v; count += 1; } }
  return count ? total / count : 0;
}
function ema(values: number[], length: number): number[] {
  if (!values.length) return []; const out = new Array<number>(values.length); const alpha = 2 / (length + 1); out[0] = values[0];
  for (let i = 1; i < values.length; i += 1) out[i] = alpha * values[i] + (1 - alpha) * out[i - 1]; return out;
}
function atrSeries(candles: SweepCandle[], length: number): number[] {
  const tr = candles.map((c, i) => i === 0 ? c.high - c.low : Math.max(c.high - c.low, Math.abs(c.high - candles[i - 1].close), Math.abs(c.low - candles[i - 1].close)));
  return tr.map((_, i) => sma(tr, length, i));
}
function isPivotHigh(candles: SweepCandle[], index: number, length: number): boolean {
  if (index - length < 0 || index + length >= candles.length) return false; const value = candles[index].high;
  for (let i = index - length; i <= index + length; i += 1) if (i !== index && candles[i].high >= value) return false; return true;
}
function isPivotLow(candles: SweepCandle[], index: number, length: number): boolean {
  if (index - length < 0 || index + length >= candles.length) return false; const value = candles[index].low;
  for (let i = index - length; i <= index + length; i += 1) if (i !== index && candles[i].low <= value) return false; return true;
}
function round(value: number, decimals = 2): number { const factor = 10 ** decimals; return Math.round(value * factor) / factor; }
function nearestHighAbove(entry: number, high: number | null, previousHigh: number | null): number | null {
  const candidates = [high, previousHigh].filter((v): v is number => v !== null && v > entry); return candidates.length ? Math.min(...candidates) : null;
}
function nearestLowBelow(entry: number, low: number | null, previousLow: number | null): number | null {
  const candidates = [low, previousLow].filter((v): v is number => v !== null && v < entry); return candidates.length ? Math.max(...candidates) : null;
}
function statusForStrength(score: number): string { return score >= 80 ? "VERY STRONG" : score >= 65 ? "STRONG" : score >= 50 ? "MODERATE" : "WEAK"; }
function srStrength(candles: SweepCandle[], level: number | null, atr: number, lookback: number, toleranceATR: number, support: boolean) {
  if (level === null) return { score: 0, touch: false, reaction: false };
  const start = Math.max(0, candles.length - lookback); const tolerance = atr * toleranceATR;
  const volumes = candles.map(c => c.volume ?? 0); const avg = volumes.length ? volumes.reduce((a, b) => a + b, 0) / volumes.length : 0;
  let touches = 0, reactions = 0, volumeReactions = 0, latestTouch = false, latestReaction = false;
  for (let i = start; i < candles.length; i += 1) {
    const c = candles[i]; const touch = support ? c.low <= level + tolerance && c.high >= level - tolerance : c.high >= level - tolerance && c.low <= level + tolerance;
    const reaction = support ? touch && c.close > level : touch && c.close < level;
    if (touch) touches += 1; if (reaction) reactions += 1; if (reaction && avg > 0 && (c.volume ?? 0) / avg >= 1) volumeReactions += 1;
    if (i === candles.length - 1) { latestTouch = touch; latestReaction = reaction; }
  }
  return { score: Math.min(100, Math.min(touches * 10, 40) + Math.min(reactions * 10, 35) + Math.min(volumeReactions * 5, 25)), touch: latestTouch, reaction: latestReaction };
}

function evaluate(candles: SweepCandle[], settings: SweepEngulfingSettings, state: InternalState, index: number): SweepEngulfingResult {
  const c = candles[index], prev = index > 0 ? candles[index - 1] : null;
  const atr = atrSeries(candles.slice(0, index + 1), settings.atrLength)[index] || Math.max(c.high - c.low, 1e-10);
  const closes = candles.slice(0, index + 1).map(x => x.close); const emaTrend = ema(closes, settings.trendEMA)[index];
  const volumes = candles.slice(0, index + 1).map(x => x.volume ?? 0); const averageVolume = sma(volumes, settings.volumeLength, index);
  const relativeVolume = averageVolume > 0 ? (c.volume ?? 0) / averageVolume : 0; const volumeScore = Math.min(100, relativeVolume / settings.volumeSpikeMultiplier * 100);
  const volumeOK = !settings.requireVolumeConfirmation || volumeScore >= settings.minimumVolumeScore;

  let bullishBOS = false, bearishBOS = false, bullishCHOCH = false, bearishCHOCH = false, bullishMSS = false, bearishMSS = false;
  let higherHigh = false, lowerHigh = false, higherLow = false, lowerLow = false;
  const ph = index - settings.externalSwingLength, pl = index - settings.externalSwingLength;
  if (ph >= 0 && isPivotHigh(candles, ph, settings.externalSwingLength)) { state.previousExternalHigh = state.externalHigh; state.previousExternalHighBar = state.externalHighBar; state.externalHigh = candles[ph].high; state.externalHighBar = ph; }
  if (pl >= 0 && isPivotLow(candles, pl, settings.externalSwingLength)) { state.previousExternalLow = state.externalLow; state.previousExternalLowBar = state.externalLowBar; state.externalLow = candles[pl].low; state.externalLowBar = pl; }
  if (state.previousExternalHigh !== null && state.externalHigh !== null) { higherHigh = state.externalHigh > state.previousExternalHigh; lowerHigh = state.externalHigh < state.previousExternalHigh; }
  if (state.previousExternalLow !== null && state.externalLow !== null) { higherLow = state.externalLow > state.previousExternalLow; lowerLow = state.externalLow < state.previousExternalLow; }
  if (higherHigh && higherLow) state.structureTrend = 1; if (lowerHigh && lowerLow) state.structureTrend = -1;
  const previousTrend = state.structureTrend; const previousClose = prev?.close ?? null;
  const bullishBreak = state.externalHigh !== null && previousClose !== null && c.close > state.externalHigh && previousClose <= state.externalHigh;
  const bearishBreak = state.externalLow !== null && previousClose !== null && c.close < state.externalLow && previousClose >= state.externalLow;
  if (bullishBreak) { if (previousTrend === -1) { bullishCHOCH = true; bullishMSS = true; } else bullishBOS = true; state.structureTrend = 1; }
  if (bearishBreak) { if (previousTrend === 1) { bearishCHOCH = true; bearishMSS = true; } else bearishBOS = true; state.structureTrend = -1; }

  const bullishSweep = state.externalLow !== null && c.low < state.externalLow && c.close > state.externalLow;
  const bearishSweep = state.externalHigh !== null && c.high > state.externalHigh && c.close < state.externalHigh;
  const bullishSweepConfirmed = bullishSweep && (!settings.sweepConfirmationBody || c.close > c.open);
  const bearishSweepConfirmed = bearishSweep && (!settings.sweepConfirmationBody || c.close < c.open);
  if (bullishSweepConfirmed) { state.bullishSweepBar = index; state.bullishSweepPrice = c.low; }
  if (bearishSweepConfirmed) { state.bearishSweepBar = index; state.bearishSweepPrice = c.high; }
  const bullishSweepActive = state.bullishSweepBar !== null && index - state.bullishSweepBar <= settings.sweepValidityBars;
  const bearishSweepActive = state.bearishSweepBar !== null && index - state.bearishSweepBar <= settings.sweepValidityBars;

  const body = Math.abs(c.close - c.open), previousBody = prev ? Math.abs(prev.close - prev.open) : 0;
  const currentBullish = c.close > c.open, currentBearish = c.close < c.open;
  const bullishBodyStrong = currentBullish && body >= atr * settings.engulfATRMultiplier;
  const bearishBodyStrong = currentBearish && body >= atr * settings.engulfATRMultiplier;
  const bullishBodyExpansion = currentBullish && (previousBody <= 0 || body >= previousBody * settings.engulfBodyMultiplier);
  const bearishBodyExpansion = currentBearish && (previousBody <= 0 || body >= previousBody * settings.engulfBodyMultiplier);
  const bullPrevOK = !prev || settings.previousCandleDirection === "Any" || (settings.previousCandleDirection === "Opposite Direction" ? prev.close < prev.open : prev.close > prev.open);
  const bearPrevOK = !prev || settings.previousCandleDirection === "Any" || (settings.previousCandleDirection === "Opposite Direction" ? prev.close > prev.open : prev.close < prev.open);
  const strongBullishEngulfing = currentBullish && bullishBodyStrong && bullishBodyExpansion && volumeOK && bullPrevOK;
  const strongBearishEngulfing = currentBearish && bearishBodyStrong && bearishBodyExpansion && volumeOK && bearPrevOK;

  const longEMAOK = !settings.useEMAFilter || c.close > emaTrend, shortEMAOK = !settings.useEMAFilter || c.close < emaTrend;
  const candidateLongEntry = c.close, candidateShortEntry = c.close;
  const longLiquidityTarget = nearestHighAbove(candidateLongEntry, state.externalHigh, state.previousExternalHigh);
  const shortLiquidityTarget = nearestLowBelow(candidateShortEntry, state.externalLow, state.previousExternalLow);
  const candidateLongStop = settings.stopLossMethod === "ATR" ? candidateLongEntry - atr * settings.atrMultiplier : (state.bullishSweepPrice !== null ? state.bullishSweepPrice - atr * 0.10 : candidateLongEntry - atr * settings.atrMultiplier);
  const candidateShortStop = settings.stopLossMethod === "ATR" ? candidateShortEntry + atr * settings.atrMultiplier : (state.bearishSweepPrice !== null ? state.bearishSweepPrice + atr * 0.10 : candidateShortEntry + atr * settings.atrMultiplier);
  const longRisk = candidateLongEntry - candidateLongStop, shortRisk = candidateShortStop - candidateShortEntry;
  const longRR = longLiquidityTarget !== null && longRisk > 0 ? (longLiquidityTarget - candidateLongEntry) / longRisk : null;
  const shortRR = shortLiquidityTarget !== null && shortRisk > 0 ? (candidateShortEntry - shortLiquidityTarget) / shortRisk : null;
  const longQualified = settings.enableEngine && bullishSweepActive && strongBullishEngulfing && longEMAOK && volumeOK && longLiquidityTarget !== null && longLiquidityTarget > candidateLongEntry && longRR !== null && longRR >= settings.minimumRR;
  const shortQualified = settings.enableEngine && bearishSweepActive && strongBearishEngulfing && shortEMAOK && volumeOK && shortLiquidityTarget !== null && shortLiquidityTarget < candidateShortEntry && shortRR !== null && shortRR >= settings.minimumRR;
  const rawLong = settings.requireLiquiditySweep ? longQualified : strongBullishEngulfing && longEMAOK && volumeOK;
  const rawShort = settings.requireLiquiditySweep ? shortQualified : strongBearishEngulfing && shortEMAOK && volumeOK;
  const finalLong = settings.invertStrategy ? rawShort : rawLong, finalShort = settings.invertStrategy ? rawLong : rawShort;
  const longSignal = finalLong && !state.previousFinalLong, shortSignal = finalShort && !state.previousFinalShort;
  state.previousFinalLong = finalLong; state.previousFinalShort = finalShort;

  const support = srStrength(candles.slice(0, index + 1), state.externalLow, atr, settings.srLookback, settings.srToleranceATR, true);
  const resistance = srStrength(candles.slice(0, index + 1), state.externalHigh, atr, settings.srLookback, settings.srToleranceATR, false);
  const direction: SweepDirection = longSignal ? "LONG" : shortSignal ? "SHORT" : "NONE";
  const signal = longSignal ? "BUY" : shortSignal ? "SELL" : "WAIT";
  const entry = longSignal ? candidateLongEntry : shortSignal ? candidateShortEntry : null;
  const stop = longSignal ? candidateLongStop : shortSignal ? candidateShortStop : null;
  const target1 = longSignal ? longLiquidityTarget : shortSignal ? shortLiquidityTarget : null;
  const activeRR = longSignal ? longRR : shortSignal ? shortRR : null;
  const risk = longSignal && longRisk > 0 ? longRisk : shortSignal && shortRisk > 0 ? shortRisk : null;
  const target2 = entry !== null && risk !== null ? (longSignal ? entry + risk * Math.max(settings.minimumRR + 0.50, settings.tpMultiplier + 0.50) : entry - risk * Math.max(settings.minimumRR + 0.50, settings.tpMultiplier + 0.50)) : null;
  const target3 = entry !== null && risk !== null ? (longSignal ? entry + risk * Math.max(settings.minimumRR + 1.00, settings.tpMultiplier + 1.00) : entry - risk * Math.max(settings.minimumRR + 1.00, settings.tpMultiplier + 1.00)) : null;
  const evidence: string[] = [], invalidation: string[] = [];
  if (bullishSweepConfirmed) evidence.push("Sell-side liquidity swept and price closed back above the confirmed low.");
  if (bearishSweepConfirmed) evidence.push("Buy-side liquidity swept and price closed back below the confirmed high.");
  if (strongBullishEngulfing) evidence.push("Strong bullish displacement/engulfing confirmation is present.");
  if (strongBearishEngulfing) evidence.push("Strong bearish displacement/engulfing confirmation is present.");
  if (bullishCHOCH) evidence.push("Bullish CHOCH/MSS confirmed."); if (bearishCHOCH) evidence.push("Bearish CHOCH/MSS confirmed.");
  if (bullishBOS) evidence.push("Bullish BOS confirmed."); if (bearishBOS) evidence.push("Bearish BOS confirmed.");
  if (longLiquidityTarget !== null) evidence.push(`Nearest opposing buy-side liquidity is ${round(longLiquidityTarget)}.`);
  if (shortLiquidityTarget !== null) evidence.push(`Nearest opposing sell-side liquidity is ${round(shortLiquidityTarget)}.`);
  if (!longSignal && !shortSignal) invalidation.push("A new signal requires the configured sweep + strong engulfing + filters + opposing liquidity + minimum RR qualification.");
  if (settings.requireLiquiditySweep && !bullishSweepActive && !bearishSweepActive) invalidation.push("No active confirmed liquidity sweep within the configured validity window.");
  if (settings.requireVolumeConfirmation && !volumeOK) invalidation.push(`Volume score ${round(volumeScore)} is below the required ${settings.minimumVolumeScore}.`);
  const confidence = longSignal || shortSignal ? 100 : Math.min(99, Math.round((bullishSweepActive || bearishSweepActive ? 30 : 0) + (strongBullishEngulfing || strongBearishEngulfing ? 30 : 0) + (longEMAOK || shortEMAOK ? 15 : 0) + (volumeOK ? 10 : 0) + (longLiquidityTarget !== null || shortLiquidityTarget !== null ? 15 : 0)));
  const message = longSignal ? "BUY — sell-side liquidity swept, bullish displacement/engulfing confirmed, opposing buy-side liquidity available, and minimum RR qualified." : shortSignal ? "SELL — buy-side liquidity swept, bearish displacement/engulfing confirmed, opposing sell-side liquidity available, and minimum RR qualified." : "WAIT — Sweep & Engulfing conditions are not fully qualified.";

  return {
    strategyId: SWEEP_ENGULFING_ID, strategyName: SWEEP_ENGULFING_NAME, direction, signal, isNewSignal: longSignal || shortSignal,
    entryPrice: entry, stopLoss: stop, target1, target2, target3, riskReward: activeRR,
    structure: { bias: state.structureTrend === 1 ? "Bullish" : state.structureTrend === -1 ? "Bearish" : "Neutral", trend: state.structureTrend,
      event: bullishCHOCH ? "BULL CHOCH" : bearishCHOCH ? "BEAR CHOCH" : bullishBOS ? "BULL BOS" : bearishBOS ? "BEAR BOS" : "NONE",
      bullishBOS, bearishBOS, bullishCHOCH, bearishCHOCH, bullishMSS, bearishMSS,
      externalHigh: state.externalHigh, externalLow: state.externalLow, previousExternalHigh: state.previousExternalHigh, previousExternalLow: state.previousExternalLow,
      higherHigh, lowerHigh, higherLow, lowerLow,
      strongHigh: state.structureTrend === -1 && state.externalHigh !== null, weakHigh: state.structureTrend === 1 && state.externalHigh !== null,
      strongLow: state.structureTrend === 1 && state.externalLow !== null, weakLow: state.structureTrend === -1 && state.externalLow !== null },
    liquidity: { bullishSweepConfirmed, bearishSweepConfirmed, bullishSweepActive, bearishSweepActive, bullishSweepPrice: state.bullishSweepPrice, bearishSweepPrice: state.bearishSweepPrice },
    engulfing: { bullish: strongBullishEngulfing, bearish: strongBearishEngulfing, body, previousBody, bodyVsATR: atr > 0 ? body / atr : 0, bodyExpansion: bullishBodyExpansion || bearishBodyExpansion },
    volume: { averageVolume, relativeVolume, institutionalVolume: relativeVolume >= settings.volumeSpikeMultiplier, volumeScore, volumeConfirmed: volumeOK },
    opposingLiquidity: target1,
    support: { level: state.externalLow, strength: support.score, status: statusForStrength(support.score), touch: support.touch, reaction: support.reaction },
    resistance: { level: state.externalHigh, strength: resistance.score, status: statusForStrength(resistance.score), touch: resistance.touch, reaction: resistance.reaction },
    confidence, evidence, invalidation, message,
  };
}

export function analyzeSweepEngulfing(candles: SweepCandle[], settingsInput: Partial<SweepEngulfingSettings> = {}): SweepEngulfingResult {
  const settings = { ...DEFAULT_SWEEP_ENGULFING_SETTINGS, ...settingsInput };
  if (candles.length < Math.max(settings.externalSwingLength * 2 + 1, settings.atrLength + 2)) return emptySweepResult();
  const state: InternalState = { externalHigh: null, externalLow: null, previousExternalHigh: null, previousExternalLow: null, externalHighBar: null, externalLowBar: null, previousExternalHighBar: null, previousExternalLowBar: null, structureTrend: 0, bullishSweepBar: null, bearishSweepBar: null, bullishSweepPrice: null, bearishSweepPrice: null, previousFinalLong: false, previousFinalShort: false };
  let result = emptySweepResult(); for (let i = 0; i < candles.length; i += 1) result = evaluate(candles, settings, state, i); return result;
}

function emptySweepResult(): SweepEngulfingResult {
  return { strategyId: SWEEP_ENGULFING_ID, strategyName: SWEEP_ENGULFING_NAME, direction: "NONE", signal: "WAIT", isNewSignal: false, entryPrice: null, stopLoss: null, target1: null, target2: null, target3: null, riskReward: null,
    structure: { bias: "Neutral", trend: 0, event: "NONE", bullishBOS: false, bearishBOS: false, bullishCHOCH: false, bearishCHOCH: false, bullishMSS: false, bearishMSS: false, externalHigh: null, externalLow: null, previousExternalHigh: null, previousExternalLow: null, higherHigh: false, lowerHigh: false, higherLow: false, lowerLow: false, strongHigh: false, weakHigh: false, strongLow: false, weakLow: false },
    liquidity: { bullishSweepConfirmed: false, bearishSweepConfirmed: false, bullishSweepActive: false, bearishSweepActive: false, bullishSweepPrice: null, bearishSweepPrice: null },
    engulfing: { bullish: false, bearish: false, body: 0, previousBody: 0, bodyVsATR: 0, bodyExpansion: false },
    volume: { averageVolume: 0, relativeVolume: 0, institutionalVolume: false, volumeScore: 0, volumeConfirmed: false }, opposingLiquidity: null,
    support: { level: null, strength: 0, status: "WEAK", touch: false, reaction: false }, resistance: { level: null, strength: 0, status: "WEAK", touch: false, reaction: false }, confidence: 0, evidence: [], invalidation: ["Insufficient candle history for Sweep & Engulfing evaluation."], message: "WAIT — insufficient market data." };
}

export const sweepEngulfingStrategy = { id: SWEEP_ENGULFING_ID, name: SWEEP_ENGULFING_NAME, description: "Institutional liquidity sweep + strong engulfing/displacement + opposing liquidity target.", timeframes: ["chart"] as const, analyze: analyzeSweepEngulfing };
export default sweepEngulfingStrategy;

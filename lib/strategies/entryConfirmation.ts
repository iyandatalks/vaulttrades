import type { Candle, Side } from "../types";

export type EntryConfirmationStage =
  | "AOI"
  | "WHY_PRICE_RETURNED"
  | "LIQUIDITY_SWEEP"
  | "FAILED_SWING"
  | "REJECTION"
  | "STRATEGY_CHANNEL"
  | "BREAKOUT"
  | "RETEST"
  | "MSS_CHOCH"
  | "VOLUME"
  | "ENTRY_LOCATION";

export interface EntryConfirmationResult {
  valid: boolean;
  side: Side;
  score: number;
  stages: Record<EntryConfirmationStage, boolean>;
  evidence: string[];
  missingConditions: string[];
  swingHigh: number | null;
  swingLow: number | null;
  sweepIndex: number | null;
  structureBreakIndex: number | null;
  retestIndex: number | null;
  message: string;
}

export interface EntryConfirmationOptions {
  side: Side;
  lookback?: number;
  atrLength?: number;
  displacementAtr?: number;
  retestBars?: number;
  volumeMultiplier?: number;
  channelLow?: number | null;
  channelHigh?: number | null;
  requireVolume?: boolean;
}

const STAGES: EntryConfirmationStage[] = [
  "AOI", "WHY_PRICE_RETURNED", "LIQUIDITY_SWEEP", "FAILED_SWING", "REJECTION",
  "STRATEGY_CHANNEL", "BREAKOUT", "RETEST", "MSS_CHOCH", "VOLUME", "ENTRY_LOCATION",
];

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function trueRange(c: Candle, previous?: Candle) {
  if (!previous) return Math.max(0, c.high - c.low);
  return Math.max(c.high - c.low, Math.abs(c.high - previous.close), Math.abs(c.low - previous.close));
}

function atrAt(candles: Candle[], index: number, length: number) {
  const start = Math.max(0, index - length + 1);
  const values = candles.slice(start, index + 1).map((c, i) => trueRange(c, candles[start + i - 1]));
  if (values.length < length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function average(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function priorHigh(candles: Candle[], index: number, lookback: number) {
  const slice = candles.slice(Math.max(0, index - lookback), index);
  return slice.length ? Math.max(...slice.map(c => c.high)) : null;
}

function priorLow(candles: Candle[], index: number, lookback: number) {
  const slice = candles.slice(Math.max(0, index - lookback), index);
  return slice.length ? Math.min(...slice.map(c => c.low)) : null;
}

function stageMap(values: Partial<Record<EntryConfirmationStage, boolean>>) {
  return Object.fromEntries(STAGES.map(stage => [stage, values[stage] === true])) as Record<EntryConfirmationStage, boolean>;
}

export function evaluateEntryConfirmation(candles: Candle[], options: EntryConfirmationOptions): EntryConfirmationResult {
  const side = options.side;
  const lookback = Math.max(5, options.lookback ?? 20);
  const atrLength = Math.max(5, options.atrLength ?? 14);
  const displacementAtr = options.displacementAtr ?? 0.6;
  const retestBars = Math.max(1, options.retestBars ?? 6);
  const volumeMultiplier = options.volumeMultiplier ?? 1.2;
  const requireVolume = options.requireVolume ?? true;
  const emptyStages = stageMap({});

  if (candles.length < Math.max(atrLength + 2, lookback + 2)) {
    return {
      valid: false, side, score: 0, stages: emptyStages, evidence: [],
      missingConditions: ["Sufficient candle history"], swingHigh: null, swingLow: null,
      sweepIndex: null, structureBreakIndex: null, retestIndex: null,
      message: "WAIT: insufficient history for entry confirmation.",
    };
  }

  let best: EntryConfirmationResult | null = null;

  for (let i = lookback; i < candles.length - 1; i += 1) {
    const current = candles[i];
    const previous = candles[i - 1];
    const swingHigh = priorHigh(candles, i, lookback);
    const swingLow = priorLow(candles, i, lookback);
    const atr = atrAt(candles, i, atrLength);
    if (!finite(swingHigh) || !finite(swingLow) || !finite(atr) || atr <= 0) continue;

    const buySweep = side === "BUY" && current.low < swingLow && current.close > swingLow;
    const sellSweep = side === "SELL" && current.high > swingHigh && current.close < swingHigh;
    if (!buySweep && !sellSweep) continue;

    const rejectionBody = Math.abs(current.close - current.open);
    const buyReject = side === "BUY" && current.close > current.open && current.close > swingLow;
    const sellReject = side === "SELL" && current.close < current.open && current.close < swingHigh;
    const rejection = buyReject || sellReject || rejectionBody >= atr * 0.25;

    let breakIndex: number | null = null;
    let retestIndex: number | null = null;
    let breakoutAccepted = false;
    let retestConfirmed = false;
    let volumeConfirmed = false;
    let entryLocation = false;

    for (let j = i + 1; j <= Math.min(candles.length - 1, i + retestBars + 3); j += 1) {
      const x = candles[j];
      const xAtr = atrAt(candles, j, atrLength) ?? atr;
      const body = Math.abs(x.close - x.open);
      const displacement = body >= xAtr * displacementAtr;
      const breakLevel = side === "BUY" ? swingHigh : swingLow;
      const directionalBreak = side === "BUY" ? x.close > breakLevel : x.close < breakLevel;

      if (breakIndex === null && directionalBreak && displacement) {
        breakIndex = j;
        breakoutAccepted = true;
        const priorVolumes = candles.slice(Math.max(0, j - 20), j).map(c => c.volume ?? 0).filter(v => v > 0);
        const avgVolume = average(priorVolumes);
        volumeConfirmed = !requireVolume || (finite(avgVolume) && (x.volume ?? 0) >= avgVolume * volumeMultiplier);
        continue;
      }

      if (breakIndex !== null && j > breakIndex) {
        const level = side === "BUY" ? swingHigh : swingLow;
        const touched = side === "BUY"
          ? x.low <= level + xAtr * 0.25
          : x.high >= level - xAtr * 0.25;
        const held = side === "BUY" ? x.close > level : x.close < level;
        if (touched && held) {
          retestIndex = j;
          retestConfirmed = true;
          entryLocation = side === "BUY" ? x.close > level + xAtr * 0.10 : x.close < level - xAtr * 0.10;
          break;
        }
      }
    }

    const stages = stageMap({
      AOI: true,
      WHY_PRICE_RETURNED: true,
      LIQUIDITY_SWEEP: true,
      FAILED_SWING: true,
      REJECTION: rejection,
      STRATEGY_CHANNEL: options.channelLow != null && options.channelHigh != null
        ? (side === "BUY" ? current.low <= options.channelHigh : current.high >= options.channelLow)
        : true,
      BREAKOUT: breakoutAccepted,
      RETEST: retestConfirmed,
      MSS_CHOCH: breakIndex !== null,
      VOLUME: volumeConfirmed,
      ENTRY_LOCATION: entryLocation,
    });

    const evidence: string[] = [
      side === "BUY" ? "Previous meaningful swing low identified" : "Previous meaningful swing high identified",
      side === "BUY" ? "Sell-side liquidity sweep failed back above the swing" : "Buy-side liquidity sweep failed back below the swing",
      "Failed swing converted the liquidity event into a directional setup",
    ];
    if (rejection) evidence.push("Rejection/displacement response confirmed");
    if (breakoutAccepted) evidence.push("Directional breakout accepted with displacement");
    if (retestConfirmed) evidence.push("Breakout level retested and held");
    if (breakIndex !== null) evidence.push("MSS/CHOCH structure shift confirmed");
    if (volumeConfirmed) evidence.push("Volume validates the directional move");
    if (entryLocation) evidence.push("Price left the reversal area before entry");
    if (options.channelLow != null && options.channelHigh != null) evidence.push("Strategy-specific entry channel was respected");

    const missingConditions = STAGES.filter(stage => !stages[stage]).map(stage => stage.replaceAll("_", " "));
    const score = Math.round((STAGES.filter(stage => stages[stage]).length / STAGES.length) * 100);
    const valid = STAGES.every(stage => stages[stage]);
    const result: EntryConfirmationResult = {
      valid, side, score, stages, evidence, missingConditions,
      swingHigh, swingLow, sweepIndex: i, structureBreakIndex: breakIndex,
      retestIndex, message: valid
        ? `${side} ENTRY VALID: AOI → liquidity failure → rejection → breakout → retest → MSS/CHOCH → volume → entry location.`
        : `${side} WAIT: entry confirmation incomplete (${score}/100).`,
    };

    if (!best || result.score > best.score || (result.valid && !best.valid)) best = result;
    if (result.valid) return result;
  }

  return best ?? {
    valid: false, side, score: 0, stages: emptyStages, evidence: [],
    missingConditions: STAGES.map(stage => stage.replaceAll("_", " ")),
    swingHigh: null, swingLow: null, sweepIndex: null, structureBreakIndex: null,
    retestIndex: null, message: `${side} WAIT: no complete entry-confirmation sequence found.`,
  };
}

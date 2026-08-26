import type { MarketDataCandle } from "../market-data/twelvedata";

export type Ema20EngineConfig = {
  ema20Length?: number;
  slowLength?: number;
  atrLength?: number;
  atrTouch?: number;
  atrSLMultiplier?: number;
  riskReward?: number;
  pivotLength?: number;
  confirmationBars?: number;
  utKeyValue?: number;
  utATRLength?: number;
  smiLength?: number;
  smiK?: number;
  smiD?: number;
};

export type Ema20EngineBar = {
  index: number;
  datetime: string;
  close: number;
  ema20: number | null;
  slowEMA: number | null;
  atr: number | null;
  pivotHigh: number | null;
  pivotLow: number | null;
  lastSwingHigh: number | null;
  previousSwingHigh: number | null;
  lastSwingLow: number | null;
  previousSwingLow: number | null;
  higherHigh: boolean;
  higherLow: boolean;
  lowerHigh: boolean;
  lowerLow: boolean;
  bullStructure: boolean;
  bearStructure: boolean;
  bullTouch: boolean;
  bearTouch: boolean;
  bullReject: boolean;
  bearReject: boolean;
  bullRejectHigh: number | null;
  bullRejectLow: number | null;
  bullRejectBar: number | null;
  bearRejectHigh: number | null;
  bearRejectLow: number | null;
  bearRejectBar: number | null;
  bullActive: boolean;
  bearActive: boolean;
  bullMABreak: boolean;
  bearMABreak: boolean;
  utStop: number | null;
  utBull: boolean;
  utBear: boolean;
  smiMain: number | null;
  smiSignal: number | null;
  smiBull: boolean;
  smiBear: boolean;
  longConfirmationScore: number;
  shortConfirmationScore: number;
  longSignal: boolean;
  shortSignal: boolean;
  newLong: boolean;
  newShort: boolean;
  longEntry: number | null;
  longSL: number | null;
  longTP: number | null;
  shortEntry: number | null;
  shortSL: number | null;
  shortTP: number | null;
  bias0600: -1 | 0 | 1;
};

const finite = (v: number | null | undefined): v is number => v !== null && v !== undefined && Number.isFinite(v);

function sma(values: Array<number | null>, length: number, end: number): number | null {
  if (length < 1 || end < length - 1) return null;
  const slice = values.slice(end - length + 1, end + 1);
  if (slice.some(v => v === null)) return null;
  return (slice as number[]).reduce((a, b) => a + b, 0) / length;
}

function emaSeries(values: Array<number | null>, length: number): Array<number | null> {
  const out: Array<number | null> = Array(values.length).fill(null);
  if (length < 1) return out;
  let previous: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (previous === null) {
      const seed = sma(values, length, i);
      if (seed !== null) {
        previous = seed;
        out[i] = seed;
      }
    } else if (values[i] !== null) {
      previous = values[i]! * (2 / (length + 1)) + previous * (1 - 2 / (length + 1));
      out[i] = previous;
    }
  }
  return out;
}

function rmaSeries(values: Array<number | null>, length: number): Array<number | null> {
  const out: Array<number | null> = Array(values.length).fill(null);
  let previous: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (previous === null) {
      const seed = sma(values, length, i);
      if (seed !== null) {
        previous = seed;
        out[i] = seed;
      }
    } else if (values[i] !== null) {
      previous = (previous * (length - 1) + values[i]!) / length;
      out[i] = previous;
    }
  }
  return out;
}

function trueRangeSeries(candles: MarketDataCandle[]): number[] {
  return candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const p = candles[i - 1];
    return Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close));
  });
}

function pivotAt(candles: MarketDataCandle[], i: number, length: number, high: boolean): number | null {
  const pivotIndex = i - length;
  if (pivotIndex < length || pivotIndex + length >= candles.length) return null;
  const value = high ? candles[pivotIndex].high : candles[pivotIndex].low;
  for (let j = 1; j <= length; j++) {
    if (high) {
      if (value <= candles[pivotIndex - j].high || value <= candles[pivotIndex + j].high) return null;
    } else {
      if (value >= candles[pivotIndex - j].low || value >= candles[pivotIndex + j].low) return null;
    }
  }
  return value;
}

function smiSeries(candles: MarketDataCandle[], length: number, smooth1: number, smooth2: number) {
  const relative: Array<number | null> = Array(candles.length).fill(null);
  const distance: Array<number | null> = Array(candles.length).fill(null);
  for (let i = length - 1; i < candles.length; i++) {
    const window = candles.slice(i - length + 1, i + 1);
    const hh = Math.max(...window.map(c => c.high));
    const ll = Math.min(...window.map(c => c.low));
    relative[i] = candles[i].close - (hh + ll) / 2;
    distance[i] = hh - ll;
  }
  const relativeEMA = emaSeries(relative, smooth1);
  const rangeEMA = emaSeries(distance, smooth1);
  const raw: Array<number | null> = candles.map((_, i) => {
    const r = relativeEMA[i], d = rangeEMA[i];
    return d !== null && d !== 0 && r !== null ? 200 * r / d : null;
  });
  const main = emaSeries(raw, smooth2);
  const signal = emaSeries(main, smooth2);
  return { main, signal };
}

const defaults: Required<Ema20EngineConfig> = {
  ema20Length: 20,
  slowLength: 105,
  atrLength: 14,
  atrTouch: 0.20,
  atrSLMultiplier: 2.23,
  riskReward: 1.81,
  pivotLength: 3,
  confirmationBars: 3,
  utKeyValue: 1.0,
  utATRLength: 10,
  smiLength: 7,
  smiK: 2,
  smiD: 2,
};

export function runEma20Engine(candles: MarketDataCandle[], input: Ema20EngineConfig = {}): Ema20EngineBar[] {
  const c = { ...defaults, ...input };
  if (!candles.length) return [];

  const closes = candles.map(x => x.close as number | null);
  const ema20 = emaSeries(closes, c.ema20Length);
  const slowEMA = emaSeries(closes, c.slowLength);
  const atr = rmaSeries(trueRangeSeries(candles), c.atrLength);
  const utATR = rmaSeries(trueRangeSeries(candles), c.utATRLength);
  const smi = smiSeries(candles, c.smiLength, c.smiK, c.smiD);

  let lastSwingHigh: number | null = null;
  let previousSwingHigh: number | null = null;
  let lastSwingLow: number | null = null;
  let previousSwingLow: number | null = null;
  let bullRejectHigh: number | null = null;
  let bullRejectLow: number | null = null;
  let bullRejectBar: number | null = null;
  let bearRejectHigh: number | null = null;
  let bearRejectLow: number | null = null;
  let bearRejectBar: number | null = null;
  let utStop: number | null = null;
  let previousLongSignal = false;
  let previousShortSignal = false;
  let bias0600: -1 | 0 | 1 = 0;

  const result: Ema20EngineBar[] = [];

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    const ph = pivotAt(candles, i, c.pivotLength, true);
    const pl = pivotAt(candles, i, c.pivotLength, false);
    if (ph !== null) {
      previousSwingHigh = lastSwingHigh;
      lastSwingHigh = ph;
    }
    if (pl !== null) {
      previousSwingLow = lastSwingLow;
      lastSwingLow = pl;
    }

    const higherHigh = finite(lastSwingHigh) && finite(previousSwingHigh) && lastSwingHigh! > previousSwingHigh!;
    const higherLow = finite(lastSwingLow) && finite(previousSwingLow) && lastSwingLow! > previousSwingLow!;
    const lowerHigh = finite(lastSwingHigh) && finite(previousSwingHigh) && lastSwingHigh! < previousSwingHigh!;
    const lowerLow = finite(lastSwingLow) && finite(previousSwingLow) && lastSwingLow! < previousSwingLow!;

    const rising = i > 0 && ema20[i] !== null && ema20[i - 1] !== null && ema20[i]! > ema20[i - 1]!;
    const falling = i > 0 && ema20[i] !== null && ema20[i - 1] !== null && ema20[i]! < ema20[i - 1]!;
    const bullStructure = (higherHigh || higherLow) && rising && ema20[i] !== null && candle.close > ema20[i]!;
    const bearStructure = (lowerHigh || lowerLow) && falling && ema20[i] !== null && candle.close < ema20[i]!;

    const tolerance = atr[i] === null ? null : atr[i]! * c.atrTouch;
    const bullTouch = tolerance !== null && ema20[i] !== null && candle.low <= ema20[i]! + tolerance && candle.low >= ema20[i]! - tolerance;
    const bearTouch = tolerance !== null && ema20[i] !== null && candle.high >= ema20[i]! - tolerance && candle.high <= ema20[i]! + tolerance;
    const bullReject = bullStructure && bullTouch && candle.close > candle.open && ema20[i] !== null && candle.close > ema20[i]!;
    const bearReject = bearStructure && bearTouch && candle.close < candle.open && ema20[i] !== null && candle.close < ema20[i]!;

    if (bullReject) {
      bullRejectHigh = candle.high;
      bullRejectLow = candle.low;
      bullRejectBar = i;
    }
    if (bearReject) {
      bearRejectHigh = candle.high;
      bearRejectLow = candle.low;
      bearRejectBar = i;
    }

    if (bullRejectLow !== null && candle.close < bullRejectLow) {
      bullRejectHigh = null;
      bullRejectLow = null;
      bullRejectBar = null;
    }
    if (bearRejectHigh !== null && candle.close > bearRejectHigh) {
      bearRejectHigh = null;
      bearRejectLow = null;
      bearRejectBar = null;
    }
    if (bullRejectBar !== null && i - bullRejectBar > c.confirmationBars) {
      bullRejectHigh = null;
      bullRejectLow = null;
      bullRejectBar = null;
    }
    if (bearRejectBar !== null && i - bearRejectBar > c.confirmationBars) {
      bearRejectHigh = null;
      bearRejectLow = null;
      bearRejectBar = null;
    }

    const bullActive = bullRejectBar !== null && i > bullRejectBar && i - bullRejectBar <= c.confirmationBars;
    const bearActive = bearRejectBar !== null && i > bearRejectBar && i - bearRejectBar <= c.confirmationBars;
    const bullMABreak = bullActive && bullRejectHigh !== null && candle.close > bullRejectHigh;
    const bearMABreak = bearActive && bearRejectLow !== null && candle.close < bearRejectLow;

    const utLoss = utATR[i] === null ? null : c.utKeyValue * utATR[i]!;
    if (utLoss !== null) {
      if (i === 0 || utStop === null) utStop = candle.close - utLoss;
      else if (candle.close > utStop && candles[i - 1].close > utStop) utStop = Math.max(utStop, candle.close - utLoss);
      else if (candle.close < utStop && candles[i - 1].close < utStop) utStop = Math.min(utStop, candle.close + utLoss);
      else if (candle.close > utStop) utStop = candle.close - utLoss;
      else utStop = candle.close + utLoss;
    }

    const utBull = utStop !== null && candle.close > utStop;
    const utBear = utStop !== null && candle.close < utStop;
    const smiMain = smi.main[i];
    const smiSignal = smi.signal[i];
    const smiBull = smiMain !== null && smiSignal !== null && i > 0 && smi.main[i - 1] !== null && smiMain > smiSignal && smiMain > smi.main[i - 1]!;
    const smiBear = smiMain !== null && smiSignal !== null && i > 0 && smi.main[i - 1] !== null && smiMain < smiSignal && smiMain < smi.main[i - 1]!;

    const longConfirmationScore = (utBull ? 1 : 0) + (smiBull ? 1 : 0);
    const shortConfirmationScore = (utBear ? 1 : 0) + (smiBear ? 1 : 0);
    const longSignal = bullMABreak && longConfirmationScore >= 1;
    const shortSignal = bearMABreak && shortConfirmationScore >= 1;
    const newLong = longSignal && !previousLongSignal;
    const newShort = shortSignal && !previousShortSignal;

    let longEntry: number | null = null;
    let longSL: number | null = null;
    let longTP: number | null = null;
    let shortEntry: number | null = null;
    let shortSL: number | null = null;
    let shortTP: number | null = null;
    if (newLong) {
      longEntry = candle.close;
      longSL = longEntry - ((atr[i] ?? 0) * c.atrSLMultiplier);
      const risk = longEntry - longSL;
      if (risk > 0) longTP = longEntry + risk * c.riskReward;
      bullRejectHigh = null;
      bullRejectLow = null;
      bullRejectBar = null;
    }
    if (newShort) {
      shortEntry = candle.close;
      shortSL = shortEntry + ((atr[i] ?? 0) * c.atrSLMultiplier);
      const risk = shortSL - shortEntry;
      if (risk > 0) shortTP = shortEntry - risk * c.riskReward;
      bearRejectHigh = null;
      bearRejectLow = null;
      bearRejectBar = null;
    }

    const datetime = candle.datetime;
    const d = new Date(datetime);
    const sastHour = Number.isNaN(d.getTime()) ? -1 : Number(new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Johannesburg", hour: "2-digit", hour12: false }).format(d));
    const sastMinute = Number.isNaN(d.getTime()) ? -1 : Number(new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Johannesburg", minute: "2-digit", hour12: false }).format(d));
    if (sastHour === 6 && sastMinute === 0) bias0600 = bullStructure ? 1 : bearStructure ? -1 : 0;

    result.push({ index: i, datetime, close: candle.close, ema20: ema20[i], slowEMA: slowEMA[i], atr: atr[i], pivotHigh: ph, pivotLow: pl, lastSwingHigh, previousSwingHigh, lastSwingLow, previousSwingLow, higherHigh, higherLow, lowerHigh, lowerLow, bullStructure, bearStructure, bullTouch, bearTouch, bullReject, bearReject, bullRejectHigh, bullRejectLow, bullRejectBar, bearRejectHigh, bearRejectLow, bearRejectBar, bullActive, bearActive, bullMABreak, bearMABreak, utStop, utBull, utBear, smiMain, smiSignal, smiBull, smiBear, longConfirmationScore, shortConfirmationScore, longSignal, shortSignal, newLong, newShort, longEntry, longSL, longTP, shortEntry, shortSL, shortTP, bias0600 });

    previousLongSignal = longSignal;
    previousShortSignal = shortSignal;
  }
  return result;
}

export function evaluateEma20(candles: MarketDataCandle[], config: Ema20EngineConfig = {}): Ema20EngineBar | null {
  const rows = runEma20Engine(candles, config);
  return rows.at(-1) ?? null;
}

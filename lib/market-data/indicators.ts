import type { MarketDataCandle } from "./twelvedata";

export type IndicatorReading = {
  name: string;
  available: boolean;
  value: number | null;
  values?: Record<string, number | null>;
  signal: "BULLISH" | "BEARISH" | "NEUTRAL" | "UNAVAILABLE";
  reason: string;
};

export type AnalyzerMarketContext = {
  symbol: string;
  timeframe: string;
  currentPrice: number | null;
  candles: number;
  indicators: IndicatorReading[];
  selectedIndicators: IndicatorReading[];
  structure: {
    trend: "UPTREND" | "DOWNTREND" | "RANGE" | "CHOPPY" | "UNAVAILABLE";
    support: number | null;
    resistance: number | null;
    latestHigh: number | null;
    latestLow: number | null;
  };
  volatility: {
    atr: number | null;
    atrPct: number | null;
    breakout: "EXPANDING" | "CONTRACTING" | "NORMAL" | "UNAVAILABLE";
  };
};

const n = (v: number | null | undefined) => (v !== null && v !== undefined && Number.isFinite(v) ? v : null);

function sma(values: number[], length: number): number | null {
  if (values.length < length) return null;
  return values.slice(-length).reduce((a, b) => a + b, 0) / length;
}

function ema(values: number[], length: number): number | null {
  if (values.length < length) return null;
  const k = 2 / (length + 1);
  let out = sma(values.slice(0, length), length);
  if (out === null) return null;
  for (let i = length; i < values.length; i++) out = values[i] * k + out * (1 - k);
  return out;
}

function trueRanges(candles: MarketDataCandle[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    out.push(i === 0 ? c.high - c.low : Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close)));
  }
  return out;
}

function atr(candles: MarketDataCandle[], length = 14): number | null {
  return ema(trueRanges(candles), length);
}

function rsi(closes: number[], length = 14): number | null {
  if (closes.length <= length) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gains += d; else losses -= d;
  }
  let avgGain = gains / length;
  let avgLoss = losses / length;
  for (let i = length + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (length - 1) + Math.max(d, 0)) / length;
    avgLoss = (avgLoss * (length - 1) + Math.max(-d, 0)) / length;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function adx(candles: MarketDataCandle[], length = 14): { adx: number | null; plus: number | null; minus: number | null } {
  if (candles.length <= length + 1) return { adx: null, plus: null, minus: null };
  const trs: number[] = [], plusDm: number[] = [], minusDm: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i], p = candles[i - 1];
    const up = c.high - p.high, down = p.low - c.low;
    plusDm.push(up > down && up > 0 ? up : 0);
    minusDm.push(down > up && down > 0 ? down : 0);
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
  }
  const atrV = ema(trs, length);
  const plusV = ema(plusDm, length), minusV = ema(minusDm, length);
  if (atrV === null || plusV === null || minusV === null || atrV === 0) return { adx: null, plus: null, minus: null };
  const pdi = 100 * plusV / atrV, mdi = 100 * minusV / atrV;
  const dx = 100 * Math.abs(pdi - mdi) / Math.max(pdi + mdi, 1e-9);
  return { adx: dx, plus: pdi, minus: mdi };
}

function macd(closes: number[]): { macd: number | null; signal: number | null; histogram: number | null } {
  if (closes.length < 35) return { macd: null, signal: null, histogram: null };
  const fast = 12, slow = 26, signalLen = 9;
  const series: number[] = [];
  let ef: number | null = null, es: number | null = null;
  const kf = 2 / 13, ks = 2 / 27;
  for (const close of closes) {
    ef = ef === null ? close : close * kf + ef * (1 - kf);
    es = es === null ? close : close * ks + es * (1 - ks);
    series.push(ef - es);
  }
  const signal = ema(series, signalLen);
  const line = series[series.length - 1];
  return { macd: line, signal, histogram: signal === null ? null : line - signal };
}

function bollinger(closes: number[], length = 20, mult = 2) {
  if (closes.length < length) return { middle: null, upper: null, lower: null, percentB: null };
  const window = closes.slice(-length), middle = sma(closes, length)!;
  const variance = window.reduce((s, x) => s + (x - middle) ** 2, 0) / length;
  const sd = Math.sqrt(variance), upper = middle + mult * sd, lower = middle - mult * sd;
  const last = closes[closes.length - 1];
  return { middle, upper, lower, percentB: upper === lower ? null : (last - lower) / (upper - lower) * 100 };
}

function vwap(candles: MarketDataCandle[], length = 20): number | null {
  const slice = candles.slice(-length);
  let pv = 0, vol = 0;
  for (const c of slice) {
    if (c.volume === null) continue;
    pv += ((c.high + c.low + c.close) / 3) * c.volume;
    vol += c.volume;
  }
  return vol > 0 ? pv / vol : null;
}

function rvol(candles: MarketDataCandle[], length = 20): number | null {
  const volumes = candles.map(c => c.volume).filter((v): v is number => v !== null);
  if (volumes.length < length + 1) return null;
  const current = volumes[volumes.length - 1];
  const baseline = sma(volumes.slice(0, -1), length);
  return baseline && baseline > 0 ? current / baseline : null;
}

function stoch(candles: MarketDataCandle[], length = 14): number | null {
  if (candles.length < length) return null;
  const slice = candles.slice(-length), high = Math.max(...slice.map(c => c.high)), low = Math.min(...slice.map(c => c.low));
  return high === low ? 50 : (candles[candles.length - 1].close - low) / (high - low) * 100;
}

function mfi(candles: MarketDataCandle[], length = 14): number | null {
  const usable = candles.filter(c => c.volume !== null);
  if (usable.length <= length) return null;
  let positive = 0, negative = 0;
  for (let i = usable.length - length; i < usable.length; i++) {
    const c = usable[i], p = usable[i - 1];
    const tp = (c.high + c.low + c.close) / 3, ptp = (p.high + p.low + p.close) / 3;
    const flow = tp * (c.volume ?? 0);
    if (tp >= ptp) positive += flow; else negative += flow;
  }
  if (negative === 0) return 100;
  return 100 - 100 / (1 + positive / negative);
}

function smi(candles: MarketDataCandle[], length = 7): number | null {
  if (candles.length < length + 4) return null;
  const raw: number[] = [];
  for (let i = length - 1; i < candles.length; i++) {
    const slice = candles.slice(i - length + 1, i + 1), hh = Math.max(...slice.map(c => c.high)), ll = Math.min(...slice.map(c => c.low));
    const distance = (hh - ll) / 2, relative = candles[i].close - (hh + ll) / 2;
    raw.push(distance === 0 ? 0 : 100 * relative / distance);
  }
  return ema(raw, 4);
}

function reading(name: string, value: number | null, signal: IndicatorReading["signal"], reason: string, values?: Record<string, number | null>): IndicatorReading {
  return { name, available: value !== null, value, values, signal: value === null ? "UNAVAILABLE" : signal, reason };
}

export function buildAnalyzerMarketContext(candles: MarketDataCandle[], symbol: string, timeframe: string, selectedNames: string[]): AnalyzerMarketContext {
  const closes = candles.map(c => c.close), price = closes.at(-1) ?? null;
  const ema9 = ema(closes, 9), ema20 = ema(closes, 20), ema50 = ema(closes, 50), ema100 = ema(closes, 100);
  const sma20 = sma(closes, 20), atr14 = atr(candles, 14), rsi14 = rsi(closes, 14);
  const adx14 = adx(candles, 14), macdV = macd(closes), bb = bollinger(closes), vw = vwap(candles), rv = rvol(candles), st = stoch(candles), mf = mfi(candles), smiV = smi(candles);
  const emaSignal = ema9 === null || ema20 === null || price === null ? "NEUTRAL" : ema9 > ema20 && price > ema20 ? "BULLISH" : ema9 < ema20 && price < ema20 ? "BEARISH" : "NEUTRAL";
  const atrPct = price && atr14 ? atr14 / price * 100 : null;
  const readings: IndicatorReading[] = [
    reading("SMA", sma20, price !== null && sma20 !== null ? price > sma20 ? "BULLISH" : price < sma20 ? "BEARISH" : "NEUTRAL" : "NEUTRAL", "20-period simple moving-average context.", { period: 20 }),
    reading("EMA", ema20, emaSignal, "EMA trend context using 9/20/50/100 calculations.", { ema9, ema20, ema50, ema100 }),
    reading("ATR", atr14, "NEUTRAL", "14-period true-range volatility; direction is not inferred from ATR itself.", { period: 14, atrPct }),
    reading("VWAP", vw, price !== null && vw !== null ? price > vw ? "BULLISH" : price < vw ? "BEARISH" : "NEUTRAL" : "NEUTRAL", "Volume-weighted price context from available volume.", { period: 20 }),
    reading("RSI", rsi14, rsi14 === null ? "NEUTRAL" : rsi14 >= 55 ? "BULLISH" : rsi14 <= 45 ? "BEARISH" : "NEUTRAL", "14-period momentum context.", { period: 14 }),
    reading("MACD", macdV.macd, macdV.histogram === null ? "NEUTRAL" : macdV.histogram > 0 ? "BULLISH" : macdV.histogram < 0 ? "BEARISH" : "NEUTRAL", "12/26/9 MACD momentum and crossover context.", macdV),
    reading("Bollinger Bands", bb.middle, price !== null && bb.upper !== null && bb.lower !== null ? price > bb.upper ? "BEARISH" : price < bb.lower ? "BULLISH" : "NEUTRAL" : "NEUTRAL", "20-period Bollinger location and volatility envelope.", bb),
    reading("ADX", adx14.adx, adx14.adx === null ? "NEUTRAL" : adx14.adx >= 25 ? (adx14.plus! >= adx14.minus! ? "BULLISH" : "BEARISH") : "NEUTRAL", "14-period trend strength with directional movement.", adx14),
    reading("Stochastic", st, st === null ? "NEUTRAL" : st >= 55 ? "BULLISH" : st <= 45 ? "BEARISH" : "NEUTRAL", "14-period stochastic location."),
    reading("MFI", mf, mf === null ? "NEUTRAL" : mf >= 55 ? "BULLISH" : mf <= 45 ? "BEARISH" : "NEUTRAL", "14-period money-flow context."),
    reading("RVOL", rv, rv === null ? "NEUTRAL" : rv >= 1.2 ? (candles.at(-1)!.close >= candles.at(-1)!.open ? "BULLISH" : "BEARISH") : "NEUTRAL", "Current volume divided by 20-period average volume."),
    reading("SMI", smiV, smiV === null ? "NEUTRAL" : smiV >= 40 ? "BULLISH" : smiV <= -40 ? "BEARISH" : "NEUTRAL", "7-period SMI-style momentum context with EMA smoothing."),
  ];
  const selected = readings.filter(r => selectedNames.includes(r.name));
  const recent = candles.slice(-20), support = recent.length ? Math.min(...recent.map(c => c.low)) : null, resistance = recent.length ? Math.max(...recent.map(c => c.high)) : null;
  const trend = ema50 !== null && ema100 !== null && price !== null ? price > ema50 && ema50 > ema100 ? "UPTREND" : price < ema50 && ema50 < ema100 ? "DOWNTREND" : "RANGE" : "UNAVAILABLE";
  const insideCount = candles.length >= 6 ? (() => { let count = 0; for (let i = candles.length - 1; i > 0 && i > candles.length - 7; i--) { const c = candles[i], p = candles[i - 1]; if (c.high <= p.high && c.low >= p.low) count++; else break; } return count; })() : 0;
  const finalTrend = insideCount > 5 ? "CHOPPY" : trend;
  return { symbol, timeframe, currentPrice: price, candles: candles.length, indicators: readings, selectedIndicators: selected, structure: { trend: finalTrend, support, resistance, latestHigh: candles.at(-1)?.high ?? null, latestLow: candles.at(-1)?.low ?? null }, volatility: { atr: atr14, atrPct, breakout: atrPct === null ? "UNAVAILABLE" : atrPct > 0.5 ? "EXPANDING" : atrPct < 0.15 ? "CONTRACTING" : "NORMAL" } };
}

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
  structure: { trend: "UPTREND" | "DOWNTREND" | "RANGE" | "CHOPPY" | "UNAVAILABLE"; support: number | null; resistance: number | null; latestHigh: number | null; latestLow: number | null };
  volatility: { atr: number | null; atrPct: number | null; breakout: "EXPANDING" | "CONTRACTING" | "NORMAL" | "UNAVAILABLE" };
};

const finite = (v: number | null | undefined): v is number => v !== null && v !== undefined && Number.isFinite(v);

function sma(values: number[], length: number): number | null {
  if (length < 1 || values.length < length) return null;
  return values.slice(-length).reduce((a, b) => a + b, 0) / length;
}

function ema(values: number[], length: number): number | null {
  if (length < 1 || values.length < length) return null;
  const k = 2 / (length + 1);
  let out = sma(values.slice(0, length), length);
  if (out === null) return null;
  for (let i = length; i < values.length; i++) out = values[i] * k + out * (1 - k);
  return out;
}

function rma(values: number[], length: number): number | null {
  if (length < 1 || values.length < length) return null;
  let out = values.slice(0, length).reduce((a, b) => a + b, 0) / length;
  for (let i = length; i < values.length; i++) out = (out * (length - 1) + values[i]) / length;
  return out;
}

function wma(values: number[], length: number): number | null {
  if (length < 1 || values.length < length) return null;
  const window = values.slice(-length);
  const denominator = length * (length + 1) / 2;
  return window.reduce((sum, value, i) => sum + value * (i + 1), 0) / denominator;
}

function trueRanges(candles: MarketDataCandle[]): number[] {
  return candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const p = candles[i - 1];
    return Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close));
  });
}

function atr(candles: MarketDataCandle[], length = 14): number | null { return rma(trueRanges(candles), length); }

function rsi(closes: number[], length = 14): number | null {
  if (closes.length <= length) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= length; i++) { const d = closes[i] - closes[i - 1]; if (d >= 0) gains += d; else losses -= d; }
  let avgGain = gains / length, avgLoss = losses / length;
  for (let i = length + 1; i < closes.length; i++) { const d = closes[i] - closes[i - 1]; avgGain = (avgGain * (length - 1) + Math.max(d, 0)) / length; avgLoss = (avgLoss * (length - 1) + Math.max(-d, 0)) / length; }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function adx(candles: MarketDataCandle[], length = 14): { adx: number | null; plus: number | null; minus: number | null } {
  if (candles.length <= length + 1) return { adx: null, plus: null, minus: null };
  const trs: number[] = [], plusDm: number[] = [], minusDm: number[] = [];
  for (let i = 1; i < candles.length; i++) { const c = candles[i], p = candles[i - 1]; const up = c.high - p.high, down = p.low - c.low; plusDm.push(up > down && up > 0 ? up : 0); minusDm.push(down > up && down > 0 ? down : 0); trs.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close))); }
  const atrV = rma(trs, length), plusV = rma(plusDm, length), minusV = rma(minusDm, length);
  if (atrV === null || plusV === null || minusV === null || atrV === 0) return { adx: null, plus: null, minus: null };
  const pdi = 100 * plusV / atrV, mdi = 100 * minusV / atrV, dx = 100 * Math.abs(pdi - mdi) / Math.max(pdi + mdi, 1e-9);
  return { adx: dx, plus: pdi, minus: mdi };
}

function macd(closes: number[]): { macd: number | null; signal: number | null; histogram: number | null } {
  if (closes.length < 35) return { macd: null, signal: null, histogram: null };
  const series: number[] = []; let ef: number | null = null, es: number | null = null; const kf = 2 / 13, ks = 2 / 27;
  for (const close of closes) { ef = ef === null ? close : close * kf + ef * (1 - kf); es = es === null ? close : close * ks + es * (1 - ks); series.push(ef - es); }
  const signal = ema(series, 9), line = series.at(-1) ?? null;
  return { macd: line, signal, histogram: signal === null || line === null ? null : line - signal };
}

function bollinger(closes: number[], length = 20, mult = 2) {
  if (closes.length < length) return { middle: null, upper: null, lower: null, percentB: null };
  const window = closes.slice(-length), middle = sma(closes, length)!; const variance = window.reduce((s, x) => s + (x - middle) ** 2, 0) / length; const sd = Math.sqrt(variance), upper = middle + mult * sd, lower = middle - mult * sd, last = closes.at(-1)!;
  return { middle, upper, lower, percentB: upper === lower ? null : (last - lower) / (upper - lower) * 100 };
}

function vwap(candles: MarketDataCandle[], length = 20): number | null {
  const slice = candles.slice(-length); let pv = 0, vol = 0;
  for (const c of slice) { if (c.volume === null) continue; pv += ((c.high + c.low + c.close) / 3) * c.volume; vol += c.volume; }
  return vol > 0 ? pv / vol : null;
}

function rvol(candles: MarketDataCandle[], length = 20): number | null {
  const volumes = candles.map(c => c.volume).filter((v): v is number => v !== null); if (volumes.length < length + 1) return null;
  const current = volumes.at(-1)!; const baseline = sma(volumes.slice(0, -1), length); return baseline && baseline > 0 ? current / baseline : null;
}

function stoch(candles: MarketDataCandle[], length = 14): number | null {
  if (candles.length < length) return null; const slice = candles.slice(-length), high = Math.max(...slice.map(c => c.high)), low = Math.min(...slice.map(c => c.low)); return high === low ? 50 : (candles.at(-1)!.close - low) / (high - low) * 100;
}

function mfi(candles: MarketDataCandle[], length = 14): number | null {
  const usable = candles.filter(c => c.volume !== null); if (usable.length <= length) return null; let positive = 0, negative = 0;
  for (let i = usable.length - length; i < usable.length; i++) { const c = usable[i], p = usable[i - 1]; const tp = (c.high + c.low + c.close) / 3, ptp = (p.high + p.low + p.close) / 3, flow = tp * (c.volume ?? 0); if (tp >= ptp) positive += flow; else negative += flow; }
  if (negative === 0) return 100; return 100 - 100 / (1 + positive / negative);
}

function smi(candles: MarketDataCandle[], length = 7, smooth1 = 2, smooth2 = 2): number | null {
  if (candles.length < length) return null;
  const rel: number[] = [], dist: number[] = [];
  for (let i = length - 1; i < candles.length; i++) { const slice = candles.slice(i - length + 1, i + 1), hh = Math.max(...slice.map(c => c.high)), ll = Math.min(...slice.map(c => c.low)); rel.push(candles[i].close - (hh + ll) / 2); dist.push((hh - ll) / 2); }
  const rel1: number[] = [], dist1: number[] = [];
  for (let i = 0; i < rel.length; i++) { rel1.push(ema(rel.slice(0, i + 1), smooth1) ?? 0); dist1.push(ema(dist.slice(0, i + 1), smooth1) ?? 0); }
  const rel2 = ema(rel1, smooth2), dist2 = ema(dist1, smooth2);
  return rel2 === null || dist2 === null || dist2 === 0 ? null : 100 * rel2 / dist2;
}

function movingAverageChannel(candles: MarketDataCandle[], length = 20, maType = "EMA"): IndicatorReading {
  const highs = candles.map(c => c.high), lows = candles.map(c => c.low), calc = (v: number[]) => maType === "SMA" ? sma(v, length) : maType === "WMA" ? wma(v, length) : maType === "RMA" ? rma(v, length) : ema(v, length);
  const upper = calc(highs), lower = calc(lows), middle = finite(upper) && finite(lower) ? (upper + lower) / 2 : null, price = candles.at(-1)?.close ?? null;
  const bull = finite(price) && finite(upper) && price > upper, bear = finite(price) && finite(lower) && price < lower;
  return reading("Moving Average Channel", middle, bull ? "BULLISH" : bear ? "BEARISH" : "NEUTRAL", `${maType} ${length}/high-low channel from source strategy.`, { upper, lower, middle, length, maType: maType === "EMA" ? 20 : length });
}

function utBot(candles: MarketDataCandle[], sensitivity = 1, atrLength = 10): IndicatorReading {
  const a = atr(candles, atrLength), last = candles.at(-1), prev = candles.at(-2); if (!finite(a) || !last || !prev) return reading("UT Bot", null, "UNAVAILABLE", `UT Bot sensitivity ${sensitivity}, ATR ${atrLength}; insufficient data.`);
  const trailingStop = prev.close - a * sensitivity; return reading("UT Bot", trailingStop, last.close > trailingStop ? "BULLISH" : "BEARISH", `UT Bot sensitivity ${sensitivity}, ATR length ${atrLength}.`, { sensitivity, atrLength, trailingStop });
}

function reading(name: string, value: number | null, signal: IndicatorReading["signal"], reason: string, values?: Record<string, number | null>): IndicatorReading { return { name, available: value !== null, value, values, signal: value === null ? "UNAVAILABLE" : signal, reason }; }

export function buildAnalyzerMarketContext(candles: MarketDataCandle[], symbol: string, timeframe: string, selectedNames: string[]): AnalyzerMarketContext {
  const closes = candles.map(c => c.close), price = closes.at(-1) ?? null;
  const emaLengths = [4, 9, 15, 20, 21, 50, 72, 89, 100, 105, 200, 233];
  const emaValues: Record<string, number | null> = Object.fromEntries(emaLengths.map(length => [`EMA${length}`, ema(closes, length)]));
  const ema9 = emaValues.EMA9, ema20 = emaValues.EMA20, ema50 = emaValues.EMA50, ema100 = emaValues.EMA100;
  const sma20 = sma(closes, 20), atr14 = atr(candles, 14), rsi14 = rsi(closes, 14), adx14 = adx(candles, 14), macdV = macd(closes), bb = bollinger(closes), vw = vwap(candles), rv = rvol(candles), st = stoch(candles), mf = mfi(candles), smiV = smi(candles, 7, 2, 2), channel = movingAverageChannel(candles, 20, "EMA"), ut = utBot(candles, 1, 10);
  const emaSignal = finite(ema9) && finite(ema20) && finite(price) ? ema9! > ema20! && price! > ema20! ? "BULLISH" : ema9! < ema20! && price! < ema20! ? "BEARISH" : "NEUTRAL" : "NEUTRAL";
  const atrPct = finite(price) && finite(atr14) && price !== 0 ? atr14! / price! * 100 : null;
  const readings: IndicatorReading[] = [
    reading("SMA", sma20, price !== null && sma20 !== null ? price > sma20 ? "BULLISH" : price < sma20 ? "BEARISH" : "NEUTRAL" : "NEUTRAL", "20-period simple moving-average context.", { period: 20 }),
    reading("EMA", ema20, emaSignal, "Source-aware EMA calculations. Only source-selected EMA lengths are to be treated as required.", emaValues),
    reading("Moving Average Channel", channel.value, channel.signal, channel.reason, channel.values),
    reading("ATR", atr14, "NEUTRAL", "Source-compatible ATR using Wilder/RMA smoothing; length 14 unless a source-specific calculator is selected.", { period: 14, atrPct }),
    reading("VWAP", vw, price !== null && vw !== null ? price > vw ? "BULLISH" : price < vw ? "BEARISH" : "NEUTRAL" : "NEUTRAL", "Volume-weighted price context from available volume.", { period: 20 }),
    reading("RSI", rsi14, rsi14 === null ? "NEUTRAL" : rsi14 >= 55 ? "BULLISH" : rsi14 <= 45 ? "BEARISH" : "NEUTRAL", "14-period momentum context.", { period: 14 }),
    reading("MACD", macdV.macd, macdV.histogram === null ? "NEUTRAL" : macdV.histogram > 0 ? "BULLISH" : macdV.histogram < 0 ? "BEARISH" : "NEUTRAL", "12/26/9 MACD momentum and crossover context.", macdV),
    reading("Bollinger Bands", bb.middle, price !== null && bb.upper !== null && bb.lower !== null ? price > bb.upper ? "BEARISH" : price < bb.lower ? "BULLISH" : "NEUTRAL" : "NEUTRAL", "20-period Bollinger location and volatility envelope.", bb),
    reading("ADX", adx14.adx, adx14.adx === null ? "NEUTRAL" : adx14.adx >= 25 ? (adx14.plus! >= adx14.minus! ? "BULLISH" : "BEARISH") : "NEUTRAL", "14-period trend strength with directional movement.", adx14),
    reading("Stochastic", st, st === null ? "NEUTRAL" : st >= 55 ? "BULLISH" : st <= 45 ? "BEARISH" : "NEUTRAL", "14-period stochastic location."),
    reading("MFI", mf, mf === null ? "NEUTRAL" : mf >= 55 ? "BULLISH" : mf <= 45 ? "BEARISH" : "NEUTRAL", "14-period money-flow context."),
    reading("RVOL", rv, rv === null ? "NEUTRAL" : rv >= 1.2 ? (candles.at(-1)!.close >= candles.at(-1)!.open ? "BULLISH" : "BEARISH") : "NEUTRAL", "Current volume divided by 20-period average volume."),
    reading("SMI", smiV, smiV === null ? "NEUTRAL" : smiV >= 40 ? "BULLISH" : smiV <= -40 ? "BEARISH" : "NEUTRAL", "Source SMI 7-2-2 calculation.", { length: 7, smooth1: 2, smooth2: 2, overbought: 40, oversold: -40 }),
    ut,
  ];
  const selected = readings.filter(r => selectedNames.includes(r.name));
  const recent = candles.slice(-20), support = recent.length ? Math.min(...recent.map(c => c.low)) : null, resistance = recent.length ? Math.max(...recent.map(c => c.high)) : null;
  const trend = ema50 !== null && ema100 !== null && price !== null ? price > ema50 && ema50 > ema100 ? "UPTREND" : price < ema50 && ema50 < ema100 ? "DOWNTREND" : "RANGE" : "UNAVAILABLE";
  let insideCount = 0; for (let i = candles.length - 1; i > 0 && i > candles.length - 7; i--) { const c = candles[i], p = candles[i - 1]; if (c.high <= p.high && c.low >= p.low) insideCount++; else break; }
  const finalTrend = insideCount > 5 ? "CHOPPY" : trend;
  return { symbol, timeframe, currentPrice: price, candles: candles.length, indicators: readings, selectedIndicators: selected, structure: { trend: finalTrend, support, resistance, latestHigh: candles.at(-1)?.high ?? null, latestLow: candles.at(-1)?.low ?? null }, volatility: { atr: atr14, atrPct, breakout: atrPct === null ? "UNAVAILABLE" : atrPct > 0.5 ? "EXPANDING" : atrPct < 0.15 ? "CONTRACTING" : "NORMAL" } };
}

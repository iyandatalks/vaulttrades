import type { StrategyIndicatorRequirement } from "../strategies/types";
import type { MarketDataCandle } from "./twelvedata";
import type { IndicatorReading } from "./indicators";

/**
 * Calculates ONLY indicators declared by the selected strategy source.
 *
 * This module intentionally does not contain a generic indicator bundle.
 * The caller passes the exact source requirements extracted from the strategy
 * contract, including lengths, smoothing and multipliers.
 */

const finite = (v: number | null): v is number => v !== null && Number.isFinite(v);

function sma(values: number[], length: number): number | null {
  if (length < 1 || values.length < length) return null;
  return values.slice(-length).reduce((a, b) => a + b, 0) / length;
}

function ema(values: number[], length: number): number | null {
  if (length < 1 || values.length < length) return null;
  const k = 2 / (length + 1);
  let out = values[0];
  for (let i = 1; i < values.length; i++) out = values[i] * k + out * (1 - k);
  return out;
}

function rma(values: number[], length: number): number | null {
  if (length < 1 || values.length < length) return null;
  let out = values.slice(0, length).reduce((a, b) => a + b, 0) / length;
  for (let i = length; i < values.length; i++) out = (out * (length - 1) + values[i]) / length;
  return out;
}

function trueRanges(candles: MarketDataCandle[]): number[] {
  return candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const p = candles[i - 1];
    return Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close));
  });
}

function atr(candles: MarketDataCandle[], length: number): number | null {
  return rma(trueRanges(candles), length);
}

function parseLengths(parameters: Record<string, number | string | boolean>): number[] {
  const raw = parameters.lengths;
  if (typeof raw === "number") return [raw];
  if (typeof raw === "string") return raw.split(",").map(Number).filter((x) => Number.isFinite(x) && x > 0);
  return [];
}

function signal(value: number | null, bullish: boolean, bearish: boolean): IndicatorReading["signal"] {
  if (!finite(value)) return "UNAVAILABLE";
  return bullish ? "BULLISH" : bearish ? "BEARISH" : "NEUTRAL";
}

function reading(name: string, value: number | null, sig: IndicatorReading["signal"], reason: string, values?: Record<string, number | null>): IndicatorReading {
  return { name, available: finite(value), value, values, signal: finite(value) ? sig : "UNAVAILABLE", reason };
}

function movingAverageChannel(candles: MarketDataCandle[], parameters: Record<string, number | string | boolean>): IndicatorReading {
  const length = Number(parameters.length ?? 20);
  const maType = String(parameters.maType ?? "EMA").toUpperCase();
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const calc = (v: number[]) => maType === "SMA" ? sma(v, length) : maType === "WMA" ? wma(v, length) : maType === "RMA" ? rma(v, length) : ema(v, length);
  const upper = calc(highs);
  const lower = calc(lows);
  const close = candles.at(-1)?.close ?? null;
  const bullish = finite(close) && finite(upper) && close > upper;
  const bearish = finite(close) && finite(lower) && close < lower;
  const middle = finite(upper) && finite(lower) ? (upper + lower) / 2 : null;
  return reading("Moving Average Channel", middle, signal(middle, bullish, bearish), `${maType} ${length}/${length} channel calculated from candle highs/lows.`, { upper, lower, middle, length, maType: maType === "EMA" ? 20 : length });
}

function wma(values: number[], length: number): number | null {
  if (length < 1 || values.length < length) return null;
  const window = values.slice(-length);
  const denominator = length * (length + 1) / 2;
  return window.reduce((sum, value, i) => sum + value * (i + 1), 0) / denominator;
}

function smi(candles: MarketDataCandle[], length: number, smooth1: number, smooth2: number): number | null {
  if (candles.length < length) return null;
  const rawRelative: number[] = [];
  const rawDistance: number[] = [];
  for (let i = length - 1; i < candles.length; i++) {
    const slice = candles.slice(i - length + 1, i + 1);
    const hh = Math.max(...slice.map((c) => c.high));
    const ll = Math.min(...slice.map((c) => c.low));
    rawRelative.push(candles[i].close - (hh + ll) / 2);
    rawDistance.push((hh - ll) / 2);
  }
  const rs = rawRelative.length ? ema(rawRelative, smooth1) : null;
  const ds = rawDistance.length ? ema(rawDistance, smooth1) : null;
  if (!finite(rs) || !finite(ds)) return null;
  const ratioSeries: number[] = [];
  let relSeries = rawRelative;
  let distSeries = rawDistance;
  const relFirst = ema(relSeries, smooth1);
  const distFirst = ema(distSeries, smooth1);
  if (!finite(relFirst) || !finite(distFirst)) return null;
  // The source Pine applies EMA twice. Reconstruct the smoothed terminal values.
  const relSecondSeries = relSeries.map((_, i) => {
    const prefix = relSeries.slice(0, i + 1);
    return ema(prefix, smooth1) ?? 0;
  });
  const distSecondSeries = distSeries.map((_, i) => {
    const prefix = distSeries.slice(0, i + 1);
    return ema(prefix, smooth1) ?? 0;
  });
  for (let i = 0; i < relSecondSeries.length; i++) {
    const r = ema(relSecondSeries.slice(0, i + 1), smooth2);
    const d = ema(distSecondSeries.slice(0, i + 1), smooth2);
    ratioSeries.push(finite(r) && finite(d) && d !== 0 ? 100 * r / d : 0);
  }
  return ratioSeries.at(-1) ?? null;
}

function utBot(candles: MarketDataCandle[], sensitivity: number, atrLength: number): IndicatorReading {
  const a = atr(candles, atrLength);
  const close = candles.at(-1)?.close ?? null;
  if (!finite(a) || !finite(close) || !candles.length) return reading("UT Bot", null, "UNAVAILABLE", "Insufficient data for source UT Bot confirmation.");
  const previous = candles.length > 1 ? candles.at(-2)!.close : null;
  if (!finite(previous)) return reading("UT Bot", null, "UNAVAILABLE", "Insufficient prior close for source UT Bot confirmation.");
  const stop = previous - a * sensitivity;
  const bullish = close > stop;
  return reading("UT Bot", stop, bullish ? "BULLISH" : "BEARISH", `Source UT Bot sensitivity ${sensitivity}, ATR length ${atrLength}.`, { sensitivity, atrLength, trailingStop: stop });
}

export function buildSourceDrivenIndicatorReadings(candles: MarketDataCandle[], requirements: readonly StrategyIndicatorRequirement[]): IndicatorReading[] {
  const close = candles.at(-1)?.close ?? null;
  const results: IndicatorReading[] = [];

  for (const requirement of requirements) {
    const p = requirement.parameters;
    switch (requirement.name) {
      case "Moving Average Channel":
        results.push(movingAverageChannel(candles, p));
        break;
      case "EMA": {
        const lengths = parseLengths(p);
        const values: Record<string, number | null> = {};
        for (const length of lengths) values[`EMA${length}`] = ema(candles.map((c) => c.close), length);
        const primary = values[`EMA${lengths[0]}`] ?? null;
        const bull = lengths.length >= 2 && finite(values[`EMA${lengths[0]}`]) && finite(values[`EMA${lengths[1]}`]) ? values[`EMA${lengths[0]}`]! > values[`EMA${lengths[1]}`]! : finite(primary) && finite(close) ? close > primary : false;
        const bear = lengths.length >= 2 && finite(values[`EMA${lengths[0]}`]) && finite(values[`EMA${lengths[1]}`]) ? values[`EMA${lengths[0]}`]! < values[`EMA${lengths[1]}`]! : finite(primary) && finite(close) ? close < primary : false;
        results.push(reading("EMA", primary, signal(primary, bull, bear), `Source EMA lengths ${lengths.join(", ")}.`, values));
        break;
      }
      case "ATR": {
        const length = Number(p.length ?? 14);
        const value = atr(candles, length);
        results.push(reading("ATR", value, "NEUTRAL", `Source ATR length ${length}.`, { length, atrPct: finite(value) && finite(close) && close !== 0 ? value / close * 100 : null, ...Object.fromEntries(Object.entries(p).filter(([k]) => k !== "length").map(([k, v]) => [k, typeof v === "number" ? v : null])) }));
        break;
      }
      case "Volume": {
        const length = Number(p.movingAverageLength ?? 20);
        const volumes = candles.map((c) => c.volume ?? 0);
        const baseline = sma(volumes.slice(0, -1), length);
        const current = volumes.at(-1) ?? null;
        const ratio = finite(baseline) && baseline > 0 && finite(current) ? current / baseline : null;
        const multiplier = Number(p.expansionMultiplier ?? p.spikeMultiplier ?? 1.2);
        const bull = finite(ratio) && ratio >= multiplier && (candles.at(-1)?.close ?? 0) >= (candles.at(-1)?.open ?? 0);
        const bear = finite(ratio) && ratio >= multiplier && (candles.at(-1)?.close ?? 0) < (candles.at(-1)?.open ?? 0);
        results.push(reading("Volume", ratio, signal(ratio, bull, bear), `Source volume average length ${length}.`, { movingAverageLength: length, currentVolume: current, averageVolume: baseline, relativeVolume: ratio, ...Object.fromEntries(Object.entries(p).filter(([k]) => !["movingAverageLength"].includes(k)).map(([k, v]) => [k, typeof v === "number" ? v : null])) }));
        break;
      }
      case "SMI": {
        const length = Number(p.length ?? 7);
        const smooth1 = Number(p.smooth1 ?? 2);
        const smooth2 = Number(p.smooth2 ?? 2);
        const value = smi(candles, length, smooth1, smooth2);
        const ob = Number(p.overbought ?? 40);
        const os = Number(p.oversold ?? -40);
        results.push(reading("SMI", value, signal(value, finite(value) && value >= ob, finite(value) && value <= os), `Source SMI ${length}-${smooth1}-${smooth2}.`, { length, smooth1, smooth2, overbought: ob, oversold: os }));
        break;
      }
      case "UT Bot":
        results.push(utBot(candles, Number(p.sensitivity ?? 1), Number(p.atrLength ?? 10)));
        break;
      default:
        results.push(reading(requirement.name, null, "UNAVAILABLE", `Source requirement '${requirement.name}' has no deterministic market-data calculator yet. The Analyzer must not substitute another indicator.`));
    }
  }
  return results;
}

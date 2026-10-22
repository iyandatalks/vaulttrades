type Candle = { datetime: string; open: number; high: number; low: number; close: number; volume: number | null };
type Direction = "BUY" | "SELL" | "NO TRADE";
type SRBResult = {
  state: string; direction: Direction; entry: number | null; stopLoss: number | null; finalTp: number | null;
  rangeHigh: number | null; rangeLow: number | null; window: string | null; fibLevel: number;
  score: number; evidence: string[]; missingConditions: string[]; invalidation: string;
  liquidityTarget: number | null; orderBlock: { direction: string; top: number; bottom: number } | null;
  riskReward: number | null; source: "SRB_OB_DETERMINISTIC";
};
const windows = [
  { id: 1, name: "TOKYO", start: "02:30", end: "03:00", days: [1, 2] },
  { id: 2, name: "LONDON 1", start: "10:00", end: "10:30", days: [3, 4, 5] },
  { id: 3, name: "LONDON 2", start: "12:00", end: "12:30", days: [2] },
  { id: 4, name: "NYSE 1", start: "15:30", end: "16:00", days: [2] },
  { id: 5, name: "NYSE 2", start: "19:45", end: "20:15", days: [3] },
];
function localParts(value: string) {
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Johannesburg", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (k: string) => parts.find(p => p.type === k)?.value ?? "";
  const weekday = ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 } as Record<string, number>)[get("weekday")] ?? 0;
  return { weekday, clock: get("hour") + ":" + get("minute"), dateKey: new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(date) };
}
function atr14(c: Candle[]) {
  if (c.length < 15) return null;
  const tr = c.map((x, i) => i === 0 ? x.high - x.low : Math.max(x.high - x.low, Math.abs(x.high - c[i - 1].close), Math.abs(x.low - c[i - 1].close)));
  let a = tr.slice(1, 15).reduce((s, n) => s + n, 0) / 14;
  for (let i = 15; i < tr.length; i++) a = (a * 13 + tr[i]) / 14;
  return a;
}
function ema(values: number[], length: number) {
  if (values.length < length) return null;
  const k = 2 / (length + 1);
  let out = values.slice(0, length).reduce((a, b) => a + b, 0) / length;
  for (let i = length; i < values.length; i++) out = values[i] * k + out * (1 - k);
  return out;
}
function rsi(values: number[], length = 14) {
  if (values.length < length + 1) return null;
  let gains = 0, losses = 0;
  for (let i = values.length - length; i < values.length; i++) {
    const d = values[i] - values[i - 1]; if (d > 0) gains += d; else losses -= d;
  }
  return losses === 0 ? 100 : 100 - 100 / (1 + gains / losses);
}
function findOB(c: Candle[], dir: "BUY" | "SELL", target: number | null, a: number) {
  if (target == null) return null;
  let best: { direction: string; top: number; bottom: number; distance: number } | null = null;
  for (let i = Math.max(2, c.length - 100); i < c.length - 1; i++) {
    const base = c[i], impulse = c[i + 1], body = Math.abs(impulse.close - impulse.open);
    const bearish = base.close > base.open && impulse.close < impulse.open && body >= (a || 0) * .8 && impulse.close < base.low;
    const bullish = base.close < base.open && impulse.close > impulse.open && body >= (a || 0) * .8 && impulse.close > base.high;
    const valid = dir === "SELL" ? bearish && base.low > target : bullish && base.high < target;
    if (!valid) continue;
    const distance = dir === "SELL" ? base.low - target : target - base.high;
    if (!best || distance < best.distance) best = { direction: dir, top: base.high, bottom: base.low, distance };
  }
  return best ? { direction: best.direction, top: best.top, bottom: best.bottom } : null;
}
export function evaluateSrbOb(candles: Candle[], config?: { fibLevel?: number; stopExtension?: number; targetExtension?: number; minScore?: number; trendOnly?: boolean; dxyDirection?: "BUY" | "SELL" | "NEUTRAL" | null; silverDirection?: "BUY" | "SELL" | "NEUTRAL" | null }) : SRBResult {
  const fibLevel = config?.fibLevel ?? .681, stopExtension = config?.stopExtension ?? 1.25, targetExtension = config?.targetExtension ?? .618;
  const empty = (state: string, window: string | null, hi: number | null, lo: number | null, score = 0, evidence: string[] = [], missing: string[] = []): SRBResult => ({
    state, direction: "NO TRADE", entry: null, stopLoss: null, finalTp: null, rangeHigh: hi, rangeLow: lo, window, fibLevel, score, evidence, missingConditions: missing,
    invalidation: "Wait for the next configured opening range, a confirmed close breakout, then a valid Fib pullback retest.", liquidityTarget: null, orderBlock: null, riskReward: null, source: "SRB_OB_DETERMINISTIC"
  });
  if (candles.length < 40) return empty("WAITING", null, null, null, 0, [], ["At least 40 live candles are required."]);
  const parts = candles.map(c => localParts(c.datetime));
  let selected: { window: typeof windows[number]; dateKey: string; indices: number[]; endIndex: number } | null = null;
  for (let i = candles.length - 1; i >= 0 && !selected; i--) {
    const p = parts[i]; if (!p) continue;
    for (const w of windows) {
      if (!w.days.includes(p.weekday) || p.clock < w.end) continue;
      const indices: number[] = [];
      for (let j = i; j >= 0; j--) {
        const pj = parts[j]; if (pj?.dateKey !== p.dateKey) break;
        if (w.days.includes(pj.weekday) && pj.clock >= w.start && pj.clock < w.end) indices.unshift(j);
      }
      if (indices.length) { selected = { window: w, dateKey: p.dateKey, indices, endIndex: i }; break; }
    }
  }
  if (!selected) return empty("WAITING", null, null, null, 0, [], ["The available live history does not include a completed configured SRB window."]);
  const hi = Math.max(...selected.indices.map(i => candles[i].high)), lo = Math.min(...selected.indices.map(i => candles[i].low));
  const range = hi - lo, last = candles.at(-1)!, previous = candles.at(-2)!;
  const after = candles.map((_, i) => i).filter(i => i > selected!.indices.at(-1)!);
  if (!after.length) return empty("BUILDING", selected.window.name, hi, lo, 0, ["Opening range is being formed."], ["Wait until the opening-range window closes."]);
  let breakIndex = -1, dir: "BUY" | "SELL" | null = null;
  for (const i of after) {
    if (candles[i].close > hi && candles[i - 1].close <= hi) { breakIndex = i; dir = "BUY"; }
    if (candles[i].close < lo && candles[i - 1].close >= lo) { breakIndex = i; dir = "SELL"; }
  }
  if (breakIndex < 0 || !dir) return empty("ARMED", selected.window.name, hi, lo, 0, ["Completed opening range identified.", "No confirmed close breakout beyond the range."], ["Wait for a candle close above range high or below range low."]);
  const prior = candles.slice(Math.max(0, breakIndex - 60), breakIndex);
  const lastSwingLow = prior.length ? Math.min(...prior.map(x => x.low)) : lo;
  const lastSwingHigh = prior.length ? Math.max(...prior.map(x => x.high)) : hi;
  let impulseLow = dir === "BUY" ? Math.min(lastSwingLow, lo) : candles[breakIndex].low;
  let impulseHigh = dir === "SELL" ? Math.max(lastSwingHigh, hi) : candles[breakIndex].high;
  for (let i = breakIndex + 1; i < candles.length; i++) {
    if (dir === "BUY") impulseHigh = Math.max(impulseHigh, candles[i].high);
    else impulseLow = Math.min(impulseLow, candles[i].low);
  }
  const impulseRange = Math.max(impulseHigh - impulseLow, 1e-8);
  const entry = dir === "BUY" ? impulseHigh - impulseRange * fibLevel : impulseLow + impulseRange * fibLevel;
  const stopLoss = dir === "BUY" ? impulseLow - impulseRange * (stopExtension - 1) : impulseHigh + impulseRange * (stopExtension - 1);
  const finalTp = dir === "BUY" ? impulseHigh + impulseRange * targetExtension : impulseLow - impulseRange * targetExtension;
  const atr = atr14(candles) ?? 0;
  const closes = candles.map(x => x.close), ema20 = ema(closes, 20), ema200 = ema(closes, 200), r = rsi(closes);
  const volumeNow = last.volume, volumes = candles.slice(-21, -1).map(x => x.volume).filter((x): x is number => x != null);
  const volumeAvg = volumes.length ? volumes.reduce((a, b) => a + b, 0) / volumes.length : null;
  const volumeGood = volumeNow != null && volumeAvg != null && volumeNow > volumeAvg;
  const score = (ema200 != null && (dir === "BUY" ? last.close > ema200 : last.close < ema200) ? 15 : 0) +
    (ema20 != null && (dir === "BUY" ? last.close > ema20 : last.close < ema20) ? 15 : 0) +
    (r != null && (dir === "BUY" ? r > 50 : r < 50) ? 20 : 0) + (volumeGood ? 30 : 0) + (atr > 0 && range > atr * .5 ? 20 : 0);
  const upperTarget = Math.min(...candles.map(x => x.high).filter(v => v > last.close), Infinity);
  const lowerTarget = Math.max(...candles.map(x => x.low).filter(v => v < last.close), -Infinity);
  const liquidityTarget = dir === "BUY" ? (Number.isFinite(upperTarget) ? upperTarget : null) : (Number.isFinite(lowerTarget) ? lowerTarget : null);
  const ob = findOB(candles.slice(0, -1), dir === "BUY" ? "SELL" : "BUY", liquidityTarget, atr);
  const insideOB = !!ob && entry <= ob.top && entry >= ob.bottom;
  const trendOK = !config?.trendOnly || (ema200 != null && (dir === "BUY" ? last.close > ema200 : last.close < ema200));
  const dxyOK = !config?.dxyDirection || config.dxyDirection === dir;
  const silverOK = !config?.silverDirection || config.silverDirection === dir;
  const rr = Math.abs(finalTp - entry) / Math.max(Math.abs(entry - stopLoss), 1e-8);
  const touched = dir === "BUY" ? last.low <= entry : last.high >= entry;
  const afterBreak = candles.length - 1 > breakIndex;
  const geometry = dir === "BUY" ? stopLoss < entry && finalTp > entry : stopLoss > entry && finalTp < entry;
  const scoreOK = score >= (config?.minScore ?? 50);
  const evidence = ["Completed configured opening range: " + selected.window.name, "Confirmed range breakout at " + candles[breakIndex].datetime, "Fib pullback level: " + (fibLevel * 100).toFixed(1) + "%", "Confluence score: " + score + "/100", "Order-block exclusion: " + (insideOB ? "entry overlaps opposing OB" : "no opposing OB overlap identified")];
  const missing = [
    ...(!scoreOK ? ["Confluence score is below the configured minimum."] : []),
    ...(!geometry ? ["Stop/target geometry is invalid."] : []),
    ...(insideOB ? ["Planned entry overlaps an opposing order block."] : []),
    ...(!trendOK ? ["EMA200 trend filter failed."] : []),
    ...(!dxyOK ? ["Optional DXY direction does not confirm."] : []),
    ...(!silverOK ? ["Optional silver direction does not confirm."] : []),
    ...(!touched ? ["Waiting for price to retest the Fib entry; breakout is not an entry."] : []),
  ];
  if (!scoreOK || !geometry || insideOB || !trendOK || !dxyOK || !silverOK) return { ...empty("REJECTED", selected.window.name, hi, lo, score, evidence, missing), direction: "NO TRADE", entry, stopLoss, finalTp, liquidityTarget, orderBlock: ob, riskReward: rr };
  if (!touched || !afterBreak) return { ...empty("LIMIT WAIT", selected.window.name, hi, lo, score, evidence, missing), direction: "NO TRADE", entry, stopLoss, finalTp, liquidityTarget, orderBlock: ob, riskReward: rr };
  return { ...empty("FIB RETEST DETECTED", selected.window.name, hi, lo, score, evidence, []), direction: dir, entry, stopLoss, finalTp, liquidityTarget, orderBlock: ob, riskReward: rr, invalidation: dir === "BUY" ? "Invalidate if price reaches the planned stop below the impulse low." : "Invalidate if price reaches the planned stop above the impulse high." };
}

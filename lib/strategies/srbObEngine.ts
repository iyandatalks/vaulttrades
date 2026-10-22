type Candle = { datetime: string; open: number; high: number; low: number; close: number; volume: number | null };
type Direction = "BUY" | "SELL" | "NO TRADE";
type SRBResult = {
  state: string; direction: Direction; entry: number | null; stopLoss: number | null; finalTp: number | null;
  rangeHigh: number | null; rangeLow: number | null; window: string | null; fibLevel: number;
  score: number; evidence: string[]; missingConditions: string[]; invalidation: string;
  liquidityTarget: number | null; orderBlock: { direction: string; top: number; bottom: number } | null;
  riskReward: number | null; breakoutPrice?: number | null; breakoutTime?: string | null; breakoutDirection?: "BUY" | "SELL" | null;
  confluence?: { macroTrend: string; fastTrend: string; rsi: number | null; rsiAligned: boolean | null; volumeRatio: number | null; volumeGood: boolean; rangeSize: number; rangeAtrRatio: number | null; longScore: number; shortScore: number; dxy: string; silver: string; gate: string; maChannelUpper: number | null; maChannelLower: number | null; maChannelDirection: string; maChannelAligned: boolean | null; maChannelMode: string };
  source: "SRB_OB_DETERMINISTIC";
};
const windows = [
  { id: 1, name: "TOKYO", start: "02:30", end: "03:00", days: [1, 2, 3, 4, 5] },
  { id: 2, name: "LONDON 1", start: "10:00", end: "10:30", days: [1, 2, 3, 4, 5] },
  { id: 3, name: "LONDON 2", start: "12:00", end: "12:30", days: [1, 2, 3, 4, 5] },
  { id: 4, name: "NEW YORK 1", start: "15:30", end: "16:00", days: [1, 2, 3, 4, 5] },
  { id: 5, name: "NEW YORK 2", start: "19:45", end: "20:15", days: [1, 2, 3, 4, 5] },
];
function localParts(value: string) {
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Johannesburg", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (k: string) => parts.find(p => p.type === k)?.value ?? "";
  const weekday = ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 } as Record<string, number>)[get("weekday")] ?? 0;
  return { weekday, clock: get("hour") + ":" + get("minute"), dateKey: new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(date) };
}
function aggregateTo30m(input: Candle[]): Candle[] {
  if (input.length < 3) return input;
  const gaps = input.slice(1).map((c, i) => (new Date(c.datetime).getTime() - new Date(input[i].datetime).getTime()) / 60000).filter(v => v > 0 && v <= 240).sort((a, b) => a - b);
  const medianGap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 30;
  if (medianGap >= 30) return input;
  const grouped = new Map<string, Candle>();
  const counts = new Map<string, number>();
  const expectedBars = Math.max(1, Math.ceil(30 / medianGap));
  for (const c of input) {
    const p = localParts(c.datetime); if (!p) continue;
    const parts = p.clock.split(':').map(Number);
    const bucket = String(parts[0]).padStart(2, '0') + ':' + String(parts[1] < 30 ? 0 : 30).padStart(2, '0');
    const key = p.dateKey + ' ' + bucket;
    const old = grouped.get(key);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!old) grouped.set(key, { datetime: c.datetime, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume });
    else { old.high = Math.max(old.high, c.high); old.low = Math.min(old.low, c.low); old.close = c.close; old.volume = old.volume == null || c.volume == null ? null : old.volume + c.volume; }
  }
  return [...grouped.entries()].filter(([key]) => (counts.get(key) ?? 0) >= expectedBars).map(([, candle]) => candle).sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
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
function movingAverageChannel(candles: Candle[], period = 20) {
  if (period < 1 || candles.length < period) return { upper: null as number | null, lower: null as number | null, direction: "INSUFFICIENT HISTORY" };
  const window = candles.slice(-period);
  const upper = window.reduce((sum, candle) => sum + candle.high, 0) / period;
  const lower = window.reduce((sum, candle) => sum + candle.low, 0) / period;
  const close = candles.at(-1)?.close;
  const direction = close == null ? "INSUFFICIENT HISTORY" : close > upper && close > lower ? "BULLISH" : close < upper && close < lower ? "BEARISH" : "INSIDE CHANNEL";
  return { upper, lower, direction };
}
function lastConfirmedSwing(candles: Candle[], side: "HIGH" | "LOW", length = 3): number | null {
  if (candles.length < length * 2 + 1) return null;
  for (let i = candles.length - length - 1; i >= length; i--) {
    const value = side === "HIGH" ? candles[i].high : candles[i].low;
    let pivot = true;
    for (let j = 1; j <= length; j++) {
      if (side === "HIGH" && (value <= candles[i - j].high || value <= candles[i + j].high)) pivot = false;
      if (side === "LOW" && (value >= candles[i - j].low || value >= candles[i + j].low)) pivot = false;
    }
    if (pivot) return value;
  }
  return null;
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
export function evaluateSrbOb(candles: Candle[], config?: { fibLevel?: number; stopExtension?: number; targetExtension?: number; minScore?: number; trendOnly?: boolean; limitExpiryBars?: number; ticketClearanceAtr?: number; maChannelPeriod?: number; maChannelMode?: "VETO" | "VOTE" | "OFF"; stopModel?: "FIB_0382" | "FIB_0500" | "OPPOSITE_RANGE_EDGE" | "FIB_EXTENSION"; dxyDirection?: "BUY" | "SELL" | "NEUTRAL" | null; silverDirection?: "BUY" | "SELL" | "NEUTRAL" | null }) : SRBResult {
  // Keep chart-timeframe candles for exact session-range geometry and trade lifecycle.
  // Use completed 30-minute aggregates only to confirm breakout closes.
  const formationCandles = aggregateTo30m(candles);
  const fibLevel = config?.fibLevel ?? .681, stopExtension = config?.stopExtension ?? 1.25, targetExtension = config?.targetExtension ?? .618;
  const maChannelPeriod = Math.max(1, config?.maChannelPeriod ?? 20);
  const maChannelMode = config?.maChannelMode ?? "VETO";
  const empty = (state: string, window: string | null, hi: number | null, lo: number | null, score = 0, evidence: string[] = [], missing: string[] = []): SRBResult => {
    const last = candles.at(-1);
    const closes = candles.map(x => x.close);
    const liveChannel = movingAverageChannel(candles, maChannelPeriod);
    const liveAtr = atr14(candles) ?? 0;
    const liveEma20 = ema(closes, 20), liveEma200 = ema(closes, 200), liveRsi = rsi(closes);
    const liveVolumes = candles.slice(-21, -1).map(x => x.volume).filter((x): x is number => x != null);
    const liveVolumeAvg = liveVolumes.length ? liveVolumes.reduce((a,b)=>a+b,0)/liveVolumes.length : null;
    const liveVolumeGood = last?.volume != null && liveVolumeAvg != null && last.volume > liveVolumeAvg;
    const liveRangeSize = hi != null && lo != null ? hi - lo : 0;
    const liveVolumeRatio = last?.volume != null && liveVolumeAvg != null && liveVolumeAvg > 0 ? last.volume/liveVolumeAvg : null;
    const channelAligned = (side: "BUY" | "SELL") => liveChannel.upper !== null && liveChannel.lower !== null && !!last &&
      (side === "BUY" ? last.close > liveChannel.upper && last.close > liveChannel.lower : last.close < liveChannel.upper && last.close < liveChannel.lower);
    const baseScoreFor = (side: "BUY" | "SELL") =>
      (liveEma200 != null && last && (side === "BUY" ? last.close > liveEma200 : last.close < liveEma200) ? 15 : 0) +
      (liveEma20 != null && last && (side === "BUY" ? last.close > liveEma20 : last.close < liveEma20) ? 15 : 0) +
      (liveRsi != null && (side === "BUY" ? liveRsi > 50 : liveRsi < 50) ? 20 : 0) +
      (liveVolumeGood ? 30 : 0) + (liveAtr > 0 && liveRangeSize > liveAtr * .5 ? 20 : 0);
    const scoreFor = (side: "BUY" | "SELL") => maChannelMode === "VOTE"
      ? Math.round(baseScoreFor(side) * .85 + (channelAligned(side) ? 15 : 0))
      : baseScoreFor(side);
    return {
      state, direction: "NO TRADE", entry: null, stopLoss: null, finalTp: null, rangeHigh: hi, rangeLow: lo, window, fibLevel, score, evidence, missingConditions: missing, breakoutDirection: null,
      invalidation: "Wait for the next configured opening range, a confirmed close breakout, then a valid Fib pullback retest.", liquidityTarget: null, orderBlock: null, riskReward: null,
      confluence: {
        macroTrend: liveEma200 == null || !last ? "INSUFFICIENT HISTORY" : last.close > liveEma200 ? "BULLISH" : last.close < liveEma200 ? "BEARISH" : "NEUTRAL",
        fastTrend: liveEma20 == null || !last ? "INSUFFICIENT HISTORY" : last.close > liveEma20 ? "BULLISH" : last.close < liveEma20 ? "BEARISH" : "NEUTRAL",
        rsi: liveRsi, rsiAligned: null, volumeRatio: liveVolumeRatio, volumeGood: liveVolumeGood,
        rangeSize: liveRangeSize, rangeAtrRatio: liveAtr > 0 && liveRangeSize > 0 ? liveRangeSize/liveAtr : null,
        longScore: scoreFor("BUY"), shortScore: scoreFor("SELL"),
        dxy: config?.dxyDirection ?? "NOT PROVIDED", silver: config?.silverDirection ?? "NOT PROVIDED", gate: state,
        maChannelUpper: liveChannel.upper, maChannelLower: liveChannel.lower, maChannelDirection: liveChannel.direction,
        maChannelAligned: null, maChannelMode
      },
      source: "SRB_OB_DETERMINISTIC"
    };
  };
  if (candles.length < 40) return empty("WAITING", null, null, null, 0, [], ["At least 40 live candles are required."]);
  const parts = candles.map(c => localParts(c.datetime));
  const latestDateKey = [...parts].reverse().find(p => p != null)?.dateKey;
  const nowParts = localParts(new Date().toISOString());
  const currentWindow = nowParts ? windows.find(w => w.days.includes(nowParts.weekday) && nowParts.clock >= w.start && nowParts.clock < w.end) : undefined;
  let selected: { window: typeof windows[number]; dateKey: string; indices: number[]; endIndex: number; building: boolean } | null = null;
  // For live evaluation, the wall-clock session takes precedence over a stale or
  // future-dated final market candle. Use today's actual SAST date and active window.
  const liveDateKey = nowParts?.dateKey ?? latestDateKey;
  if (currentWindow && liveDateKey) {
    const indices = parts.map((p, i) => p?.dateKey === liveDateKey && p.weekday === nowParts!.weekday && p.clock >= currentWindow.start && p.clock < currentWindow.end ? i : -1).filter(i => i >= 0);
    if (indices.length) selected = { window: currentWindow, dateKey: liveDateKey, indices, endIndex: indices.at(-1)!, building: true };
    else return empty("BUILDING", currentWindow.name, null, null, 0, ["Current SAST opening window is forming; candle data for this window is not available yet."], ["Refresh market data for the active window before evaluating its range."]);
  }
  // Outside a currently forming opening window, use the most recent eligible
  // session from the latest SAST market-data date.
  for (let i = candles.length - 1; i >= 0 && !selected; i--) {
    const p = parts[i]; if (!p || p.dateKey !== latestDateKey || (nowParts && p.dateKey !== nowParts.dateKey)) continue;
    const candidates = windows.filter(w => w.days.includes(p.weekday) && p.clock >= w.end).sort((x,y) => y.end.localeCompare(x.end));
    for (const w of candidates) {
      const indices: number[] = [];
      for (let j = i; j >= 0; j--) {
        const pj = parts[j]; if (pj?.dateKey !== p.dateKey) break;
        if (w.days.includes(pj.weekday) && pj.clock >= w.start && pj.clock < w.end) indices.unshift(j);
      }
      if (indices.length) { selected = { window: w, dateKey: p.dateKey, indices, endIndex: i, building: false }; break; }
    }
  }
  if (!selected) return empty("WAITING", null, null, null, 0, [], ["The available live history does not include a completed configured SRB window."]);
  const intervals = candles.slice(1).map((c, i) => (new Date(c.datetime).getTime() - new Date(candles[i].datetime).getTime()) / 60000).filter(v => v > 0 && v <= 240).sort((x,y)=>x-y);
  const candleMinutes = intervals.length ? intervals[Math.floor(intervals.length / 2)] : 15;
  const expectedRangeBars = Math.max(1, Math.ceil(30 / candleMinutes));
  const hi = Math.max(...selected.indices.map(i => candles[i].high)), lo = Math.min(...selected.indices.map(i => candles[i].low));
  if (selected.building) return empty("BUILDING", selected.window.name, hi, lo, 0, ["Current configured opening range is still forming."], ["Wait for the full 30-minute window to close before confirming a breakout."]);
  if (selected.indices.length < expectedRangeBars) return empty("INCOMPLETE RANGE", selected.window.name, hi, lo, 0, ["Configured 30-minute opening window has incomplete candle coverage."], ["Need " + expectedRangeBars + " candles for this chart timeframe; found " + selected.indices.length + "."]);
  const range = hi - lo, last = candles.at(-1)!, previous = candles.at(-2)!;
  const after = candles.map((_, i) => i).filter(i => i > selected!.indices.at(-1)!);
  if (!after.length) return empty("BUILDING", selected.window.name, hi, lo, 0, ["Opening range is being formed."], ["Wait until the opening-range window closes."]);
  let breakIndex = -1, dir: "BUY" | "SELL" | null = null;
  const formationParts = formationCandles.map(c => localParts(c.datetime));
  // Use the FIRST confirmed 30-minute close whose formation candle starts after
  // the complete range. This matters for the 19:45–20:15 New York 2 window,
  // which does not align to a standard :00/:30 candle boundary.
  for (let fi = 1; fi < formationCandles.length; fi++) {
    const fp = formationParts[fi];
    if (!fp || fp.dateKey !== selected.dateKey || fp.clock < selected.window.end) continue;
    const formed = formationCandles[fi], prevFormed = formationCandles[fi - 1];
    let candidateDir: "BUY" | "SELL" | null = null;
    if (formed.close > hi && prevFormed.close <= hi) candidateDir = "BUY";
    else if (formed.close < lo && prevFormed.close >= lo) candidateDir = "SELL";
    if (!candidateDir) continue;
    const formationEnd = new Date(formed.datetime).getTime() + 30 * 60_000;
    let mappedIndex = -1;
    for (let ci = 0; ci < candles.length; ci++) {
      if (parts[ci]?.dateKey === selected.dateKey && new Date(candles[ci].datetime).getTime() < formationEnd) mappedIndex = ci;
    }
    if (mappedIndex <= selected.indices.at(-1)!) continue;
    breakIndex = mappedIndex;
    dir = candidateDir;
    break;
  }
  if (breakIndex < 0 || !dir) return empty("ARMED", selected.window.name, hi, lo, 0, ["Completed opening range identified.", "No confirmed close breakout beyond the range."], ["Wait for a candle close above range high or below range low."]);
  // Freeze the completed breakout impulse wick-to-wick. Longs retrace from the
  // breakout high to the last confirmed swing low (or range low); shorts mirror it.
  // Later candles never move the planned entry, stop or target.
  const signalCandles = candles.slice(0, breakIndex + 1);
  const signalCandle = candles[breakIndex];
  const preBreakCandles = signalCandles.slice(0, -1);
  const confirmedSwingLow = lastConfirmedSwing(preBreakCandles, "LOW", 3);
  const confirmedSwingHigh = lastConfirmedSwing(preBreakCandles, "HIGH", 3);
  const impulseLow = dir === "BUY"
    ? (confirmedSwingLow !== null && confirmedSwingLow < signalCandle.high ? confirmedSwingLow : lo)
    : signalCandle.low;
  const impulseHigh = dir === "SELL"
    ? (confirmedSwingHigh !== null && confirmedSwingHigh > signalCandle.low ? confirmedSwingHigh : hi)
    : signalCandle.high;
  const impulseRange = Math.max(impulseHigh - impulseLow, Number.EPSILON);
  const entry = dir === "BUY" ? impulseHigh - impulseRange * fibLevel : impulseLow + impulseRange * fibLevel;
  const stopModel = config?.stopModel ?? "OPPOSITE_RANGE_EDGE";
  const stopExtension = config?.stopExtension ?? 1.25;
  const stopLoss = dir === "BUY"
    ? stopModel === "FIB_0382" ? impulseHigh - impulseRange * 0.382
      : stopModel === "FIB_0500" ? impulseHigh - impulseRange * 0.5
      : stopModel === "FIB_EXTENSION" ? impulseLow - impulseRange * (stopExtension - 1)
      : lo
    : stopModel === "FIB_0382" ? impulseLow + impulseRange * 0.382
      : stopModel === "FIB_0500" ? impulseLow + impulseRange * 0.5
      : stopModel === "FIB_EXTENSION" ? impulseHigh + impulseRange * (stopExtension - 1)
      : hi;
  // Target model stays with the source default: Fib 1.618, projected from the
  // frozen impulse (0.618 beyond the impulse extreme).
  const finalTp = dir === "BUY" ? impulseHigh + impulseRange * targetExtension : impulseLow - impulseRange * targetExtension;
  const atr = atr14(signalCandles) ?? 0;
  const closes = signalCandles.map(x => x.close), ema20 = ema(closes, 20), ema200 = ema(closes, 200), r = rsi(closes);
  const volumeNow = signalCandle.volume, volumes = signalCandles.slice(-21, -1).map(x => x.volume).filter((x): x is number => x != null);
  const volumeAvg = volumes.length ? volumes.reduce((a, b) => a + b, 0) / volumes.length : null;
  const volumeGood = volumeNow != null && volumeAvg != null && volumeNow > volumeAvg;
  const signalChannel = movingAverageChannel(signalCandles, maChannelPeriod);
  const channelAligned = signalChannel.upper !== null && signalChannel.lower !== null &&
    (dir === "BUY"
      ? signalCandle.close > signalChannel.upper && signalCandle.close > signalChannel.lower
      : signalCandle.close < signalChannel.upper && signalCandle.close < signalChannel.lower);
  const channelBlocksSetup = maChannelMode === "VETO" && !channelAligned;
  const baseScoreFor = (side: "BUY" | "SELL") =>
    (ema200 != null && (side === "BUY" ? signalCandle.close > ema200 : signalCandle.close < ema200) ? 15 : 0) +
    (ema20 != null && (side === "BUY" ? signalCandle.close > ema20 : signalCandle.close < ema20) ? 15 : 0) +
    (r != null && (side === "BUY" ? r > 50 : r < 50) ? 20 : 0) + (volumeGood ? 30 : 0) + (atr > 0 && range > atr * .5 ? 20 : 0);
  const scoreFor = (side: "BUY" | "SELL") => {
    const aligned = signalChannel.upper !== null && signalChannel.lower !== null &&
      (side === "BUY" ? signalCandle.close > signalChannel.upper && signalCandle.close > signalChannel.lower
        : signalCandle.close < signalChannel.upper && signalCandle.close < signalChannel.lower);
    return maChannelMode === "VOTE" ? Math.round(baseScoreFor(side) * 0.85 + (aligned ? 15 : 0)) : baseScoreFor(side);
  };
  const score = scoreFor(dir);
  const longScore = scoreFor("BUY"), shortScore = scoreFor("SELL");
  const priorHighs = signalCandles.slice(0, -1).map(x => x.high);
  const priorLows = signalCandles.slice(0, -1).map(x => x.low);
  const upperTarget = Math.min(...priorHighs.filter(v => v > signalCandle.close), Infinity);
  const lowerTarget = Math.max(...priorLows.filter(v => v < signalCandle.close), -Infinity);
  const liquidityTarget = dir === "BUY" ? (Number.isFinite(upperTarget) ? upperTarget : null) : (Number.isFinite(lowerTarget) ? lowerTarget : null);
  const ob = findOB(signalCandles.slice(0, -1), dir === "BUY" ? "SELL" : "BUY", liquidityTarget, atr);
  const clearance = atr * (config?.ticketClearanceAtr ?? 0.55);
  // Keep the historical OB fixed; reject a ticket inside or too close to the opposing zone.
  const insideOB = !!ob && entry <= ob.top + clearance && entry >= ob.bottom - clearance;
  const trendOK = !config?.trendOnly || (ema200 != null && (dir === "BUY" ? signalCandle.close > ema200 : signalCandle.close < ema200));
  const dxyOK = !config?.dxyDirection || config.dxyDirection === dir;
  const silverOK = !config?.silverDirection || config.silverDirection === dir;
  const rr = Math.abs(finalTp - entry) / Math.max(Math.abs(entry - stopLoss), 1e-8);
  const expiryBars = Math.max(1, config?.limitExpiryBars ?? 12);
  const barsSinceBreak = candles.length - 1 - breakIndex;
  const afterBreak = barsSinceBreak > 0;
  const expired = barsSinceBreak >= expiryBars;
  const geometry = dir === "BUY" ? stopLoss < entry && finalTp > entry : stopLoss > entry && finalTp < entry;
  // Reconstruct the resting-limit lifecycle from bars after the breakout.
  // If stop/target is reached before the Fib price, the pending setup is invalid.
  let touched = false;
  let fillIndex = -1;
  let riskHitBeforeFill = false;
  for (let i = breakIndex + 1; i < candles.length; i++) {
    const bar = candles[i];
    const entryTouched = dir === "BUY" ? bar.low <= entry : bar.high >= entry;
    const riskTouched = dir === "BUY"
      ? bar.low <= stopLoss || bar.high >= finalTp
      : bar.high >= stopLoss || bar.low <= finalTp;
    // If the entry and a risk level are both touched on the same pre-fill candle,
    // resolve conservatively as no fill; the candle cannot prove event ordering.
    if (riskTouched) { riskHitBeforeFill = true; break; }
    if (entryTouched) { touched = true; fillIndex = i; break; }
  }
  let completedState: "TARGET HIT" | "STOP HIT" | null = null;
  if (touched && fillIndex >= 0) {
    for (let i = fillIndex + 1; i < candles.length; i++) {
      const bar = candles[i];
      const stopHit = dir === "BUY" ? bar.low <= stopLoss : bar.high >= stopLoss;
      const targetHit = dir === "BUY" ? bar.high >= finalTp : bar.low <= finalTp;
      if (stopHit || targetHit) {
        // If a single candle spans both levels, choose the stop as the conservative outcome.
        completedState = targetHit && !stopHit ? "TARGET HIT" : "STOP HIT";
        break;
      }
    }
  }
  const scoreOK = score >= (config?.minScore ?? 50);
  const confluenceDetails = {
    macroTrend: ema200 == null ? "INSUFFICIENT HISTORY" : signalCandle.close > ema200 ? "BULLISH" : signalCandle.close < ema200 ? "BEARISH" : "NEUTRAL",
    fastTrend: ema20 == null ? "INSUFFICIENT HISTORY" : signalCandle.close > ema20 ? "BULLISH" : signalCandle.close < ema20 ? "BEARISH" : "NEUTRAL",
    rsi: r, rsiAligned: r == null ? null : (dir === "BUY" ? r > 50 : r < 50),
    volumeRatio: volumeNow != null && volumeAvg != null && volumeAvg > 0 ? volumeNow / volumeAvg : null,
    volumeGood, rangeSize: range, rangeAtrRatio: atr > 0 ? range / atr : null,
    longScore, shortScore,
    dxy: config?.dxyDirection ?? "NOT PROVIDED", silver: config?.silverDirection ?? "NOT PROVIDED",
    gate: riskHitBeforeFill ? "PENDING INVALIDATED" : expired && !touched ? "LIMIT EXPIRED" : !scoreOK ? "SCORE BLOCK" : !geometry ? "GEOMETRY BLOCK" : insideOB ? "OPPOSING OB BLOCK" : channelBlocksSetup ? "MA CHANNEL BLOCK" : !trendOK ? "TREND BLOCK" : !dxyOK ? "DXY BLOCK" : !silverOK ? "SILVER BLOCK" : touched ? "FIB FILLED" : "WAITING FOR FIB RETEST",
    maChannelUpper: signalChannel.upper, maChannelLower: signalChannel.lower, maChannelDirection: signalChannel.direction,
    maChannelAligned: channelAligned, maChannelMode,
  };
  const evidence = ["Completed configured opening range: " + selected.window.name, "Confirmed range breakout at " + candles[breakIndex].datetime, "Fib pullback level: " + (fibLevel * 100).toFixed(1) + "%", "Confluence score: " + score + "/100", "Order-block exclusion: " + (insideOB ? "entry overlaps opposing OB" : "no opposing OB overlap identified")];
  const missing = [
    ...(!scoreOK ? ["Confluence score is below the configured minimum."] : []),
    ...(!geometry ? ["Stop/target geometry is invalid."] : []),
    ...(insideOB ? ["Planned entry overlaps an opposing order block."] : []),
    ...(channelBlocksSetup ? ["Breakout candle did not close outside the SMA(high, 20) / SMA(low, 20) channel in the trade direction."] : []),
    ...(!trendOK ? ["EMA200 trend filter failed."] : []),
    ...(!dxyOK ? ["Optional DXY direction does not confirm."] : []),
    ...(!silverOK ? ["Optional silver direction does not confirm."] : []),
    ...(riskHitBeforeFill ? ["Stop or target was reached before the Fib order filled; pending setup is invalid."] : []),
    ...(expired && !touched ? ["Fib limit expired after " + expiryBars + " bars without a fill."] : []),
    ...(!touched && !expired && !riskHitBeforeFill ? ["Waiting for price to retest the fixed Fib entry; breakout is not an entry."] : []),
  ];
  if (riskHitBeforeFill) return { ...empty("CANCELLED", selected.window.name, hi, lo, score, evidence, missing), entry, stopLoss, finalTp, liquidityTarget, orderBlock: ob, riskReward: rr, breakoutPrice: signalCandle.close, breakoutTime: signalCandle.datetime, breakoutDirection: dir, confluence: confluenceDetails, invalidation: "Pending setup cancelled because stop/target was reached before the Fib entry filled." };
  if (expired && !touched) return { ...empty("EXPIRED", selected.window.name, hi, lo, score, evidence, missing), entry, stopLoss, finalTp, liquidityTarget, orderBlock: ob, riskReward: rr, breakoutPrice: signalCandle.close, breakoutTime: signalCandle.datetime, breakoutDirection: dir, confluence: confluenceDetails, invalidation: "Unfilled Fib setup expired after " + expiryBars + " bars." };
  if (!scoreOK || !geometry || insideOB || channelBlocksSetup || !trendOK || !dxyOK || !silverOK) return { ...empty("REJECTED", selected.window.name, hi, lo, score, evidence, missing), direction: "NO TRADE", entry, stopLoss, finalTp, liquidityTarget, orderBlock: ob, riskReward: rr, breakoutPrice: signalCandle.close, breakoutTime: signalCandle.datetime, breakoutDirection: dir, confluence: confluenceDetails };
  if (!touched || !afterBreak) return { ...empty("LIMIT WAIT", selected.window.name, hi, lo, score, evidence, missing), entry, stopLoss, finalTp, liquidityTarget, orderBlock: ob, riskReward: rr, breakoutPrice: signalCandle.close, breakoutTime: signalCandle.datetime, breakoutDirection: dir, confluence: confluenceDetails };
  const finalState = completedState ?? (touched ? "TRADE OPEN" : "LIMIT WAIT");
  const finalEvidence = completedState === "TARGET HIT" ? [...evidence, "Fib entry filled; target reached after entry."] : completedState === "STOP HIT" ? [...evidence, "Fib entry filled; stop reached after entry."] : touched ? [...evidence, "Fib entry filled; trade remains open because neither exit has been reached."] : evidence;
  return { ...empty(finalState, selected.window.name, hi, lo, score, finalEvidence, []), direction: dir, entry, stopLoss, finalTp, liquidityTarget, orderBlock: ob, riskReward: rr, breakoutPrice: signalCandle.close, breakoutTime: signalCandle.datetime, breakoutDirection: dir, confluence: confluenceDetails, invalidation: completedState === "TARGET HIT" ? "Trade closed at the planned target." : completedState === "STOP HIT" ? "Trade closed at the planned stop." : touched ? "Manage the filled trade against its fixed stop and target." : "Wait for price to retest the fixed Fib entry before counting a trade as filled." };
}

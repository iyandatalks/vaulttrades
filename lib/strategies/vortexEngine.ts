export type VortexCandle = { time: number; open: number; high: number; low: number; close: number; volume?: number };
export type VortexDirection = "BUY" | "SELL";
export type VortexTrade = {
  direction: VortexDirection; entry: number; stopLoss: number;
  tp1: number; tp2: number; tp3: number; tp4: number; tp5: number;
  fibLevel: number; entryTime: string; confirmationTime: string;
  lotSize: number; targetHits: boolean[]; status: "ACTIVE" | "TP_HIT" | "SL_HIT";
  exitTime?: string; exitPrice?: number;
};
export type VortexResult = {
  source: "VAULTTRADES_VORTEX_PINE_V12"; state: "WAITING" | "SETUP DEVELOPING" | "TRADE ACTIVE" | "TP HIT" | "SL HIT";
  direction: VortexDirection | "NO TRADE"; entry: number | null; stopLoss: number | null;
  tp1: number | null; tp2: number | null; tp3: number | null; tp4: number | null; tp5: number | null;
  fibLevel: number | null; score: number; buyConfluence: number; sellConfluence: number;
  liquidityTarget: number | null; orderBlock: { direction: VortexDirection; top: number; bottom: number } | null;
  entryTime: string | null; confirmationTime: string | null; lotSize: number; lotModel: string;
  targetHits: boolean[]; openTrade: VortexTrade | null; latestClosedTrade: VortexTrade | null;
  evidence: string[]; missingConditions: string[]; invalidation: string; statusReason: string;
  riskReward: number | null; silver: { available: boolean; close: number | null; flow: string; ma: number | null };
};
export type EvaluateVortexInput = { m1Candles: VortexCandle[]; m5Candles: VortexCandle[]; silverCandles?: VortexCandle[]; tickSize?: number; lotSize?: number };

const ENTRY_FIBS = [68.1, 78.6, 88.0];
const TP_FIBS = [38.2, 0, -23.6];
const RETEST_BARS = 8;
const MIN_SCORE = 60;
const PIVOT = 5;
const NY = "America/New_York";

function nyParts(time: number) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: NY, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(time));
  const get = (k: string) => parts.find(p => p.type === k)?.value ?? "0";
  return { day: get("year") + "-" + get("month") + "-" + get("day"), minute: Number(get("hour")) * 60 + Number(get("minute")) };
}
function inSilverBullet(time: number) {
  const m = nyParts(time).minute;
  return (m >= 180 && m < 240) || (m >= 600 && m < 660) || (m >= 840 && m < 900);
}
function atrSeries(c: VortexCandle[], n = 14) {
  const tr = c.map((x, i) => i === 0 ? x.high - x.low : Math.max(x.high - x.low, Math.abs(x.high - c[i - 1].close), Math.abs(x.low - c[i - 1].close)));
  const out = Array(c.length).fill(0);
  if (c.length < n) return out;
  let seed = 0;
  for (let i = 0; i < n; i++) seed += tr[i];
  out[n - 1] = seed / n;
  for (let i = n; i < c.length; i++) out[i] = (out[i - 1] * (n - 1) + tr[i]) / n;
  return out;
}
function ema(v: number[], n: number): number | null {
  if (v.length < n) return null;
  const k = 2 / (n + 1);
  let x = v.slice(0, n).reduce((a, b) => a + b, 0) / n;
  for (let i = n; i < v.length; i++) x = v[i] * k + x * (1 - k);
  return x;
}
function buyFib(top: number, bottom: number, pct: number) { return top - (top - bottom) * pct / 100; }
function sellFib(top: number, bottom: number, pct: number) { return bottom + (top - bottom) * pct / 100; }
function pivot(c: VortexCandle[], i: number, len = PIVOT) {
  if (i < len * 2) return { high: null as number | null, low: null as number | null };
  const p = i - len, x = c[p];
  let hi = true, lo = true;
  for (let k = 1; k <= len; k++) {
    if (x.high <= c[p - k].high || x.high <= c[p + k].high) hi = false;
    if (x.low >= c[p - k].low || x.low >= c[p + k].low) lo = false;
  }
  return { high: hi ? x.high : null, low: lo ? x.low : null };
}
function nearest(values: number[], price: number, above: boolean): number | null {
  const a = values.filter(x => above ? x > price : x < price);
  return a.length ? (above ? Math.min(...a) : Math.max(...a)) : null;
}
function periodLevels(c: VortexCandle[]) {
  const out: Array<{ high: number | null; low: number | null; weekHigh: number | null; weekLow: number | null }> = [];
  let dayKey = "", weekKey = "", dayHigh = -Infinity, dayLow = Infinity, weekHigh = -Infinity, weekLow = Infinity;
  let priorHigh: number | null = null, priorLow: number | null = null, priorWeekHigh: number | null = null, priorWeekLow: number | null = null;
  for (const bar of c) {
    const key = nyParts(bar.time).day;
    const dt = new Date(bar.time);
    const yearStart = Date.UTC(dt.getUTCFullYear(), 0, 1);
    const week = Math.floor((Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()) - yearStart) / 604800000);
    const wk = dt.getUTCFullYear() + "-" + week;
    if (dayKey && key !== dayKey) { priorHigh = Number.isFinite(dayHigh) ? dayHigh : priorHigh; priorLow = Number.isFinite(dayLow) ? dayLow : priorLow; dayHigh = -Infinity; dayLow = Infinity; }
    if (weekKey && wk !== weekKey) { priorWeekHigh = Number.isFinite(weekHigh) ? weekHigh : priorWeekHigh; priorWeekLow = Number.isFinite(weekLow) ? weekLow : priorWeekLow; weekHigh = -Infinity; weekLow = Infinity; }
    dayKey = key; weekKey = wk;
    dayHigh = Math.max(dayHigh, bar.high); dayLow = Math.min(dayLow, bar.low);
    weekHigh = Math.max(weekHigh, bar.high); weekLow = Math.min(weekLow, bar.low);
    out.push({ high: priorHigh, low: priorLow, weekHigh: priorWeekHigh, weekLow: priorWeekLow });
  }
  return out;
}
function emaSeries(values: number[], n: number) {
  const out: Array<number | null> = Array(values.length).fill(null);
  if (values.length < n) return out;
  const k = 2 / (n + 1);
  let x = values.slice(0, n).reduce((a, b) => a + b, 0) / n;
  out[n - 1] = x;
  for (let i = n; i < values.length; i++) { x = values[i] * k + x * (1 - k); out[i] = x; }
  return out;
}
function targetOb(c: VortexCandle[], atr: number[], end: number, target: number, bearish: boolean) {
  let found: { top: number; bottom: number; direction: VortexDirection } | null = null, distance = Infinity;
  for (let i = Math.max(2, end - 60); i < end - 1; i++) {
    const base = c[i], impulse = c[i + 1], a = atr[i + 1];
    if (a <= 0) continue;
    const body = Math.abs(impulse.close - impulse.open);
    const bear = impulse.close < impulse.open && body >= a * 0.8 && impulse.close < base.low;
    const bull = impulse.close > impulse.open && body >= a * 0.8 && impulse.close > base.high;
    const valid = bearish ? base.close > base.open && bear && base.low > target : base.close < base.open && bull && base.high < target;
    if (!valid) continue;
    const d = bearish ? base.low - target : target - base.high;
    if (d < distance) { distance = d; found = { top: base.high, bottom: base.low, direction: bearish ? "SELL" : "BUY" }; }
  }
  return found;
}
function confluence(dir: 1 | -1, c: VortexCandle[], i: number, f68: number, f88: number, structure: boolean, levels: { high: number | null; low: number | null; weekHigh: number | null; weekLow: number | null }, silver: { last: VortexCandle | null; prev: VortexCandle | null; ma: number | null; priorMa: number | null; lastHigh: number | null; previousHigh: number | null; lastLow: number | null; previousLow: number | null; avgVolume: number | null }) {
  const b = c[i];
  let available = 45, raw = (dir > 0 ? b.low <= f68 && b.close >= f88 : b.high >= f68 && b.close <= f88) ? 25 : 0;
  if (structure) raw += 20;
  const liquidityAvailable = levels.high != null || levels.low != null || levels.weekHigh != null || levels.weekLow != null;
  if (liquidityAvailable) {
    available += 15;
    const swept = dir > 0
      ? (levels.low != null && b.low < levels.low && b.close > levels.low) || (levels.weekLow != null && b.low < levels.weekLow && b.close > levels.weekLow)
      : (levels.high != null && b.high > levels.high && b.close < levels.high) || (levels.weekHigh != null && b.high > levels.weekHigh && b.close < levels.weekHigh);
    if (swept) raw += 15;
  }
  let flow = "UNAVAILABLE";
  const last = silver.last, prev = silver.prev;
  if (last && prev) {
    const falling = last.close < prev.close, rising = last.close > prev.close;
    flow = falling ? "FALLING" : rising ? "RISING" : "FLAT";
    available += 15; if (dir > 0 ? falling : rising) raw += 15;
    const structureAvailable = dir > 0
      ? silver.lastHigh != null && silver.lastLow != null && silver.previousLow != null
      : silver.lastLow != null && silver.lastHigh != null && silver.previousHigh != null;
    if (structureAvailable) {
      available += 10;
      const structurePass = dir > 0
        ? silver.lastLow! > silver.previousLow! && last.close > silver.lastHigh!
        : silver.lastHigh! < silver.previousHigh! && last.close < silver.lastLow!;
      if (structurePass) raw += 10;
    }
    const maFalling = silver.ma != null && silver.priorMa != null && silver.ma < silver.priorMa;
    const maRising = silver.ma != null && silver.priorMa != null && silver.ma > silver.priorMa;
    if (silver.ma != null && silver.priorMa != null) {
      available += 10;
      if (dir > 0 ? maFalling : maRising) raw += 10;
    }
    if (silver.avgVolume != null && last.volume != null && silver.avgVolume > 0) {
      available += 5;
      if (last.volume > silver.avgVolume * 1.5 && (dir > 0 ? falling : rising)) raw += 5;
    }
    if ((dir > 0 && rising && maRising) || (dir < 0 && falling && maFalling)) raw -= 15 * available / 100;
  }
  return { score: Math.max(0, Math.min(100, Math.round(raw / available * 100))), flow };
}
export function evaluateVortex(input: EvaluateVortexInput): VortexResult {
  const c = [...input.m1Candles].sort((a, b) => a.time - b.time), m5 = [...input.m5Candles].sort((a, b) => a.time - b.time);
  const silver = [...(input.silverCandles ?? [])].sort((a, b) => a.time - b.time);
  const lotSize = input.lotSize ?? 0.05, tick = input.tickSize ?? 0.01;
  const empty = (reason: string): VortexResult => ({
    source: "VAULTTRADES_VORTEX_PINE_V12", state: "WAITING", direction: "NO TRADE",
    entry: null, stopLoss: null, tp1: null, tp2: null, tp3: null, tp4: null, tp5: null, fibLevel: null,
    score: 0, buyConfluence: 0, sellConfluence: 0, liquidityTarget: null, orderBlock: null,
    entryTime: null, confirmationTime: null, lotSize, lotModel: lotSize < 0.05 ? "FULL CLOSE AT TP1" : "FIVE TARGETS · 20% EACH",
    targetHits: [false, false, false, false, false], openTrade: null, latestClosedTrade: null,
    evidence: [], missingConditions: [reason], invalidation: "The setup expires after 8 M1 bars or when its Silver Bullet window closes.",
    statusReason: reason, riskReward: null, silver: { available: silver.length > 51, close: silver.at(-1)?.close ?? null, flow: "UNAVAILABLE", ma: null },
  });
  if (c.length < 300 || m5.length < 30) return empty("Waiting for sufficient M1 history and completed M5 confirmation candles.");
  const atr = atrSeries(c), atr5 = atrSeries(m5), m5Levels = periodLevels(m5), silverEma = emaSeries(silver.map(x => x.close), 50);
  const highs: number[] = [], lows: number[] = [];
  const ranges = new Map<string, { asia?: { high: number; low: number }; london?: { high: number; low: number }; ny?: { high: number; low: number }; last: "Asia" | "London" | "New York" }>();
  let bullActive = false, bearActive = false, bullArmed = false, bearArmed = false;
  let bullSweep = 0, bearSweep = 0, bullSweepBar = -1, bearSweepBar = -1, bullLevel: number | null = null, bearLevel: number | null = null;
  let bullStart: number | null = null, bullEnd: number | null = null, bullChochBar = -1;
  let bearStart: number | null = null, bearEnd: number | null = null, bearChochBar = -1;
  let liqHigh: number | null = null, liqLow: number | null = null;
  let buySetup = { state: 0, pullback: -1, fib: null as number | null, pct: null as number | null };
  let sellSetup = { state: 0, pullback: -1, fib: null as number | null, pct: null as number | null };
  let active: VortexTrade | null = null, closed: VortexTrade | null = null, lastOb: VortexResult["orderBlock"] = null, lastLiq: number | null = null;
  let buyScore = 0, sellScore = 0, lastScore = 0, evidence: string[] = [], missing = ["Waiting for a confirmed institutional order."], lastFib: number | null = null, lastM5Time: string | null = null;
  let m5Pointer = -1, silverPointer = -1, currentDay = "", runningDayHigh = -Infinity, runningDayLow = Infinity, priorHigh: number | null = null, priorLow: number | null = null, priorNySession: { high: number; low: number } | null = null;
  let silverLastHigh: number | null = null, silverPreviousHigh: number | null = null, silverLastLow: number | null = null, silverPreviousLow: number | null = null;

  for (let i = 20; i < c.length; i++) {
    const b = c[i], prev = c[i - 1], closeTime = b.time + 60_000, np = nyParts(closeTime), m = np.minute;
    if (currentDay && np.day !== currentDay) { priorHigh = Number.isFinite(runningDayHigh) ? runningDayHigh : priorHigh; priorLow = Number.isFinite(runningDayLow) ? runningDayLow : priorLow; priorNySession = ranges.get(currentDay)?.ny ?? priorNySession; runningDayHigh = -Infinity; runningDayLow = Infinity; }
    currentDay = np.day; runningDayHigh = Math.max(runningDayHigh, b.high); runningDayLow = Math.min(runningDayLow, b.low);
    const session: "Asia" | "London" | "New York" | null = m < 360 ? "Asia" : m >= 420 && m < 600 ? "London" : m >= 750 && m < 1020 ? "New York" : null;
    let day = ranges.get(np.day);
    if (!day) { day = { last: "Asia" }; ranges.set(np.day, day); }
    if (session) {
      day.last = session;
      const key = session === "Asia" ? "asia" : session === "London" ? "london" : "ny";
      const range = day[key] ?? { high: b.high, low: b.low };
      range.high = Math.max(range.high, b.high); range.low = Math.min(range.low, b.low); day[key] = range;
      if (session === "London" && day.asia) { liqHigh = day.asia.high; liqLow = day.asia.low; }
      if (session === "New York" && day.london) { liqHigh = day.london.high; liqLow = day.london.low; }
      if (session === "Asia" && priorNySession) { liqHigh = priorNySession.high; liqLow = priorNySession.low; }
    }
    const pv = pivot(c, i);
    if (pv.high != null) highs.push(pv.high);
    if (pv.low != null) lows.push(pv.low);
    const lastHigh = highs.at(-1) ?? null, lastLow = lows.at(-1) ?? null;
    if (liqLow != null && prev.low >= liqLow && b.low < liqLow && !bullArmed && !bearArmed) { bullArmed = true; bullSweep = b.low; bullSweepBar = i; bullLevel = lastHigh; }
    else if (bullArmed && b.low < bullSweep) { bullSweep = b.low; bullSweepBar = i; }
    if (liqHigh != null && prev.high <= liqHigh && b.high > liqHigh && !bearArmed && !bullArmed) { bearArmed = true; bearSweep = b.high; bearSweepBar = i; bearLevel = lastLow; }
    else if (bearArmed && b.high > bearSweep) { bearSweep = b.high; bearSweepBar = i; }
    if (bullArmed && bullLevel != null && b.high > bullLevel && i > bullSweepBar) { bullActive = true; bearActive = false; bullStart = bullSweep; bullEnd = b.high; bullChochBar = i; bullArmed = false; }
    if (bearArmed && bearLevel != null && b.low < bearLevel && i > bearSweepBar) { bearActive = true; bullActive = false; bearStart = bearSweep; bearEnd = b.low; bearChochBar = i; bearArmed = false; }
    if (bullActive && b.high > (bullEnd ?? 0)) { bullEnd = b.high; bullChochBar = i; }
    if (bearActive && b.low < (bearEnd ?? Infinity)) { bearEnd = b.low; bearChochBar = i; }
    if (bullActive && (i - bullChochBar > 20 || (bullStart != null && b.low < bullStart))) bullActive = false;
    if (bearActive && (i - bearChochBar > 20 || (bearStart != null && b.high > bearStart))) bearActive = false;
    if (bullArmed && i - bullSweepBar > 20) bullArmed = false;
    if (bearArmed && i - bearSweepBar > 20) bearArmed = false;

    const ss = ranges.get(np.day);
    const sr = ss?.last === "Asia" ? ss.asia : ss?.last === "London" ? ss.london : ss?.ny ?? ss?.london ?? ss?.asia;
    const buyStart = bullActive ? bullStart : sr?.low ?? null, buyEnd = bullActive ? bullEnd : sr?.high ?? null;
    const sellStart = bearActive ? bearStart : sr?.high ?? null, sellEnd = bearActive ? bearEnd : sr?.low ?? null;
    const buyReady = buyStart != null && buyEnd != null && Math.abs(buyEnd - buyStart) > tick;
    const sellReady = sellStart != null && sellEnd != null && Math.abs(sellEnd - sellStart) > tick;
    const bt = buyReady ? Math.max(buyStart!, buyEnd!) : 0, bb = buyReady ? Math.min(buyStart!, buyEnd!) : 0;
    const st = sellReady ? Math.max(sellStart!, sellEnd!) : 0, sb = sellReady ? Math.min(sellStart!, sellEnd!) : 0;
    const window = inSilverBullet(closeTime);
    if (!window) {
      buySetup = { state: 0, pullback: -1, fib: null, pct: null };
      sellSetup = { state: 0, pullback: -1, fib: null, pct: null };
    }
    const bullInstitution = window && (bullActive || buyReady) && buyReady && b.close >= (bt + bb) / 2 && prev.close < prev.open && b.close > prev.high && atr[i] > 0 && b.close - b.open >= atr[i] * 0.5;
    const bearInstitution = window && (bearActive || sellReady) && sellReady && b.close <= (st + sb) / 2 && prev.close > prev.open && b.close < prev.low && atr[i] > 0 && b.open - b.close >= atr[i] * 0.5;
    if (bullInstitution) { buySetup = { state: 1, pullback: -1, fib: null, pct: null }; sellSetup = { state: 0, pullback: -1, fib: null, pct: null }; evidence = []; missing = ["Bullish institutional order detected; waiting for Fib pullback."]; }
    if (bearInstitution) { sellSetup = { state: 1, pullback: -1, fib: null, pct: null }; buySetup = { state: 0, pullback: -1, fib: null, pct: null }; evidence = []; missing = ["Bearish institutional order detected; waiting for Fib pullback."]; }
    if (buySetup.state === 1 && buyReady) for (const pct of ENTRY_FIBS) { const level = buyFib(bt, bb, pct); if (b.low <= level) { buySetup = { state: 2, pullback: i, fib: level, pct }; break; } }
    if (sellSetup.state === 1 && sellReady) for (const pct of ENTRY_FIBS) { const level = sellFib(st, sb, pct); if (b.high >= level) { sellSetup = { state: 2, pullback: i, fib: level, pct }; break; } }
    if (buySetup.state >= 2 && i - buySetup.pullback > RETEST_BARS) buySetup = { state: 0, pullback: -1, fib: null, pct: null };
    if (sellSetup.state >= 2 && i - sellSetup.pullback > RETEST_BARS) sellSetup = { state: 0, pullback: -1, fib: null, pct: null };
    if (buySetup.state === 2 && buySetup.fib != null && b.low <= buySetup.fib && b.close > buySetup.fib && b.close > b.open && b.close > prev.high) buySetup.state = 3;
    if (sellSetup.state === 2 && sellSetup.fib != null && b.high >= sellSetup.fib && b.close < sellSetup.fib && b.close < b.open && b.close < prev.low) sellSetup.state = 3;

    while (m5Pointer + 1 < m5.length && m5[m5Pointer + 1].time + 300_000 <= closeTime) m5Pointer++;
    const m5i = m5Pointer, m5b = m5i >= 0 ? m5[m5i] : null, m5p = m5i > 0 ? m5[m5i - 1] : null, a5 = m5i >= 0 ? atr5[m5i] : 0;
    const m5Bull = !!m5b && !!m5p && a5 > 0 && m5b.close > m5b.open && m5b.close - m5b.open >= a5 * 0.6 && m5b.close > m5p.high;
    const m5Bear = !!m5b && !!m5p && a5 > 0 && m5b.close < m5b.open && m5b.open - m5b.close >= a5 * 0.6 && m5b.close < m5p.low;
    while (silverPointer + 1 < silver.length && silver[silverPointer + 1].time <= b.time) {
      silverPointer++;
      const sp = pivot(silver, silverPointer, 3);
      if (sp.high != null) { silverPreviousHigh = silverLastHigh; silverLastHigh = sp.high; }
      if (sp.low != null) { silverPreviousLow = silverLastLow; silverLastLow = sp.low; }
    }
    const silverLast = silverPointer >= 0 ? silver[silverPointer] : null, silverPrev = silverPointer > 0 ? silver[silverPointer - 1] : null;
    const silverMa = silverPointer >= 0 ? silverEma[silverPointer] : null, silverPriorMa = silverPointer > 0 ? silverEma[silverPointer - 1] : null;
    const silverContext = {
      last: silverLast, prev: silverPrev, ma: silverMa, priorMa: silverPriorMa,
      lastHigh: silverLastHigh, previousHigh: silverPreviousHigh, lastLow: silverLastLow, previousLow: silverPreviousLow,
      avgVolume: silverPointer >= 19 ? silver.slice(silverPointer - 19, silverPointer + 1).reduce((sum, x) => sum + (x.volume ?? 0), 0) / 20 : null,
    };
    const pd = { high: priorHigh, low: priorLow, weekHigh: m5i >= 0 ? m5Levels[m5i]?.weekHigh ?? null : null, weekLow: m5i >= 0 ? m5Levels[m5i]?.weekLow ?? null : null };
    const upper = nearest([...highs, ...(pd.high != null ? [pd.high] : []), ...(pd.weekHigh != null ? [pd.weekHigh] : [])], b.high, true);
    const lower = nearest([...lows, ...(pd.low != null ? [pd.low] : []), ...(pd.weekLow != null ? [pd.weekLow] : [])], b.low, false);
    const bullOb = lower != null ? targetOb(c, atr, i, lower, false) : null;
    const bearOb = upper != null ? targetOb(c, atr, i, upper, true) : null;
    const bScore = buyReady ? confluence(1, c, i, buyFib(bt, bb, 68.1), buyFib(bt, bb, 88), bullActive, pd, silverContext).score : 0;
    const sScore = sellReady ? confluence(-1, c, i, sellFib(st, sb, 68.1), sellFib(st, sb, 88), bearActive, pd, silverContext).score : 0;
    buyScore = bScore; sellScore = sScore;
    const buyValid = buySetup.state === 3 && buySetup.fib != null && b.low <= buySetup.fib && b.close >= buySetup.fib && m5Bull && upper != null && upper > buySetup.fib && (bullActive || buyReady) && !!bullOb && bullOb.bottom < buySetup.fib && bScore >= MIN_SCORE;
    const sellValid = sellSetup.state === 3 && sellSetup.fib != null && b.high >= sellSetup.fib && b.close <= sellSetup.fib && m5Bear && lower != null && lower < sellSetup.fib && (bearActive || sellReady) && !!bearOb && bearOb.top > sellSetup.fib && sScore >= MIN_SCORE;

    if (active) {
      const slHit = active.direction === "BUY" ? b.low <= active.stopLoss : b.high >= active.stopLoss;
      const targets = [active.tp1, active.tp2, active.tp3, active.tp4, active.tp5];
      if (slHit) {
        active.status = "SL_HIT"; active.exitTime = new Date(closeTime).toISOString(); active.exitPrice = active.stopLoss; closed = active; active = null;
      } else if (lotSize < 0.05) {
        if (!active.targetHits[0] && (active.direction === "BUY" ? b.high >= active.tp1 : b.low <= active.tp1)) {
          active.targetHits[0] = true; active.status = "TP_HIT"; active.exitTime = new Date(closeTime).toISOString(); active.exitPrice = active.tp1; closed = active; active = null;
        }
      } else {
        for (let targetIndex = 0; targetIndex < targets.length; targetIndex++) {
          if (active.targetHits[targetIndex]) continue;
          const targetPrice = targets[targetIndex];
          const hit = active.direction === "BUY" ? b.high >= targetPrice : b.low <= targetPrice;
          if (hit) active.targetHits[targetIndex] = true;
        }
        if (active.targetHits.every(Boolean)) {
          active.status = "TP_HIT"; active.exitTime = new Date(closeTime).toISOString(); active.exitPrice = active.tp5; closed = active; active = null;
        }
      }
    }
    if (!active && (buyValid || sellValid)) {
      const isBuy = buyValid, dir: VortexDirection = isBuy ? "BUY" : "SELL";
      const fib = (isBuy ? buySetup.fib : sellSetup.fib)!;
      const pct = (isBuy ? buySetup.pct : sellSetup.pct)!;
      const ob = (isBuy ? bullOb : bearOb)!;
      const entry = fib, sl = isBuy ? ob.bottom - tick : ob.top + tick;
      const tps = TP_FIBS.map(x => isBuy ? buyFib(bt, bb, x) : sellFib(st, sb, x));
      const tp4 = entry * (isBuy ? 1.015 : 0.985), tp5 = entry * (isBuy ? 1.0181 : 0.9819);
      const targetsValid = [...tps, tp4, tp5].every(x => isBuy ? x > entry : x < entry);
      if (targetsValid && (isBuy ? sl < entry : sl > entry)) {
        active = { direction: dir, entry, stopLoss: sl, tp1: tps[0], tp2: tps[1], tp3: tps[2], tp4, tp5, fibLevel: pct, entryTime: new Date(closeTime).toISOString(), confirmationTime: m5b ? new Date(m5b.time + 300_000).toISOString() : new Date(closeTime).toISOString(), lotSize, targetHits: [false, false, false, false, false], status: "ACTIVE" };
        lastOb = ob; lastLiq = isBuy ? upper : lower; lastScore = isBuy ? bScore : sScore; lastFib = pct;
        evidence = ["Institutional order detected", "Fib pullback selected at " + pct + "%", "M1 retest and candle confirmation completed", "M5 displacement confirmation passed", "External liquidity and opposing target OB aligned", "Confluence score " + lastScore + "/100 passed"];
        missing = [];
        if (isBuy) buySetup = { state: 0, pullback: -1, fib: null, pct: null };
        else sellSetup = { state: 0, pullback: -1, fib: null, pct: null };
      }
    }
    if (i === c.length - 1 && !active) {
      missing = [!window ? "Outside the source-defined New York Silver Bullet windows (03:00–04:00, 10:00–11:00, 14:00–15:00)." : buySetup.state || sellSetup.state ? "Setup is developing; waiting for the remaining M1/M5, liquidity, OB and confluence conditions." : "Waiting for a confirmed institutional order."];
    }
    if (m5b) lastM5Time = new Date(m5b.time + 300_000).toISOString();
  }

  const setupDeveloping = buySetup.state > 0 || sellSetup.state > 0;
  const trade = active ?? (setupDeveloping ? null : closed);
  const state = active ? "TRADE ACTIVE" : setupDeveloping ? "SETUP DEVELOPING" : closed?.status === "TP_HIT" ? "TP HIT" : closed?.status === "SL_HIT" ? "SL HIT" : "WAITING";
  const sLast = silver.at(-1), sPrev = silver.at(-2), sMa = silver.length >= 50 ? silverEma[silverEma.length - 1] : null;
  const sFlow = sLast && sPrev ? sLast.close < sPrev.close ? "FALLING" : sLast.close > sPrev.close ? "RISING" : "FLAT" : "UNAVAILABLE";
  return {
    source: "VAULTTRADES_VORTEX_PINE_V12", state, direction: trade?.direction ?? "NO TRADE",
    entry: trade?.entry ?? null, stopLoss: trade?.stopLoss ?? null, tp1: trade?.tp1 ?? null, tp2: trade?.tp2 ?? null,
    tp3: trade?.tp3 ?? null, tp4: trade?.tp4 ?? null, tp5: trade?.tp5 ?? null, fibLevel: trade?.fibLevel ?? lastFib,
    score: active ? lastScore : Math.max(buyScore, sellScore), buyConfluence: buyScore, sellConfluence: sellScore, liquidityTarget: lastLiq, orderBlock: lastOb,
    entryTime: trade?.entryTime ?? null, confirmationTime: trade?.confirmationTime ?? lastM5Time, lotSize,
    lotModel: lotSize < 0.05 ? "FULL CLOSE AT TP1" : "FIVE TARGETS · 20% EACH",
    targetHits: trade?.targetHits ?? [false, false, false, false, false], openTrade: active, latestClosedTrade: closed,
    evidence, missingConditions: active ? [] : missing,
    invalidation: "The M1 setup expires after 8 bars or when its Silver Bullet window closes. SL is anchored to the opposing target-OB wick.",
    statusReason: active ? (lotSize < 0.05 ? "Trade active. This lot size closes fully at TP1." : "Trade active. Five targets are managed progressively at 20% each.") : setupDeveloping ? "Vortex setup developing. Waiting for the next M1/M5 qualification event." : closed ? "The previous trade has closed. Waiting for the next qualifying Vortex setup." : missing[0],
    riskReward: trade ? Math.abs(trade.tp5 - trade.entry) / Math.abs(trade.entry - trade.stopLoss) : null,
    silver: { available: silver.length > 1, close: sLast?.close ?? null, flow: sFlow, ma: sMa },
  };
}

export type VortexCandle = { time: number; open: number; high: number; low: number; close: number; volume?: number };
export type VortexDirection = "BUY" | "SELL";
export type VortexTimeframe = "1m" | "5m" | "10m" | "15m" | "30m" | "1H" | "4H" | "1D" | "1W" | "1M";
export type VortexOrderBlock = { direction: VortexDirection; top: number; bottom: number };
export type VortexDetectedOrderBlock = {
  direction: VortexDirection;
  top: number;
  bottom: number;
  formedAt: string;
  displacementAt: string;
  state: "ACTIVE" | "MITIGATED" | "INVALIDATED";
};
export type VortexDetectedLiquidity = {
  price: number;
  source: "CONFIRMED SWING HIGH" | "CONFIRMED SWING LOW";
  pivotTime: string;
};
export type VortexStructureDetection = {
  timeframe: VortexTimeframe;
  asOf: string | null;
  structuralDirection: VortexDirection | "NEUTRAL";
  orderBlocks: VortexDetectedOrderBlock[];
  buySideLiquidity: VortexDetectedLiquidity | null;
  sellSideLiquidity: VortexDetectedLiquidity | null;
  lastBullishDisplacementAt: string | null;
  lastBearishDisplacementAt: string | null;
  lookbackBars: number;
  swingLength: number;
  displacementAtr: number;
};
type VortexSetup = { state: number; orderBar: number; pullback: number; fib: number | null; pct: number | null; start: number | null; end: number | null; ob: VortexOrderBlock | null };
const newSetup = (): VortexSetup => ({ state: 0, orderBar: -1, pullback: -1, fib: null, pct: null, start: null, end: null, ob: null });
export type VortexVwap = { value: number | null; sd: number | null; upperInner: number | null; upperOuter: number | null; lowerInner: number | null; lowerOuter: number | null; available: boolean; buyAligned: boolean; sellAligned: boolean };
export type VortexTrade = {
  timeframe: VortexTimeframe; direction: VortexDirection; entry: number; stopLoss: number;
  tp1: number; tp2: number; tp3: number; tp4: null; tp5: null;
  fibLevel: number; entryTime: string; confirmationTime: string;
  lotSize: number; targetHits: boolean[]; status: "ACTIVE" | "TP_HIT" | "SL_HIT";
  orderBlock: VortexOrderBlock; liquidityTarget: number;
  exitTime?: string; exitPrice?: number;
};
export type VortexResult = {
  source: "VAULTTRADES_VORTEX_S1_FIB_VWAP_CONFLUENCE"; timeframe: VortexTimeframe; state: "WAITING" | "SETUP DEVELOPING" | "TRADE ACTIVE" | "TP HIT" | "SL HIT";
  direction: VortexDirection | "NO TRADE"; plannedDirection: VortexDirection | null; structuralDirection: VortexDirection | "NEUTRAL"; entryConfirmed: boolean; htfConfirmation: VortexHtfConfirmation;
  entry: number | null; stopLoss: number | null;
  tp1: number | null; tp2: number | null; tp3: number | null; tp4: number | null; tp5: number | null;
  fibLevel: number | null; score: number; buyConfluence: number; sellConfluence: number;
  liquidityTarget: number | null; orderBlock: VortexOrderBlock | null;
  entryTime: string | null; confirmationTime: string | null; lotSize: number; lotModel: string;
  targetHits: boolean[]; openTrade: VortexTrade | null; latestClosedTrade: VortexTrade | null;
  evidence: string[]; missingConditions: string[]; invalidation: string; statusReason: string;
  riskReward: number | null; silver: { available: boolean; close: number | null; flow: string; ma: number | null };
  vwap: VortexVwap | null;
};
export type EvaluateVortexInput = { m1Candles: VortexCandle[]; m5Candles: VortexCandle[]; h4Candles?: VortexCandle[]; h1Candles?: VortexCandle[]; silverCandles?: VortexCandle[]; timeframe?: VortexTimeframe; confirmationTimeframe?: "5m"; tickSize?: number; lotSize?: number };

const ENTRY_FIBS = [68.1, 78.6, 88.0];
const TP_FIBS = [38.2, 0, -23.6];
const TIMEFRAME_MS: Record<VortexTimeframe, number> = { "1m": 60_000, "5m": 300_000, "10m": 600_000, "15m": 900_000, "30m": 1_800_000, "1H": 3_600_000, "4H": 14_400_000, "1D": 86_400_000, "1W": 604_800_000, "1M": 2_629_746_000 };
function candleCloseTime(candles: VortexCandle[], index: number, timeframe: VortexTimeframe) {
  const current = candles[index];
  const next = candles[index + 1];
  if (next && next.time > current.time) return next.time;
  const end = new Date(current.time);
  if (timeframe === "1M") end.setUTCMonth(end.getUTCMonth() + 1);
  else end.setTime(end.getTime() + TIMEFRAME_MS[timeframe]);
  return end.getTime();
}
const RETEST_BARS = 8;
const MIN_SCORE = 60;
const PIVOT = 5;
const NY = "America/New_York";

function nyParts(time: number) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: NY, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(time));
  const get = (k: string) => parts.find(p => p.type === k)?.value ?? "0";
  return { day: get("year") + "-" + get("month") + "-" + get("day"), minute: Number(get("hour")) * 60 + Number(get("minute")) };
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

export function detectVortexInstitutionalStructure(
  input: VortexCandle[],
  timeframe: VortexTimeframe,
  options: { swingLength?: number; atrLength?: number; displacementAtr?: number; lookbackBars?: number } = {},
): VortexStructureDetection {
  const c = [...input].sort((a, b) => a.time - b.time);
  const swingLength = options.swingLength ?? 3;
  const atrLength = options.atrLength ?? 14;
  const displacementAtr = options.displacementAtr ?? 0.8;
  const lookbackBars = options.lookbackBars ?? 200;
  const empty: VortexStructureDetection = {
    timeframe, asOf: c.length ? new Date(c[c.length - 1].time).toISOString() : null,
    structuralDirection: "NEUTRAL", orderBlocks: [], buySideLiquidity: null, sellSideLiquidity: null,
    lastBullishDisplacementAt: null, lastBearishDisplacementAt: null,
    lookbackBars, swingLength, displacementAtr,
  };
  if (c.length < Math.max(atrLength + 2, swingLength * 2 + 5)) return empty;

  const atr = atrSeries(c, atrLength);
  const highs: Array<{ price: number; index: number; time: number; swept: boolean }> = [];
  const lows: Array<{ price: number; index: number; time: number; swept: boolean }> = [];
  const blocks: Array<VortexDetectedOrderBlock & { formedIndex: number; displacementIndex: number }> = [];
  let lastSwingHigh: { price: number; index: number } | null = null;
  let lastSwingLow: { price: number; index: number } | null = null;
  let structuralDirection: VortexDirection | "NEUTRAL" = "NEUTRAL";
  let lastBullishDisplacementAt: string | null = null;
  let lastBearishDisplacementAt: string | null = null;

  for (let i = swingLength * 2; i < c.length; i++) {
    const bar = c[i];
    // Update lifecycle of already-formed footprints before considering a new one.
    for (const ob of blocks) {
      if (ob.state === "INVALIDATED" || i <= ob.displacementIndex) continue;
      if (ob.direction === "BUY" && bar.close < ob.bottom) ob.state = "INVALIDATED";
      else if (ob.direction === "SELL" && bar.close > ob.top) ob.state = "INVALIDATED";
      else if (ob.state === "ACTIVE" && bar.low <= ob.top && bar.high >= ob.bottom) ob.state = "MITIGATED";
    }

    const confirmedPivot = pivot(c, i, swingLength);
    if (confirmedPivot.high !== null) {
      const index = i - swingLength;
      lastSwingHigh = { price: confirmedPivot.high, index };
      highs.push({ price: confirmedPivot.high, index, time: c[index].time, swept: bar.high > confirmedPivot.high });
      if (highs.length > 80) highs.shift();
    }
    if (confirmedPivot.low !== null) {
      const index = i - swingLength;
      lastSwingLow = { price: confirmedPivot.low, index };
      lows.push({ price: confirmedPivot.low, index, time: c[index].time, swept: bar.low < confirmedPivot.low });
      if (lows.length > 80) lows.shift();
    }

    for (const level of highs) if (bar.high > level.price) level.swept = true;
    for (const level of lows) if (bar.low < level.price) level.swept = true;

    const a = atr[i];
    if (!(a > 0)) continue;
    const body = Math.abs(bar.close - bar.open);
    const previous = c[i - 1];
    const bullBreak = !!lastSwingHigh && previous.close <= lastSwingHigh.price &&
      bar.close > lastSwingHigh.price && bar.close > bar.open && body >= a * displacementAtr;
    const bearBreak = !!lastSwingLow && previous.close >= lastSwingLow.price &&
      bar.close < lastSwingLow.price && bar.close < bar.open && body >= a * displacementAtr;

    const findOrigin = (direction: VortexDirection, floorIndex: number) => {
      const start = Math.max(floorIndex, i - lookbackBars, 0);
      for (let j = i - 1; j >= start; j--) {
        const base = c[j];
        const opposing = direction === "BUY" ? base.close < base.open : base.close > base.open;
        if (!opposing) continue;
        const displacementClearsOrigin = direction === "BUY" ? bar.close > base.high : bar.close < base.low;
        if (!displacementClearsOrigin) continue;
        const revisitedBeforeBreak = c.slice(j + 1, i).some(x => x.low <= base.high && x.high >= base.low);
        if (revisitedBeforeBreak) continue;
        return { index: j, top: base.high, bottom: base.low };
      }
      return null;
    };

    if (bullBreak) {
      const origin = findOrigin("BUY", lastSwingLow?.index ?? Math.max(0, i - lookbackBars));
      if (origin) {
        blocks.push({
          direction: "BUY", top: origin.top, bottom: origin.bottom,
          formedAt: new Date(c[origin.index].time).toISOString(),
          displacementAt: new Date(bar.time).toISOString(), state: "ACTIVE",
          formedIndex: origin.index, displacementIndex: i,
        });
        structuralDirection = "BUY";
        lastBullishDisplacementAt = new Date(bar.time).toISOString();
      }
    }
    if (bearBreak) {
      const origin = findOrigin("SELL", lastSwingHigh?.index ?? Math.max(0, i - lookbackBars));
      if (origin) {
        blocks.push({
          direction: "SELL", top: origin.top, bottom: origin.bottom,
          formedAt: new Date(c[origin.index].time).toISOString(),
          displacementAt: new Date(bar.time).toISOString(), state: "ACTIVE",
          formedIndex: origin.index, displacementIndex: i,
        });
        structuralDirection = "SELL";
        lastBearishDisplacementAt = new Date(bar.time).toISOString();
      }
    }
    if (blocks.length > 40) blocks.shift();
  }

  const current = c[c.length - 1];
  const buyTarget = highs.filter(x => !x.swept && x.price > current.close).sort((a, b) => a.price - b.price)[0];
  const sellTarget = lows.filter(x => !x.swept && x.price < current.close).sort((a, b) => b.price - a.price)[0];
  const visibleBlocks = blocks
    .filter(x => x.state !== "INVALIDATED")
    .slice(-8)
    .map(({ formedIndex: _formedIndex, displacementIndex: _displacementIndex, ...ob }) => ob);

  return {
    timeframe, asOf: new Date(current.time).toISOString(), structuralDirection,
    orderBlocks: visibleBlocks,
    buySideLiquidity: buyTarget ? { price: buyTarget.price, source: "CONFIRMED SWING HIGH", pivotTime: new Date(buyTarget.time).toISOString() } : null,
    sellSideLiquidity: sellTarget ? { price: sellTarget.price, source: "CONFIRMED SWING LOW", pivotTime: new Date(sellTarget.time).toISOString() } : null,
    lastBullishDisplacementAt, lastBearishDisplacementAt,
    lookbackBars, swingLength, displacementAtr,
  };
}

function findCausalOrderBlock(
  c: VortexCandle[],
  atr: number[],
  impulseIndex: number,
  direction: VortexDirection,
  breakLevel: number,
  lookback = 60,
): VortexOrderBlock | null {
  const impulse = c[impulseIndex];
  const impulseAtr = atr[impulseIndex] ?? 0;
  if (!impulse || impulseAtr <= 0) return null;
  const body = Math.abs(impulse.close - impulse.open);
  const validImpulse = direction === "BUY"
    ? impulse.close > impulse.open && impulse.close > breakLevel && body >= impulseAtr * 0.5
    : impulse.close < impulse.open && impulse.close < breakLevel && body >= impulseAtr * 0.5;
  if (!validImpulse) return null;
  for (let j = impulseIndex - 1; j >= Math.max(0, impulseIndex - lookback); j--) {
    const base = c[j];
    const opposing = direction === "BUY" ? base.close < base.open : base.close > base.open;
    if (!opposing) continue;
    const clearsBase = direction === "BUY" ? impulse.close > base.high : impulse.close < base.low;
    if (!clearsBase) continue;
    const revisitedBeforeImpulse = c.slice(j + 1, impulseIndex).some(x => x.low <= base.high && x.high >= base.low);
    if (revisitedBeforeImpulse) continue;
    return { direction, top: base.high, bottom: base.low };
  }
  return null;
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
    const [year, month, date] = key.split("-").map(Number);
    const utcDay = Date.UTC(year, month - 1, date);
    const monday = utcDay - ((new Date(utcDay).getUTCDay() + 6) % 7) * 86400000;
    const wk = String(monday);
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
function weeklyVwapSeries(c: VortexCandle[]): VortexVwap[] {
  const out: VortexVwap[] = [];
  let key = "", volume = 0, priceVolume = 0, variance = 0;
  for (let i = 0; i < c.length; i++) {
    const bar = c[i], day = nyParts(bar.time).day;
    const [year, month, date] = day.split("-").map(Number);
    const utcDay = Date.UTC(year, month - 1, date);
    const monday = utcDay - ((new Date(utcDay).getUTCDay() + 6) % 7) * 86400000;
    const nextKey = String(monday);
    if (nextKey !== key) { key = nextKey; volume = 0; priceVolume = 0; variance = 0; }
    const typical = (bar.high + bar.low + bar.close) / 3;
    const qty = Math.max(0, bar.volume ?? 0);
    const previousVwap = volume > 0 ? priceVolume / volume : typical;
    volume += qty;
    priceVolume += typical * qty;
    const currentVwap = volume > 0 ? priceVolume / volume : typical;
    variance += qty * (typical - previousVwap) * (typical - currentVwap);
    const value = volume > 0 ? currentVwap : null;
    const sd = volume > 0 ? Math.sqrt(Math.max(variance / volume, 0)) : null;
    const upperInner = value !== null && sd !== null ? value + 1.618 * sd : null;
    const upperOuter = value !== null && sd !== null ? value + 2.618 * sd : null;
    const lowerInner = value !== null && sd !== null ? value - 1.618 * sd : null;
    const lowerOuter = value !== null && sd !== null ? value - 2.618 * sd : null;
    const prev = i > 0 ? c[i - 1] : null;
    const prevValue = i > 0 ? out[i - 1]?.value ?? null : null;
    const crossAbove = prev !== null && prevValue !== null && value !== null && prev.close <= prevValue && bar.close > value;
    const crossBelow = prev !== null && prevValue !== null && value !== null && prev.close >= prevValue && bar.close < value;
    const available = value !== null && sd !== null && volume > 0;
    const bullReclaim = available && (crossAbove || (lowerInner !== null && bar.low <= lowerInner && bar.close > lowerInner && bar.close > bar.open) || (lowerOuter !== null && bar.low <= lowerOuter && bar.close > lowerOuter && bar.close > bar.open));
    const bearRejection = available && (crossBelow || (upperInner !== null && bar.high >= upperInner && bar.close < upperInner && bar.close < bar.open) || (upperOuter !== null && bar.high >= upperOuter && bar.close < upperOuter && bar.close < bar.open));
    out.push({ value, sd, upperInner, upperOuter, lowerInner, lowerOuter, available,
      buyAligned: available && ((bar.close > value! && bar.close <= upperOuter!) || bullReclaim),
      sellAligned: available && ((bar.close < value! && bar.close >= lowerOuter!) || bearRejection) });
  }
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
function confluence(dir: 1 | -1, c: VortexCandle[], i: number, f68: number, f88: number, structure: boolean, levels: { high: number | null; low: number | null; weekHigh: number | null; weekLow: number | null }, silver: { last: VortexCandle | null; prev: VortexCandle | null; ma: number | null; priorMa: number | null; lastHigh: number | null; previousHigh: number | null; lastLow: number | null; previousLow: number | null; avgVolume: number | null }, vwap: VortexVwap) {
  const b = c[i];
  let available = 45 + (vwap.available ? 10 : 0), raw = (dir > 0 ? b.low <= f68 && b.close >= f88 : b.high >= f68 && b.close <= f88) ? 25 : 0;
  if (structure) raw += 20;
  if (vwap.available && (dir > 0 ? vwap.buyAligned : vwap.sellAligned)) raw += 10;
  const liquidityAvailable = dir > 0 ? levels.low != null || levels.weekLow != null : levels.high != null || levels.weekHigh != null;
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

export type VortexHtfConfirmation = {
  direction: VortexDirection | "WAITING" | "NEUTRAL";
  h4Level: number | null;
  h4WickExtreme: number | null;
  h4AnchorTime: string | null;
  h1BreakTime: string | null;
  h1RetestTime: string | null;
  confirmed: boolean;
  reason: string;
};
function evaluateH4H1Confirmation(h4Input: VortexCandle[], h1Input: VortexCandle[]): VortexHtfConfirmation {
  const h4 = [...h4Input].sort((a, b) => a.time - b.time);
  const h1 = [...h1Input].sort((a, b) => a.time - b.time);
  const waiting = (reason: string): VortexHtfConfirmation => ({
    direction: "WAITING", h4Level: null, h4WickExtreme: null, h4AnchorTime: null,
    h1BreakTime: null, h1RetestTime: null, confirmed: false, reason,
  });
  if (h4.length < 3 || h1.length < 10) return waiting("Waiting for completed H4 and H1 candle history.");
  // Lock the first directional H4 candle in the latest uninterrupted directional run.
  // The candle open is the body boundary; the wick extreme is retained separately.
  let anchor: VortexCandle | null = null;
  let direction: VortexDirection | null = null;
  for (let i = h4.length - 1; i >= 1; i--) {
    const bar = h4[i];
    const dir: VortexDirection | null = bar.close > bar.open ? "BUY" : bar.close < bar.open ? "SELL" : null;
    if (!dir) continue;
    let first = i;
    while (first > 0) {
      const prior = h4[first - 1];
      const same = dir === "BUY" ? prior.close > prior.open : prior.close < prior.open;
      if (!same) break;
      first--;
    }
    const prior = h4[first - 1];
    const beganAfterOpposing = !prior || (dir === "BUY" ? prior.close <= prior.open : prior.close >= prior.open);
    if (beganAfterOpposing) { anchor = h4[first]; direction = dir; break; }
  }
  if (!anchor || !direction) return waiting("Waiting for a completed H4 directional reference candle.");
  const level = anchor.open;
  const wick = direction === "BUY" ? anchor.low : anchor.high;
  const afterAnchor = h1.filter(bar => bar.time >= anchor!.time + TIMEFRAME_MS["4H"]);
  let breakIndex = -1;
  for (let i = 0; i < afterAnchor.length; i++) {
    const bar = afterAnchor[i];
    if (direction === "BUY" ? bar.close > level : bar.close < level) { breakIndex = i; break; }
  }
  if (breakIndex < 0) return {
    direction: "WAITING", h4Level: level, h4WickExtreme: wick,
    h4AnchorTime: new Date(anchor.time).toISOString(), h1BreakTime: null, h1RetestTime: null,
    confirmed: false, reason: `H4 ${direction} reference locked at ${level}; waiting for a completed H1 close beyond the H4 body boundary.`,
  };
  const breakBar = afterAnchor[breakIndex];
  for (let i = breakIndex + 1; i < afterAnchor.length; i++) {
    const bar = afterAnchor[i];
    const retest = direction === "BUY"
      ? bar.low <= level && bar.close > level && bar.close > bar.open
      : bar.high >= level && bar.close < level && bar.close < bar.open;
    if (retest) return {
      direction, h4Level: level, h4WickExtreme: wick,
      h4AnchorTime: new Date(anchor.time).toISOString(),
      h1BreakTime: new Date(breakBar.time).toISOString(),
      h1RetestTime: new Date(bar.time).toISOString(),
      confirmed: true,
      reason: `H4 ${direction} reference locked; H1 break-and-close and separate H1 retest/rejection confirmed.`,
    };
    if (direction === "BUY" ? bar.close < wick : bar.close > wick) return {
      direction: "WAITING", h4Level: level, h4WickExtreme: wick,
      h4AnchorTime: new Date(anchor.time).toISOString(),
      h1BreakTime: new Date(breakBar.time).toISOString(), h1RetestTime: null,
      confirmed: false, reason: "H1 invalidated the H4 reference before a valid retest; waiting for a new H4 reference.",
    };
  }
  return {
    direction: "WAITING", h4Level: level, h4WickExtreme: wick,
    h4AnchorTime: new Date(anchor.time).toISOString(),
    h1BreakTime: new Date(breakBar.time).toISOString(), h1RetestTime: null,
    confirmed: false, reason: `H1 broke the H4 level; waiting for a separate ${direction} H1 retest and directional close.`,
  };
}

export function evaluateVortex(input: EvaluateVortexInput): VortexResult {
  const c = [...input.m1Candles].sort((a, b) => a.time - b.time), m5 = [...input.m5Candles].sort((a, b) => a.time - b.time);
  const silver = [...(input.silverCandles ?? [])].sort((a, b) => a.time - b.time);
  const htf = evaluateH4H1Confirmation(input.h4Candles ?? [], input.h1Candles ?? []);
  const lotSize = input.lotSize ?? 0.05, tick = input.tickSize ?? 0.01;
  const timeframe = input.timeframe ?? "1m";
  const confirmationTimeframe = "5m" as const;
  const empty = (reason: string): VortexResult => ({
    source: "VAULTTRADES_VORTEX_S1_FIB_VWAP_CONFLUENCE", timeframe, state: "WAITING", direction: "NO TRADE", plannedDirection: null,
    structuralDirection: "NEUTRAL", entryConfirmed: false, htfConfirmation: htf,
    entry: null, stopLoss: null, tp1: null, tp2: null, tp3: null, tp4: null, tp5: null, fibLevel: null,
    score: 0, buyConfluence: 0, sellConfluence: 0, liquidityTarget: null, orderBlock: null,
    entryTime: null, confirmationTime: null, lotSize, lotModel: "FULL CLOSE AT TP1",
    targetHits: [false, false, false], openTrade: null, latestClosedTrade: null,
    evidence: [], missingConditions: [reason], invalidation: `The setup expires after 8 ${timeframe.toUpperCase()} bars or when its structure is invalidated.`,
    statusReason: reason, riskReward: null, silver: { available: silver.length > 51, close: silver.at(-1)?.close ?? null, flow: "UNAVAILABLE", ma: null },
    vwap: null,
  });
  if (c.length < 300 || m5.length < 30) return empty(`Waiting for sufficient ${timeframe.toUpperCase()} history and completed ${confirmationTimeframe.toUpperCase()} confirmation candles.`);
  const timeframeSeconds: Record<VortexTimeframe, number> = {
    "1m": 60, "5m": 300, "10m": 600, "15m": 900, "30m": 1800,
    "1H": 3600, "4H": 14400, "1D": 86400, "1W": 604800, "1M": 2592000,
  };
  // Mirrors Pine's autoFibTimeframe/effectivePivotLen default.
  const structurePivotLen = timeframeSeconds[timeframe] <= 300 ? 5 : timeframeSeconds[timeframe] <= 1800 ? 4 : 3;
  const atr = atrSeries(c), atr5 = atrSeries(m5), selectedPeriodLevels = periodLevels(c), silverEma = emaSeries(silver.map(x => x.close), 50), vwapSeries = weeklyVwapSeries(c);
  const highs: number[] = [], lows: number[] = [], targetHighs: number[] = [], targetLows: number[] = [];
  const ranges = new Map<string, { asia?: { high: number; low: number }; london?: { high: number; low: number }; ny?: { high: number; low: number }; last: "Asia" | "London" | "New York" }>();
  let bullActive = false, bearActive = false, bullArmed = false, bearArmed = false;
  let bullSetupConsumed = false, bearSetupConsumed = false;
  let bullSweep = 0, bearSweep = 0, bullSweepBar = -1, bearSweepBar = -1, bullLevel: number | null = null, bearLevel: number | null = null;
  let bullStart: number | null = null, bullEnd: number | null = null, bullChochBar = -1;
  let bearStart: number | null = null, bearEnd: number | null = null, bearChochBar = -1;
  let liqHigh: number | null = null, liqLow: number | null = null;
  let buySetup: VortexSetup = newSetup();
  let sellSetup: VortexSetup = newSetup();
  let active: VortexTrade | null = null, closed: VortexTrade | null = null, lastOb: VortexResult["orderBlock"] = null, lastLiq: number | null = null;
  let buyScore = 0, sellScore = 0, lastScore = 0, evidence: string[] = [], missing = ["Waiting for a completed-session liquidity sweep followed by a close-confirmed CHOCH."], lastFib: number | null = null, lastM5Time: string | null = null;
  let m5Pointer = -1, silverPointer = -1, currentDay = "", runningDayHigh = -Infinity, runningDayLow = Infinity, priorHigh: number | null = null, priorLow: number | null = null, priorNySession: { high: number; low: number } | null = null;
  let silverLastHigh: number | null = null, silverPreviousHigh: number | null = null, silverLastLow: number | null = null, silverPreviousLow: number | null = null;
  let activeTargetSessionId = 0, targetActiveHigh: number | null = null, targetActiveLow: number | null = null, targetPreviousHigh: number | null = null, targetPreviousLow: number | null = null;
  let targetBullOb: { top: number; bottom: number; direction: VortexDirection } | null = null, targetBearOb: { top: number; bottom: number; direction: VortexDirection } | null = null;

  for (let i = 20; i < c.length; i++) {
    const b = c[i], prev = c[i - 1], closeTime = candleCloseTime(c, i, timeframe), np = nyParts(b.time), m = np.minute;
    if (currentDay && np.day !== currentDay) { priorHigh = Number.isFinite(runningDayHigh) ? runningDayHigh : priorHigh; priorLow = Number.isFinite(runningDayLow) ? runningDayLow : priorLow; priorNySession = ranges.get(currentDay)?.ny ?? priorNySession; runningDayHigh = -Infinity; runningDayLow = Infinity; }
    currentDay = np.day; runningDayHigh = Math.max(runningDayHigh, b.high); runningDayLow = Math.min(runningDayLow, b.low);
    const session: "Asia" | "London" | "New York" | null = m < 360 ? "Asia" : m >= 420 && m < 600 ? "London" : m >= 750 && m < 1020 ? "New York" : null;
    let day = ranges.get(np.day);
    if (!day) { day = { last: "Asia" }; ranges.set(np.day, day); }
    const targetSessionId = (m >= 1140 || m < 120) ? 1 : m >= 120 && m < 480 ? 2 : m >= 480 && m < 1020 ? 3 : 0;
    if (targetSessionId !== 0 && targetSessionId !== activeTargetSessionId) {
      if (targetActiveHigh != null && targetActiveLow != null && activeTargetSessionId !== 0) { targetPreviousHigh = targetActiveHigh; targetPreviousLow = targetActiveLow; }
      targetActiveHigh = b.high; targetActiveLow = b.low; activeTargetSessionId = targetSessionId;
    } else if (targetSessionId !== 0) {
      targetActiveHigh = targetActiveHigh == null ? b.high : Math.max(targetActiveHigh, b.high);
      targetActiveLow = targetActiveLow == null ? b.low : Math.min(targetActiveLow, b.low);
    }
    if (session) {
      day.last = session;
      const key = session === "Asia" ? "asia" : session === "London" ? "london" : "ny";
      const range = day[key] ?? { high: b.high, low: b.low };
      range.high = Math.max(range.high, b.high); range.low = Math.min(range.low, b.low); day[key] = range;
      if (session === "London" && day.asia) { liqHigh = day.asia.high; liqLow = day.asia.low; }
      if (session === "New York" && day.london) { liqHigh = day.london.high; liqLow = day.london.low; }
      if (session === "Asia" && priorNySession) { liqHigh = priorNySession.high; liqLow = priorNySession.low; }
    }
    const pv = pivot(c, i, structurePivotLen);
    if (pv.high != null) highs.push(pv.high);
    if (pv.low != null) lows.push(pv.low);
    const targetPv = pivot(c, i, 3);
    if (targetPv.high != null) { targetHighs.push(targetPv.high); if (targetHighs.length > 50) targetHighs.shift(); }
    if (targetPv.low != null) { targetLows.push(targetPv.low); if (targetLows.length > 50) targetLows.shift(); }
    const lastHigh = highs.at(-1) ?? null, lastLow = lows.at(-1) ?? null;
    if (liqLow != null && prev.low >= liqLow && b.low < liqLow && !bullArmed && !bearArmed) { bullArmed = true; bullSweep = b.low; bullSweepBar = i; bullLevel = lastHigh; }
    else if (bullArmed && b.low < bullSweep) { bullSweep = b.low; bullSweepBar = i; }
    if (liqHigh != null && prev.high <= liqHigh && b.high > liqHigh && !bearArmed && !bullArmed) { bearArmed = true; bearSweep = b.high; bearSweepBar = i; bearLevel = lastLow; }
    else if (bearArmed && b.high > bearSweep) { bearSweep = b.high; bearSweepBar = i; }
    // Pine CHOCH is a completed-candle CLOSE through the last confirmed swing,
    // after the liquidity sweep. A wick through the swing is not confirmation.
    if (bullArmed && bullLevel != null && b.close > bullLevel && i > bullSweepBar) {
      bullActive = true; bearActive = false; bullStart = bullSweep; bullEnd = b.high; bullChochBar = i; bullArmed = false; bearArmed = false;
      targetBullOb = findCausalOrderBlock(c, atr, i, "BUY", bullLevel);
      targetBearOb = null;
      buySetup = newSetup(); sellSetup = newSetup(); bullSetupConsumed = false; bearSetupConsumed = true;
      evidence = ["Sell-side liquidity swept", "Bullish CHOCH confirmed by a completed close above the last confirmed swing high.", ...(targetBullOb ? ["Historical bullish Order Block identified from the opposing candle preceding the displacement."] : ["No unmitigated causal bullish Order Block was found in the structural leg."])];
      missing = [targetBullOb ? "Wait for the 68.1%, 78.6% or 88.0% Fib pullback." : "Waiting for a valid historical bullish Order Block."];
    }
    if (bearArmed && bearLevel != null && b.close < bearLevel && i > bearSweepBar) {
      bearActive = true; bullActive = false; bearStart = bearSweep; bearEnd = b.low; bearChochBar = i; bearArmed = false; bullArmed = false;
      targetBearOb = findCausalOrderBlock(c, atr, i, "SELL", bearLevel);
      targetBullOb = null;
      buySetup = newSetup(); sellSetup = newSetup(); bearSetupConsumed = false; bullSetupConsumed = true;
      evidence = ["Buy-side liquidity swept", "Bearish CHOCH confirmed by a completed close below the last confirmed swing low.", ...(targetBearOb ? ["Historical bearish Order Block identified from the opposing candle preceding the displacement."] : ["No unmitigated causal bearish Order Block was found in the structural leg."])];
      missing = [targetBearOb ? "Wait for the 68.1%, 78.6% or 88.0% Fib pullback." : "Waiting for a valid historical bearish Order Block."];
    }
    if (bullActive && buySetup.state === 0 && b.high > (bullEnd ?? 0)) { bullEnd = b.high; bullChochBar = i; }
    if (bearActive && sellSetup.state === 0 && b.low < (bearEnd ?? Infinity)) { bearEnd = b.low; bearChochBar = i; }
    if (bullActive && (i - bullChochBar > 20 || (bullStart != null && b.low < bullStart))) bullActive = false;
    if (bearActive && (i - bearChochBar > 20 || (bearStart != null && b.high > bearStart))) bearActive = false;
    if (bullArmed && i - bullSweepBar > 20) bullArmed = false;
    if (bearArmed && i - bearSweepBar > 20) bearArmed = false;

    const ss = ranges.get(np.day);
    const sr = ss?.last === "Asia" ? ss.asia : ss?.last === "London" ? ss.london : ss?.ny ?? ss?.london ?? ss?.asia;
    const sessionBuyStart = sr?.low ?? null, sessionBuyEnd = sr?.high ?? null;
    const sessionSellStart = sr?.high ?? null, sessionSellEnd = sr?.low ?? null;
    const buyReady = sessionBuyStart != null && sessionBuyEnd != null && Math.abs(sessionBuyEnd - sessionBuyStart) > tick;
    const sellReady = sessionSellStart != null && sessionSellEnd != null && Math.abs(sessionSellEnd - sessionSellStart) > tick;
    const buyStart = bullActive ? bullStart : sessionBuyStart, buyEnd = bullActive ? bullEnd : sessionBuyEnd;
    const sellStart = bearActive ? bearStart : sessionSellStart, sellEnd = bearActive ? bearEnd : sessionSellEnd;
    const activeBuyReady = buyStart != null && buyEnd != null && Math.abs(buyEnd - buyStart) > tick;
    const activeSellReady = sellStart != null && sellEnd != null && Math.abs(sellEnd - sellStart) > tick;
    const bt = activeBuyReady ? Math.max(buyStart!, buyEnd!) : 0, bb = activeBuyReady ? Math.min(buyStart!, buyEnd!) : 0;
    const st = activeSellReady ? Math.max(sellStart!, sellEnd!) : 0, sb = activeSellReady ? Math.min(sellStart!, sellEnd!) : 0;
    // Flip and institutional-order checks use the confirmed structural impulse,
    // never session Fib readiness alone.
    const buyFlip = bullActive && activeBuyReady && b.close >= (bt + bb) / 2;
    const sellFlip = bearActive && activeSellReady && b.close <= (st + sb) / 2;
    const bullInstitution = !active && bullActive && !bullSetupConsumed && buySetup.state === 0 && buyFlip &&
      prev.close < prev.open && b.close > prev.high && atr[i] > 0 && b.close - b.open >= atr[i] * 0.5;
    const bearInstitution = !active && bearActive && !bearSetupConsumed && sellSetup.state === 0 && sellFlip &&
      prev.close > prev.open && b.close < prev.low && atr[i] > 0 && b.open - b.close >= atr[i] * 0.5;
    if (bullInstitution) {
      bullSetupConsumed = true;
      buySetup = { state: 1, orderBar: i, pullback: -1, fib: null, pct: null, start: bullStart, end: bullEnd, ob: targetBullOb ? { ...targetBullOb } : null };
      sellSetup = newSetup();
      evidence = ["Bullish CHOCH already confirmed", "Bullish institutional order: prior candle bearish, current close above prior high, bullish body >= 0.50 x ATR(14), and structural Buy Flip active."];
      missing = ["Wait for the 68.1%, 78.6% or 88.0% Fib pullback."];
    }
    if (bearInstitution) {
      bearSetupConsumed = true;
      sellSetup = { state: 1, orderBar: i, pullback: -1, fib: null, pct: null, start: bearStart, end: bearEnd, ob: targetBearOb ? { ...targetBearOb } : null };
      buySetup = newSetup();
      evidence = ["Bearish CHOCH already confirmed", "Bearish institutional order: prior candle bullish, current close below prior low, bearish body >= 0.50 x ATR(14), and structural Sell Flip active."];
      missing = ["Wait for the 68.1%, 78.6% or 88.0% Fib pullback."];
    }
    if (buySetup.state > 0 && !buySetup.ob && targetBullOb) buySetup.ob = { ...targetBullOb };
    if (sellSetup.state > 0 && !sellSetup.ob && targetBearOb) sellSetup.ob = { ...targetBearOb };

    const setupBuyTop = buySetup.state > 0 && buySetup.start !== null && buySetup.end !== null ? Math.max(buySetup.start, buySetup.end) : bt;
    const setupBuyBottom = buySetup.state > 0 && buySetup.start !== null && buySetup.end !== null ? Math.min(buySetup.start, buySetup.end) : bb;
    const setupSellTop = sellSetup.state > 0 && sellSetup.start !== null && sellSetup.end !== null ? Math.max(sellSetup.start, sellSetup.end) : st;
    const setupSellBottom = sellSetup.state > 0 && sellSetup.start !== null && sellSetup.end !== null ? Math.min(sellSetup.start, sellSetup.end) : sb;
    if (buySetup.state === 1 && buySetup.start !== null && buySetup.end !== null) for (const pct of ENTRY_FIBS) { const level = buyFib(setupBuyTop, setupBuyBottom, pct); if (b.low <= level) { buySetup = { ...buySetup, state: 2, pullback: i, fib: level, pct }; break; } }
    if (sellSetup.state === 1 && sellSetup.start !== null && sellSetup.end !== null) for (const pct of ENTRY_FIBS) { const level = sellFib(setupSellTop, setupSellBottom, pct); if (b.high >= level) { sellSetup = { ...sellSetup, state: 2, pullback: i, fib: level, pct }; break; } }
    if ((buySetup.state === 1 && i - buySetup.orderBar > RETEST_BARS) || (buySetup.state >= 2 && i - buySetup.pullback > RETEST_BARS) || (buySetup.ob && b.close < buySetup.ob.bottom)) buySetup = newSetup();
    if ((sellSetup.state === 1 && i - sellSetup.orderBar > RETEST_BARS) || (sellSetup.state >= 2 && i - sellSetup.pullback > RETEST_BARS) || (sellSetup.ob && b.close > sellSetup.ob.top)) sellSetup = newSetup();
    if (buySetup.state === 2 && buySetup.fib != null && b.low <= buySetup.fib && b.close > buySetup.fib && b.close > b.open && b.close > prev.high) {
      buySetup.state = 3;
      evidence = ["Bullish CHOCH confirmed", "Bullish institutional order confirmed", `Fib pullback selected at ${buySetup.pct}%`, "Bullish retest held and candle closed above the prior candle high."];
      missing = ["Wait for completed M5 bullish displacement and final target/OB/confluence validation."];
    }
    if (sellSetup.state === 2 && sellSetup.fib != null && b.high >= sellSetup.fib && b.close < sellSetup.fib && b.close < b.open && b.close < prev.low) {
      sellSetup.state = 3;
      evidence = ["Bearish CHOCH confirmed", "Bearish institutional order confirmed", `Fib pullback selected at ${sellSetup.pct}%`, "Bearish retest held and candle closed below the prior candle low."];
      missing = ["Wait for completed M5 bearish displacement and final target/OB/confluence validation."];
    }

    while (m5Pointer + 1 < m5.length && m5[m5Pointer + 1].time + TIMEFRAME_MS["5m"] <= closeTime) m5Pointer++;
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
    const pd = { high: selectedPeriodLevels[i]?.high ?? priorHigh, low: selectedPeriodLevels[i]?.low ?? priorLow, weekHigh: selectedPeriodLevels[i]?.weekHigh ?? null, weekLow: selectedPeriodLevels[i]?.weekLow ?? null };
    let targetHigher = nearest(targetHighs, b.high, true);
    let targetLower = nearest(targetLows, b.low, false);
    if (targetPreviousHigh != null && targetPreviousHigh > b.high && (targetHigher == null || targetPreviousHigh < targetHigher)) targetHigher = targetPreviousHigh;
    if (targetPreviousLow != null && targetPreviousLow < b.low && (targetLower == null || targetPreviousLow > targetLower)) targetLower = targetPreviousLow;
    if (targetBearOb && b.close > targetBearOb.top) targetBearOb = null;
    if (targetBullOb && b.close < targetBullOb.bottom) targetBullOb = null;
    const bullOb = buySetup.ob ?? targetBullOb, bearOb = sellSetup.ob ?? targetBearOb;
    const vwapNow = vwapSeries[i];
    lastOb = bullOb ?? bearOb;
    lastLiq = bullOb ? targetHigher : bearOb ? targetLower : null;
    const bScore = (activeBuyReady || buySetup.state > 0) ? confluence(1, c, i, buyFib(setupBuyTop, setupBuyBottom, 68.1), buyFib(setupBuyTop, setupBuyBottom, 88), bullActive, pd, silverContext, vwapNow).score : 0;
    const sScore = (activeSellReady || sellSetup.state > 0) ? confluence(-1, c, i, sellFib(setupSellTop, setupSellBottom, 68.1), sellFib(setupSellTop, setupSellBottom, 88), bearActive, pd, silverContext, vwapNow).score : 0;
    buyScore = bScore; sellScore = sScore;
    const buyValid = htf.confirmed && htf.direction === "BUY" && buySetup.state === 3 && buySetup.fib != null && buySetup.start !== null && buySetup.end !== null &&
      b.low <= buySetup.fib && b.close >= buySetup.fib && m5Bull && targetHigher != null && targetHigher > buySetup.fib &&
      bullActive && !!buySetup.ob && !!bullOb && bullOb.bottom < buySetup.fib && bScore >= MIN_SCORE;
    const sellValid = htf.confirmed && htf.direction === "SELL" && sellSetup.state === 3 && sellSetup.fib != null && sellSetup.start !== null && sellSetup.end !== null &&
      b.high >= sellSetup.fib && b.close <= sellSetup.fib && m5Bear && targetLower != null && targetLower < sellSetup.fib &&
      bearActive && !!sellSetup.ob && !!bearOb && bearOb.top > sellSetup.fib && sScore >= MIN_SCORE;

    if (active) {
      const isBuy = active.direction === "BUY";
      const stopTouched = isBuy ? b.low <= active.stopLoss : b.high >= active.stopLoss;
      const relevantTargets = [active.tp1];
      const anyTargetTouched = relevantTargets.some((target, index) => !active!.targetHits[index] && (isBuy ? b.high >= target : b.low <= target));
      // Match TradingView's historical OHLC path assumption when a candle spans
      // both a protective stop and a target: price visits the nearer extreme first.
      const highFirst = Math.abs(b.open - b.high) < Math.abs(b.open - b.low);
      const stopWinsCollision = isBuy ? !highFirst : highFirst;
      if (stopTouched && anyTargetTouched && stopWinsCollision) {
        active.status = "SL_HIT"; active.exitTime = new Date(closeTime).toISOString(); active.exitPrice = active.stopLoss; closed = active; active = null;
      } else if (stopTouched && !anyTargetTouched) {
        active.status = "SL_HIT"; active.exitTime = new Date(closeTime).toISOString(); active.exitPrice = active.stopLoss; closed = active; active = null;
      } else if (!active.targetHits[0] && (isBuy ? b.high >= active.tp1 : b.low <= active.tp1)) {
        // Full-position exit at the first Pine target for every lot size.
        // TP2-TP5 remain calculated reference levels, not partial-close instructions.
        active.targetHits[0] = true;
        active.status = "TP_HIT";
        active.exitTime = new Date(closeTime).toISOString();
        active.exitPrice = active.tp1;
        closed = active;
        active = null;
      }
    }
    if (!active && (buyValid || sellValid)) {
      const isBuy = buyValid, dir: VortexDirection = isBuy ? "BUY" : "SELL";
      const fib = (isBuy ? buySetup.fib : sellSetup.fib)!;
      const pct = (isBuy ? buySetup.pct : sellSetup.pct)!;
      const ob = (isBuy ? bullOb : bearOb)!;
      const entry = fib, sl = isBuy ? ob.bottom - tick : ob.top + tick;
      const fibTps = TP_FIBS.map(x => isBuy ? buyFib(setupBuyTop, setupBuyBottom, x) : sellFib(setupSellTop, setupSellBottom, x));
      const tps = fibTps;
      const targetsValid = tps.every(x => isBuy ? x > entry : x < entry);
      if (targetsValid && (isBuy ? sl < entry : sl > entry)) {
        active = { timeframe, direction: dir, entry, stopLoss: sl, tp1: tps[0], tp2: tps[1], tp3: tps[2], tp4: null, tp5: null, fibLevel: pct, entryTime: new Date(closeTime).toISOString(), confirmationTime: m5b ? new Date(m5b.time + TIMEFRAME_MS["5m"]).toISOString() : new Date(closeTime).toISOString(), lotSize, targetHits: [false, false, false], status: "ACTIVE", orderBlock: ob, liquidityTarget: isBuy ? targetHigher! : targetLower! };
        lastOb = ob; lastLiq = isBuy ? targetHigher : targetLower; lastScore = isBuy ? bScore : sScore; lastFib = pct;
        evidence = [isBuy ? "Bullish CHOCH confirmed" : "Bearish CHOCH confirmed", isBuy ? "Bullish institutional-order candle confirmed" : "Bearish institutional-order candle confirmed", "Fib pullback selected at " + pct + "%", `${timeframe.toUpperCase()} retest and directional candle confirmation completed`, `${confirmationTimeframe.toUpperCase()} displacement confirmation passed`, "External liquidity target and opposing target OB aligned", "OB-wick stop geometry passed", "Normalized confluence score " + lastScore + "/100 passed"];
        missing = [];
        if (isBuy) buySetup = newSetup();
        else sellSetup = newSetup();
      }
    }
    if (i === c.length - 1 && !active) {
      if (buySetup.state === 1) missing = ["Bullish institutional order is armed; waiting for the preferred Fib pullback (68.1%, then 78.6%, then 88.0%)."];
      else if (sellSetup.state === 1) missing = ["Bearish institutional order is armed; waiting for the preferred Fib pullback (68.1%, then 78.6%, then 88.0%)."];
      else if (buySetup.state === 2) missing = [`Bullish Fib pullback touched; waiting for the ${timeframe.toUpperCase()} retest to hold and a bullish candle close above the prior high.`];
      else if (sellSetup.state === 2) missing = [`Bearish Fib pullback touched; waiting for the ${timeframe.toUpperCase()} retest to hold and a bearish candle close below the prior low.`];
      else if (buySetup.state === 3) missing = [
        ...(buySetup.fib == null || b.low > buySetup.fib || b.close < buySetup.fib ? [`Waiting for the ${timeframe.toUpperCase()} candle to retest and hold the selected Fib entry.`] : []),
        ...(!m5Bull ? [`Waiting for a completed bullish ${confirmationTimeframe.toUpperCase()} displacement candle.`] : []),
        ...(targetHigher == null || buySetup.fib == null || targetHigher <= buySetup.fib ? ["No valid higher-liquidity target above the selected Fib entry."] : []),
        ...(!bullOb ? ["Waiting for the bullish target order block below lower liquidity."] : []),
        ...(bullOb && buySetup.fib != null && bullOb.bottom >= buySetup.fib ? ["Bullish target OB is not below the selected Fib entry."] : []),
        ...(bScore < MIN_SCORE ? ["Bullish confluence is below 60/100."] : []),
      ];
      else if (sellSetup.state === 3) missing = [
        ...(sellSetup.fib == null || b.high < sellSetup.fib || b.close > sellSetup.fib ? [`Waiting for the ${timeframe.toUpperCase()} candle to retest and hold the selected Fib entry.`] : []),
        ...(!m5Bear ? [`Waiting for a completed bearish ${confirmationTimeframe.toUpperCase()} displacement candle.`] : []),
        ...(targetLower == null || sellSetup.fib == null || targetLower >= sellSetup.fib ? ["No valid lower-liquidity target below the selected Fib entry."] : []),
        ...(!bearOb ? ["Waiting for the bearish target order block above higher liquidity."] : []),
        ...(bearOb && sellSetup.fib != null && bearOb.top <= sellSetup.fib ? ["Bearish target OB is not above the selected Fib entry."] : []),
        ...(sScore < MIN_SCORE ? ["Bearish confluence is below 60/100."] : []),
      ];
      else if (bullActive) missing = ["Bullish CHOCH is confirmed; waiting for the separate bullish institutional-order candle."];
      else if (bearActive) missing = ["Bearish CHOCH is confirmed; waiting for the separate bearish institutional-order candle."];
      else missing = ["Waiting for a completed-session liquidity sweep followed by a close-confirmed CHOCH."];
    }
    if (m5b) lastM5Time = new Date(m5b.time + TIMEFRAME_MS["5m"]).toISOString();
  }

  const setupDeveloping = buySetup.state > 0 || sellSetup.state > 0;
  const latestBarClose = c.length ? candleCloseTime(c, c.length - 1, timeframe) : 0;
  const recentClosed = closed && closed.exitTime && latestBarClose - Date.parse(closed.exitTime) <= TIMEFRAME_MS[timeframe] * 1.5 ? closed : null;
  const trade = active ?? (setupDeveloping ? null : recentClosed);
  const state = active ? "TRADE ACTIVE" : setupDeveloping ? "SETUP DEVELOPING" : recentClosed?.status === "TP_HIT" ? "TP HIT" : recentClosed?.status === "SL_HIT" ? "SL HIT" : "WAITING";
  const sLast = silver.at(-1), sPrev = silver.at(-2), sMa = silver.length >= 50 ? silverEma[silverEma.length - 1] : null;
  const sFlow = sLast && sPrev ? sLast.close < sPrev.close ? "FALLING" : sLast.close > sPrev.close ? "RISING" : "FLAT" : "UNAVAILABLE";
  const finalVwap = vwapSeries.at(-1) ?? null;
  const projectionDirection: VortexDirection | null = buySetup.state > 0 ? "BUY" : sellSetup.state > 0 ? "SELL" : bullActive ? "BUY" : bearActive ? "SELL" : null;
  const projectionStart = buySetup.state > 0 ? buySetup.start : sellSetup.state > 0 ? sellSetup.start : bullActive ? bullStart : bearActive ? bearStart : null;
  const projectionEnd = buySetup.state > 0 ? buySetup.end : sellSetup.state > 0 ? sellSetup.end : bullActive ? bullEnd : bearActive ? bearEnd : null;
  const projectionTop = projectionStart !== null && projectionEnd !== null ? Math.max(projectionStart, projectionEnd) : null;
  const projectionBottom = projectionStart !== null && projectionEnd !== null ? Math.min(projectionStart, projectionEnd) : null;
  const selectedProjectionFib = buySetup.state > 0 && buySetup.fib !== null ? buySetup.fib : sellSetup.state > 0 && sellSetup.fib !== null ? sellSetup.fib : projectionTop !== null && projectionBottom !== null ? (projectionDirection === "BUY" ? buyFib(projectionTop, projectionBottom, 68.1) : sellFib(projectionTop, projectionBottom, 68.1)) : null;
  const projectedFibTargets = projectionTop !== null && projectionBottom !== null && projectionDirection
    ? TP_FIBS.map(x => projectionDirection === "BUY" ? buyFib(projectionTop, projectionBottom, x) : sellFib(projectionTop, projectionBottom, x))
    : [null, null, null];
  const projectionOb = projectionDirection === "BUY" ? (buySetup.ob ?? (lastOb?.direction === "BUY" ? lastOb : null)) : projectionDirection === "SELL" ? (sellSetup.ob ?? (lastOb?.direction === "SELL" ? lastOb : null)) : null;
  const provisionalM5Atr = atr5.at(-1) ?? 0;
  // Match the Pine pre-entry ladder: provisional SL is 2x M5 ATR, capped at 2% of entry.
  // Once a trade confirms, the frozen trade SL remains anchored to the opposing target-OB wick.
  const projectedStop = selectedProjectionFib !== null && projectionDirection && provisionalM5Atr > 0
    ? projectionDirection === "BUY"
      ? selectedProjectionFib - Math.min(provisionalM5Atr * 2, selectedProjectionFib * 0.02)
      : selectedProjectionFib + Math.min(provisionalM5Atr * 2, selectedProjectionFib * 0.02)
    : null;
  return {
    source: "VAULTTRADES_VORTEX_S1_FIB_VWAP_CONFLUENCE", timeframe, state, direction: trade?.direction ?? "NO TRADE", plannedDirection: active ? active.direction : projectionDirection,
    structuralDirection: bullActive ? "BUY" : bearActive ? "SELL" : "NEUTRAL", entryConfirmed: !!active, htfConfirmation: htf,
    entry: trade?.entry ?? selectedProjectionFib, stopLoss: trade?.stopLoss ?? projectedStop,
    tp1: trade?.tp1 ?? projectedFibTargets[0], tp2: trade?.tp2 ?? projectedFibTargets[1],
    tp3: trade?.tp3 ?? projectedFibTargets[2], tp4: null, tp5: null,
    fibLevel: trade?.fibLevel ?? buySetup.pct ?? sellSetup.pct ?? (projectionDirection ? 68.1 : lastFib),
    score: active ? lastScore : Math.max(buyScore, sellScore), buyConfluence: buyScore, sellConfluence: sellScore, liquidityTarget: trade?.liquidityTarget ?? lastLiq, orderBlock: trade?.orderBlock ?? lastOb,
    entryTime: trade?.entryTime ?? null, confirmationTime: trade?.confirmationTime ?? lastM5Time, lotSize,
    lotModel: "FULL CLOSE AT TP1",
    targetHits: trade?.targetHits ?? [false, false, false], openTrade: active, latestClosedTrade: recentClosed,
    evidence, missingConditions: active ? [] : [...missing, ...(!htf.confirmed ? [htf.reason] : [])],
    invalidation: `The ${timeframe.toUpperCase()} setup expires after 8 bars or when its structure is invalidated. SL is anchored to the opposing target-OB wick.`,
    statusReason: active ? "Trade active. The full position closes at TP1; lot size does not create partial exits." : !htf.confirmed ? htf.reason : setupDeveloping ? `Vortex ${timeframe.toUpperCase()} setup developing. Waiting for the next qualification event.` : recentClosed ? "The previous trade has closed. Waiting for the next qualifying Vortex setup." : missing[0],
    riskReward: trade ? Math.abs(trade.tp1 - trade.entry) / Math.abs(trade.entry - trade.stopLoss) : projectedStop !== null && selectedProjectionFib !== null && projectedFibTargets[0] !== null ? Math.abs(projectedFibTargets[0]! - selectedProjectionFib) / Math.abs(selectedProjectionFib - projectedStop) : null,
    silver: { available: silver.length > 1, close: sLast?.close ?? null, flow: sFlow, ma: sMa },
    vwap: finalVwap,
  };
}

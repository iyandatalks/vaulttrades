import { runEma20Engine, type Ema20EngineBar } from "./ema20Engine";
import type { MarketDataCandle } from "../market-data/twelvedata";

export type Ema20OrderBlock = {
  direction: "BULLISH" | "BEARISH";
  top: number;
  bottom: number;
  originTime: string;
  rejectionTime: string;
  label: string;
  state: "ACTIVE" | "INVALIDATED";
};

export type Ema20AnalyzerLifecycle = {
  state: "WAITING" | "TRADE ACTIVE" | "SL HIT" | "TP HIT";
  direction: "BUY" | "SELL" | "NO TRADE";
  entry: number | null;
  stopLoss: number | null;
  target: number | null;
  entryTime: string | null;
  entryDay: string | null;
  orderBlock: Ema20OrderBlock | null;
  reason: string;
  sourceBar: Ema20EngineBar | null;
};

const TF_MINUTES: Record<string, number> = {
  "1m": 1, "5m": 5, "10m": 10, "15m": 15, "30m": 30,
  "1H": 60, "4H": 240, "1D": 1440, "1W": 10080, "1M": 43200,
};

function sastParts(datetime: string, timeframe: string) {
  const raw = datetime.includes("T") ? datetime : datetime.replace(" ", "T") + "Z";
  const opened = new Date(raw);
  if (!Number.isFinite(opened.getTime())) return null;
  const close = new Date(opened.getTime() + (TF_MINUTES[timeframe] ?? 0) * 60_000);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(close);
  const get = (key: string) => parts.find(part => part.type === key)?.value ?? "";
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minuteOfDay: hour * 60 + minute,
  };
}

function atrAt(candles: MarketDataCandle[], index: number, length = 14) {
  const start = Math.max(0, index - length + 1);
  const sample = candles.slice(start, index + 1);
  if (sample.length < Math.min(length, 8)) return null;
  const ranges = sample.map((candle, offset) => {
    const previous = sample[offset - 1];
    return previous
      ? Math.max(candle.high - candle.low, Math.abs(candle.high - previous.close), Math.abs(candle.low - previous.close))
      : candle.high - candle.low;
  });
  return ranges.reduce((sum, value) => sum + value, 0) / ranges.length;
}

/**
 * Finds a pre-existing displacement OB which is first revisited by the stored
 * EMA20 rejection candle. The zone is fixed to the origin candle's wick range.
 * A close through the far edge, or an earlier mitigation before the rejection,
 * disqualifies the block.
 */
function findOrderBlockForRejection(
  candles: MarketDataCandle[],
  rejectionIndex: number,
  direction: "BUY" | "SELL",
): Ema20OrderBlock | null {
  const rejection = candles[rejectionIndex];
  if (!rejection) return null;
  const bullish = direction === "BUY";
  const rejectionTouches: (origin: MarketDataCandle) => boolean = origin =>
    rejection.low <= origin.high && rejection.high >= origin.low;
  const start = Math.max(8, rejectionIndex - 60);

  for (let originIndex = rejectionIndex - 2; originIndex >= start; originIndex--) {
    const origin = candles[originIndex];
    const oppositeOrigin = bullish ? origin.close < origin.open : origin.close > origin.open;
    if (!oppositeOrigin) continue;

    const lastImpulse = Math.min(rejectionIndex - 1, originIndex + 4);
    for (let impulseIndex = originIndex + 1; impulseIndex <= lastImpulse; impulseIndex++) {
      const impulse = candles[impulseIndex];
      const impulseAtr = atrAt(candles, impulseIndex);
      if (!impulseAtr || impulseAtr <= 0) continue;
      const body = Math.abs(impulse.close - impulse.open);
      const directionalImpulse = bullish
        ? impulse.close > impulse.open && body >= impulseAtr * 0.8
        : impulse.close < impulse.open && body >= impulseAtr * 0.8;
      if (!directionalImpulse) continue;

      const prior = candles.slice(Math.max(0, originIndex - 8), originIndex);
      if (prior.length < 3) continue;
      const structureBreak = bullish
        ? impulse.close > Math.max(...prior.map(candle => candle.high))
        : impulse.close < Math.min(...prior.map(candle => candle.low));
      if (!structureBreak) continue;

      let invalidatedOrPreviouslyMitigated = false;
      for (let index = impulseIndex + 1; index < rejectionIndex; index++) {
        const candle = candles[index];
        const invalidated = bullish ? candle.close < origin.low : candle.close > origin.high;
        const mitigated = candle.low <= origin.high && candle.high >= origin.low;
        if (invalidated || mitigated) {
          invalidatedOrPreviouslyMitigated = true;
          break;
        }
      }
      if (invalidatedOrPreviouslyMitigated || !rejectionTouches(origin)) continue;

      const rejectionQualifies = bullish
        ? rejection.close > rejection.open && rejection.close > origin.low
        : rejection.close < rejection.open && rejection.close < origin.high;
      if (!rejectionQualifies) continue;

      return {
        direction: bullish ? "BULLISH" : "BEARISH",
        top: origin.high,
        bottom: origin.low,
        originTime: origin.datetime,
        rejectionTime: rejection.datetime,
        label: bullish ? "EMA20 · BULLISH DISPLACEMENT OB" : "EMA20 · BEARISH DISPLACEMENT OB",
        state: "ACTIVE",
      };
    }
  }
  return null;
}

export function evaluateEma20Analyzer(
  candles: MarketDataCandle[],
  timeframe: string,
  livePrice: number | null = null,
): Ema20AnalyzerLifecycle & { engine: Ema20EngineBar | null } {
  const bars = runEma20Engine(candles);
  if (!bars.length) {
    return {
      state: "WAITING", direction: "NO TRADE", entry: null, stopLoss: null, target: null,
      entryTime: null, entryDay: null, orderBlock: null,
      reason: "Waiting for sufficient completed candles to evaluate EMA20 and Order Block conditions.",
      sourceBar: null, engine: null,
    };
  }

  let lastEntryDay: string | null = null;
  let active: {
    direction: "BUY" | "SELL";
    entry: number;
    stopLoss: number;
    target: number;
    entryTime: string;
    entryDay: string;
    orderBlock: Ema20OrderBlock;
    sourceBar: Ema20EngineBar;
    status: "TRADE ACTIVE" | "SL HIT" | "TP HIT";
  } | null = null;
  let lastCompletedToday: typeof active = null;
  let currentSastDay = "";

  for (let index = 0; index < bars.length; index++) {
    const bar = bars[index];
    const candle = candles[index];
    const time = sastParts(candle.datetime, timeframe);
    if (!time) continue;
    if (currentSastDay && time.date !== currentSastDay) lastCompletedToday = null;
    currentSastDay = time.date;

    // Existing positions are managed outside the morning entry window.
    let closedThisBar = false;
    if (active && index > active.sourceBar.index) {
      const slHit = active.direction === "BUY" ? candle.low <= active.stopLoss : candle.high >= active.stopLoss;
      const tpHit = active.direction === "BUY" ? candle.high >= active.target : candle.low <= active.target;
      if (slHit || tpHit) {
        // Conservative OHLC handling: if both levels print in one candle,
        // count the stop first rather than assuming an unobservable intrabar path.
        active.status = slHit ? "SL HIT" : "TP HIT";
        lastCompletedToday = active;
        active = null;
        closedThisBar = true;
      }
    }

    const isNewSignal = bar.newLong || bar.newShort;
    if (!isNewSignal || active || closedThisBar || lastEntryDay === time.date) continue;
    if (time.minuteOfDay < 0 || time.minuteOfDay > 645) continue;

    const direction = bar.newLong ? "BUY" : "SELL";
    let rejectionIndex: number | null = null;
    for (let candidate = index - 1; candidate >= Math.max(0, index - 3); candidate--) {
      if (direction === "BUY" ? bars[candidate].bullReject : bars[candidate].bearReject) {
        rejectionIndex = candidate;
        break;
      }
    }
    if (rejectionIndex == null) continue;
    const orderBlock = findOrderBlockForRejection(candles, rejectionIndex, direction);
    if (!orderBlock) continue;
    const obInvalidatedAfterRejection = candles.slice(rejectionIndex + 1, index + 1).some(candle =>
      direction === "BUY" ? candle.close < orderBlock.bottom : candle.close > orderBlock.top
    );
    if (obInvalidatedAfterRejection) continue;

    const entry = direction === "BUY" ? bar.longEntry : bar.shortEntry;
    const stopLoss = direction === "BUY" ? bar.longSL : bar.shortSL;
    const target = direction === "BUY" ? bar.longTP : bar.shortTP;
    if (entry == null || stopLoss == null || target == null) continue;
    const geometryValid = direction === "BUY"
      ? stopLoss < entry && target > entry
      : stopLoss > entry && target < entry;
    if (!geometryValid) continue;

    // The Pine script's first authorized entry consumes the whole SAST day.
    lastEntryDay = time.date;
    active = {
      direction, entry, stopLoss, target, entryTime: candle.datetime, entryDay: time.date,
      orderBlock, sourceBar: bar, status: "TRADE ACTIVE",
    };
    lastCompletedToday = null;
  }

  if (active && livePrice != null && Number.isFinite(livePrice)) {
    const liveStopHit = active.direction === "BUY" ? livePrice <= active.stopLoss : livePrice >= active.stopLoss;
    const liveTargetHit = active.direction === "BUY" ? livePrice >= active.target : livePrice <= active.target;
    if (liveStopHit || liveTargetHit) {
      active.status = liveStopHit ? "SL HIT" : "TP HIT";
      lastCompletedToday = active;
      active = null;
    }
  }

  if (active) {
    return {
      state: "TRADE ACTIVE", direction: active.direction, entry: active.entry,
      stopLoss: active.stopLoss, target: active.target, entryTime: active.entryTime,
      entryDay: active.entryDay, orderBlock: active.orderBlock,
      reason: "EMA20 structure, pullback/rejection, rejection break, UT Bot or SMI confirmation, and a pre-existing unmitigated Order Block all qualified. Original trade levels remain locked.",
      sourceBar: active.sourceBar, engine: bars.at(-1) ?? null,
    };
  }

  if (lastCompletedToday) {
    return {
      state: lastCompletedToday.status, direction: lastCompletedToday.direction,
      entry: lastCompletedToday.entry, stopLoss: lastCompletedToday.stopLoss,
      target: lastCompletedToday.target, entryTime: lastCompletedToday.entryTime,
      entryDay: lastCompletedToday.entryDay, orderBlock: lastCompletedToday.orderBlock,
      reason: lastCompletedToday.status === "SL HIT"
        ? (lastCompletedToday.entryDay === currentSastDay
          ? "Today's EMA20 + OB trade hit its original stop loss. NO TRADE for the remainder of this timeframe's SAST day."
          : "The prior EMA20 + OB trade hit its original stop loss today. A fresh signal may still qualify within today's 00:00–10:45 SAST window.")
        : (lastCompletedToday.entryDay === currentSastDay
          ? "Today's EMA20 + OB trade reached its original target. No second trade is permitted on this timeframe today."
          : "The prior EMA20 + OB trade reached its original target today. A fresh signal may still qualify within today's 00:00–10:45 SAST window."),
      sourceBar: lastCompletedToday.sourceBar, engine: bars.at(-1) ?? null,
    };
  }

  return {
    state: "WAITING", direction: "NO TRADE", entry: null, stopLoss: null, target: null,
    entryTime: null, entryDay: null, orderBlock: null,
    reason: lastEntryDay === currentSastDay
      ? "Today's EMA20 opportunity has already been consumed. NO TRADE for the remainder of this timeframe's SAST day."
      : "WAIT — no EMA20 signal has qualified with a pre-existing, unmitigated Order Block during the 00:00–10:45 SAST signal window.",
    sourceBar: null, engine: bars.at(-1) ?? null,
  };
}

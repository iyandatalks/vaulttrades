import { runEma20Engine, type Ema20EngineBar } from "./ema20Engine";
import type { MarketDataCandle } from "../market-data/twelvedata";

export type Ema20AnalyzerLifecycle = {
  state: "WAITING" | "TRADE ACTIVE" | "SL HIT" | "TP HIT";
  direction: "BUY" | "SELL" | "NO TRADE";
  entry: number | null;
  stopLoss: number | null;
  target: number | null;
  entryTime: string | null;
  entryDay: string | null;
  reason: string;
  sourceBar: Ema20EngineBar | null;
};

const TF_MINUTES: Record<string, number> = {
  "1m": 1, "M1": 1, "5m": 5, "M5": 5, "10m": 10, "M10": 10,
  "15m": 15, "M15": 15, "30m": 30, "M30": 30,
  "1H": 60, "H1": 60, "4H": 240, "H4": 240, "1D": 1440, "D1": 1440,
};

function sastParts(datetime: string, timeframe: string) {
  const normalized = datetime.includes("T") ? datetime : datetime.replace(" ", "T");
  const hasExplicitTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  const opened = new Date(hasExplicitTimezone ? normalized : normalized + "Z");
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

type Ema20TradeRecord = {
  direction: "BUY" | "SELL";
  entry: number;
  stopLoss: number;
  target: number;
  entryTime: string;
  entryDay: string;
  sourceBar: Ema20EngineBar;
  status: "TRADE ACTIVE" | "SL HIT" | "TP HIT";
};

/**
 * Mirrors the Pine strategy's bracket exits on completed OHLC bars.
 * TradingView's broker emulator walks from the open toward the nearer
 * extreme first when both stop and target are touched in one candle.
 */
function pineBracketExit(
  candle: MarketDataCandle,
  trade: Ema20TradeRecord,
): "SL HIT" | "TP HIT" | null {
  const buy = trade.direction === "BUY";
  const stopTouched = buy ? candle.low <= trade.stopLoss : candle.high >= trade.stopLoss;
  const targetTouched = buy ? candle.high >= trade.target : candle.low <= trade.target;
  if (!stopTouched && !targetTouched) return null;

  // A gap through an exit level is filled at the bar open by the emulator.
  if (buy) {
    if (candle.open <= trade.stopLoss) return "SL HIT";
    if (candle.open >= trade.target) return "TP HIT";
  } else {
    if (candle.open >= trade.stopLoss) return "SL HIT";
    if (candle.open <= trade.target) return "TP HIT";
  }

  if (stopTouched && targetTouched) {
    const highFirst = Math.abs(candle.open - candle.high) < Math.abs(candle.open - candle.low);
    if (buy) return highFirst ? "TP HIT" : "SL HIT";
    return highFirst ? "SL HIT" : "TP HIT";
  }
  return stopTouched ? "SL HIT" : "TP HIT";
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
      entryTime: null, entryDay: null,
      reason: "WAIT — waiting for enough completed candles to calculate the Pine EMA20, structure, ATR, UT Bot and SMI series.",
      sourceBar: null, engine: null,
    };
  }

  let lastEntryDay: string | null = null;
  let active: Ema20TradeRecord | null = null;
  let lastCompletedToday: Ema20TradeRecord | null = null;
  let currentSastDay = "";

  for (let index = 0; index < bars.length; index++) {
    const bar = bars[index];
    const candle = candles[index];
    const time = sastParts(candle.datetime, timeframe);
    if (!time) continue;
    if (currentSastDay && time.date !== currentSastDay) lastCompletedToday = null;
    currentSastDay = time.date;

    // Existing Pine positions remain managed after the morning entry window.
    let closedThisBar = false;
    if (active && index > active.sourceBar.index) {
      const exit = pineBracketExit(candle, active);
      if (exit) {
        active.status = exit;
        lastCompletedToday = active;
        active = null;
        closedThisBar = true;
      }
    }

    // Pine: newLong/newShort, morningSignalWindow, canTradeToday,
    // and strategy.position_size == 0 must all permit the entry.
    const isNewSignal = bar.newLong || bar.newShort;
    if (!isNewSignal || active || closedThisBar || lastEntryDay === time.date) continue;
    if (time.minuteOfDay < 0 || time.minuteOfDay > 645) continue;

    const direction = bar.newLong ? "BUY" : "SELL";
    const entry = direction === "BUY" ? bar.longEntry : bar.shortEntry;
    const stopLoss = direction === "BUY" ? bar.longSL : bar.shortSL;
    const target = direction === "BUY" ? bar.longTP : bar.shortTP;
    if (entry == null || stopLoss == null || target == null) continue;

    const geometryValid = direction === "BUY"
      ? stopLoss < entry && target > entry
      : stopLoss > entry && target < entry;
    if (!geometryValid) continue;

    // The first accepted entry consumes this timeframe's SAST day for both sides.
    lastEntryDay = time.date;
    active = {
      direction, entry, stopLoss, target, entryTime: candle.datetime, entryDay: time.date,
      sourceBar: bar, status: "TRADE ACTIVE",
    };
    lastCompletedToday = null;
  }

  // Live quote management supplements completed-bar history for the current candle.
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
      entryDay: active.entryDay,
      reason: "Pine entry sequence confirmed. Original Entry, ATR(14) × 2.23 Stop Loss and 1:1.81 Target remain locked while the position is open.",
      sourceBar: active.sourceBar, engine: bars.at(-1) ?? null,
    };
  }

  if (lastCompletedToday) {
    const sameDay = lastCompletedToday.entryDay === currentSastDay;
    return {
      state: lastCompletedToday.status, direction: lastCompletedToday.direction,
      entry: lastCompletedToday.entry, stopLoss: lastCompletedToday.stopLoss,
      target: lastCompletedToday.target, entryTime: lastCompletedToday.entryTime,
      entryDay: lastCompletedToday.entryDay,
      reason: lastCompletedToday.status === "SL HIT"
        ? (sameDay
          ? "Today's Pine EMA20 trade hit its original stop loss. NO TRADE for the remainder of this timeframe's SAST day."
          : "The prior Pine EMA20 trade hit its original stop loss today. A fresh Pine signal may still qualify within today's 00:00–10:45 SAST window.")
        : (sameDay
          ? "Today's Pine EMA20 trade reached its original target. No second trade is permitted on this timeframe today."
          : "The prior Pine EMA20 trade reached its original target today. A fresh Pine signal may still qualify within today's 00:00–10:45 SAST window."),
      sourceBar: lastCompletedToday.sourceBar, engine: bars.at(-1) ?? null,
    };
  }

  return {
    state: "WAITING", direction: "NO TRADE", entry: null, stopLoss: null, target: null,
    entryTime: null, entryDay: null,
    reason: lastEntryDay === currentSastDay
      ? "Today's Pine EMA20 opportunity has already been consumed. NO TRADE for the remainder of this timeframe's SAST day."
      : "WAIT — no Pine EMA20 entry sequence has qualified during the 00:00–10:45 SAST signal window.",
    sourceBar: null, engine: bars.at(-1) ?? null,
  };
}

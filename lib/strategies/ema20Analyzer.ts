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
  "1W": 10080, "1M": 43200,
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
  const normalizedTf = timeframe.toUpperCase();
  const atrSLMultiplier = normalizedTf === "M5" || normalizedTf === "5M" ? 2.23
    : normalizedTf === "M15" || normalizedTf === "15M" ? 2.23
    : normalizedTf === "M30" || normalizedTf === "30M" ? 2.25
    : normalizedTf === "H1" || normalizedTf === "1H" ? 3.00
    : normalizedTf === "H4" || normalizedTf === "4H" ? 8.00 : 8.00;
  const bars = runEma20Engine(candles, { atrSLMultiplier, riskReward: 1.91 });
  if (!bars.length) {
    return {
      state: "WAITING", direction: "NO TRADE", entry: null, stopLoss: null, target: null,
      entryTime: null, entryDay: null,
      reason: "WAIT — waiting for enough completed candles to calculate the Pine EMA20, structure, ATR, UT Bot and SMI series.",
      sourceBar: null, engine: null,
    };
  }

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

    // No clock-based entry window or daily trade cap. pyramiding=0 means
    // a new entry is allowed only while the previous position is flat.
    const isNewSignal = bar.newLong || bar.newShort;
    if (!isNewSignal || active || closedThisBar) continue;

    const direction = bar.newLong ? "BUY" : "SELL";
    const entry = direction === "BUY" ? bar.longEntry : bar.shortEntry;
    const stopLoss = direction === "BUY" ? bar.longSL : bar.shortSL;
    const target = direction === "BUY" ? bar.longTP : bar.shortTP;
    if (entry == null || stopLoss == null || target == null) continue;

    const geometryValid = direction === "BUY"
      ? stopLoss < entry && target > entry
      : stopLoss > entry && target < entry;
    if (!geometryValid) continue;

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
      reason: "Pine entry sequence confirmed. Original Entry, timeframe-specific ATR stop and 1:1.91 Target remain locked while the position is open.",
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
        ? "The most recent Pine trade hit its original stop loss. The position is closed; a new independent Pine signal may qualify immediately."
        : "The most recent Pine trade reached its original target. The position is closed; a new independent Pine signal may qualify immediately.",
      sourceBar: lastCompletedToday.sourceBar, engine: bars.at(-1) ?? null,
    };
  }

  return {
    state: "WAITING", direction: "NO TRADE", entry: null, stopLoss: null, target: null,
    entryTime: null, entryDay: null,
    reason: "WAIT — no new Pine EMA20 entry sequence has qualified on the latest completed candle. Signals are not restricted by clock windows or daily trade limits.",
    sourceBar: null, engine: bars.at(-1) ?? null,
  };
}

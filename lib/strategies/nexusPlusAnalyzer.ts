import { runEma20Engine, type Ema20EngineBar } from "./ema20Engine";
import type { MarketDataCandle } from "../market-data/twelvedata";

export type NexusPlusState = "WAITING" | "TRADE ACTIVE" | "SL HIT" | "TP HIT";
type Direction = "BUY" | "SELL";
type Trade = {
  direction: Direction;
  entry: number;
  stopLoss: number;
  target: number;
  entryTime: string;
  entryDay: string;
  sourceBar: Ema20EngineBar;
  status: "TRADE ACTIVE" | "SL HIT" | "TP HIT";
};

export type NexusPlusLifecycle = {
  state: NexusPlusState;
  direction: Direction | "NO TRADE";
  entry: number | null;
  stopLoss: number | null;
  target: number | null;
  entryTime: string | null;
  entryDay: string | null;
  reason: string;
  sourceBar: Ema20EngineBar | null;
  engine: Ema20EngineBar | null;
  h4Direction: Direction | "NEUTRAL" | "UNAVAILABLE";
  h4Entry: number | null;
  h4StopLoss: number | null;
  h4Target: number | null;
  riskReward: number;
  atrMultiplier: number;
};

const TF_MINUTES: Record<string, number> = {
  "1m": 1, "5m": 5, "10m": 10, "15m": 15, "30m": 30,
  "1H": 60, "4H": 240, "1D": 1440, "1W": 10080, "1M": 43200,
};

const ATR_MULTIPLIERS: Record<string, number> = {
  "5m": 2.23, "15m": 2.23, "30m": 2.25, "1H": 3.00, "4H": 8.00,
};

function sastTime(datetime: string, timeframe: string) {
  const normalized = datetime.includes("T") ? datetime : datetime.replace(" ", "T");
  const hasZone = /(?:Z|[+-]\\d{2}:?\\d{2})$/i.test(normalized);
  const opened = new Date(hasZone ? normalized : normalized + "Z");
  if (!Number.isFinite(opened.getTime())) return null;
  const closed = new Date(opened.getTime() + (TF_MINUTES[timeframe] ?? 0) * 60_000);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(closed);
  const get = (key: string) => parts.find(part => part.type === key)?.value ?? "";
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minuteOfDay: hour * 60 + minute,
  };
}

function bracketExit(candle: MarketDataCandle, trade: Trade): "SL HIT" | "TP HIT" | null {
  const buy = trade.direction === "BUY";
  const stopTouched = buy ? candle.low <= trade.stopLoss : candle.high >= trade.stopLoss;
  const targetTouched = buy ? candle.high >= trade.target : candle.low <= trade.target;
  if (!stopTouched && !targetTouched) return null;
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

function evaluateH4Authority(candles: MarketDataCandle[]) {
  if (candles.length < 120) return { direction: "UNAVAILABLE" as const, trade: null as Trade | null };
  const bars = runEma20Engine(candles, { atrSLMultiplier: 8, riskReward: 1.91 });
  let active: Trade | null = null;
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const candle = candles[i];
    const time = sastTime(candle.datetime, "4H");
    if (!time) continue;
    let closedThisBar = false;
    if (active && i > active.sourceBar.index) {
      const exit = bracketExit(candle, active);
      if (exit) {
        active.status = exit;
        active = null;
        closedThisBar = true;
      }
    }
    if (!active && !closedThisBar && (bar.newLong || bar.newShort)) {
      const direction: Direction = bar.newLong ? "BUY" : "SELL";
      const entry = direction === "BUY" ? bar.longEntry : bar.shortEntry;
      const stopLoss = direction === "BUY" ? bar.longSL : bar.shortSL;
      const target = direction === "BUY" ? bar.longTP : bar.shortTP;
      if (entry == null || stopLoss == null || target == null) continue;
      active = { direction, entry, stopLoss, target, entryTime: candle.datetime, entryDay: time.date, sourceBar: bar, status: "TRADE ACTIVE" };
    }
  }
  return { direction: active?.direction ?? "NEUTRAL" as const, trade: active };
}

/**
 * Pine-equivalent Nexus Plus lifecycle:
 * - Core EMA20 persistent structure/rejection/MA-break + UT OR SMI signal.
 * - Entries on every confirmed Pine signal; no clock window or daily trade cap.
 * - H4 authority lock on lower timeframes, released only by H4 SL/TP.
 * - Native timeframe ATR stop multipliers and 1.91R target.
 */
export function evaluateNexusPlusAnalyzer(
  candles: MarketDataCandle[],
  timeframe: string,
  livePrice: number | null,
  h4Candles: MarketDataCandle[] = [],
  options: { useDaylightSchedule?: boolean; earlyMinutes?: number; lateMinutes?: number; useH4Lock?: boolean } = {},
): NexusPlusLifecycle {
  const riskReward = 1.91;
  const atrMultiplier = ATR_MULTIPLIERS[timeframe] ?? 8.0;
  const useH4Lock = options.useH4Lock ?? true;
  const empty = (reason: string, h4Direction: NexusPlusLifecycle["h4Direction"] = "UNAVAILABLE"): NexusPlusLifecycle => ({
    state: "WAITING", direction: "NO TRADE", entry: null, stopLoss: null, target: null,
    entryTime: null, entryDay: null, reason, sourceBar: null, engine: null, h4Direction,
    h4Entry: null, h4StopLoss: null, h4Target: null, riskReward, atrMultiplier,
  });
  if (candles.length < 120) return empty("WAIT — insufficient completed candle history for the Nexus Plus Pine engine.");

  const h4 = evaluateH4Authority(h4Candles);
  const belowH4 = (TF_MINUTES[timeframe] ?? 0) < 240;
  if (belowH4 && useH4Lock && h4.direction === "UNAVAILABLE") {
    return empty("NO TRADE — H4 Directional Authority data is unavailable; lower-timeframe entries remain blocked until the H4 lock can be evaluated.", "UNAVAILABLE");
  }

  const bars = runEma20Engine(candles, { atrSLMultiplier: atrMultiplier, riskReward });
  const scheduleShift = useDaylightSchedule ? 60 : 0;
  const anchors = [360 + scheduleShift, 555 + scheduleShift, 1005 + scheduleShift];
  let active: Trade | null = null;
  let lastCompletedToday: Trade | null = null;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const candle = candles[i];
    const time = sastTime(candle.datetime, timeframe);
    if (!time) continue;
    let closedThisBar = false;
    if (active && i > active.sourceBar.index) {
      const exit = bracketExit(candle, active);
      if (exit) {
        active.status = exit;
        lastCompletedToday = active;
        active = null;
        closedThisBar = true;
      }
    }

    if (active || closedThisBar) continue;
    if (scheduledLong === scheduledShort) continue;
    const direction: Direction = scheduledLong ? "BUY" : "SELL";
    if (belowH4 && useH4Lock && h4.direction !== direction) continue;

    const entry = direction === "BUY" ? bar.longEntry : bar.shortEntry;
    const stopLoss = direction === "BUY" ? bar.longSL : bar.shortSL;
    const target = direction === "BUY" ? bar.longTP : bar.shortTP;
    if (entry == null || stopLoss == null || target == null) continue;
    const geometryValid = direction === "BUY"
      ? stopLoss < entry && target > entry
      : stopLoss > entry && target < entry;
    if (!geometryValid) continue;

    active = { direction, entry, stopLoss, target, entryTime: candle.datetime, entryDay: time.date, sourceBar: bar, status: "TRADE ACTIVE" };
    lastCompletedToday = null;
  }

  if (active && livePrice !== null && Number.isFinite(livePrice)) {
    const stopHit = active.direction === "BUY" ? livePrice <= active.stopLoss : livePrice >= active.stopLoss;
    const targetHit = active.direction === "BUY" ? livePrice >= active.target : livePrice <= active.target;
    if (stopHit || targetHit) {
      active.status = stopHit ? "SL HIT" : "TP HIT";
      lastCompletedToday = active;
      active = null;
    }
  }

  if (active) {
    return {
      state: "TRADE ACTIVE", direction: active.direction, entry: active.entry, stopLoss: active.stopLoss,
      target: active.target, entryTime: active.entryTime, entryDay: active.entryDay,
      reason: `Pine Nexus Plus confirmed-bar signal accepted without a clock or daily limit. Entry/SL/TP locked at ${active.entry}/${active.stopLoss}/${active.target}; ATR(${14}) × ${atrMultiplier} stop and 1:${riskReward} target. H4 authority: ${h4.direction}.`,
      sourceBar: active.sourceBar, engine: bars.at(-1) ?? null, h4Direction: h4.direction,
      h4Entry: h4.trade?.entry ?? null, h4StopLoss: h4.trade?.stopLoss ?? null, h4Target: h4.trade?.target ?? null,
      riskReward, atrMultiplier,
    };
  }

  if (lastCompletedToday) {
    return {
      state: lastCompletedToday.status, direction: "NO TRADE", entry: lastCompletedToday.entry,
      stopLoss: lastCompletedToday.stopLoss, target: lastCompletedToday.target,
      entryTime: lastCompletedToday.entryTime, entryDay: lastCompletedToday.entryDay,
      reason: lastCompletedToday.status === "SL HIT"
        ? "NO TRADE — the latest Nexus Plus trade reached its original stop loss. A new qualifying Pine signal may open a subsequent trade."
        : "TRADE COMPLETED — the latest Nexus Plus trade reached its original target. A new qualifying Pine signal may open a subsequent trade.",
      sourceBar: lastCompletedToday.sourceBar, engine: bars.at(-1) ?? null, h4Direction: h4.direction,
      h4Entry: h4.trade?.entry ?? null, h4StopLoss: h4.trade?.stopLoss ?? null, h4Target: h4.trade?.target ?? null,
      riskReward, atrMultiplier,
    };
  }

  return {
    ...empty(
      belowH4 && useH4Lock && h4.direction === "NEUTRAL"
        ? "WAIT — H4 Directional Authority has no active direction; lower-timeframe entries are blocked."
        : "WAIT — no confirmed Nexus Plus signal has occurred, or the H4 Directional Authority Lock blocked the opposite direction.",
      h4.direction,
    ),
    engine: bars.at(-1) ?? null,
    h4Entry: h4.trade?.entry ?? null,
    h4StopLoss: h4.trade?.stopLoss ?? null,
    h4Target: h4.trade?.target ?? null,
  };
}

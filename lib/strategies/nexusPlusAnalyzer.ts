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
  "5m": 2.23, "15m": 2.23, "30m": 2.23, "1H": 8.00, "4H": 8.00,
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

type H4AuthoritySnapshot = { closedAt: number; direction: Direction | "NEUTRAL"; trade: Trade | null };

function candleOpenMs(datetime: string): number | null {
  const normalized = datetime.includes("T") ? datetime : datetime.replace(" ", "T");
  const hasZone = /(?:Z|[+-]\\d{2}:?\\d{2})$/i.test(normalized);
  const value = Date.parse(hasZone ? normalized : normalized + "Z");
  return Number.isFinite(value) ? value : null;
}

/** Build an authority timeline, not one final direction applied to old bars. */
function evaluateH4Authority(candles: MarketDataCandle[]): H4AuthoritySnapshot[] {
  if (candles.length < 120) return [];
  const bars = runEma20Engine(candles, { atrSLMultiplier: 8, riskReward: 1.81 });
  const snapshots: H4AuthoritySnapshot[] = [];
  let active: Trade | null = null;
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const candle = candles[i];
    const openedAt = candleOpenMs(candle.datetime);
    if (openedAt === null) continue;
    const closedAt = openedAt + 240 * 60_000;
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
      if (entry != null && stopLoss != null && target != null) {
        active = { direction, entry, stopLoss, target, entryTime: candle.datetime, entryDay: sastTime(candle.datetime, "4H")?.date ?? "", sourceBar: bar, status: "TRADE ACTIVE" };
      }
    }
    snapshots.push({ closedAt, direction: active?.direction ?? "NEUTRAL", trade: active });
  }
  return snapshots;
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
  options: { useH4Lock?: boolean } = {},
): NexusPlusLifecycle {
  const riskReward = 1.81;
  const atrMultiplier = ATR_MULTIPLIERS[timeframe] ?? 2.23;
  const useH4Lock = options.useH4Lock ?? true;
  const empty = (reason: string, h4Direction: NexusPlusLifecycle["h4Direction"] = "UNAVAILABLE"): NexusPlusLifecycle => ({
    state: "WAITING", direction: "NO TRADE", entry: null, stopLoss: null, target: null,
    entryTime: null, entryDay: null, reason, sourceBar: null, engine: null, h4Direction,
    h4Entry: null, h4StopLoss: null, h4Target: null, riskReward, atrMultiplier,
  });
  if (candles.length < 120) return empty("WAIT — insufficient completed candle history for the Nexus Plus Pine engine.");

  const belowH4 = (TF_MINUTES[timeframe] ?? 0) < 240;
  const h4Timeline = belowH4 && useH4Lock ? evaluateH4Authority(h4Candles) : [];
  if (belowH4 && useH4Lock && h4Timeline.length === 0) {
    return empty("NO TRADE — H4 Directional Authority history is unavailable; lower-timeframe entries remain blocked until it can be evaluated.", "UNAVAILABLE");
  }

  const bars = runEma20Engine(candles, { atrSLMultiplier: atrMultiplier, riskReward });
  let active: Trade | null = null;
  let lastCompletedTrade: Trade | null = null;
  let h4Cursor = 0;
  let authority: H4AuthoritySnapshot | null = h4Timeline[0] ?? null;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const candle = candles[i];
    const openedAt = candleOpenMs(candle.datetime);
    if (openedAt === null) continue;
    const closeAt = openedAt + (TF_MINUTES[timeframe] ?? 0) * 60_000;

    // Advance H4 authority only when each H4 candle has actually closed.
    while (h4Cursor < h4Timeline.length && h4Timeline[h4Cursor].closedAt <= closeAt) {
      authority = h4Timeline[h4Cursor];
      h4Cursor++;
    }

    let closedThisBar = false;
    if (active && i > active.sourceBar.index) {
      const exit = bracketExit(candle, active);
      if (exit) {
        active.status = exit;
        lastCompletedTrade = active;
        active = null;
        closedThisBar = true;
      }
    }
    if (active || closedThisBar || (!bar.newLong && !bar.newShort)) continue;

    const direction: Direction = bar.newLong ? "BUY" : "SELL";
    if (belowH4 && useH4Lock && authority?.direction !== direction) continue;

    const entry = direction === "BUY" ? bar.longEntry : bar.shortEntry;
    const stopLoss = direction === "BUY" ? bar.longSL : bar.shortSL;
    const target = direction === "BUY" ? bar.longTP : bar.shortTP;
    if (entry == null || stopLoss == null || target == null) continue;
    const geometryValid = direction === "BUY"
      ? stopLoss < entry && target > entry
      : stopLoss > entry && target < entry;
    if (!geometryValid) continue;

    const localDate = sastTime(candle.datetime, timeframe)?.date ?? "";
    active = { direction, entry, stopLoss, target, entryTime: candle.datetime, entryDay: localDate, sourceBar: bar, status: "TRADE ACTIVE" };
    lastCompletedTrade = null;
  }

  if (active && livePrice !== null && Number.isFinite(livePrice)) {
    const stopHit = active.direction === "BUY" ? livePrice <= active.stopLoss : livePrice >= active.stopLoss;
    const targetHit = active.direction === "BUY" ? livePrice >= active.target : livePrice <= active.target;
    if (stopHit || targetHit) {
      active.status = stopHit ? "SL HIT" : "TP HIT";
      lastCompletedTrade = active;
      active = null;
    }
  }

  const latestAuthority = h4Timeline.at(-1) ?? null;
  const h4Direction: NexusPlusLifecycle["h4Direction"] = !belowH4 || !useH4Lock
    ? "NEUTRAL"
    : latestAuthority?.direction ?? "UNAVAILABLE";
  const h4Trade = latestAuthority?.trade ?? null;

  if (active) {
    return {
      state: "TRADE ACTIVE", direction: active.direction, entry: active.entry, stopLoss: active.stopLoss,
      target: active.target, entryTime: active.entryTime, entryDay: active.entryDay,
      reason: `Pine Nexus Plus confirmed-bar signal accepted without a time window or daily cap. Entry/SL/TP locked at ${active.entry}/${active.stopLoss}/${active.target}; ATR(14) × ${atrMultiplier} stop and 1:${riskReward} target. H4 authority: ${h4Direction}.`,
      sourceBar: active.sourceBar, engine: bars.at(-1) ?? null, h4Direction,
      h4Entry: h4Trade?.entry ?? null, h4StopLoss: h4Trade?.stopLoss ?? null, h4Target: h4Trade?.target ?? null,
      riskReward, atrMultiplier,
    };
  }

  if (lastCompletedTrade) {
    return {
      state: lastCompletedTrade.status, direction: "NO TRADE", entry: lastCompletedTrade.entry,
      stopLoss: lastCompletedTrade.stopLoss, target: lastCompletedTrade.target,
      entryTime: lastCompletedTrade.entryTime, entryDay: lastCompletedTrade.entryDay,
      reason: lastCompletedTrade.status === "SL HIT"
        ? "NO TRADE — the latest Nexus Plus trade reached its original stop loss. A new qualifying Pine signal may open the next trade."
        : "TRADE COMPLETED — the latest Nexus Plus trade reached its original target. A new qualifying Pine signal may open the next trade.",
      sourceBar: lastCompletedTrade.sourceBar, engine: bars.at(-1) ?? null, h4Direction,
      h4Entry: h4Trade?.entry ?? null, h4StopLoss: h4Trade?.stopLoss ?? null, h4Target: h4Trade?.target ?? null,
      riskReward, atrMultiplier,
    };
  }

  return {
    ...empty(
      belowH4 && useH4Lock && h4Direction === "NEUTRAL"
        ? "WAIT — H4 Directional Authority has no active direction; lower-timeframe entries are blocked."
        : "WAIT — no confirmed Nexus Plus signal has occurred, or the chronological H4 Directional Authority Lock blocked the opposite direction.",
      h4Direction,
    ),
    engine: bars.at(-1) ?? null,
    h4Entry: h4Trade?.entry ?? null,
    h4StopLoss: h4Trade?.stopLoss ?? null,
    h4Target: h4Trade?.target ?? null,
  };
}

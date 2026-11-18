export type NexusCandle = {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type NexusTrade = {
  direction: "BUY" | "SELL";
  entry: number;
  stopLoss: number;
  takeProfit: number;
  entryTime: string;
  entryDay: string;
  status: "OPEN" | "TP_HIT" | "SL_HIT";
  resultR: number | null;
};

export type VaultTradesNexusResult = {
  state: "WAITING" | "TRADE ACTIVE" | "TP HIT" | "SL HIT";
  direction: "BUY" | "SELL" | "NO TRADE";
  entry: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  riskReward: number;
  signalTime: string | null;
  signalDay: string | null;
  openTrades: NexusTrade[];
  closedTrades: NexusTrade[];
  performance: {
    tradesTaken: number;
    closedTrades: number;
    openTrades: number;
    winners: number;
    losers: number;
    winRate: number;
    profitFactor: number | null;
    totalR: number;
  };
};

const TIMEFRAME_MINUTES: Record<string, number> = {
  "1m": 1, "5m": 5, "10m": 10, "15m": 15, "30m": 30,
  "1H": 60, "4H": 240, "1D": 1440, "1W": 10080, "1M": 43200,
};

function parseTime(value: string): number {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const explicitZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  return Date.parse(explicitZone ? normalized : normalized + "Z");
}

function sastDay(value: string): string {
  const timestamp = parseTime(value);
  if (!Number.isFinite(timestamp)) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return get("year") + "-" + get("month") + "-" + get("day");
}

function sma(values: number[], period: number): Array<number | null> {
  const output: Array<number | null> = Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) output[i] = sum / period;
  }
  return output;
}

function atr(candles: NexusCandle[], period: number): Array<number | null> {
  const tr: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    const previousClose = i > 0 ? candles[i - 1].close : null;
    tr.push(previousClose == null
      ? candle.high - candle.low
      : Math.max(candle.high - candle.low, Math.abs(candle.high - previousClose), Math.abs(candle.low - previousClose)));
  }
  const output: Array<number | null> = Array(candles.length).fill(null);
  if (tr.length < period) return output;
  let value = tr.slice(0, period).reduce((sum, item) => sum + item, 0) / period;
  output[period - 1] = value;
  for (let i = period; i < tr.length; i++) {
    value = ((value * (period - 1)) + tr[i]) / period;
    output[i] = value;
  }
  return output;
}

/**
 * Pine-equivalent VaultTrades Nexus calculation.
 * Only completed candles are evaluated. Each SAST calendar day can create
 * one signal. Existing trades are checked before a new signal is considered.
 * If SL and TP are touched in the same candle, SL is recorded first.
 */
export function evaluateVaultTradesNexus(
  input: NexusCandle[],
  options: {
    timeframe?: string;
    maPeriod?: number;
    atrPeriod?: number;
    atrMultiplier?: number;
    riskReward?: number;
    now?: number;
  } = {},
): VaultTradesNexusResult {
  const maPeriod = options.maPeriod ?? 20;
  const atrPeriod = options.atrPeriod ?? 14;
  const atrMultiplier = options.atrMultiplier ?? 2;
  const riskReward = options.riskReward ?? 1.5;
  const minutes = TIMEFRAME_MINUTES[options.timeframe ?? "5m"] ?? 5;
  const now = options.now ?? Date.now();
  const candles = [...input]
    .filter((candle) => [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite))
    .sort((a, b) => parseTime(a.datetime) - parseTime(b.datetime))
    .filter((candle) => {
      const openedAt = parseTime(candle.datetime);
      return Number.isFinite(openedAt) && openedAt + minutes * 60_000 <= now;
    });

  const maHigh = sma(candles.map((candle) => candle.high), maPeriod);
  const maLow = sma(candles.map((candle) => candle.low), maPeriod);
  const atrValues = atr(candles, atrPeriod);

  const openTrades: NexusTrade[] = [];
  const closedTrades: NexusTrade[] = [];
  let lastSignalDay: string | null = null;
  let lastSignalTime: string | null = null;
  let lastClosedStatus: "TP HIT" | "SL HIT" | null = null;

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    const day = sastDay(candle.datetime);
    const currentAtr = atrValues[i];

    // Match the Pine source: manage existing trades before looking for a new entry.
    for (let tradeIndex = openTrades.length - 1; tradeIndex >= 0; tradeIndex--) {
      const trade = openTrades[tradeIndex];
      const stopHit = trade.direction === "BUY"
        ? candle.low <= trade.stopLoss
        : candle.high >= trade.stopLoss;
      const targetHit = trade.direction === "BUY"
        ? candle.high >= trade.takeProfit
        : candle.low <= trade.takeProfit;

      if (stopHit || targetHit) {
        const won = targetHit && !stopHit;
        const closed: NexusTrade = {
          ...trade,
          status: won ? "TP_HIT" : "SL_HIT",
          resultR: won ? riskReward : -1,
        };
        closedTrades.push(closed);
        lastClosedStatus = won ? "TP HIT" : "SL HIT";
        openTrades.splice(tradeIndex, 1);
      }
    }

    if (!day || lastSignalDay === day || currentAtr == null || !Number.isFinite(currentAtr) || currentAtr <= 0) continue;
    const upper = maHigh[i];
    const lower = maLow[i];
    if (upper == null || lower == null) continue;

    const isLong = candle.close > upper && candle.close > lower;
    const isShort = candle.close < upper && candle.close < lower;
    if (!isLong && !isShort) continue;

    const entry = candle.close;
    const stopLoss = isLong
      ? entry - currentAtr * atrMultiplier
      : entry + currentAtr * atrMultiplier;
    const takeProfit = isLong
      ? entry + currentAtr * atrMultiplier * riskReward
      : entry - currentAtr * atrMultiplier * riskReward;

    openTrades.push({
      direction: isLong ? "BUY" : "SELL",
      entry,
      stopLoss,
      takeProfit,
      entryTime: candle.datetime,
      entryDay: day,
      status: "OPEN",
      resultR: null,
    });
    lastSignalDay = day;
    lastSignalTime = candle.datetime;
  }

  const active = openTrades.length ? openTrades[openTrades.length - 1] : null;
  const winners = closedTrades.filter((trade) => trade.resultR != null && trade.resultR > 0).length;
  const losers = closedTrades.filter((trade) => trade.resultR != null && trade.resultR < 0).length;
  const grossProfitR = closedTrades.reduce((sum, trade) => sum + Math.max(0, trade.resultR ?? 0), 0);
  const grossLossR = Math.abs(closedTrades.reduce((sum, trade) => sum + Math.min(0, trade.resultR ?? 0), 0));
  const totalR = closedTrades.reduce((sum, trade) => sum + (trade.resultR ?? 0), 0);

  return {
    state: active ? "TRADE ACTIVE" : lastClosedStatus ?? "WAITING",
    direction: active?.direction ?? "NO TRADE",
    entry: active?.entry ?? null,
    stopLoss: active?.stopLoss ?? null,
    takeProfit: active?.takeProfit ?? null,
    riskReward,
    signalTime: active?.entryTime ?? lastSignalTime,
    signalDay: active?.entryDay ?? lastSignalDay,
    openTrades,
    closedTrades,
    performance: {
      tradesTaken: openTrades.length + closedTrades.length,
      closedTrades: closedTrades.length,
      openTrades: openTrades.length,
      winners,
      losers,
      winRate: closedTrades.length ? (winners / closedTrades.length) * 100 : 0,
      profitFactor: grossLossR > 0 ? grossProfitR / grossLossR : grossProfitR > 0 ? null : null,
      totalR,
    },
  };
}

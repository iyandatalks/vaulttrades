export type TwelveDataInterval =
  | "1min"
  | "5min"
  | "15min"
  | "30min"
  | "1h"
  | "4h"
  | "1day"
  | "1week"
  | "1month";

export type MarketDataCandle = {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};

export type MarketDataSnapshot = {
  provider: "twelvedata";
  symbol: string;
  interval: TwelveDataInterval;
  candles: MarketDataCandle[];
  currentPrice: number | null;
  fetchedAt: string;
};

const BASE_URL = "https://api.twelvedata.com";

const INTERVALS: Record<string, TwelveDataInterval> = {
  "1m": "1min",
  "5m": "5min",
  "15m": "15min",
  "30m": "30min",
  "1H": "1h",
  "4H": "4h",
  "1D": "1day",
  "1W": "1week",
  "1M": "1month",
};

export function toTwelveDataInterval(timeframe: string): TwelveDataInterval | null {
  return INTERVALS[timeframe] ?? null;
}

function finiteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function getTwelveDataTimeSeries({
  symbol,
  timeframe,
  outputsize = 120,
}: {
  symbol: string;
  timeframe: string;
  outputsize?: number;
}): Promise<MarketDataSnapshot> {
  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) {
    throw new Error("TWELVEDATA_API_KEY is not configured.");
  }

  const interval = toTwelveDataInterval(timeframe);
  if (!interval) {
    throw new Error(`Unsupported Twelve Data timeframe: ${timeframe}`);
  }

  const normalizedSymbol = symbol.trim().toUpperCase();
  if (!normalizedSymbol) {
    throw new Error("A market symbol is required.");
  }

  const url = new URL(`${BASE_URL}/time_series`);
  url.searchParams.set("symbol", normalizedSymbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("outputsize", String(Math.min(Math.max(outputsize, 20), 5000)));
  url.searchParams.set("format", "JSON");
  url.searchParams.set("apikey", apiKey);

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.status === "error") {
    const message = typeof payload?.message === "string"
      ? payload.message
      : `Twelve Data request failed with HTTP ${response.status}.`;
    throw new Error(message);
  }

  const values = Array.isArray(payload?.values) ? payload.values : [];
  const candles: MarketDataCandle[] = values
    .map((row: Record<string, unknown>) => ({
      datetime: String(row.datetime ?? ""),
      open: finiteNumber(row.open),
      high: finiteNumber(row.high),
      low: finiteNumber(row.low),
      close: finiteNumber(row.close),
      volume: finiteNumber(row.volume),
    }))
    .filter((row: MarketDataCandle) =>
      Boolean(row.datetime) &&
      row.open !== null &&
      row.high !== null &&
      row.low !== null &&
      row.close !== null,
    )
    .map((row: MarketDataCandle) => ({
      ...row,
      open: row.open as number,
      high: row.high as number,
      low: row.low as number,
      close: row.close as number,
    }))
    // Twelve Data normally returns newest-first. The analyzer, indicators,
    // structure engine and chart all require chronological oldest -> newest.
    .sort((a, b) => {
      const aTime = Date.parse(a.datetime);
      const bTime = Date.parse(b.datetime);
      if (Number.isFinite(aTime) && Number.isFinite(bTime)) return aTime - bTime;
      return a.datetime.localeCompare(b.datetime);
    });

  // Prefer the provider's live meta price. If it is unavailable, use the
  // close of the chronologically latest candle — never the oldest candle.
  const latestClose = candles.at(-1)?.close ?? null;
  const currentPrice = finiteNumber(payload?.meta?.price) ?? latestClose;

  return {
    provider: "twelvedata",
    symbol: normalizedSymbol,
    interval,
    candles,
    currentPrice,
    fetchedAt: new Date().toISOString(),
  };
}

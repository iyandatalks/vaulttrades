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

export type MarketInstrument = {
  symbol: string;
  name: string;
  type: string;
  exchange?: string;
  currency?: string;
};

export type MarketDataSnapshot = {
  provider: "twelvedata";
  symbol: string;
  interval: TwelveDataInterval;
  candles: MarketDataCandle[];
  currentPrice: number | null;
  currentPriceTimestamp: string | null;
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

async function twelveDataJson(path: string, params: Record<string, string>) {
  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) throw new Error("TWELVEDATA_API_KEY is not configured.");
  const url = new URL(`${BASE_URL}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("apikey", apiKey);

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.status === "error") {
    const message = typeof payload?.message === "string" ? payload.message : `Twelve Data request failed with HTTP ${response.status}.`;
    throw new Error(message);
  }
  return payload;
}

export async function getTwelveDataLatestPrice(symbol: string): Promise<{ price: number | null; timestamp: string | null }> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const payload = await twelveDataJson("price", { symbol: normalizedSymbol });
  return {
    price: finiteNumber(payload?.price),
    timestamp: typeof payload?.datetime === "string" ? payload.datetime : null,
  };
}

export async function getTwelveDataInstruments(marketType: "FOREX" | "INDICES" | "CRYPTO" | "STOCKS"): Promise<MarketInstrument[]> {
  if (marketType === "FOREX") {
    const payload = await twelveDataJson("forex_pairs", { outputsize: "5000" });
    return (Array.isArray(payload?.data) ? payload.data : []).map((item: Record<string, unknown>) => ({
      symbol: String(item.symbol ?? ""),
      name: String(item.symbol ?? ""),
      type: "Forex",
      currency: `${String(item.currency_base ?? "")} / ${String(item.currency_quote ?? "")}`,
    })).filter((item: MarketInstrument) => item.symbol);
  }

  if (marketType === "CRYPTO") {
    const payload = await twelveDataJson("cryptocurrencies", { outputsize: "5000" });
    return (Array.isArray(payload?.data) ? payload.data : []).map((item: Record<string, unknown>) => ({
      symbol: String(item.symbol ?? ""),
      name: String(item.symbol ?? ""),
      type: "Cryptocurrency",
    })).filter((item: MarketInstrument) => item.symbol);
  }

  if (marketType === "STOCKS") {
    const payload = await twelveDataJson("stocks", { outputsize: "5000" });
    return (Array.isArray(payload?.data) ? payload.data : []).map((item: Record<string, unknown>) => ({
      symbol: String(item.symbol ?? ""),
      name: String(item.name ?? item.symbol ?? ""),
      type: String(item.type ?? "Stock"),
      exchange: String(item.exchange ?? ""),
      currency: String(item.currency ?? ""),
    })).filter((item: MarketInstrument) => item.symbol);
  }

  // Index selection uses Twelve Data's symbol discovery rather than assuming
  // that a UI label such as "NASDAQ" is itself a valid provider symbol.
  const queries = ["NASDAQ 100", "S&P 500", "Dow Jones Industrial Average", "FTSE 100"];
  const results = await Promise.all(queries.map(async (query) => {
    try {
      const payload = await twelveDataJson("symbol_search", { symbol: query, outputsize: "30" });
      return Array.isArray(payload?.data) ? payload.data : [];
    } catch {
      return [];
    }
  }));

  const preferred = ["NASDAQ 100", "S&P 500", "Dow Jones Industrial Average", "FTSE 100"];
  const candidates: MarketInstrument[] = results.flat().map((item: Record<string, unknown>) => ({
    symbol: String(item.symbol ?? ""),
    name: String(item.instrument_name ?? item.symbol ?? ""),
    type: String(item.instrument_type ?? ""),
    exchange: String(item.exchange ?? ""),
    currency: String(item.currency ?? ""),
  })).filter((item: MarketInstrument) => item.symbol && /index/i.test(item.type) || /index/i.test(item.name));

  const unique = new Map<string, MarketInstrument>();
  for (const item of candidates) unique.set(`${item.symbol}|${item.exchange ?? ""}`, item);
  return Array.from(unique.values()).sort((a, b) => {
    const ai = preferred.findIndex((name) => a.name.toLowerCase().includes(name.toLowerCase().replace("industrial average", "")));
    const bi = preferred.findIndex((name) => b.name.toLowerCase().includes(name.toLowerCase().replace("industrial average", "")));
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });
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
  const interval = toTwelveDataInterval(timeframe);
  if (!interval) throw new Error(`Unsupported Twelve Data timeframe: ${timeframe}`);

  const normalizedSymbol = symbol.trim().toUpperCase();
  if (!normalizedSymbol) throw new Error("A market symbol is required.");

  const payload = await twelveDataJson("time_series", {
    symbol: normalizedSymbol,
    interval,
    outputsize: String(Math.min(Math.max(outputsize, 20), 5000)),
    format: "JSON",
  });

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
    .filter((row: MarketDataCandle) => Boolean(row.datetime) && row.open !== null && row.high !== null && row.low !== null && row.close !== null)
    .map((row: MarketDataCandle) => ({
      ...row,
      open: row.open as number,
      high: row.high as number,
      low: row.low as number,
      close: row.close as number,
    }))
    .sort((a: MarketDataCandle, b: MarketDataCandle) => {
      const aTime = Date.parse(a.datetime);
      const bTime = Date.parse(b.datetime);
      if (Number.isFinite(aTime) && Number.isFinite(bTime)) return aTime - bTime;
      return a.datetime.localeCompare(b.datetime);
    });

  // /time_series contains historical bars. It must not be treated as a live
  // quote. Fetch /price separately so "Current price" is the provider's latest
  // available quote rather than the last completed 15m/30m/etc. candle.
  const live = await getTwelveDataLatestPrice(normalizedSymbol);
  const latestClose = candles.at(-1)?.close ?? null;
  const currentPrice = live.price ?? latestClose;

  return {
    provider: "twelvedata",
    symbol: normalizedSymbol,
    interval,
    candles,
    currentPrice,
    currentPriceTimestamp: live.timestamp,
    fetchedAt: new Date().toISOString(),
  };
}
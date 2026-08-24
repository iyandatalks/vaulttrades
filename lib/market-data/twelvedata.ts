export type TwelveDataInterval =
  | "1min" | "5min" | "15min" | "30min" | "1h" | "4h" | "1day" | "1week" | "1month";
export type MarketDataCandle = { datetime: string; open: number; high: number; low: number; close: number; volume: number | null };
export type MarketInstrument = { symbol: string; name: string; type: string; exchange?: string; currency?: string };
export type MarketDataSnapshot = { provider: "twelvedata"; symbol: string; interval: TwelveDataInterval; candles: MarketDataCandle[]; currentPrice: number | null; currentPriceTimestamp: string | null; fetchedAt: string };

const BASE_URL = "https://api.twelvedata.com";
const INTERVALS: Record<string, TwelveDataInterval> = { "1m": "1min", "5m": "5min", "15m": "15min", "30m": "30min", "1H": "1h", "4H": "4h", "1D": "1day", "1W": "1week", "1M": "1month" };
export function toTwelveDataInterval(timeframe: string): TwelveDataInterval | null { return INTERVALS[timeframe] ?? null; }
function finiteNumber(value: unknown): number | null { const number = typeof value === "number" ? value : Number(value); return Number.isFinite(number) ? number : null; }

async function twelveDataJson(path: string, params: Record<string, string>) {
  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) throw new Error("TWELVEDATA_API_KEY is not configured.");
  const url = new URL(`${BASE_URL}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("apikey", apiKey);
  const response = await fetch(url, { method: "GET", headers: { Accept: "application/json" }, cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.status === "error") {
    const message = typeof payload?.message === "string" ? payload.message : `Twelve Data request failed with HTTP ${response.status}.`;
    throw new Error(message);
  }
  return payload;
}

export async function getTwelveDataLatestPrice(symbol: string): Promise<{ price: number | null; timestamp: string | null }> {
  const payload = await twelveDataJson("price", { symbol: symbol.trim().toUpperCase() });
  return { price: finiteNumber(payload?.price), timestamp: typeof payload?.datetime === "string" ? payload.datetime : null };
}

export async function resolveTwelveDataSymbol(marketType: "FOREX" | "INDICES" | "CRYPTO" | "STOCKS", requested: string): Promise<string> {
  const value = requested.trim().toUpperCase();
  const exactAliases: Record<string, string> = { "XAU": "XAU/USD", "GOLD": "XAU/USD", "GOLD/USD": "XAU/USD", "XAUUSD": "XAU/USD", "XAG": "XAG/USD", "SILVER": "XAG/USD", "XAGUSD": "XAG/USD", "BTCUSD": "BTC/USD", "ETHUSD": "ETH/USD", "SOLUSD": "SOL/USD" };
  if (exactAliases[value]) return exactAliases[value];
  if (marketType === "FOREX" || marketType === "CRYPTO" || marketType === "STOCKS") return value;
  const aliases: Record<string, string> = { NASDAQ: "NASDAQ 100", NAS100: "NASDAQ 100", NDX: "NASDAQ 100", SPX: "S&P 500", SP500: "S&P 500", "S&P500": "S&P 500", DOW: "Dow Jones Industrial Average", DJIA: "Dow Jones Industrial Average", FTSE: "FTSE 100", UK100: "FTSE 100" };
  const query = aliases[value] ?? requested.trim();
  const payload = await twelveDataJson("symbol_search", { symbol: query, outputsize: "30" });
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const candidates = rows.filter((row: Record<string, unknown>) => /index/i.test(String(row.instrument_type ?? "")) || /index/i.test(String(row.instrument_name ?? "")));
  const first = candidates[0] ?? rows[0];
  if (typeof first?.symbol !== "string" || !first.symbol) throw new Error(`Twelve Data could not resolve the selected ${marketType.toLowerCase()} instrument.`);
  return first.symbol;
}

export async function getTwelveDataInstruments(marketType: "FOREX" | "INDICES" | "CRYPTO" | "STOCKS"): Promise<MarketInstrument[]> {
  if (marketType === "FOREX") {
    const payload = await twelveDataJson("forex_pairs", { outputsize: "5000" });
    return (Array.isArray(payload?.data) ? payload.data : []).map((item: Record<string, unknown>) => ({ symbol: String(item.symbol ?? ""), name: String(item.symbol ?? ""), type: "Forex", currency: `${String(item.currency_base ?? "")} / ${String(item.currency_quote ?? "")}` })).filter((item: MarketInstrument) => item.symbol);
  }
  if (marketType === "CRYPTO") {
    const payload = await twelveDataJson("cryptocurrencies", { outputsize: "5000" });
    return (Array.isArray(payload?.data) ? payload.data : []).map((item: Record<string, unknown>) => ({ symbol: String(item.symbol ?? ""), name: String(item.symbol ?? ""), type: "Cryptocurrency" })).filter((item: MarketInstrument) => item.symbol);
  }
  if (marketType === "STOCKS") {
    const payload = await twelveDataJson("stocks", { outputsize: "5000" });
    return (Array.isArray(payload?.data) ? payload.data : []).map((item: Record<string, unknown>) => ({ symbol: String(item.symbol ?? ""), name: String(item.name ?? item.symbol ?? ""), type: String(item.type ?? "Stock"), exchange: String(item.exchange ?? ""), currency: String(item.currency ?? "") })).filter((item: MarketInstrument) => item.symbol);
  }
  const queries = ["NASDAQ 100", "S&P 500", "Dow Jones Industrial Average", "FTSE 100"];
  const results = await Promise.all(queries.map(async query => { try { const payload = await twelveDataJson("symbol_search", { symbol: query, outputsize: "30" }); return Array.isArray(payload?.data) ? payload.data : []; } catch { return []; } }));
  const unique = new Map<string, MarketInstrument>();
  for (const row of results.flat() as Record<string, unknown>[]) {
    const item: MarketInstrument = { symbol: String(row.symbol ?? ""), name: String(row.instrument_name ?? row.symbol ?? ""), type: String(row.instrument_type ?? ""), exchange: String(row.exchange ?? ""), currency: String(row.currency ?? "") };
    if (item.symbol && (/index/i.test(item.type) || /index/i.test(item.name))) unique.set(`${item.symbol}|${item.exchange ?? ""}`, item);
  }
  return Array.from(unique.values());
}

export async function getTwelveDataTimeSeries({ symbol, timeframe, outputsize = 120 }: { symbol: string; timeframe: string; outputsize?: number }): Promise<MarketDataSnapshot> {
  const interval = toTwelveDataInterval(timeframe);
  if (!interval) throw new Error(`Unsupported Twelve Data timeframe: ${timeframe}`);
  const requestedSymbol = symbol.trim().toUpperCase();
  if (!requestedSymbol) throw new Error("A market symbol is required.");

  // Resolve common UI labels against Twelve Data instead of treating labels as
  // provider tickers. This prevents NASDAQ/SPX/DOW-style labels from being
  // queried as if they were valid symbols, while preserving real pair symbols.
  const aliases: Record<string, string> = { NASDAQ: "NASDAQ 100", NAS100: "NASDAQ 100", SPX: "S&P 500", SP500: "S&P 500", "S&P500": "S&P 500", DOW: "Dow Jones Industrial Average", DJIA: "Dow Jones Industrial Average", FTSE: "FTSE 100" };
  let normalizedSymbol = requestedSymbol;
  if (aliases[requestedSymbol]) {
    const payload = await twelveDataJson("symbol_search", { symbol: aliases[requestedSymbol], outputsize: "30" });
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    const candidates = rows.filter((row: Record<string, unknown>) => /index/i.test(String(row.instrument_type ?? "")) || /index/i.test(String(row.instrument_name ?? "")));
    const resolved = candidates[0]?.symbol ?? rows[0]?.symbol;
    if (typeof resolved !== "string" || !resolved) throw new Error(`Unable to resolve ${requestedSymbol} to a supported market instrument.`);
    normalizedSymbol = resolved;
  }

  const payload = await twelveDataJson("time_series", { symbol: normalizedSymbol, interval, outputsize: String(Math.min(Math.max(outputsize, 20), 5000)), format: "JSON" });
  const values = Array.isArray(payload?.values) ? payload.values : [];
  const candles: MarketDataCandle[] = values
    .map((row: Record<string, unknown>) => ({ datetime: String(row.datetime ?? ""), open: finiteNumber(row.open), high: finiteNumber(row.high), low: finiteNumber(row.low), close: finiteNumber(row.close), volume: finiteNumber(row.volume) }))
    .filter((row: MarketDataCandle) => Boolean(row.datetime) && row.open !== null && row.high !== null && row.low !== null && row.close !== null)
    .map((row: MarketDataCandle) => ({ ...row, open: row.open as number, high: row.high as number, low: row.low as number, close: row.close as number }))
    .sort((a: MarketDataCandle, b: MarketDataCandle) => { const aTime = Date.parse(a.datetime); const bTime = Date.parse(b.datetime); if (Number.isFinite(aTime) && Number.isFinite(bTime)) return aTime - bTime; return a.datetime.localeCompare(b.datetime); });
  const live = await getTwelveDataLatestPrice(normalizedSymbol);
  const latestClose = candles.at(-1)?.close ?? null;
  return { provider: "twelvedata", symbol: normalizedSymbol, interval, candles, currentPrice: live.price ?? latestClose, currentPriceTimestamp: live.timestamp, fetchedAt: new Date().toISOString() };
}
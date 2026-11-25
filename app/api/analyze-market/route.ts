import { createClient } from "../../../lib/supabase/server";
import { ANALYZER_STRATEGY_MAP } from "../../../lib/strategies/analyzerProfiles";
import { getStrategyRules, type StrategyId } from "../../../lib/strategies";
import { buildAnalyzerMarketContext } from "../../../lib/market-data/indicators";
import { getTwelveDataTimeSeries, type MarketDataCandle } from "../../../lib/market-data/twelvedata";
import { getMarketProviderRoute, type MarketType } from "../../../lib/market-data/provider";
import { evaluateNexusPlusAnalyzer } from "../../../lib/strategies/nexusPlusAnalyzer";
import { evaluateSrbOb } from "../../../lib/strategies/srbObEngine";
import { evaluateLsObr } from "../../../lib/strategies/lsobrEngine";
import { analyzeAutoFibRetrace } from "../../../lib/strategies/autoFibRetrace";
import { evaluateSupplyDemand } from "../../../lib/strategies/supplyDemandEngine";
import { evaluateVaultTradesNexus } from "../../../lib/strategies/vaulttradesNexusEngine";
import { evaluateVortex, type VortexTimeframe } from "../../../lib/strategies/vortexEngine";
import { resolveLiquidityTargets } from "../../../lib/market-data/liquidityTargets";

export const runtime = "nodejs";

const TIMEFRAMES = ["1m", "5m", "10m", "15m", "30m", "1H", "4H", "1D", "1W", "1M"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];
const MARKETS: MarketType[] = ["FOREX", "INDICES", "CRYPTO", "STOCKS", "SYNTHETIC"];
type Direction = "BUY" | "SELL" | "NO TRADE";

const validTimeframe = (value: unknown): value is Timeframe => typeof value === "string" && TIMEFRAMES.includes(value as Timeframe);
const validMarket = (value: unknown): value is MarketType => typeof value === "string" && MARKETS.includes(value as MarketType);
const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";
const EMA20_TIMEFRAME_MINUTES: Record<string, number> = {
  "1m": 1, "5m": 5, "10m": 10, "15m": 15, "30m": 30,
  "1H": 60, "4H": 240, "1D": 1440, "1W": 10080, "1M": 43200,
};
function timeframeCloseAt(datetime: string, timeframe: string) {
  const normalized = datetime.includes("T") ? datetime : datetime.replace(" ", "T");
  const openedAt = Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized) ? normalized : normalized + "Z");
  if (!Number.isFinite(openedAt)) return NaN;
  if (timeframe === "1M") { const d = new Date(openedAt); d.setUTCMonth(d.getUTCMonth() + 1); return d.getTime(); }
  return openedAt + (EMA20_TIMEFRAME_MINUTES[timeframe] ?? 0) * 60_000;
}

type OandaPrice = { o: string; h: string; l: string; c: string };
function getOandaPriceComponent() {
  const value = (process.env.OANDA_PRICE_COMPONENT ?? "M").toUpperCase();
  return ["M", "B", "A"].includes(value) ? value : "M";
}
function toOandaInstrument(symbol: string) {
  const normalized = symbol.toUpperCase().replace(/^OANDA:/, "").replace(/[^A-Z]/g, "");
  if (normalized === "GOLD") return "XAU_USD";
  if (normalized === "SILVER") return "XAG_USD";
  return normalized.length === 6 ? `${normalized.slice(0, 3)}_${normalized.slice(3)}` : null;
}
async function getOandaCandles(symbol: string, timeframe: string, count: number): Promise<MarketDataCandle[] | null> {
  const token = process.env.OANDA_ACCESS_TOKEN;
  const accountId = process.env.OANDA_ACCOUNT_ID;
  const instrument = toOandaInstrument(symbol);
  if (!token || !accountId || !instrument) return null;
  const granularity: Record<string, string> = { "1m": "M1", "5m": "M5", "10m": "M10", "15m": "M15", "30m": "M30", "1H": "H1", "4H": "H4", "1D": "D", "1W": "W", "1M": "M" };
  const g = granularity[timeframe];
  if (!g) return null;
  const environment = (process.env.OANDA_ENVIRONMENT ?? "live").toLowerCase();
  const baseUrl = environment === "practice" ? "https://api-fxpractice.oanda.com" : "https://api-fxtrade.oanda.com";
  const priceComponent = getOandaPriceComponent();
  const params = new URLSearchParams({ granularity: g, count: String(Math.min(5000, Math.max(100, count))), price: priceComponent });
  const response = await fetch(`${baseUrl}/v3/accounts/${encodeURIComponent(accountId)}/instruments/${instrument}/candles?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`OANDA candle request failed (${response.status})`);
  const payload = await response.json() as { candles?: Array<{ time: string; complete: boolean; volume?: number; mid?: OandaPrice; bid?: OandaPrice; ask?: OandaPrice }> };
  const rows = (payload.candles ?? []).filter(row => row.complete);
  return rows.flatMap(row => {
    const price = priceComponent === "B" ? row.bid : priceComponent === "A" ? row.ask : row.mid;
    if (!price) return [];
    const open = Number(price.o), high = Number(price.h), low = Number(price.l), close = Number(price.c);
    if (![open, high, low, close].every(Number.isFinite)) return [];
    return [{ datetime: row.time, open, high, low, close, volume: typeof row.volume === "number" ? row.volume : null }];
  });
}

async function getVortexFeed(symbol: string, timeframe: Timeframe, oandaConfigured: boolean) {
  if (oandaConfigured) {
    const oandaCandles = await getOandaCandles(symbol, timeframe, 5000).catch(() => null);
    if (oandaCandles?.length) return { candles: oandaCandles, source: `OANDA v20 (${getOandaPriceComponent()})` };
  }
  const fallback = await getTwelveDataTimeSeries({ symbol, timeframe, outputsize: 5000, normalizeToUtc: true });
  return { candles: fallback.candles, source: "Twelve Data" };
}

function completedEma20Candles(candles: MarketDataCandle[], timeframe: string) {
  const minutes = EMA20_TIMEFRAME_MINUTES[timeframe];
  if (!minutes) return [];
  const now = Date.now();
  return candles.filter(candle => {
    const normalized = candle.datetime.includes("T") ? candle.datetime : candle.datetime.replace(" ", "T");
    const hasExplicitTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
    const openedAt = Date.parse(hasExplicitTimezone ? normalized : normalized + "Z");
    const closeAt = timeframeCloseAt(candle.datetime, timeframe);
    return Number.isFinite(openedAt) && Number.isFinite(closeAt) && closeAt <= now;
  });
}


function calculateChannel(candles: Array<{ high: number; low: number; close: number }>, length = 20) {
  if (candles.length < length) return { upper: null, lower: null, middle: null };
  const channelCandles = candles.slice(-length);
  const upper = channelCandles.reduce((sum, candle) => sum + candle.high, 0) / length;
  const lower = channelCandles.reduce((sum, candle) => sum + candle.low, 0) / length;
  return { upper, lower, middle: (upper + lower) / 2 };
}

function derivePriceLevels(candles: Array<{ high: number; low: number; close: number }>, current: number | null, pivotLength = 3) {
  if (candles.length < pivotLength * 2 + 3 || current === null) return { support: null, resistance: null };
  const highs: number[] = [];
  const lows: number[] = [];
  const start = Math.max(pivotLength, candles.length - 150);
  for (let i = start; i < candles.length - pivotLength; i++) {
    let highPivot = true;
    let lowPivot = true;
    for (let j = 1; j <= pivotLength; j++) {
      if (candles[i].high <= candles[i - j].high || candles[i].high <= candles[i + j].high) highPivot = false;
      if (candles[i].low >= candles[i - j].low || candles[i].low >= candles[i + j].low) lowPivot = false;
    }
    if (highPivot) highs.push(candles[i].high);
    if (lowPivot) lows.push(candles[i].low);
  }
  const recent = candles.slice(-80);
  const supportCandidates = lows.filter(v => v < current).sort((a, b) => b - a);
  const resistanceCandidates = highs.filter(v => v > current).sort((a, b) => a - b);
  let support: number | null = supportCandidates[0] ?? recent.map(c => c.low).filter(v => v < current).sort((a, b) => b - a)[0] ?? null;
  let resistance: number | null = resistanceCandidates[0] ?? recent.map(c => c.high).filter(v => v > current).sort((a, b) => a - b)[0] ?? null;
  if (support !== null && support >= current) support = null;
  if (resistance !== null && resistance <= current) resistance = null;
  if (support !== null && resistance !== null && support >= resistance) {
    support = recent.map(c => c.low).filter(v => v < current).sort((a, b) => b - a)[0] ?? null;
    resistance = recent.map(c => c.high).filter(v => v > current).sort((a, b) => a - b)[0] ?? null;
  }
  return { support, resistance };
}

function tradeMath(direction: Direction, entry: number | null, stop: number | null, tp: number | null, current: number | null, minimumRR = 2, minimumSlPct = 0.1, maximumEntryDistancePct = 0.5) {
  if (direction === "NO TRADE" || entry === null || stop === null || tp === null) return { valid: false, rr: null, risk: null, reward: null, slPct: null, entryDistancePct: null };
  const risk = direction === "BUY" ? entry - stop : stop - entry;
  const reward = direction === "BUY" ? tp - entry : entry - tp;
  const rr = risk > 0 ? reward / risk : null;
  const slPct = entry !== 0 ? Math.abs(entry - stop) / Math.abs(entry) * 100 : null;
  const entryDistancePct = current !== null && current !== 0 ? Math.abs(entry - current) / Math.abs(current) * 100 : null;
  return { valid: risk > 0 && reward > 0 && rr !== null && rr >= minimumRR && (slPct === null || slPct >= minimumSlPct) && (entryDistancePct === null || entryDistancePct <= maximumEntryDistancePct), rr, risk, reward, slPct, entryDistancePct };
}

function jsonText(raw: any): string {
  return raw.output?.flatMap((x: any) => x.content ?? []).filter((x: any) => x.type === "output_text").map((x: any) => x.text).join("").trim() || "";
}
function findActiveVisualOrderBlocks(candles: Array<{ open:number; high:number; low:number; close:number }>) {
  const pivotLength = 3;
  const atrAt = (end:number) => {
    const sample = candles.slice(Math.max(0, end - 14), end + 1);
    if (sample.length < 8) return null;
    const ranges = sample.map((c,i) => i === 0 ? c.high-c.low : Math.max(c.high-c.low, Math.abs(c.high-sample[i-1].close), Math.abs(c.low-sample[i-1].close)));
    return ranges.reduce((sum,value)=>sum+value,0)/ranges.length;
  };
  const find = (direction:"BULLISH"|"BEARISH") => {
    for (let breakIndex = candles.length - 2; breakIndex >= Math.max(20, candles.length - 120); breakIndex--) {
      const bar = candles[breakIndex], a = atrAt(breakIndex);
      if (!a || a <= 0) continue;
      const pivots:number[] = [];
      for (let i = Math.max(pivotLength, breakIndex - 35); i < breakIndex - pivotLength; i++) {
        let pivot = true;
        for (let j=1;j<=pivotLength;j++) {
          if (direction === "BULLISH" ? candles[i].high <= candles[i-j].high || candles[i].high <= candles[i+j].high : candles[i].low >= candles[i-j].low || candles[i].low >= candles[i+j].low) { pivot=false; break; }
        }
        if (pivot) pivots.push(direction === "BULLISH" ? candles[i].high : candles[i].low);
      }
      const level = direction === "BULLISH" ? Math.max(...pivots.filter(v=>v<bar.close), -Infinity) : Math.min(...pivots.filter(v=>v>bar.close), Infinity);
      const body = Math.abs(bar.close-bar.open);
      const broke = direction === "BULLISH" ? Number.isFinite(level) && bar.close>level && bar.close>bar.open && body>=a*0.8 : Number.isFinite(level) && bar.close<level && bar.close<bar.open && body>=a*0.8;
      if (!broke) continue;
      for (let originIndex = breakIndex - 1; originIndex >= Math.max(0, breakIndex - 12); originIndex--) {
        const origin = candles[originIndex];
        if (direction === "BULLISH" ? origin.close >= origin.open : origin.close <= origin.open) continue;
        const later = candles.slice(originIndex + 1);
        const invalidated = later.some(x => direction === "BULLISH" ? x.close < origin.low : x.close > origin.high);
        const mitigated = later.some(x => x.low <= origin.high && x.high >= origin.low);
        if (invalidated || mitigated) break;
        return { direction, top: origin.high, bottom: origin.low, label: direction === "BULLISH" ? "ACTIVE BULLISH OB · UNMITIGATED" : "ACTIVE BEARISH OB · UNMITIGATED", state: "ACTIVE" };
      }
    }
    return null;
  };
  return [find("BULLISH"), find("BEARISH")].filter((x): x is NonNullable<typeof x> => x !== null);
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("role")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (profileError) return Response.json({ error: "Unable to verify account access." }, { status: 500 });

    const isAdmin = profile?.role === "admin";
    if (!isAdmin) {
      const { data: hasFeature, error: featureError } = await supabase.rpc("has_feature_access", {
        p_auth_user_id: user.id,
        p_feature_code: "analyzer",
      });
      if (featureError) return Response.json({ error: "Unable to verify Analyzer access." }, { status: 500 });
      if (hasFeature !== true) return Response.json({ error: "Analyzer access is not active for this account." }, { status: 403 });
    }

    const body = await request.json();
    const marketType = validMarket(body.marketType) ? body.marketType : "FOREX";
    const requestedTimeframe = validTimeframe(body.timeframe) ? body.timeframe : "15m";
    const strategyId = clean(body.strategy);
    const timeframe = requestedTimeframe;
    const symbol = clean(body.symbol).toUpperCase();
    const profileStrategy = ANALYZER_STRATEGY_MAP[strategyId];
    if (!profileStrategy) return Response.json({ error: "Invalid strategy selected." }, { status: 400 });
    if (!symbol) return Response.json({ error: "Select or enter a market symbol." }, { status: 400 });
    if (marketType === "SYNTHETIC") return Response.json({ error: "Synthetic indices require the Synthetic/Broker provider connection." }, { status: 400 });
    const oandaConfigured = Boolean(process.env.OANDA_ACCESS_TOKEN && process.env.OANDA_ACCOUNT_ID);
    const providerRoute = getMarketProviderRoute(marketType);
    if (!providerRoute.available && !(strategyId === "vortex" && oandaConfigured)) return Response.json({ error: providerRoute.reason || "Market data is unavailable." }, { status: 503 });
    const apiKey = process.env.OPENAI_API_KEY;

    const oandaPrimaryCandles = strategyId === "vortex" && oandaConfigured
      ? await getOandaCandles(symbol, timeframe, 5000).catch(() => null)
      : null;
    const marketDataSource = oandaPrimaryCandles?.length
      ? `OANDA v20 (${getOandaPriceComponent()})`
      : oandaConfigured && strategyId === "vortex" ? "Twelve Data fallback (OANDA unavailable)" : "Twelve Data";
    const market = oandaPrimaryCandles?.length
      ? ({
          provider: "oanda",
          symbol: toOandaInstrument(symbol) ?? symbol,
          interval: ({ "1m": "1min", "5m": "5min", "10m": "10min", "15m": "15min", "30m": "30min", "1H": "1h", "4H": "4h", "1D": "1day", "1W": "1week", "1M": "1month" } as Record<string, string>)[timeframe],
          currentPrice: oandaPrimaryCandles[oandaPrimaryCandles.length - 1]?.close ?? null,
          currentPriceTimestamp: oandaPrimaryCandles[oandaPrimaryCandles.length - 1]?.datetime ?? null,
          fetchedAt: new Date().toISOString(),
          candles: oandaPrimaryCandles,
          exchangeTimezone: "America/New_York",
        } as Awaited<ReturnType<typeof getTwelveDataTimeSeries>>)
      : await getTwelveDataTimeSeries({ symbol, timeframe, outputsize: strategyId === "ema20" || strategyId === "vaulttradesNexus" || strategyId === "vortex" ? 5000 : 250, normalizeToUtc: strategyId === "vaulttradesNexus" || strategyId === "ema20" || strategyId === "vortex" });
    if (market.candles.length < 40) return Response.json({ error: "Not enough live market history was returned for this symbol/timeframe." }, { status: 422 });
    if (strategyId === "vortex") {
      const completedSelectedCandles = completedEma20Candles(market.candles, timeframe);
      const lastCompleted = completedSelectedCandles.at(-1);
      const lastCompletedClose = lastCompleted ? timeframeCloseAt(lastCompleted.datetime, timeframe) : NaN;
      const freshnessWindowMs: Record<string, number> = {
        "1m": 3 * 60_000, "5m": 15 * 60_000, "10m": 30 * 60_000,
        "15m": 45 * 60_000, "30m": 90 * 60_000, "1H": 3 * 60 * 60_000,
        "4H": 12 * 60 * 60_000, "1D": 3 * 24 * 60 * 60_000,
        "1W": 21 * 24 * 60 * 60_000, "1M": 62 * 24 * 60 * 60_000,
      };
      if (!lastCompleted || !Number.isFinite(lastCompletedClose) || Date.now() - lastCompletedClose > freshnessWindowMs[timeframe]) {
        return Response.json({
          error: "Current market candles are stale or unavailable for the selected timeframe. No Vortex trade decision was produced.",
          marketData: { symbol: market.symbol, timeframe, provider: market.provider, lastCompletedCandle: lastCompleted?.datetime ?? null, fetchedAt: market.fetchedAt },
        }, { status: 503 });
      }
    }
    if (strategyId === "vortex") {
      const completedSelectedCandles = completedEma20Candles(market.candles, timeframe);
      const lastCompleted = completedSelectedCandles.at(-1);
      const lastCompletedClose = lastCompleted ? timeframeCloseAt(lastCompleted.datetime, timeframe) : NaN;
      const freshnessWindowMs: Record<string, number> = {
        "1m": 3 * 60_000, "5m": 15 * 60_000, "10m": 30 * 60_000,
        "15m": 45 * 60_000, "30m": 90 * 60_000, "1H": 3 * 60 * 60_000,
        "4H": 12 * 60 * 60_000, "1D": 3 * 24 * 60 * 60_000,
        "1W": 21 * 24 * 60 * 60_000, "1M": 62 * 24 * 60 * 60_000,
      };
      if (!lastCompleted || !Number.isFinite(lastCompletedClose) || Date.now() - lastCompletedClose > freshnessWindowMs[timeframe]) {
        return Response.json({
          error: "Current market candles are stale or unavailable for the selected timeframe. No Vortex trade decision was produced.",
          marketData: { symbol: market.symbol, timeframe, provider: market.provider, lastCompletedCandle: lastCompleted?.datetime ?? null, fetchedAt: market.fetchedAt },
        }, { status: 503 });
      }
    }
    // Silver is optional confluence for Auto Fib and Vortex on Gold instruments.
    const isGoldInstrument = /XAU|GOLD/.test(symbol.replace(/[^A-Z]/g, ""));
    const silverMarket = strategyId === "fibRetracement" && isGoldInstrument
      ? await getTwelveDataTimeSeries({ symbol: "XAG/USD", timeframe, outputsize: 250 }).catch(() => null)
      : null;
    const fibM5Market = strategyId === "fibRetracement" && timeframe !== "5m"
      ? await getTwelveDataTimeSeries({ symbol, timeframe: "5m", outputsize: 250 }).catch(() => null)
      : null;
    const vortexM5Feed = strategyId === "vortex"
      ? timeframe === "5m" ? { candles: market.candles, source: marketDataSource } : await getVortexFeed(symbol, "5m", oandaConfigured)
      : null;
    const vortexSilverSelectedFeed = strategyId === "vortex" && isGoldInstrument
      ? await getVortexFeed("XAG/USD", timeframe, oandaConfigured).catch(() => ({ candles: [], source: "Unavailable" }))
      : null;
    const nexusPlusH4Market = strategyId === "ema20" && (EMA20_TIMEFRAME_MINUTES[timeframe] ?? 0) < 240
      ? await getTwelveDataTimeSeries({ symbol, timeframe: "4H", outputsize: 1500, normalizeToUtc: true }).catch(() => null)
      : null;

    const selectedIndicators = profileStrategy.defaultIndicators;
    const context = buildAnalyzerMarketContext(market.candles, market.symbol, timeframe, selectedIndicators);
    const liveCurrentPrice = market.currentPrice ?? market.candles.at(-1)?.close ?? null;
    const latest = market.candles.at(-1)!;
    const previous = market.candles.at(-2)!;
    const channel = calculateChannel(market.candles);
    const priceLevels = derivePriceLevels(market.candles, liveCurrentPrice, 3);
    const liquidityTargets = resolveLiquidityTargets(market.candles, liveCurrentPrice, 3, 150);
    const lockedStructure = { ...context.structure, support: priceLevels.support, resistance: priceLevels.resistance };
    const sourceRules = profileStrategy.sourceIds.map((id: StrategyId) => getStrategyRules(id));
    const indicatorEvidence = context.selectedIndicators.map(i => ({ name: i.name, value: i.value, signal: i.signal, parameters: profileStrategy.indicatorSpecs.find(s => s.name === i.name)?.parameters ?? "source-defined" }));

    // EMA20 is the first live strategy wired to a deterministic Pine-equivalent engine.
    // The engine is authoritative for strategy state and native Entry/SL/TP. The Analyzer is downstream.
    // Pine signals are confirmed-bar only. Exclude the still-forming provider candle;
    // the lifecycle uses the live quote only to detect whether a locked trade has exited.
    const ema20Candles = strategyId === "ema20" ? completedEma20Candles(market.candles, timeframe) : [];
    const nexusPlusH4Candles = strategyId === "ema20"
      ? completedEma20Candles(timeframe === "4H" ? market.candles : nexusPlusH4Market?.candles ?? [], "4H")
      : [];
    const ema20Engine = strategyId === "ema20"
      ? evaluateNexusPlusAnalyzer(ema20Candles, timeframe, liveCurrentPrice, nexusPlusH4Candles)
      : null;
    // Nexus filters completed bars internally: intraday data is UTC-normalized,
    // while daily+ bars are returned in the exchange's local calendar.
    const nexusEngine = strategyId === "vaulttradesNexus"
      ? evaluateVaultTradesNexus(market.candles, { timeframe, exchangeTimezone: market.exchangeTimezone })
      : null;
    const toVortexCandles = (candles: MarketDataCandle[], tf: Timeframe | "5m") => completedEma20Candles(candles, tf).map(c => ({
      time: Date.parse(c.datetime), open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume ?? undefined,
    }));
    const vortexLotSize = Number.isFinite(Number(body.lotSize)) && Number(body.lotSize) >= 0.01 ? Math.floor(Number(body.lotSize) * 100) / 100 : 0.05;
    const vortexTickSize = /XAU|XAG/.test(symbol.replace(/[^A-Z]/g, "")) ? 0.01 : /JPY/.test(symbol.replace(/[^A-Z]/g, "")) ? 0.001 : marketType === "FOREX" ? 0.00001 : 0.01;
    const vortexEngine = strategyId === "vortex" ? evaluateVortex({
      // The Pine strategy runs on the chart timeframe selected by the customer.
      // Its only lower-timeframe confirmation is the source-defined M5 displacement.
      m1Candles: toVortexCandles(market.candles, timeframe),
      m5Candles: toVortexCandles(vortexM5Feed?.candles ?? [], "5m"),
      silverCandles: toVortexCandles(vortexSilverSelectedFeed?.candles ?? [], timeframe),
      timeframe: timeframe as VortexTimeframe,
      confirmationTimeframe: "5m",
      lotSize: vortexLotSize,
      tickSize: vortexTickSize,
    }) : null;
    const vortexEngines = strategyId === "vortex" ? { [timeframe]: vortexEngine } : null;
    const ema20Bar = ema20Engine?.engine ?? null;
    const ema20EngineEvidence = ema20Engine ? {
      source: "VAULTTRADES_NEXUS_PLUS_PINE_V6",
      state: ema20Engine.state,
      signal: ema20Engine.direction,
      entry: ema20Engine.entry,
      stopLoss: ema20Engine.stopLoss,
      finalTp: ema20Engine.target,
      entryTime: ema20Engine.entryTime,
      entryDay: ema20Engine.entryDay,
      ema20: ema20Bar?.ema20 ?? null,
      slowEMA: ema20Bar?.slowEMA ?? null,
      atr: ema20Bar?.atr ?? null,
      bullStructure: ema20Bar?.bullStructure ?? false,
      bearStructure: ema20Bar?.bearStructure ?? false,
      bullTouch: ema20Bar?.bullTouch ?? false,
      bearTouch: ema20Bar?.bearTouch ?? false,
      bullReject: ema20Bar?.bullReject ?? false,
      bearReject: ema20Bar?.bearReject ?? false,
      bullMABreak: ema20Bar?.bullMABreak ?? false,
      bearMABreak: ema20Bar?.bearMABreak ?? false,
      utBull: ema20Bar?.utBull ?? false,
      utBear: ema20Bar?.utBear ?? false,
      smiBull: ema20Bar?.smiBull ?? false,
      smiBear: ema20Bar?.smiBear ?? false,
      newLong: ema20Bar?.newLong ?? false,
      newShort: ema20Bar?.newShort ?? false,
      confirmation: { long: ema20Bar?.longConfirmationScore ?? 0, short: ema20Bar?.shortConfirmationScore ?? 0 },
      reason: ema20Engine.reason,
      evidence: [
        ema20Bar?.bullStructure ? "Persistent bullish HH/HL structure" : "",
        ema20Bar?.bearStructure ? "Persistent bearish LH/LL structure" : "",
        ema20Bar?.bullTouch ? "Price touched EMA20 bullish tolerance" : "",
        ema20Bar?.bearTouch ? "Price touched EMA20 bearish tolerance" : "",
        ema20Bar?.bullMABreak ? "Bullish rejection high broken" : "",
        ema20Bar?.bearMABreak ? "Bearish rejection low broken" : "",
        ema20Bar?.utBull ? "UT Bot bullish" : "",
        ema20Bar?.utBear ? "UT Bot bearish" : "",
        ema20Bar?.smiBull ? "SMI bullish" : "",
        ema20Bar?.smiBear ? "SMI bearish" : "",
      ].filter(Boolean),
      missingConditions: ema20Engine.state === "WAITING" ? [ema20Engine.reason] : [],
      invalidation: ema20Engine.state === "SL HIT" ? "The original stop loss was reached; wait for the next confirmed Pine signal." : "The stored rejection is invalidated by a close through its opposite extreme or expires after the configured confirmation bars.",
    } : null;

    const autoFibEngine = strategyId === "fibRetracement" ? analyzeAutoFibRetrace({
      candles: market.candles.map((c) => ({ time: new Date(c.datetime).getTime(), open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume ?? undefined })),
      silverCandles: silverMarket?.candles.map((c) => ({ time: new Date(c.datetime).getTime(), open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume ?? undefined })),
      m5Candles: (timeframe === "5m" ? market.candles : fibM5Market?.candles ?? []).map((c) => ({ time: new Date(c.datetime).getTime(), open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume ?? undefined })),
    }) : null;
    const vortexLiquidityTargets = vortexEngine?.state === "TRADE ACTIVE" && vortexEngine.liquidityTarget != null ? {
      buySide: vortexEngine.direction === "BUY" ? { price: vortexEngine.liquidityTarget, source: "Vortex higher liquidity target", touches: 0 } : null,
      sellSide: vortexEngine.direction === "SELL" ? { price: vortexEngine.liquidityTarget, source: "Vortex lower liquidity target", touches: 0 } : null,
    } : { buySide: null, sellSide: null };
    const visualOrderBlocks = strategyId === "vaulttradesNexus" ? [] : strategyId === "vortex" ? (vortexEngine?.orderBlock ? [{ direction: vortexEngine.orderBlock.direction === "BUY" ? "BULLISH" : "BEARISH", top: vortexEngine.orderBlock.top, bottom: vortexEngine.orderBlock.bottom, label: "VORTEX TARGET ORDER BLOCK", state: "ACTIVE" }] : []) : strategyId === "fibRetracement" && autoFibEngine
      ? [
          ...(autoFibEngine.orderBlocks.bullish.active && !autoFibEngine.orderBlocks.bullish.mitigated && !autoFibEngine.orderBlocks.bullish.breaker && autoFibEngine.orderBlocks.bullish.high != null && autoFibEngine.orderBlocks.bullish.low != null
            ? [{ direction:"BULLISH", top:autoFibEngine.orderBlocks.bullish.high, bottom:autoFibEngine.orderBlocks.bullish.low, label:"ACTIVE BULLISH OB · UNMITIGATED", state:"ACTIVE" }] : []),
          ...(autoFibEngine.orderBlocks.bearish.active && !autoFibEngine.orderBlocks.bearish.mitigated && !autoFibEngine.orderBlocks.bearish.breaker && autoFibEngine.orderBlocks.bearish.high != null && autoFibEngine.orderBlocks.bearish.low != null
            ? [{ direction:"BEARISH", top:autoFibEngine.orderBlocks.bearish.high, bottom:autoFibEngine.orderBlocks.bearish.low, label:"ACTIVE BEARISH OB · UNMITIGATED", state:"ACTIVE" }] : []),
        ]
      : strategyId === "ema20"
        ? []
        : findActiveVisualOrderBlocks(market.candles);
    const autoFibEngineEvidence = autoFibEngine ? {
      source: "AUTO_FIB_RETRACE_DETERMINISTIC",
      state: autoFibEngine.state,
      signal: autoFibEngine.signal,
      direction: "NO TRADE",
      entry: autoFibEngine.entry,
      stopLoss: autoFibEngine.stopLoss,
      finalTp: autoFibEngine.finalTp,
      rangeHigh: autoFibEngine.buy.high ?? autoFibEngine.sell.high,
      rangeLow: autoFibEngine.buy.low ?? autoFibEngine.sell.low,
      fibLevel: autoFibEngine.buy.flipPrice ?? autoFibEngine.sell.flipPrice,
      score: Math.max(autoFibEngine.buyConfluence, autoFibEngine.sellConfluence),
      buyConfluence: autoFibEngine.buyConfluence,
      sellConfluence: autoFibEngine.sellConfluence,
      confluenceBreakdown: autoFibEngine.confluenceBreakdown,
      silver: autoFibEngine.silver,
      silverDataAvailable: Boolean(silverMarket && silverMarket.candles.length >= 2),
      evidence: autoFibEngine.evidence,
      missingConditions: autoFibEngine.missingConditions,
      liquidityTarget: null,
      orderBlock: null,
      riskReward: autoFibEngine.riskReward,
      invalidation: autoFibEngine.invalidation.join(" "),
      buy: autoFibEngine.buy,
      sell: autoFibEngine.sell,
      message: autoFibEngine.message,
    } : null;

    const supplyDemandEngine = strategyId === "supplyDemand" ? evaluateSupplyDemand(market.candles) : null;
    const srbObEngine = strategyId === "srbOb" ? evaluateSrbOb(market.candles) : null;
    const lsobrEngine = strategyId === "lsobr" ? evaluateLsObr(market.candles) : null;
    const srbObEngineEvidence = srbObEngine ? {
      source: srbObEngine.source,
      state: srbObEngine.state,
      direction: srbObEngine.direction,
      entry: srbObEngine.entry,
      stopLoss: srbObEngine.stopLoss,
      finalTp: srbObEngine.finalTp,
      rangeHigh: srbObEngine.rangeHigh,
      rangeLow: srbObEngine.rangeLow,
      window: srbObEngine.window,
      fibLevel: srbObEngine.fibLevel,
      score: srbObEngine.score,
      evidence: srbObEngine.evidence,
      missingConditions: srbObEngine.missingConditions,
      liquidityTarget: srbObEngine.liquidityTarget,
      orderBlock: srbObEngine.orderBlock,
      riskReward: srbObEngine.riskReward,
      invalidation: srbObEngine.invalidation
    } : null;

    const lsobrEngineEvidence = lsobrEngine ? {
      source: lsobrEngine.source,
      state: lsobrEngine.state,
      direction: lsobrEngine.direction,
      entry: lsobrEngine.entry,
      stopLoss: lsobrEngine.stopLoss,
      finalTp: lsobrEngine.finalTp,
      sweptLiquidity: lsobrEngine.sweptLiquidity,
      liquidityTarget: lsobrEngine.liquidityTarget,
      orderBlock: lsobrEngine.orderBlock,
      rejectionExtreme: lsobrEngine.rejectionExtreme,
      sweepTime: lsobrEngine.sweepTime,
      mssTime: lsobrEngine.mssTime,
      confirmationTime: lsobrEngine.confirmationTime,
      evidence: lsobrEngine.evidence,
      missingConditions: lsobrEngine.missingConditions,
      invalidation: lsobrEngine.invalidation,
      riskReward: lsobrEngine.riskReward,
      trend: lsobrEngine.trend,
    } : null;

    const prompt = `You are the VaultTrades educational market analyzer. Analyze REAL LIVE OHLCV data, not a screenshot and not invented prices.

USER SELECTION
Market: ${marketType}
Symbol: ${market.symbol}
Timeframe: ${timeframe}
Strategy: ${profileStrategy.name} (${strategyId})

SOURCE-OF-TRUTH STRATEGY RULES
${JSON.stringify(sourceRules)}

STRATEGY PROFILE
${JSON.stringify({ focus: profileStrategy.focus, rules: profileStrategy.rules, indicatorSpecs: profileStrategy.indicatorSpecs })}

LIVE CALCULATED MARKET CONTEXT
${JSON.stringify({ currentPrice: liveCurrentPrice, structure: lockedStructure, volatility: context.volatility, selectedIndicators: indicatorEvidence, channel20High: channel.upper, channel20Low: channel.lower, latestCandle: latest, previousCandle: previous, recentCandles: market.candles.slice(-60), sharedLiquidityTargets: liquidityTargets })}

DETERMINISTIC STRATEGY ENGINE STATE
${JSON.stringify({ ema20: ema20EngineEvidence, srbOb: srbObEngineEvidence, lsobr: lsobrEngineEvidence })}

IMPORTANT ENGINE AUTHORITY
If the selected strategy is VaultTrades Nexus Plus (ema20), its deterministic Pine-equivalent engine is authoritative for lifecycle state, entry, stop loss and target. If the selected strategy is srbOb, the SRB & OB engine is authoritative for its session-window breakout and Fib retest. If the selected strategy is lsobr, the dedicated LSOBR engine is authoritative for liquidity sweep, pre-existing fixed order block, rejection, MSS, confirmed OB exit, entry location, stop and opposing liquidity target. LSOBR must never use SRB session-window conditions. Never let generic Analyzer gates or AI rewrite the selected engine output. In particular, VaultTrades Nexus Plus uses continuous 24-hour operation with no time window or daily trade cap, each timeframe's own OHLC-derived ATR(14) and configured stop multiplier, and 1:1.81 RR. H4 directional authority filters only an opposing lower-timeframe signal while an H4 trade is active; a neutral or unavailable H4 state does not suppress valid lower-timeframe signals. Every confirmed NEW_LONG/NEW_SHORT is eligible at any time unless it opposes an active H4 direction. If the engine has no new signal, do not manufacture a BUY or SELL from generic indicators.

PRICE LEVEL INTEGRITY — MANDATORY
The current price above is authoritative. Support must be below current price. Resistance must be above current price. Never make support equal resistance. If a structural level is unavailable, return null rather than inventing one.

UNIVERSAL ANALYZER RULES 1-6 — VALIDATION/COMMUNICATION LAYER
1. Visual analysis: classify Uptrend, Downtrend, Ranging or Choppy from live evidence. More than 5 consecutive inside bars OR material conflict across 3+ selected/derived timeframes = NO TRADE.
2. SMC: score BOS, CHoCH, Order Block, FVG, Liquidity Sweep and Displacement 1-10 only from evidence. A NEW BUY/SELL requires at least TWO scores >=7 where the selected strategy's analyzer profile requires this gate.
3. Session/confluence: identify London, New York or Asian from candle timestamps; do not invent news.
4. Price validation: validate entry proximity, SL geometry, TP geometry and risk according to the selected strategy's own execution/risk rules. Do not replace strategy-native mathematics with a generic formula.
5. Confidence: confidence must match evidence.
6. Quality check: re-check strategy lifecycle, signal transition, entry, SL/TP geometry, confluence and invalidation.

CRITICAL STRATEGY RULE
The selected strategy is primary. Its source-defined rules govern the strategy state. Universal Analyzer rules validate/explain that state; they must not rewrite the strategy's source mathematics.

CRITICAL LIFECYCLE RULE
DEVELOPING, READY, WATCHING and ACTIVE are not the same as a NEW BUY/SELL. Only return BUY/SELL when the source strategy state supports it. Otherwise return NO TRADE and explain what is missing.

EDUCATIONAL COMMUNICATION
Include concrete support/resistance and the next meaningful zone if price breaks and CLOSES beyond the relevant level. Explain what confirmation would change the state. Do not reveal the data provider.

Return JSON only.`;

    const schema = {
      type: "object", additionalProperties: false,
      properties: {
        direction: { type: "string", enum: ["BUY", "SELL", "NO TRADE"] },
        decision: { type: "string", enum: ["TRADE", "NO TRADE"] },
        confidence: { type: "number", minimum: 0, maximum: 100 },
        marketCondition: { type: "string" }, directionalBias: { type: "string" }, session: { type: "string" }, higherTimeframe: { type: "string" }, marketStructure: { type: "string" },
        support: { type: ["number", "null"] }, resistance: { type: ["number", "null"] }, recentPriceAction: { type: "string" }, setup: { type: "string" },
        confirmedConditions: { type: "array", items: { type: "string" } }, missingConditions: { type: "array", items: { type: "string" } },
        bos: { type: "number", minimum: 1, maximum: 10 }, choch: { type: "number", minimum: 1, maximum: 10 }, orderBlock: { type: "number", minimum: 1, maximum: 10 }, fvg: { type: "number", minimum: 1, maximum: 10 }, liquiditySweep: { type: "number", minimum: 1, maximum: 10 }, displacement: { type: "number", minimum: 1, maximum: 10 },
        pipeline: { type: "array", items: { type: "string" } }, nextZone: { type: "string" }, invalidation: { type: "string" },
        entry: { type: ["number", "null"] }, stopLoss: { type: ["number", "null"] }, tp1: { type: ["number", "null"] }, tp2: { type: ["number", "null"] }, finalTp: { type: ["number", "null"] }, nextAction: { type: "string" }, educationalNote: { type: "string" }
      },
      required: ["direction","decision","confidence","marketCondition","directionalBias","session","higherTimeframe","marketStructure","support","resistance","recentPriceAction","setup","confirmedConditions","missingConditions","bos","choch","orderBlock","fvg","liquiditySweep","displacement","pipeline","nextZone","invalidation","entry","stopLoss","tp1","tp2","finalTp","nextAction","educationalNote"]
    };

    let ai: any;
    if (strategyId === "ema20") {
      ai = {
        direction: ema20Engine?.state === "TRADE ACTIVE" ? ema20Engine.direction : "NO TRADE",
        decision: ema20Engine?.state === "TRADE ACTIVE" ? "TRADE" : "NO TRADE",
        confidence: ema20Engine?.state === "TRADE ACTIVE" ? 80 : 45,
        marketCondition: context.structure.trend ?? "Live market structure",
        directionalBias: ema20Engine?.direction ?? "NEUTRAL",
        session: "No time window or daily entry cap.",
        higherTimeframe: "Higher timeframes are independent strategy instances; they do not gate the selected timeframe.",
        marketStructure: context.structure.trend ?? "Structure evaluated from selected timeframe candles.",
        support: priceLevels.support,
        resistance: priceLevels.resistance,
        recentPriceAction: "Deterministic VaultTrades Nexus Plus engine evaluated completed candles and the active H4 directional authority.",
        setup: ema20Engine?.reason ?? "WAIT — no Pine-defined Nexus Plus entry sequence has qualified.",
        confirmedConditions: ema20EngineEvidence?.evidence ?? [],
        missingConditions: ema20EngineEvidence?.missingConditions ?? [],
        bos: 5, choch: 5, orderBlock: 1, fvg: 5, liquiditySweep: 5, displacement: 5,
        pipeline: ema20EngineEvidence?.evidence ?? [],
        nextZone: ema20Bar?.bullReject ? "Bullish rejection high" : ema20Bar?.bearReject ? "Bearish rejection low" : "Wait for the next Pine-defined Nexus Plus setup and confirmed breakout",
        invalidation: ema20EngineEvidence?.invalidation ?? "",
        entry: ema20Engine?.entry ?? null,
        stopLoss: ema20Engine?.stopLoss ?? null,
        tp1: ema20Engine?.target ?? null,
        tp2: ema20Engine?.target ?? null,
        finalTp: ema20Engine?.target ?? null,
        nextAction: ema20Engine?.reason ?? "WAIT",
        educationalNote: "VaultTrades Nexus Plus follows the Pine v6 persistent structure, EMA20 pullback/rejection, rejection-break, UT Bot OR SMI confirmation, 24-hour operation with no daily trade cap, one active position per timeframe, H4 directional authority only against opposing lower-timeframe signals while an H4 trade is active, each timeframe's own OHLC-derived ATR stop multiplier and 1:1.81 target. No additional OB or generic confluence gate is applied.",
      };
    } else if (strategyId === "fibRetracement") {
      ai = { direction:"NO TRADE",decision:"NO TRADE",confidence:autoFibEngine?.confidence??0,marketCondition:context.structure.trend,directionalBias:autoFibEngine?.bias??"NEUTRAL",session:"Derived from market candle timestamps.",higherTimeframe:"Selected timeframe is evaluated independently.",marketStructure:context.structure.trend,support:priceLevels.support,resistance:priceLevels.resistance,recentPriceAction:autoFibEngine?.message??"Auto Fib engine evaluated the supplied candles.",setup:autoFibEngine?.message??"Waiting for valid Fib structure.",confirmedConditions:autoFibEngine?.evidence??[],missingConditions:autoFibEngine?.missingConditions??[],bos:5,choch:5,orderBlock:5,fvg:5,liquiditySweep:5,displacement:5,pipeline:autoFibEngine?.evidence??[],nextZone:"Wait for source-defined Fib flip, active unmitigated OB and entry confirmation.",invalidation:(autoFibEngine?.invalidation??[]).join(" "),entry:null,stopLoss:null,tp1:autoFibEngine?.tp1??null,tp2:autoFibEngine?.tp2??null,finalTp:autoFibEngine?.finalTp??null,nextAction:autoFibEngine?.message??"WAIT",educationalNote:"Auto Fib runs locally. Its source defines projection probability as zero and has no qualifying entry event, so no BUY/SELL or stop-loss is invented." };
    } else if (strategyId === "vortex") {
      const active = vortexEngine?.state === "TRADE ACTIVE";
      ai = {
        direction: active ? vortexEngine!.direction : "NO TRADE", decision: active ? "TRADE" : "NO TRADE",
        confidence: active ? vortexEngine!.score : 0, marketCondition: context.structure.trend ?? "Market",
        directionalBias: vortexEngine?.structuralDirection ?? "NEUTRAL", session: "All sessions (no Silver Bullet time-window gate)",
        higherTimeframe: "M1, M5 and M15 are evaluated as independent trade engines.", marketStructure: context.structure.trend ?? "Market",
        support: priceLevels.support, resistance: priceLevels.resistance,
        recentPriceAction: vortexEngine?.statusReason ?? "",
        setup: vortexEngine?.state ?? "WAITING", confirmedConditions: vortexEngine?.evidence ?? [],
        missingConditions: vortexEngine?.missingConditions ?? [], bos: 5, choch: 5, orderBlock: 5, fvg: 5, liquiditySweep: 5, displacement: 5,
        pipeline: vortexEngine?.evidence ?? [], nextZone: `${timeframe.toUpperCase()} pullback at 68.1%, 78.6% or 88% with its own timeframe displacement confirmation`,
        invalidation: vortexEngine?.invalidation ?? "", entry: vortexEngine?.entry ?? null,
        stopLoss: vortexEngine?.stopLoss ?? null, tp1: vortexEngine?.tp1 ?? null, tp2: vortexEngine?.tp2 ?? null,
        finalTp: vortexEngine?.tp5 ?? null, nextAction: vortexEngine?.statusReason ?? "WAIT",
        educationalNote: "",
      };
    } else if (strategyId === "vaulttradesNexus") {
      const active = nexusEngine?.state === "TRADE ACTIVE";
      ai = {
        direction: active ? nexusEngine!.direction : "NO TRADE", decision: active ? "TRADE" : "NO TRADE",
        confidence: active ? 80 : 0, marketCondition: context.structure.trend ?? "Market",
        directionalBias: active ? nexusEngine!.direction : "NEUTRAL", session: "SAST",
        higherTimeframe: "Selected timeframe", marketStructure: context.structure.trend ?? "Market",
        support: priceLevels.support, resistance: priceLevels.resistance, recentPriceAction: "",
        setup: active ? "TRADE ACTIVE" : "WAITING FOR TRADE", confirmedConditions: [], missingConditions: [],
        bos: 5, choch: 5, orderBlock: 5, fvg: 5, liquiditySweep: 5, displacement: 5,
        pipeline: [], nextZone: "", invalidation: "", entry: nexusEngine?.entry ?? null,
        stopLoss: nexusEngine?.stopLoss ?? null, tp1: nexusEngine?.takeProfit ?? null,
        tp2: nexusEngine?.takeProfit ?? null, finalTp: nexusEngine?.takeProfit ?? null,
        nextAction: active ? "TRADE ACTIVE" : "WAITING FOR TRADE", educationalNote: "",
      };
    } else if (strategyId === "supplyDemand") {
      const sd=supplyDemandEngine!;
      ai = { direction:sd.direction,decision:sd.direction==="NO TRADE"?"NO TRADE":"TRADE",confidence:sd.confidence,marketCondition:sd.marketCondition,directionalBias:sd.direction==="NO TRADE"?context.structure.trend:sd.direction,session:"Derived from market candle timestamps.",higherTimeframe:"Selected timeframe is the source of truth.",marketStructure:context.structure.trend,support:priceLevels.support,resistance:priceLevels.resistance,recentPriceAction:sd.evidence.join(" ")||"No qualifying fresh-zone reaction on the latest candles.",setup:sd.state==="ENTRY READY"?"Fresh zone retest, liquidity event and displacement confirmed.":"Supply & Demand sequence evaluated from historical zones.",confirmedConditions:sd.evidence,missingConditions:sd.missingConditions,bos:5,choch:5,orderBlock:5,fvg:5,liquiditySweep:5,displacement:5,pipeline:sd.evidence,nextZone:sd.activeZone?`${sd.activeZone.direction} zone ${sd.activeZone.bottom}–${sd.activeZone.top}`:"Wait for a fresh, intact zone.",invalidation:sd.invalidation,entry:sd.entry,stopLoss:sd.stopLoss,tp1:sd.tp1,tp2:sd.tp2,finalTp:sd.finalTp,nextAction:sd.missingConditions[0]??(sd.state==="ENTRY READY"?"Validate the structural setup before execution.":"WAIT for the next required zone event."),educationalNote:"Supply & Demand is calculated locally. A trade requires a fresh intact zone, retest, liquidity sweep/reclaim or rejection, directional displacement and an opposing structural target." };
    } else {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: "gpt-4.1-mini", input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }], max_output_tokens: 6000, text: { format: { type: "json_schema", name: "vaulttrades_live_market_analysis", strict: true, schema } } })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return Response.json({ error: `Analyzer model request failed: ${errorText.slice(0, 300)}` }, { status: 502 });
      }
      const raw = await response.json();
      const text = jsonText(raw);
      if (!text) return Response.json({ error: "The analyzer returned no structured result." }, { status: 502 });
      ai = JSON.parse(text);
    }

    const engineDirection: Direction = ema20Engine?.state === "TRADE ACTIVE" ? ema20Engine.direction : "NO TRADE";
    const direction = strategyId === "ema20" ? engineDirection : strategyId === "vortex" ? (vortexEngine?.state === "TRADE ACTIVE" ? vortexEngine.direction : "NO TRADE") : strategyId === "vaulttradesNexus" ? (nexusEngine?.direction ?? "NO TRADE") : strategyId === "srbOb" ? (srbObEngine?.direction ?? "NO TRADE") : strategyId === "lsobr" ? (lsobrEngine?.direction ?? "NO TRADE") : strategyId === "supplyDemand" ? (supplyDemandEngine?.direction ?? "NO TRADE") : ai.direction as Direction;
    const entry = strategyId === "ema20" ? (ema20Engine?.state === "TRADE ACTIVE" ? ema20Engine.entry : null) : strategyId === "vortex" ? (vortexEngine?.state === "TRADE ACTIVE" ? vortexEngine.entry : null) : strategyId === "vaulttradesNexus" ? (nexusEngine?.entry ?? null) : strategyId === "srbOb" ? (srbObEngine?.entry ?? null) : strategyId === "lsobr" ? (lsobrEngine?.entry ?? null) : strategyId === "supplyDemand" ? (supplyDemandEngine?.entry ?? null) : (typeof ai.entry === "number" ? ai.entry : null);
    const stopLoss = strategyId === "ema20" ? (ema20Engine?.state === "TRADE ACTIVE" ? ema20Engine.stopLoss : null) : strategyId === "vortex" ? (vortexEngine?.state === "TRADE ACTIVE" ? vortexEngine.stopLoss : null) : strategyId === "vaulttradesNexus" ? (nexusEngine?.stopLoss ?? null) : strategyId === "srbOb" ? (srbObEngine?.stopLoss ?? null) : strategyId === "lsobr" ? (lsobrEngine?.stopLoss ?? null) : strategyId === "supplyDemand" ? (supplyDemandEngine?.stopLoss ?? null) : (typeof ai.stopLoss === "number" ? ai.stopLoss : null);
    const finalTp = strategyId === "ema20" ? (ema20Engine?.state === "TRADE ACTIVE" ? ema20Engine.target : null) : strategyId === "vortex" ? (vortexEngine?.state === "TRADE ACTIVE" ? vortexEngine.tp5 : null) : strategyId === "vaulttradesNexus" ? (nexusEngine?.takeProfit ?? null) : strategyId === "srbOb" ? (srbObEngine?.finalTp ?? null) : strategyId === "lsobr" ? (lsobrEngine?.finalTp ?? null) : strategyId === "supplyDemand" ? (supplyDemandEngine?.finalTp ?? null) : (typeof ai.finalTp === "number" ? ai.finalTp : typeof ai.tp2 === "number" ? ai.tp2 : null);
    const minimumRR = strategyId === "vortex" ? 0.01 : strategyId === "vaulttradesNexus" ? 1.5 : strategyId === "ema20" ? 1.81 : strategyId === "srbOb" ? 0.1 : strategyId === "supplyDemand" ? 0.01 : 2;
    const math = tradeMath(direction, entry, stopLoss, finalTp, liveCurrentPrice, minimumRR, strategyId === "ema20" || strategyId === "supplyDemand" || strategyId === "vaulttradesNexus" || strategyId === "vortex" ? 0 : 0.1, strategyId === "ema20" || strategyId === "supplyDemand" || strategyId === "vaulttradesNexus" || strategyId === "vortex" ? Number.POSITIVE_INFINITY : 0.5);
    const strongSmc = [ai.bos, ai.choch, ai.orderBlock, ai.fvg, ai.liquiditySweep, ai.displacement].filter((x: unknown) => typeof x === "number" && x >= 7).length;
    const smcGate = strongSmc >= 2;
    const analyzerTradeGate = direction !== "NO TRADE" && math.valid && (strategyId === "ema20" || strategyId === "vaulttradesNexus" || strategyId === "supplyDemand" || strategyId === "vortex" || smcGate);
    const finalDirection: Direction = strategyId === "ema20" || strategyId === "vaulttradesNexus" || strategyId === "vortex" ? (analyzerTradeGate ? direction : "NO TRADE") : strategyId === "srbOb" ? (srbObEngine?.direction ?? "NO TRADE") : strategyId === "lsobr" ? (lsobrEngine?.state === "ENTRY READY" && analyzerTradeGate ? (lsobrEngine.direction as Direction) : "NO TRADE") : strategyId === "supplyDemand" ? (supplyDemandEngine?.state === "ENTRY READY" && analyzerTradeGate ? direction : "NO TRADE") : analyzerTradeGate && ai.decision === "TRADE" ? direction : "NO TRADE";

    const nativeEngineOutput = strategyId === "vortex" ? vortexEngine! : strategyId === "ema20" ? {
      state: ema20Engine?.state,
      signal: ema20Engine?.direction,
      newLong: ema20Bar?.newLong ?? false,
      newShort: ema20Bar?.newShort ?? false,
      // Preserve original Nexus Plus execution levels for the completed result card.
      // This is display data only; the strategy engine and its lifecycle rules are unchanged.
      entry: ema20Engine?.entry ?? entry,
      stopLoss: ema20Engine?.stopLoss ?? stopLoss,
      finalTp: ema20Engine?.target ?? finalTp,
      closedDirection: ema20Engine?.state === "TP HIT" || ema20Engine?.state === "SL HIT"
        ? (ema20Engine?.sourceBar?.newLong ? "BUY" : ema20Engine?.sourceBar?.newShort ? "SELL" : null)
        : null,
      ema20: ema20Bar?.ema20 ?? null,
      slowEMA: ema20Bar?.slowEMA ?? null,
      atr: ema20Bar?.atr ?? null,
      bullStructure: ema20Bar?.bullStructure ?? false,
      bearStructure: ema20Bar?.bearStructure ?? false,
      bullTouch: ema20Bar?.bullTouch ?? false,
      bearTouch: ema20Bar?.bearTouch ?? false,
      bullReject: ema20Bar?.bullReject ?? false,
      bearReject: ema20Bar?.bearReject ?? false,
      bullMABreak: ema20Bar?.bullMABreak ?? false,
      bearMABreak: ema20Bar?.bearMABreak ?? false,
      utBull: ema20Bar?.utBull ?? false,
      utBear: ema20Bar?.utBear ?? false,
      smiBull: ema20Bar?.smiBull ?? false,
      smiBear: ema20Bar?.smiBear ?? false,
      confirmation: { long: ema20Bar?.longConfirmationScore ?? 0, short: ema20Bar?.shortConfirmationScore ?? 0 },
      entryTime: ema20Engine?.entryTime ?? null,
      entryDay: ema20Engine?.entryDay ?? null,
      lifecycleReason: ema20Engine?.reason ?? "",
      h4Direction: ema20Engine?.h4Direction ?? "UNAVAILABLE",
      h4Entry: ema20Engine?.h4Entry ?? null,
      h4StopLoss: ema20Engine?.h4StopLoss ?? null,
      h4Target: ema20Engine?.h4Target ?? null,
      atrMultiplier: ema20Engine?.atrMultiplier ?? null,
      riskReward: ema20Engine?.riskReward ?? 1.81,
      evidence: ema20EngineEvidence?.evidence ?? [],
      missingConditions: ema20EngineEvidence?.missingConditions ?? [],
      invalidation: ema20EngineEvidence?.invalidation ?? "",
    } : strategyId === "vaulttradesNexus" ? {
      source: "VAULTTRADES_NEXUS_PINE_V6",
      exchangeTimezone: nexusEngine?.exchangeTimezone ?? market.exchangeTimezone,
      state: nexusEngine?.state ?? "WAITING",
      signal: nexusEngine?.direction ?? "NO TRADE",
      entry, stopLoss, finalTp,
      riskReward: 1.5,
      signalTime: nexusEngine?.signalTime ?? null,
      signalDay: nexusEngine?.signalDay ?? null,
      performance: nexusEngine?.performance ?? null,
      openTrades: nexusEngine?.openTrades ?? [],
      closedTrades: nexusEngine?.closedTrades ?? [],
      latestClosedTrade: nexusEngine?.latestClosedTrade ?? null,
      statusReason: nexusEngine?.statusReason ?? "No valid signal has been generated from a completed candle yet.",
    } : null;

    return Response.json({
      dataSource: marketDataSource,
      marketDataAudit: strategyId === "vortex" ? {
        symbol: market.symbol,
        selectedTimeframe: timeframe,
        provider: market.provider,
        currentPrice: market.currentPrice,
        currentPriceTimestamp: market.currentPriceTimestamp,
        lastCompletedCandle: completedEma20Candles(market.candles, timeframe).at(-1)?.datetime ?? null,
        fetchedAt: market.fetchedAt,
      } : undefined,
      market: { type: marketType, asset: market.symbol, timeframe, currentPrice: liveCurrentPrice, directionalBias: ai.directionalBias, session: ai.session },
      strategy: { id: strategyId, name: profileStrategy.name, category: profileStrategy.category },
      sourceIndicators: profileStrategy.indicatorSpecs,
      indicatorReadings: context.selectedIndicators,
      chart: { candles: market.candles, channel20: channel, orderBlocks: visualOrderBlocks },
      liquidityTargets: strategyId === "vortex" ? vortexLiquidityTargets : liquidityTargets,
      timeframeEngines: strategyId === "vortex" ? vortexEngines : undefined,
      structure: { ...lockedStructure }, volatility: context.volatility,
      strategyEngine: strategyId === "vortex" ? vortexEngine : strategyId === "lsobr" ? lsobrEngineEvidence : strategyId === "srbOb" ? srbObEngineEvidence : strategyId === "fibRetracement" ? autoFibEngineEvidence : strategyId === "supplyDemand" ? supplyDemandEngine : nativeEngineOutput,
      scanner: strategyId === "vortex" ? {
        projectedDirection: vortexEngine?.plannedDirection ?? "NO TRADE",
        analysisState: vortexEngine?.state === "TRADE ACTIVE" ? "ACTIVE" : vortexEngine?.state === "SETUP DEVELOPING" ? "DEVELOPING" : vortexEngine?.state === "TP HIT" || vortexEngine?.state === "SL HIT" ? "COMPLETED" : "WAITING",
        statusMessage: vortexEngine?.statusReason ?? "Waiting for a valid Vortex setup.",
        cycleStatus: vortexEngine?.state === "TRADE ACTIVE" ? "ACTIVE" : vortexEngine?.state === "SETUP DEVELOPING" ? "SETUP_DEVELOPING" : vortexEngine?.state === "TP HIT" ? "TP_HIT" : vortexEngine?.state === "SL HIT" ? "SL_HIT" : "WAITING",
        actualEntry: vortexEngine?.state === "TRADE ACTIVE" ? vortexEngine.entry : null,
        projectedEntry: vortexEngine?.entry ?? null,
        projectedStopLoss: vortexEngine?.stopLoss ?? null,
        projectedTp1: vortexEngine?.tp1 ?? null,
        projectedTp2: vortexEngine?.tp2 ?? null,
        projectedTp3: vortexEngine?.tp3 ?? null,
        projectedTp4: vortexEngine?.tp4 ?? null,
        projectedTp5: vortexEngine?.tp5 ?? null,
        projectedFinalTp: vortexEngine?.tp5 ?? null,
        stopHit: vortexEngine?.state === "SL HIT",
        entryConfirmation: vortexEngine?.state === "TRADE ACTIVE",
        strategyConditionsMet: vortexEngine?.state === "TRADE ACTIVE",
        isExecutable: vortexEngine?.state === "TRADE ACTIVE",
        waitReason: vortexEngine?.statusReason ?? "",
        tradeReason: vortexEngine?.statusReason ?? "",
      } : strategyId === "vaulttradesNexus" ? {
        projectedDirection: nexusEngine?.direction ?? "NO TRADE",
        analysisState: nexusEngine?.state === "TRADE ACTIVE" ? "ACTIVE" : nexusEngine?.state === "TP HIT" || nexusEngine?.state === "SL HIT" ? "COMPLETED" : "WAITING",
        statusMessage: nexusEngine?.state ?? "WAITING FOR TRADE",
        cycleStatus: nexusEngine?.state === "TRADE ACTIVE" ? "ACTIVE" : nexusEngine?.state === "SL HIT" ? "SL_HIT" : nexusEngine?.state === "TP HIT" ? "TP_HIT" : "WAITING",
        actualEntry: nexusEngine?.entry ?? null,
        projectedEntry: nexusEngine?.entry ?? null,
        projectedStopLoss: nexusEngine?.stopLoss ?? null,
        projectedTp1: nexusEngine?.takeProfit ?? null,
        projectedTp2: null,
        projectedFinalTp: nexusEngine?.takeProfit ?? null,
        stopHit: nexusEngine?.state === "SL HIT",
        entryConfirmation: nexusEngine?.state === "TRADE ACTIVE",
        strategyConditionsMet: nexusEngine?.state === "TRADE ACTIVE",
        isExecutable: nexusEngine?.state === "TRADE ACTIVE",
        waitReason: nexusEngine?.statusReason ?? "", tradeReason: nexusEngine?.state === "TRADE ACTIVE" ? "Trade remains open until the Pine-defined stop loss or take profit is reached." : "",
      } : strategyId === "ema20" ? {
        projectedDirection: ema20Engine?.state === "TRADE ACTIVE" ? ema20Engine.direction : "NO TRADE",
        analysisState: ema20Engine?.state === "TRADE ACTIVE" ? "ACTIVE" : ema20Engine?.state === "SL HIT" ? "NO TRADE" : ema20Engine?.state === "TP HIT" ? "COMPLETED" : "WAITING",
        statusMessage: ema20Engine?.reason ?? "WAIT — awaiting a valid Pine EMA20 signal.",
        cycleStatus: ema20Engine?.state === "TRADE ACTIVE" ? "ACTIVE" : ema20Engine?.state === "SL HIT" ? "SL_HIT" : ema20Engine?.state === "TP HIT" ? "TP_HIT" : "WAITING",
        actualEntry: ema20Engine?.state === "TRADE ACTIVE" ? ema20Engine.entry : null,
        projectedEntry: ema20Engine?.state === "TRADE ACTIVE" ? ema20Engine.entry : null,
        projectedStopLoss: ema20Engine?.state === "TRADE ACTIVE" ? ema20Engine.stopLoss : null,
        projectedTp1: ema20Engine?.state === "TRADE ACTIVE" ? ema20Engine.target : null,
        projectedTp2: null,
        projectedFinalTp: ema20Engine?.state === "TRADE ACTIVE" ? ema20Engine.target : null,
        stopHit: ema20Engine?.state === "SL HIT",
        entryConfirmation: ema20Engine?.state === "TRADE ACTIVE",
        strategyConditionsMet: ema20Engine?.state === "TRADE ACTIVE",
        isExecutable: ema20Engine?.state === "TRADE ACTIVE",
        waitReason: ema20Engine?.reason ?? "",
        tradeReason: ema20Engine?.reason ?? "",
      } : undefined,
      decision: finalDirection === "NO TRADE" ? "NO TRADE" : "TRADE", direction: finalDirection,
      confidence: finalDirection === "NO TRADE" ? Math.min(Number(ai.confidence) || 0, 69) : Number(ai.confidence) || 0,
      setup: ai.setup, marketCondition: ai.marketCondition, marketStructure: ai.marketStructure, recentPriceAction: ai.recentPriceAction,
      confirmedConditions: ai.confirmedConditions,
      missingConditions: [...(strategyId === "lsobr" ? [...(lsobrEngine?.missingConditions ?? []), ...(!analyzerTradeGate && lsobrEngine?.state === "ENTRY READY" ? ["Universal Analyzer Rules 1–6 did not validate the LSOBR entry."] : [])] : strategyId === "srbOb" ? (srbObEngine?.missingConditions ?? []) : strategyId === "supplyDemand" ? (supplyDemandEngine?.missingConditions ?? []) : ai.missingConditions), ...(strategyId === "ema20" && ema20Engine?.state === "WAITING" ? [ema20Engine.reason] : []), ...(strategyId !== "ema20" && strategyId !== "supplyDemand" && strategyId !== "fibRetracement" && strategyId !== "vortex" && strongSmc < 2 ? ["Analyzer SMC confluence gate: fewer than two SMC signals scored 7 or higher."] : []), ...(!math.valid && direction !== "NO TRADE" ? [math.rr !== null && math.rr < minimumRR ? `Strategy price validation: R:R is below the selected strategy minimum of 1:${minimumRR}.` : "Strategy price validation: entry/SL/TP geometry did not pass all applicable gates."] : [])],
      smcScores: { BOS: ai.bos, CHoCH: ai.choch, OrderBlock: ai.orderBlock, FVG: ai.fvg, LiquiditySweep: ai.liquiditySweep, Displacement: ai.displacement },
      pipeline: ai.pipeline, nextZone: ai.nextZone, invalidation: ai.invalidation,
      entry: strategyId === "lsobr" ? (lsobrEngine?.entry ?? null) : finalDirection === "NO TRADE" ? null : entry, stopLoss: strategyId === "lsobr" ? (lsobrEngine?.stopLoss ?? null) : finalDirection === "NO TRADE" ? null : stopLoss,
      tp1: strategyId === "lsobr" ? (lsobrEngine?.finalTp ?? null) : finalDirection === "NO TRADE" ? null : strategyId === "ema20" ? finalTp : ai.tp1, tp2: strategyId === "lsobr" ? null : finalDirection === "NO TRADE" ? null : strategyId === "ema20" ? finalTp : ai.tp2, finalTp: strategyId === "lsobr" ? (lsobrEngine?.finalTp ?? null) : finalDirection === "NO TRADE" ? null : finalTp,
      rr: strategyId === "lsobr" ? (lsobrEngine?.riskReward ?? null) : finalDirection === "NO TRADE" ? (srbObEngine?.riskReward ?? null) : math.rr, slDistancePct: finalDirection === "NO TRADE" ? null : math.slPct, entryDistancePct: finalDirection === "NO TRADE" ? null : math.entryDistancePct,
      nextAction: strategyId === "lsobr" ? (lsobrEngine?.missingConditions[0] ?? (lsobrEngine?.state === "ENTRY READY" ? "LSOBR sequence confirmed; verify universal Analyzer gates before treating it as a trade." : lsobrEngine?.state ?? "Wait for the next LSOBR condition.")) : strategyId === "srbOb" ? (srbObEngine?.missingConditions[0] ?? srbObEngine?.state ?? "Monitor the selected SRB window.") : ai.nextAction, educationalNote: strategyId === "lsobr" ? "LSOBR requires a liquidity sweep, fixed pre-existing OB rejection, MSS and a confirmed close out of the OB. No SRB opening-window rules are used." : strategyId === "srbOb" ? "SRB & OB uses its own deterministic session-range, Fibonacci pullback and opposing-order-block rules. Confirm the chart state before acting." : ai.educationalNote,
      qualityChecks: { smcStrongCount: strongSmc, rrValid: math.rr !== null && math.rr >= minimumRR, slDistanceValid: math.slPct === null || math.slPct >= (strategyId === "ema20" || strategyId === "vortex" ? 0 : 0.1), entryDistanceValid: math.entryDistancePct === null || math.entryDistancePct <= (strategyId === "ema20" || strategyId === "vortex" ? Number.POSITIVE_INFINITY : 0.5), universalTradeGate: analyzerTradeGate },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Live market analysis failed." }, { status: 500 });
  }
}

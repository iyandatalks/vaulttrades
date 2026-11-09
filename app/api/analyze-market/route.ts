import { createClient } from "../../../lib/supabase/server";
import { ANALYZER_STRATEGY_MAP } from "../../../lib/strategies/analyzerProfiles";
import { getStrategyRules, type StrategyId } from "../../../lib/strategies";
import { buildAnalyzerMarketContext } from "../../../lib/market-data/indicators";
import { getTwelveDataTimeSeries } from "../../../lib/market-data/twelvedata";
import { getMarketProviderRoute, type MarketType } from "../../../lib/market-data/provider";
import { evaluateEma20Analyzer } from "../../../lib/strategies/ema20Analyzer";
import { evaluateSrbOb } from "../../../lib/strategies/srbObEngine";
import { evaluateLsObr } from "../../../lib/strategies/lsobrEngine";
import { analyzeAutoFibRetrace } from "../../../lib/strategies/autoFibRetrace";
import { resolveLiquidityTargets } from "../../../lib/market-data/liquidityTargets";

export const runtime = "nodejs";

const TIMEFRAMES = ["1m", "5m", "10m", "15m", "30m", "1H", "4H", "1D", "1W", "1M"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];
const MARKETS: MarketType[] = ["FOREX", "INDICES", "CRYPTO", "STOCKS", "SYNTHETIC"];
type Direction = "BUY" | "SELL" | "NO TRADE";

const validTimeframe = (value: unknown): value is Timeframe => typeof value === "string" && TIMEFRAMES.includes(value as Timeframe);
const validMarket = (value: unknown): value is MarketType => typeof value === "string" && MARKETS.includes(value as MarketType);
const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";

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
    const timeframe = validTimeframe(body.timeframe) ? body.timeframe : "15m";
    const strategyId = clean(body.strategy);
    const symbol = clean(body.symbol).toUpperCase();
    const profileStrategy = ANALYZER_STRATEGY_MAP[strategyId];
    if (!profileStrategy) return Response.json({ error: "Invalid strategy selected." }, { status: 400 });
    if (!symbol) return Response.json({ error: "Select or enter a market symbol." }, { status: 400 });
    if (marketType === "SYNTHETIC") return Response.json({ error: "Synthetic indices require the Synthetic/Broker provider connection." }, { status: 400 });
    const providerRoute = getMarketProviderRoute(marketType);
    if (!providerRoute.available) return Response.json({ error: providerRoute.reason || "Market data is unavailable." }, { status: 503 });
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey && strategyId !== "ema20") return Response.json({ error: "OpenAI API key is not configured." }, { status: 500 });

    const market = await getTwelveDataTimeSeries({ symbol, timeframe, outputsize: strategyId === "ema20" ? 5000 : 250 });
    if (market.candles.length < 40) return Response.json({ error: "Not enough live market history was returned for this symbol/timeframe." }, { status: 422 });
    // Silver is fetched only for the Auto Fib strategy on Gold instruments; all other Analyzer requests retain their existing provider-call count.
    const isGoldInstrument = /XAU|GOLD/.test(symbol.replace(/[^A-Z]/g, ""));
    const silverMarket = strategyId === "fibRetracement" && isGoldInstrument
      ? await getTwelveDataTimeSeries({ symbol: "XAG/USD", timeframe, outputsize: 250 }).catch(() => null)
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
    const ema20Engine = strategyId === "ema20" ? evaluateEma20Analyzer(market.candles, timeframe) : null;
    const ema20Bar = ema20Engine?.engine ?? null;
    const ema20EngineEvidence = ema20Engine ? {
      source: "PINE_SCRIPT_PLUS_REQUIRED_OB",
      state: ema20Engine.state,
      signal: ema20Engine.direction,
      entry: ema20Engine.entry,
      stopLoss: ema20Engine.stopLoss,
      finalTp: ema20Engine.target,
      entryTime: ema20Engine.entryTime,
      entryDay: ema20Engine.entryDay,
      orderBlock: ema20Engine.orderBlock,
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
        ema20Engine.orderBlock ? ema20Engine.orderBlock.direction + " pre-existing displacement OB qualified" : "",
      ].filter(Boolean),
      missingConditions: ema20Engine.state === "WAITING" ? [ema20Engine.reason] : [],
      invalidation: ema20Engine.state === "SL HIT" ? "The original stop loss was reached; no second EMA20 trade is permitted on this timeframe today." : "The fixed Order Block is invalidated by a close through its far edge.",
    } : null;

    const autoFibEngine = strategyId === "fibRetracement" ? analyzeAutoFibRetrace({
      candles: market.candles.map((c) => ({ time: new Date(c.datetime).getTime(), open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume ?? undefined })),
      silverCandles: silverMarket?.candles.map((c) => ({ time: new Date(c.datetime).getTime(), open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume ?? undefined })),
    }) : null;
    const visualOrderBlocks = strategyId === "fibRetracement" && autoFibEngine
      ? [
          ...(autoFibEngine.orderBlocks.bullish.active && !autoFibEngine.orderBlocks.bullish.mitigated && !autoFibEngine.orderBlocks.bullish.breaker && autoFibEngine.orderBlocks.bullish.high != null && autoFibEngine.orderBlocks.bullish.low != null
            ? [{ direction:"BULLISH", top:autoFibEngine.orderBlocks.bullish.high, bottom:autoFibEngine.orderBlocks.bullish.low, label:"ACTIVE BULLISH OB · UNMITIGATED", state:"ACTIVE" }] : []),
          ...(autoFibEngine.orderBlocks.bearish.active && !autoFibEngine.orderBlocks.bearish.mitigated && !autoFibEngine.orderBlocks.bearish.breaker && autoFibEngine.orderBlocks.bearish.high != null && autoFibEngine.orderBlocks.bearish.low != null
            ? [{ direction:"BEARISH", top:autoFibEngine.orderBlocks.bearish.high, bottom:autoFibEngine.orderBlocks.bearish.low, label:"ACTIVE BEARISH OB · UNMITIGATED", state:"ACTIVE" }] : []),
        ]
      : strategyId === "ema20" && ema20Engine?.orderBlock
        ? [{ direction: ema20Engine.orderBlock.direction, top: ema20Engine.orderBlock.top, bottom: ema20Engine.orderBlock.bottom, label: ema20Engine.orderBlock.label, state: ema20Engine.orderBlock.state }]
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
If the selected strategy is EMA20, its deterministic Pine-equivalent engine is authoritative for lifecycle state, entry, stop loss and target. If the selected strategy is srbOb, the SRB & OB engine is authoritative for its session-window breakout and Fib retest. If the selected strategy is lsobr, the dedicated LSOBR engine is authoritative for liquidity sweep, pre-existing fixed order block, rejection, MSS, confirmed OB exit, entry location, stop and opposing liquidity target. LSOBR must never use SRB session-window conditions. Never let generic Analyzer gates or AI rewrite the selected engine output. In particular, EMA20 uses ATR(14) x 2.23 for native SL and exactly 1:1.81 RR. A NEW_LONG/NEW_SHORT is the source strategy trigger. If the engine has no new signal, do not manufacture a BUY or SELL from generic indicators.

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
        session: "SAST morning signal window",
        higherTimeframe: "Higher timeframes are independent strategy instances; they do not gate the selected timeframe.",
        marketStructure: context.structure.trend ?? "Structure evaluated from selected timeframe candles.",
        support: priceLevels.support,
        resistance: priceLevels.resistance,
        recentPriceAction: "Deterministic EMA20 engine evaluated the completed candle sequence.",
        setup: ema20Engine?.reason ?? "WAIT — no qualifying EMA20 + OB setup.",
        confirmedConditions: ema20EngineEvidence?.evidence ?? [],
        missingConditions: ema20EngineEvidence?.missingConditions ?? [],
        bos: 5, choch: 5, orderBlock: ema20Engine?.orderBlock ? 8 : 3, fvg: 5, liquiditySweep: 5, displacement: 5,
        pipeline: ema20EngineEvidence?.evidence ?? [],
        nextZone: ema20Engine?.orderBlock ? "Qualified EMA20 Order Block" : "Wait for a pre-existing displacement Order Block",
        invalidation: ema20EngineEvidence?.invalidation ?? "",
        entry: ema20Engine?.entry ?? null,
        stopLoss: ema20Engine?.stopLoss ?? null,
        tp1: ema20Engine?.target ?? null,
        tp2: ema20Engine?.target ?? null,
        finalTp: ema20Engine?.target ?? null,
        nextAction: ema20Engine?.reason ?? "WAIT",
        educationalNote: "EMA20 uses the Pine Script structure/pullback/rejection/confirmation sequence plus the mandatory pre-existing unmitigated Order Block qualification.",
      };
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
    const direction = strategyId === "ema20" ? engineDirection : strategyId === "srbOb" ? (srbObEngine?.direction ?? "NO TRADE") : strategyId === "lsobr" ? (lsobrEngine?.direction ?? "NO TRADE") : ai.direction as Direction;
    const entry = strategyId === "ema20" ? (ema20Engine?.state === "TRADE ACTIVE" ? ema20Engine.entry : null) : strategyId === "srbOb" ? (srbObEngine?.entry ?? null) : strategyId === "lsobr" ? (lsobrEngine?.entry ?? null) : (typeof ai.entry === "number" ? ai.entry : null);
    const stopLoss = strategyId === "ema20" ? (ema20Engine?.state === "TRADE ACTIVE" ? ema20Engine.stopLoss : null) : strategyId === "srbOb" ? (srbObEngine?.stopLoss ?? null) : strategyId === "lsobr" ? (lsobrEngine?.stopLoss ?? null) : (typeof ai.stopLoss === "number" ? ai.stopLoss : null);
    const finalTp = strategyId === "ema20" ? (ema20Engine?.state === "TRADE ACTIVE" ? ema20Engine.target : null) : strategyId === "srbOb" ? (srbObEngine?.finalTp ?? null) : strategyId === "lsobr" ? (lsobrEngine?.finalTp ?? null) : (typeof ai.finalTp === "number" ? ai.finalTp : typeof ai.tp2 === "number" ? ai.tp2 : null);
    const minimumRR = strategyId === "ema20" ? 1.81 : strategyId === "srbOb" ? 0.1 : 2;
    const math = tradeMath(direction, entry, stopLoss, finalTp, liveCurrentPrice, minimumRR, strategyId === "ema20" ? 0 : 0.1, strategyId === "ema20" ? Number.POSITIVE_INFINITY : 0.5);
    const strongSmc = [ai.bos, ai.choch, ai.orderBlock, ai.fvg, ai.liquiditySweep, ai.displacement].filter((x: unknown) => typeof x === "number" && x >= 7).length;
    const smcGate = strongSmc >= 2;
    const analyzerTradeGate = direction !== "NO TRADE" && math.valid && (strategyId === "ema20" || smcGate);
    const finalDirection: Direction = strategyId === "ema20" ? (analyzerTradeGate ? direction : "NO TRADE") : strategyId === "srbOb" ? (srbObEngine?.direction ?? "NO TRADE") : strategyId === "lsobr" ? (lsobrEngine?.state === "ENTRY READY" && analyzerTradeGate ? (lsobrEngine.direction as Direction) : "NO TRADE") : analyzerTradeGate && ai.decision === "TRADE" ? direction : "NO TRADE";

    const nativeEngineOutput = strategyId === "ema20" ? {
      state: ema20Engine?.state,
      signal: ema20Engine?.direction,
      newLong: ema20Bar?.newLong ?? false,
      newShort: ema20Bar?.newShort ?? false,
      entry,
      stopLoss,
      finalTp,
      riskReward: 1.81,
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
      orderBlock: ema20Engine?.orderBlock ?? null,
      entryTime: ema20Engine?.entryTime ?? null,
      entryDay: ema20Engine?.entryDay ?? null,
      lifecycleReason: ema20Engine?.reason ?? "",
      evidence: ema20EngineEvidence?.evidence ?? [],
      missingConditions: ema20EngineEvidence?.missingConditions ?? [],
      invalidation: ema20EngineEvidence?.invalidation ?? "",
    } : null;

    return Response.json({
      market: { type: marketType, asset: market.symbol, timeframe, currentPrice: liveCurrentPrice, directionalBias: ai.directionalBias, session: ai.session },
      strategy: { id: strategyId, name: profileStrategy.name, category: profileStrategy.category },
      sourceIndicators: profileStrategy.indicatorSpecs,
      indicatorReadings: context.selectedIndicators,
      chart: { candles: market.candles, channel20: channel, orderBlocks: visualOrderBlocks },
      liquidityTargets,
      structure: { ...lockedStructure }, volatility: context.volatility,
      strategyEngine: strategyId === "lsobr" ? lsobrEngineEvidence : strategyId === "srbOb" ? srbObEngineEvidence : strategyId === "fibRetracement" ? autoFibEngineEvidence : nativeEngineOutput,
      scanner: strategyId === "ema20" ? {
        projectedDirection: ema20Engine?.state === "TRADE ACTIVE" ? ema20Engine.direction : "NO TRADE",
        analysisState: ema20Engine?.state === "TRADE ACTIVE" ? "ACTIVE" : ema20Engine?.state === "SL HIT" ? "NO TRADE" : ema20Engine?.state === "TP HIT" ? "COMPLETED" : "WAITING",
        statusMessage: ema20Engine?.reason ?? "WAIT — awaiting a valid EMA20 + OB signal.",
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
        orderBlock: ema20Engine?.orderBlock ?? null,
      } : undefined,
      decision: finalDirection === "NO TRADE" ? "NO TRADE" : "TRADE", direction: finalDirection,
      confidence: finalDirection === "NO TRADE" ? Math.min(Number(ai.confidence) || 0, 69) : Number(ai.confidence) || 0,
      setup: ai.setup, marketCondition: ai.marketCondition, marketStructure: ai.marketStructure, recentPriceAction: ai.recentPriceAction,
      confirmedConditions: ai.confirmedConditions,
      missingConditions: [...(strategyId === "lsobr" ? [...(lsobrEngine?.missingConditions ?? []), ...(!analyzerTradeGate && lsobrEngine?.state === "ENTRY READY" ? ["Universal Analyzer Rules 1–6 did not validate the LSOBR entry."] : [])] : strategyId === "srbOb" ? (srbObEngine?.missingConditions ?? []) : ai.missingConditions), ...(strategyId === "ema20" && ema20Engine?.state === "WAITING" ? [ema20Engine.reason] : []), ...(strategyId !== "ema20" && strongSmc < 2 ? ["Analyzer SMC confluence gate: fewer than two SMC signals scored 7 or higher."] : []), ...(!math.valid && direction !== "NO TRADE" ? [math.rr !== null && math.rr < minimumRR ? `Strategy price validation: R:R is below the selected strategy minimum of 1:${minimumRR}.` : "Strategy price validation: entry/SL/TP geometry did not pass all applicable gates."] : [])],
      smcScores: { BOS: ai.bos, CHoCH: ai.choch, OrderBlock: ai.orderBlock, FVG: ai.fvg, LiquiditySweep: ai.liquiditySweep, Displacement: ai.displacement },
      pipeline: ai.pipeline, nextZone: ai.nextZone, invalidation: ai.invalidation,
      entry: strategyId === "lsobr" ? (lsobrEngine?.entry ?? null) : finalDirection === "NO TRADE" ? null : entry, stopLoss: strategyId === "lsobr" ? (lsobrEngine?.stopLoss ?? null) : finalDirection === "NO TRADE" ? null : stopLoss,
      tp1: strategyId === "lsobr" ? (lsobrEngine?.finalTp ?? null) : finalDirection === "NO TRADE" ? null : strategyId === "ema20" ? finalTp : ai.tp1, tp2: strategyId === "lsobr" ? null : finalDirection === "NO TRADE" ? null : strategyId === "ema20" ? finalTp : ai.tp2, finalTp: strategyId === "lsobr" ? (lsobrEngine?.finalTp ?? null) : finalDirection === "NO TRADE" ? null : finalTp,
      rr: strategyId === "lsobr" ? (lsobrEngine?.riskReward ?? null) : finalDirection === "NO TRADE" ? (srbObEngine?.riskReward ?? null) : math.rr, slDistancePct: finalDirection === "NO TRADE" ? null : math.slPct, entryDistancePct: finalDirection === "NO TRADE" ? null : math.entryDistancePct,
      nextAction: strategyId === "lsobr" ? (lsobrEngine?.missingConditions[0] ?? (lsobrEngine?.state === "ENTRY READY" ? "LSOBR sequence confirmed; verify universal Analyzer gates before treating it as a trade." : lsobrEngine?.state ?? "Wait for the next LSOBR condition.")) : strategyId === "srbOb" ? (srbObEngine?.missingConditions[0] ?? srbObEngine?.state ?? "Monitor the selected SRB window.") : ai.nextAction, educationalNote: strategyId === "lsobr" ? "LSOBR requires a liquidity sweep, fixed pre-existing OB rejection, MSS and a confirmed close out of the OB. No SRB opening-window rules are used." : strategyId === "srbOb" ? "SRB & OB uses its own deterministic session-range, Fibonacci pullback and opposing-order-block rules. Confirm the chart state before acting." : ai.educationalNote,
      qualityChecks: { smcStrongCount: strongSmc, rrValid: math.rr !== null && math.rr >= minimumRR, slDistanceValid: math.slPct === null || math.slPct >= (strategyId === "ema20" ? 0 : 0.1), entryDistanceValid: math.entryDistancePct === null || math.entryDistancePct <= (strategyId === "ema20" ? Number.POSITIVE_INFINITY : 0.5), universalTradeGate: analyzerTradeGate },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Live market analysis failed." }, { status: 500 });
  }
}

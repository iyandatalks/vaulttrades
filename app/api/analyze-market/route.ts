import { ANALYZER_STRATEGY_MAP } from "../../../lib/strategies/analyzerProfiles";
import { getStrategyRules, type StrategyId } from "../../../lib/strategies";
import { buildAnalyzerMarketContext } from "../../../lib/market-data/indicators";
import { getTwelveDataTimeSeries } from "../../../lib/market-data/twelvedata";
import { getMarketProviderRoute, type MarketType } from "../../../lib/market-data/provider";

export const runtime = "nodejs";

const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1H", "4H", "1D", "1W", "1M"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];
const MARKETS: MarketType[] = ["FOREX", "INDICES", "CRYPTO", "STOCKS", "SYNTHETIC"];
type Direction = "BUY" | "SELL" | "NO TRADE";

const validTimeframe = (value: unknown): value is Timeframe =>
  typeof value === "string" && TIMEFRAMES.includes(value as Timeframe);
const validMarket = (value: unknown): value is MarketType =>
  typeof value === "string" && MARKETS.includes(value as MarketType);
const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";

function calculateChannel(candles: Array<{ high: number; low: number; close: number }>, length = 20) {
  if (candles.length < length) return { upper: null, lower: null, middle: null };
  const k = 2 / (length + 1);
  let upper = candles.slice(0, length).reduce((s, c) => s + c.high, 0) / length;
  let lower = candles.slice(0, length).reduce((s, c) => s + c.low, 0) / length;
  for (let i = length; i < candles.length; i++) {
    upper = candles[i].high * k + upper * (1 - k);
    lower = candles[i].low * k + lower * (1 - k);
  }
  return { upper, lower, middle: (upper + lower) / 2 };
}

function tradeMath(direction: Direction, entry: number | null, stop: number | null, tp: number | null, current: number | null) {
  if (direction === "NO TRADE" || entry === null || stop === null || tp === null) {
    return { valid: false, rr: null, risk: null, reward: null, slPct: null, entryDistancePct: null };
  }
  const risk = direction === "BUY" ? entry - stop : stop - entry;
  const reward = direction === "BUY" ? tp - entry : entry - tp;
  const rr = risk > 0 ? reward / risk : null;
  const slPct = entry !== 0 ? Math.abs(entry - stop) / Math.abs(entry) * 100 : null;
  const entryDistancePct = current !== null && current !== 0 ? Math.abs(entry - current) / Math.abs(current) * 100 : null;
  return {
    valid: risk > 0 && reward > 0 && rr !== null && rr >= 2 && (slPct === null || slPct >= 0.1) && (entryDistancePct === null || entryDistancePct <= 0.5),
    rr, risk, reward, slPct, entryDistancePct,
  };
}

function jsonText(raw: any): string {
  return raw.output?.flatMap((x: any) => x.content ?? [])
    .filter((x: any) => x.type === "output_text")
    .map((x: any) => x.text)
    .join("")
    .trim() || "";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const marketType = validMarket(body.marketType) ? body.marketType : "FOREX";
    const timeframe = validTimeframe(body.timeframe) ? body.timeframe : "15m";
    const strategyId = clean(body.strategy);
    const symbol = clean(body.symbol).toUpperCase();

    const profile = ANALYZER_STRATEGY_MAP[strategyId];
    if (!profile) return Response.json({ error: "Invalid strategy selected." }, { status: 400 });
    if (!symbol) return Response.json({ error: "Select or enter a market symbol." }, { status: 400 });
    if (marketType === "SYNTHETIC") {
      return Response.json({ error: "Synthetic indices require the Synthetic/Broker provider connection. Twelve Data is not used for synthetic markets." }, { status: 400 });
    }

    const providerRoute = getMarketProviderRoute(marketType);
    if (!providerRoute.available) return Response.json({ error: providerRoute.reason || "Market data is unavailable." }, { status: 503 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return Response.json({ error: "OpenAI API key is not configured." }, { status: 500 });

    const market = await getTwelveDataTimeSeries({ symbol, timeframe, outputsize: 250 });
    if (market.candles.length < 40) return Response.json({ error: "Not enough live market history was returned for this symbol/timeframe." }, { status: 422 });

    const selectedIndicators = profile.defaultIndicators;
    const context = buildAnalyzerMarketContext(market.candles, market.symbol, timeframe, selectedIndicators);
    const channel = calculateChannel(market.candles);
    const latest = market.candles.at(-1)!;
    const previous = market.candles.at(-2)!;

    const sourceRules = profile.sourceIds.map((id: StrategyId) => getStrategyRules(id));
    const indicatorEvidence = context.selectedIndicators.map((i) => ({ name: i.name, value: i.value, signal: i.signal, parameters: profile.indicatorSpecs.find(s => s.name === i.name)?.parameters ?? "source-defined" }));

    const prompt = `You are the VaultTrades educational market analyzer. Analyze REAL OHLCV data, not a screenshot and not invented prices.

USER SELECTION
Market: ${marketType}
Symbol: ${market.symbol}
Timeframe: ${timeframe}
Strategy: ${profile.name} (${strategyId})

SOURCE-OF-TRUTH STRATEGY RULES
${JSON.stringify(sourceRules)}

STRATEGY PROFILE
${JSON.stringify({ focus: profile.focus, rules: profile.rules, indicatorSpecs: profile.indicatorSpecs })}

LIVE CALCULATED MARKET CONTEXT
${JSON.stringify({
  currentPrice: context.currentPrice,
  structure: context.structure,
  volatility: context.volatility,
  selectedIndicators: indicatorEvidence,
  channel20High: channel.upper,
  channel20Low: channel.lower,
  latestCandle: latest,
  previousCandle: previous,
  recentCandles: market.candles.slice(-60),
})}

UNIVERSAL ANALYZER RULES 1-6 — MANDATORY FOR EVERY STRATEGY
1. Visual/market analysis: classify Uptrend, Downtrend, Ranging or Choppy; identify concrete support/resistance and recent price action. More than 5 consecutive inside bars OR material conflict across 3+ selected/derived timeframes = NO TRADE.
2. SMC: score BOS, CHoCH, Order Block, FVG, Liquidity Sweep and Displacement 1-10 only from evidence. A NEW BUY/SELL requires at least TWO scores >=7. Do not manufacture SMC scores just to satisfy the gate.
3. Session/confluence: identify London, New York or Asian from candle timestamps; explain higher-timeframe alignment if data is available; do not invent news. Asian requires >=9/10 AND a major news event. London/NY overlap is preferred.
4. Price validation: entry <=0.5% from current price; SL >=0.1% from entry; TP >=2x SL distance; R:R must be mathematically >=1:2. Max account risk 1.5%; if equity is not supplied, sizing is unverified.
5. Confidence: 90-100 exceptional, 80-89 strong, 70-79 decent, 60-69 marginal, 50-59 weak, 30-49 poor, 10-29 very poor. Confidence must match evidence.
6. Quality check: re-check R:R, SL/TP geometry, entry proximity, risk, SMC gate and lifecycle state. Communicate useful next zones/levels instead of generic filler.

CRITICAL STRATEGY RULE
The selected strategy is primary. Auto indicators MUST be the source indicators in the selected strategy profile, with their source parameters. Never add generic EMA/ATR/ADX/RVOL/VWAP merely because they are common technical indicators. Structural concepts are separate evidence, not automatic indicator substitutions.

CRITICAL LIFECYCLE RULE
DEVELOPING, READY, WATCHING and ACTIVE are not the same as a NEW BUY/SELL. Only return BUY/SELL when the source strategy state and Universal Rules 1-6 all pass. If not, return NO TRADE and explain exactly what is missing.

EDUCATIONAL COMMUNICATION
The user should learn from the result. Include concrete support/resistance and likely next zones if price breaks and closes beyond a level. Avoid repeating market/provider information. Do not reveal the data provider to the user.

Return JSON only.`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
        max_output_tokens: 6000,
        text: { format: { type: "json_schema", name: "vaulttrades_live_market_analysis", strict: true, schema: {
          type: "object", additionalProperties: false,
          properties: {
            direction: { type: "string", enum: ["BUY", "SELL", "NO TRADE"] },
            decision: { type: "string", enum: ["TRADE", "NO TRADE"] },
            confidence: { type: "number", minimum: 0, maximum: 100 },
            marketCondition: { type: "string" },
            directionalBias: { type: "string" },
            session: { type: "string" },
            higherTimeframe: { type: "string" },
            marketStructure: { type: "string" },
            support: { type: ["number", "null"] },
            resistance: { type: ["number", "null"] },
            recentPriceAction: { type: "string" },
            setup: { type: "string" },
            confirmedConditions: { type: "array", items: { type: "string" } },
            missingConditions: { type: "array", items: { type: "string" } },
            bos: { type: "number", minimum: 1, maximum: 10 },
            choch: { type: "number", minimum: 1, maximum: 10 },
            orderBlock: { type: "number", minimum: 1, maximum: 10 },
            fvg: { type: "number", minimum: 1, maximum: 10 },
            liquiditySweep: { type: "number", minimum: 1, maximum: 10 },
            displacement: { type: "number", minimum: 1, maximum: 10 },
            pipeline: { type: "array", items: { type: "string" } },
            nextZone: { type: "string" },
            invalidation: { type: "string" },
            entry: { type: ["number", "null"] },
            stopLoss: { type: ["number", "null"] },
            tp1: { type: ["number", "null"] },
            tp2: { type: ["number", "null"] },
            finalTp: { type: ["number", "null"] },
            nextAction: { type: "string" },
            educationalNote: { type: "string" }
          },
          required: ["direction","decision","confidence","marketCondition","directionalBias","session","higherTimeframe","marketStructure","support","resistance","recentPriceAction","setup","confirmedConditions","missingConditions","bos","choch","orderBlock","fvg","liquiditySweep","displacement","pipeline","nextZone","invalidation","entry","stopLoss","tp1","tp2","finalTp","nextAction","educationalNote"]
        } } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return Response.json({ error: `Analyzer model request failed: ${errorText.slice(0, 300)}` }, { status: 502 });
    }

    const raw = await response.json();
    const text = jsonText(raw);
    if (!text) return Response.json({ error: "The analyzer returned no structured result." }, { status: 502 });
    const ai = JSON.parse(text);

    const direction = ai.direction as Direction;
    const entry = typeof ai.entry === "number" ? ai.entry : null;
    const stopLoss = typeof ai.stopLoss === "number" ? ai.stopLoss : null;
    const finalTp = typeof ai.finalTp === "number" ? ai.finalTp : typeof ai.tp2 === "number" ? ai.tp2 : null;
    const math = tradeMath(direction, entry, stopLoss, finalTp, context.currentPrice);

    const strongSmc = [ai.bos, ai.choch, ai.orderBlock, ai.fvg, ai.liquiditySweep, ai.displacement].filter((x: unknown) => typeof x === "number" && x >= 7).length;
    const universalTradeGate = direction !== "NO TRADE" && strongSmc >= 2 && math.valid;
    const finalDirection: Direction = universalTradeGate && ai.decision === "TRADE" ? direction : "NO TRADE";

    return Response.json({
      market: { type: marketType, asset: market.symbol, timeframe, currentPrice: context.currentPrice, directionalBias: ai.directionalBias, session: ai.session },
      strategy: { id: strategyId, name: profile.name, category: profile.category },
      sourceIndicators: profile.indicatorSpecs,
      indicatorReadings: context.selectedIndicators,
      chart: { candles: market.candles, channel20: channel },
      structure: { ...context.structure, support: ai.support ?? context.structure.support, resistance: ai.resistance ?? context.structure.resistance },
      volatility: context.volatility,
      decision: finalDirection === "NO TRADE" ? "NO TRADE" : "TRADE",
      direction: finalDirection,
      confidence: finalDirection === "NO TRADE" ? Math.min(Number(ai.confidence) || 0, 69) : Number(ai.confidence) || 0,
      setup: ai.setup,
      marketCondition: ai.marketCondition,
      marketStructure: ai.marketStructure,
      recentPriceAction: ai.recentPriceAction,
      confirmedConditions: ai.confirmedConditions,
      missingConditions: [
        ...ai.missingConditions,
        ...(strongSmc < 2 ? ["Universal SMC gate: fewer than two SMC signals scored 7 or higher."] : []),
        ...(!math.valid && direction !== "NO TRADE" ? [math.rr !== null && math.rr < 2 ? "Universal price validation: R:R is below 1:2." : "Universal price validation: entry/SL/TP geometry did not pass all gates."] : []),
      ],
      smcScores: { BOS: ai.bos, CHoCH: ai.choch, OrderBlock: ai.orderBlock, FVG: ai.fvg, LiquiditySweep: ai.liquiditySweep, Displacement: ai.displacement },
      pipeline: ai.pipeline,
      nextZone: ai.nextZone,
      invalidation: ai.invalidation,
      entry: finalDirection === "NO TRADE" ? null : entry,
      stopLoss: finalDirection === "NO TRADE" ? null : stopLoss,
      tp1: finalDirection === "NO TRADE" ? null : ai.tp1,
      tp2: finalDirection === "NO TRADE" ? null : ai.tp2,
      finalTp: finalDirection === "NO TRADE" ? null : finalTp,
      rr: finalDirection === "NO TRADE" ? null : math.rr,
      slDistancePct: finalDirection === "NO TRADE" ? null : math.slPct,
      entryDistancePct: finalDirection === "NO TRADE" ? null : math.entryDistancePct,
      nextAction: ai.nextAction,
      educationalNote: ai.educationalNote,
      qualityChecks: { smcStrongCount: strongSmc, rrValid: math.rr !== null && math.rr >= 2, slDistanceValid: math.slPct === null || math.slPct >= 0.1, entryDistanceValid: math.entryDistancePct === null || math.entryDistancePct <= 0.5, universalTradeGate }
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Live market analysis failed." }, { status: 500 });
  }
}

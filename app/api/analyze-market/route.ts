import { ANALYZER_STRATEGY_MAP } from "../../../lib/strategies/analyzerProfiles";
import { getStrategyRules, type StrategyId } from "../../../lib/strategies";
import { buildAnalyzerMarketContext } from "../../../lib/market-data/indicators";
import { getTwelveDataTimeSeries } from "../../../lib/market-data/twelvedata";
import { getMarketProviderRoute, type MarketType } from "../../../lib/market-data/provider";
import { evaluateEma20 } from "../../../lib/strategies/ema20Engine";

export const runtime = "nodejs";

const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1H", "4H", "1D", "1W", "1M"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];
const MARKETS: MarketType[] = ["FOREX", "INDICES", "CRYPTO", "STOCKS", "SYNTHETIC"];
type Direction = "BUY" | "SELL" | "NO TRADE";

const validTimeframe = (value: unknown): value is Timeframe => typeof value === "string" && TIMEFRAMES.includes(value as Timeframe);
const validMarket = (value: unknown): value is MarketType => typeof value === "string" && MARKETS.includes(value as MarketType);
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

function tradeMath(direction: Direction, entry: number | null, stop: number | null, tp: number | null, current: number | null, minimumRR = 2) {
  if (direction === "NO TRADE" || entry === null || stop === null || tp === null) return { valid: false, rr: null, risk: null, reward: null, slPct: null, entryDistancePct: null };
  const risk = direction === "BUY" ? entry - stop : stop - entry;
  const reward = direction === "BUY" ? tp - entry : entry - tp;
  const rr = risk > 0 ? reward / risk : null;
  const slPct = entry !== 0 ? Math.abs(entry - stop) / Math.abs(entry) * 100 : null;
  const entryDistancePct = current !== null && current !== 0 ? Math.abs(entry - current) / Math.abs(current) * 100 : null;
  return { valid: risk > 0 && reward > 0 && rr !== null && rr >= minimumRR && (slPct === null || slPct >= 0.1) && (entryDistancePct === null || entryDistancePct <= 0.5), rr, risk, reward, slPct, entryDistancePct };
}

function jsonText(raw: any): string {
  return raw.output?.flatMap((x: any) => x.content ?? []).filter((x: any) => x.type === "output_text").map((x: any) => x.text).join("").trim() || "";
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
    if (marketType === "SYNTHETIC") return Response.json({ error: "Synthetic indices require the Synthetic/Broker provider connection." }, { status: 400 });
    const providerRoute = getMarketProviderRoute(marketType);
    if (!providerRoute.available) return Response.json({ error: providerRoute.reason || "Market data is unavailable." }, { status: 503 });
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return Response.json({ error: "OpenAI API key is not configured." }, { status: 500 });

    const market = await getTwelveDataTimeSeries({ symbol, timeframe, outputsize: 250 });
    if (market.candles.length < 40) return Response.json({ error: "Not enough live market history was returned for this symbol/timeframe." }, { status: 422 });

    const selectedIndicators = profile.defaultIndicators;
    const context = buildAnalyzerMarketContext(market.candles, market.symbol, timeframe, selectedIndicators);
    const liveCurrentPrice = market.currentPrice ?? market.candles.at(-1)?.close ?? null;
    const latest = market.candles.at(-1)!;
    const previous = market.candles.at(-2)!;
    const channel = calculateChannel(market.candles);
    const priceLevels = derivePriceLevels(market.candles, liveCurrentPrice, 3);
    const lockedStructure = { ...context.structure, support: priceLevels.support, resistance: priceLevels.resistance };
    const sourceRules = profile.sourceIds.map((id: StrategyId) => getStrategyRules(id));
    const indicatorEvidence = context.selectedIndicators.map(i => ({ name: i.name, value: i.value, signal: i.signal, parameters: profile.indicatorSpecs.find(s => s.name === i.name)?.parameters ?? "source-defined" }));

    // EMA20 is the first live strategy wired to a deterministic Pine-equivalent engine.
    // The engine is authoritative for strategy state and native Entry/SL/TP. The Analyzer is downstream.
    const ema20Engine = strategyId === "ema20" ? evaluateEma20(market.candles) : null;
    const ema20EngineEvidence = ema20Engine ? {
      source: "PINE_SCRIPT",
      state: ema20Engine.newLong ? "NEW_LONG" : ema20Engine.newShort ? "NEW_SHORT" : ema20Engine.longSignal ? "LONG_ACTIVE" : ema20Engine.shortSignal ? "SHORT_ACTIVE" : ema20Engine.bullActive ? "BULL_REJECTION_ACTIVE" : ema20Engine.bearActive ? "BEAR_REJECTION_ACTIVE" : "WAITING",
      bullStructure: ema20Engine.bullStructure,
      bearStructure: ema20Engine.bearStructure,
      bullTouch: ema20Engine.bullTouch,
      bearTouch: ema20Engine.bearTouch,
      bullReject: ema20Engine.bullReject,
      bearReject: ema20Engine.bearReject,
      bullActive: ema20Engine.bullActive,
      bearActive: ema20Engine.bearActive,
      bullMABreak: ema20Engine.bullMABreak,
      bearMABreak: ema20Engine.bearMABreak,
      utBull: ema20Engine.utBull,
      utBear: ema20Engine.utBear,
      smiBull: ema20Engine.smiBull,
      smiBear: ema20Engine.smiBear,
      longConfirmationScore: ema20Engine.longConfirmationScore,
      shortConfirmationScore: ema20Engine.shortConfirmationScore,
      longSignal: ema20Engine.longSignal,
      shortSignal: ema20Engine.shortSignal,
      newLong: ema20Engine.newLong,
      newShort: ema20Engine.newShort,
      longEntry: ema20Engine.longEntry,
      longSL: ema20Engine.longSL,
      longTP: ema20Engine.longTP,
      shortEntry: ema20Engine.shortEntry,
      shortSL: ema20Engine.shortSL,
      shortTP: ema20Engine.shortTP,
      atr: ema20Engine.atr,
      atrSLMultiplier: 2.23,
      riskReward: 1.81,
      bias0600: ema20Engine.bias0600,
      latestCandle: ema20Engine.datetime,
    } : null;

    const prompt = `You are the VaultTrades educational market analyzer. Analyze REAL LIVE OHLCV data, not a screenshot and not invented prices.

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
${JSON.stringify({ currentPrice: liveCurrentPrice, structure: lockedStructure, volatility: context.volatility, selectedIndicators: indicatorEvidence, channel20High: channel.upper, channel20Low: channel.lower, latestCandle: latest, previousCandle: previous, recentCandles: market.candles.slice(-60) })}

DETERMINISTIC STRATEGY ENGINE STATE
${JSON.stringify(ema20EngineEvidence)}

IMPORTANT ENGINE AUTHORITY
If the selected strategy is EMA20, the deterministic Pine-equivalent EMA20 engine above is authoritative for EMA20 lifecycle state, signal transition, entry, stop loss and target. Do not invent, move, replace or recalculate those values. In particular, EMA20 uses ATR(14) x 2.23 for native SL and exactly 1:1.81 RR. A NEW_LONG/NEW_SHORT is the source strategy trigger. If the engine has no new signal, do not manufacture a BUY or SELL from generic indicators.

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
    const ai = JSON.parse(text);

    const engineDirection: Direction = ema20Engine?.newLong ? "BUY" : ema20Engine?.newShort ? "SELL" : "NO TRADE";
    const direction = strategyId === "ema20" ? engineDirection : ai.direction as Direction;
    const entry = strategyId === "ema20" ? (ema20Engine?.newLong ? ema20Engine.longEntry : ema20Engine?.newShort ? ema20Engine.shortEntry : null) : (typeof ai.entry === "number" ? ai.entry : null);
    const stopLoss = strategyId === "ema20" ? (ema20Engine?.newLong ? ema20Engine.longSL : ema20Engine?.newShort ? ema20Engine.shortSL : null) : (typeof ai.stopLoss === "number" ? ai.stopLoss : null);
    const finalTp = strategyId === "ema20" ? (ema20Engine?.newLong ? ema20Engine.longTP : ema20Engine?.newShort ? ema20Engine.shortTP : null) : (typeof ai.finalTp === "number" ? ai.finalTp : typeof ai.tp2 === "number" ? ai.tp2 : null);
    const minimumRR = strategyId === "ema20" ? 1.81 : 2;
    const math = tradeMath(direction, entry, stopLoss, finalTp, liveCurrentPrice, minimumRR);
    const strongSmc = [ai.bos, ai.choch, ai.orderBlock, ai.fvg, ai.liquiditySweep, ai.displacement].filter((x: unknown) => typeof x === "number" && x >= 7).length;
    const smcGate = strongSmc >= 2;
    const analyzerTradeGate = direction !== "NO TRADE" && math.valid && (strategyId === "ema20" ? smcGate : smcGate);
    const finalDirection: Direction = analyzerTradeGate && ai.decision === "TRADE" ? direction : "NO TRADE";

    const nativeEngineOutput = strategyId === "ema20" ? {
      state: ema20EngineEvidence?.state,
      signal: engineDirection,
      newLong: ema20Engine?.newLong ?? false,
      newShort: ema20Engine?.newShort ?? false,
      entry,
      stopLoss,
      finalTp,
      riskReward: math.rr,
      confirmation: { long: ema20Engine?.longConfirmationScore ?? 0, short: ema20Engine?.shortConfirmationScore ?? 0 },
    } : null;

    return Response.json({
      market: { type: marketType, asset: market.symbol, timeframe, currentPrice: liveCurrentPrice, directionalBias: ai.directionalBias, session: ai.session },
      strategy: { id: strategyId, name: profile.name, category: profile.category },
      sourceIndicators: profile.indicatorSpecs,
      indicatorReadings: context.selectedIndicators,
      chart: { candles: market.candles, channel20: channel },
      structure: { ...lockedStructure }, volatility: context.volatility,
      strategyEngine: nativeEngineOutput,
      decision: finalDirection === "NO TRADE" ? "NO TRADE" : "TRADE", direction: finalDirection,
      confidence: finalDirection === "NO TRADE" ? Math.min(Number(ai.confidence) || 0, 69) : Number(ai.confidence) || 0,
      setup: ai.setup, marketCondition: ai.marketCondition, marketStructure: ai.marketStructure, recentPriceAction: ai.recentPriceAction,
      confirmedConditions: ai.confirmedConditions,
      missingConditions: [...ai.missingConditions, ...(strategyId === "ema20" && !ema20Engine?.newLong && !ema20Engine?.newShort ? ["EMA20 Pine-equivalent engine: no newLong/newShort transition on the latest live candle."] : []), ...(strongSmc < 2 ? ["Analyzer SMC confluence gate: fewer than two SMC signals scored 7 or higher."] : []), ...(!math.valid && direction !== "NO TRADE" ? [math.rr !== null && math.rr < minimumRR ? `Strategy price validation: R:R is below the selected strategy minimum of 1:${minimumRR}.` : "Strategy price validation: entry/SL/TP geometry did not pass all applicable gates."] : [])],
      smcScores: { BOS: ai.bos, CHoCH: ai.choch, OrderBlock: ai.orderBlock, FVG: ai.fvg, LiquiditySweep: ai.liquiditySweep, Displacement: ai.displacement },
      pipeline: ai.pipeline, nextZone: ai.nextZone, invalidation: ai.invalidation,
      entry: finalDirection === "NO TRADE" ? null : entry, stopLoss: finalDirection === "NO TRADE" ? null : stopLoss,
      tp1: finalDirection === "NO TRADE" ? null : strategyId === "ema20" ? finalTp : ai.tp1, tp2: finalDirection === "NO TRADE" ? null : strategyId === "ema20" ? finalTp : ai.tp2, finalTp: finalDirection === "NO TRADE" ? null : finalTp,
      rr: finalDirection === "NO TRADE" ? null : math.rr, slDistancePct: finalDirection === "NO TRADE" ? null : math.slPct, entryDistancePct: finalDirection === "NO TRADE" ? null : math.entryDistancePct,
      nextAction: ai.nextAction, educationalNote: ai.educationalNote,
      qualityChecks: { smcStrongCount: strongSmc, rrValid: math.rr !== null && math.rr >= minimumRR, slDistanceValid: math.slPct === null || math.slPct >= 0.1, entryDistanceValid: math.entryDistancePct === null || math.entryDistancePct <= 0.5, universalTradeGate: analyzerTradeGate },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Live market analysis failed." }, { status: 500 });
  }
}

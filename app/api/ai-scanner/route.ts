import { ANALYZER_STRATEGY_MAP } from "../../../lib/strategies/analyzerProfiles";
import { getStrategyRules, type StrategyId } from "../../../lib/strategies";
import { analyzeAutoFibRetrace } from "../../../lib/strategies/autoFibRetrace";
import { evaluateTradeLifecycle, selectAllowedAbFibLevel } from "../../../lib/strategies/tradeLifecycle";
import { getTwelveDataTimeSeries } from "../../../lib/market-data/twelvedata";

export const runtime = "nodejs";
type Direction = "BUY" | "SELL" | "NO TRADE";
type EvidenceDirection = "BUY" | "SELL" | "NEUTRAL";
type MtfSnapshot = { timeframe: "M15" | "M5"; currentPrice: number | null; direction: EvidenceDirection; state: "CONFIRMATION" | "EXECUTION" | "NEUTRAL"; cycle: "BULLISH" | "BEARISH" | "NEUTRAL"; support: number | null; resistance: number | null; structureReason: string };
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const clean = (v: unknown) => typeof v === "string" ? v.trim() : "";
function atr(c: Array<{ high: number; low: number; close: number }>, n = 14): number | null {
  if (c.length < n + 1) return null;
  const tr: number[] = [];
  for (let i = 0; i < c.length; i++) {
    if (i === 0) tr.push(c[i].high - c[i].low);
    else { const p = c[i - 1], x = c[i]; tr.push(Math.max(x.high - x.low, Math.abs(x.high - p.close), Math.abs(x.low - p.close))); }
  }
  let a = tr.slice(0, n).reduce((x, y) => x + y, 0) / n;
  for (let i = n; i < tr.length; i++) a = (a * (n - 1) + tr[i]) / n;
  return a;
}
function volumeProfile(c: Array<{ open: number; high: number; low: number; close: number; volume: number | null }>) {
  const v = c.map(x => x.volume).filter((x): x is number => finite(x));
  if (v.length < 21) return { currentVolume: null, averageVolume: null, ratio: null, expansion: false, candleDirection: "NEUTRAL", displacementATR: null };
  const currentVolume = v.at(-1)!;
  const base = v.slice(-21, -1);
  const averageVolume = base.reduce((a, b) => a + b, 0) / base.length;
  const ratio = averageVolume > 0 ? currentVolume / averageVolume : null;
  const last = c.at(-1)!;
  const a = atr(c);
  return { currentVolume, averageVolume, ratio, expansion: ratio !== null && ratio >= 1.5, candleDirection: last.close > last.open ? "BULLISH" : last.close < last.open ? "BEARISH" : "NEUTRAL", displacementATR: a && a > 0 ? (last.high - last.low) / a : null };
}
function inferMtfSnapshot(timeframe: "M15" | "M5", c: Array<{ open: number; high: number; low: number; close: number }>): MtfSnapshot {
  const r = c.slice(-20), currentPrice = r.at(-1)?.close ?? null;
  if (!currentPrice || r.length < 5) return { timeframe, currentPrice, direction: "NEUTRAL", state: timeframe === "M15" ? "CONFIRMATION" : "EXECUTION", cycle: "NEUTRAL", support: null, resistance: null, structureReason: "Insufficient independent timeframe evidence." };
  const highs = r.slice(0, -1).map(x => x.high), lows = r.slice(0, -1).map(x => x.low);
  const support = lows.filter(x => x < currentPrice).sort((a, b) => b - a)[0] ?? null;
  const resistance = highs.filter(x => x > currentPrice).sort((a, b) => a - b)[0] ?? null;
  const first = r[0].close, last = r.at(-1)!;
  const span = Math.max(...r.map(x => x.high)) - Math.min(...r.map(x => x.low));
  const directionalMove = span > 0 ? (last.close - first) / span : 0;
  const bullish = last.close > first && last.close >= last.open;
  const bearish = last.close < first && last.close <= last.open;
  const direction: EvidenceDirection = bullish ? "BUY" : bearish ? "SELL" : "NEUTRAL";
  return { timeframe, currentPrice, direction, state: timeframe === "M15" ? "CONFIRMATION" : "EXECUTION", cycle: direction === "BUY" ? "BULLISH" : direction === "SELL" ? "BEARISH" : "NEUTRAL", support, resistance, structureReason: direction === "BUY" ? `Independent ${timeframe} bullish structure; directional move ${(directionalMove * 100).toFixed(1)}%.` : direction === "SELL" ? `Independent ${timeframe} bearish structure; directional move ${(directionalMove * 100).toFixed(1)}%.` : `Independent ${timeframe} structure is mixed/neutral.` };
}
function math(direction: Direction, entry: number | null, stop: number | null, target: number | null, current: number | null) {
  if (direction === "NO TRADE" || !finite(entry) || !finite(stop) || !finite(target)) return { rr: null, valid: false, risk: null, reward: null, entryDistancePct: null, slDistancePct: null };
  const risk = direction === "BUY" ? entry - stop : stop - entry;
  const reward = direction === "BUY" ? target - entry : entry - target;
  const rr = risk > 0 ? reward / risk : null;
  const entryDistancePct = current && current !== 0 ? Math.abs(entry - current) / Math.abs(current) * 100 : null;
  const slDistancePct = entry !== 0 ? Math.abs(entry - stop) / Math.abs(entry) * 100 : null;
  return { rr, risk, reward, entryDistancePct, slDistancePct, valid: risk > 0 && reward > 0 && rr !== null && rr >= 2 && (slDistancePct === null || slDistancePct >= 0.1) };
}
function jsonText(raw: any): string { return raw.output?.flatMap((x: any) => x.content ?? []).filter((x: any) => x.type === "output_text").map((x: any) => x.text).join("").trim() || ""; }
function structuralProjection(direction: Direction, current: number, support: number | null, resistance: number | null, volatility: number | null) {
  const a = volatility && volatility > 0 ? volatility : Math.max(Math.abs(current) * 0.002, 0.01);
  if (direction === "BUY" && finite(support)) {
    const entry = support;
    const stop = support - a;
    const upper = finite(resistance) && resistance > entry ? resistance : entry + 2 * a;
    const tp1 = entry + (upper - entry) * 0.5;
    const tp2 = upper;
    const tp3 = upper + a;
    const tp4 = upper + 2 * a;
    return { entry, stop, tp1, tp2, tp3, tp4, reason: "BUY projection anchored to visible support; targets map the next visible resistance/liquidity path." };
  }
  if (direction === "SELL" && finite(resistance)) {
    const entry = resistance;
    const stop = resistance + a;
    const lower = finite(support) && support < entry ? support : entry - 2 * a;
    const tp1 = entry - (entry - lower) * 0.5;
    const tp2 = lower;
    const tp3 = lower - a;
    const tp4 = lower - 2 * a;
    return { entry, stop, tp1, tp2, tp3, tp4, reason: "SELL projection anchored to visible resistance; targets map the next visible support/liquidity path." };
  }
  if (direction === "BUY") {
    const entry = current;
    return { entry, stop: entry - a, tp1: entry + a, tp2: entry + 2 * a, tp3: entry + 3 * a, tp4: entry + 4 * a, reason: "BUY projection anchored to current structural context because no reliable support level was supplied." };
  }
  if (direction === "SELL") {
    const entry = current;
    return { entry, stop: entry + a, tp1: entry - a, tp2: entry - 2 * a, tp3: entry - 3 * a, tp4: entry - 4 * a, reason: "SELL projection anchored to current structural context because no reliable resistance level was supplied." };
  }
  return null;
}
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const strategyId = clean(body.strategy);
    const profile = ANALYZER_STRATEGY_MAP[strategyId];
    const candles = Array.isArray(body.candles) ? body.candles.filter((c: any) => finite(c?.open) && finite(c?.high) && finite(c?.low) && finite(c?.close)) : [];
    const currentPrice = finite(body.currentPrice) ? body.currentPrice : candles.at(-1)?.close ?? null;
    if (!profile) return Response.json({ error: "Invalid strategy selected." }, { status: 400 });
    if (candles.length < 30 || !finite(currentPrice)) return Response.json({ error: "Not enough chart data for AI Scanner." }, { status: 422 });
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return Response.json({ error: "OpenAI API key is not configured." }, { status: 500 });
    const prior = body.analysis ?? {};
    const lifecycleInput = body.lifecycle ?? {};
    const volume = volumeProfile(candles);
    const sourceRules = profile.sourceIds.map((id: StrategyId) => getStrategyRules(id));
    const selectedTimeframe = clean(prior?.market?.timeframe).toUpperCase();
    const mtfEnabled = ["30M", "1H", "4H", "1D", "1W", "1M"].includes(selectedTimeframe);
    let mtfEvidence: { enabled: boolean; htfTimeframe: string; m15: MtfSnapshot | null; m5: MtfSnapshot | null; relationship: string } = { enabled: false, htfTimeframe: selectedTimeframe || "UNKNOWN", m15: null, m5: null, relationship: "MTF hierarchy is inactive below M30." };
    if (mtfEnabled) {
      const symbol = clean(prior?.market?.asset);
      if (symbol) {
        const [m15Market, m5Market] = await Promise.all([
          getTwelveDataTimeSeries({ symbol, timeframe: "15m", outputsize: 80 }),
          getTwelveDataTimeSeries({ symbol, timeframe: "5m", outputsize: 80 })
        ]);
        const m15 = inferMtfSnapshot("M15", m15Market.candles);
        const m5 = inferMtfSnapshot("M5", m5Market.candles);
        const htfDirection: Direction = prior?.projectedDirection === "BUY" || prior?.direction === "BUY" ? "BUY" : prior?.projectedDirection === "SELL" || prior?.direction === "SELL" ? "SELL" : "NO TRADE";
        mtfEvidence = { enabled: true, htfTimeframe: selectedTimeframe, m15, m5, relationship: htfDirection !== "NO TRADE" && m15.direction === htfDirection && m5.direction === htfDirection ? "M15 confirmation and M5 execution evidence align with the HTF direction." : htfDirection !== "NO TRADE" && (m15.direction === htfDirection || m5.direction === htfDirection) ? "One lower timeframe aligns with the HTF direction; the other is not fully aligned." : "Lower timeframe evidence does not currently align with the HTF direction." };
      }
    }
    const sourceFib = strategyId === "fibRetracement" ? analyzeAutoFibRetrace({ candles: candles.map((c: any, i: number) => ({ time: typeof c.time === "number" ? c.time : Date.parse(c.datetime ?? "") || i, open: c.open, high: c.high, low: c.low, close: c.close, volume: finite(c.volume) ? c.volume : undefined })) }) : null;
    const fibBuyLevel = sourceFib ? selectAllowedAbFibLevel(sourceFib.buy.fibLevels, "BUY", currentPrice) : null;
    const fibSellLevel = sourceFib ? selectAllowedAbFibLevel(sourceFib.sell.fibLevels, "SELL", currentPrice) : null;
    const sourceFibContext = sourceFib ? { state: sourceFib.state, confidence: sourceFib.confidence, buy: { ready: sourceFib.buy.ready, flipActive: sourceFib.buy.flipActive, fibLevels: sourceFib.buy.fibLevels.filter(x => [82, 78.6, 68.1, 61.8].includes(x.pct)), tp1: sourceFib.buy.tp1, tp2: sourceFib.buy.tp2, tp3: sourceFib.buy.tp3, tp4: sourceFib.buy.tp4 }, sell: { ready: sourceFib.sell.ready, flipActive: sourceFib.sell.flipActive, fibLevels: sourceFib.sell.fibLevels.filter(x => [82, 78.6, 68.1, 61.8].includes(x.pct)), tp1: sourceFib.sell.tp1, tp2: sourceFib.sell.tp2, tp3: sourceFib.sell.tp3, tp4: sourceFib.sell.tp4 }, projection: sourceFib.projection, orderBlocks: sourceFib.orderBlocks, confluence: { buy: sourceFib.buyConfluence, sell: sourceFib.sellConfluence } } : null;
    const prompt = `You are the VaultTrades AI Scanner. The selected strategy/analyzer is the source of truth. Do not invent or replace its price levels.\n\nPROJECTION IS REQUIRED BEFORE CONFIRMATION\nA probability assessment is not the same thing as a confirmed trade. When the visible market evidence supports a directional lean, the scanner MUST produce a planning projection even when the validation section says NO TRADE / WAIT. Use the visible support/resistance/structure and the selected strategy's logic to identify the most logical projected entry zone and the path to TP/SL. The projection is not an execution instruction.\n\nPROBABILITY MODEL\nEvaluate BUY probability and SELL probability independently from the visible evidence. They may be, for example, 40/100 BUY and 60/100 SELL. The higher probability determines the projected direction, but confirmation still depends on the strategy's required conditions. Probability must reflect currently confirmed/visible evidence, not certainty.\n\nHTF PROJECTED ENTRY LIFECYCLE — MANDATORY\nFor M30 and higher, a valid developing HTF setup must expose its strategy-derived projected Entry, projected Stop Loss and projected TP1, TP2, TP3 and TP4/Final TP before confirmation. These are planning levels and must NOT require M15 or M5 confirmation. Never replace a source projection with current price when a source projection exists.\n\nCONFIRMED ENTRY LIFECYCLE — MANDATORY\nActual/Confirmed Entry is separate from Projected Entry. It is established only when the existing HTF analyzer confirms the setup. Once established, it is fixed for that cycle. If the user runs analysis after confirmation and missed the moment, report BUY/SELL ACTIVE, show the fixed Actual Entry, and preserve the original projected levels.\n\nMTF HIERARCHY\nFor M30+: M15 = stronger confirmation evidence; M5 = execution confirmation evidence. M15/M5 affect probability/evidence only and never rewrite HTF Entry, SL or TP. Lower timeframe cycles are independent.\n\nSELECTED STRATEGY\n${JSON.stringify({ id: strategyId, name: profile.name, focus: profile.focus, rules: profile.rules, indicatorSpecs: profile.indicatorSpecs, sourceRules })}\nEXISTING ANALYZER RESULT\n${JSON.stringify(prior)}\nEXISTING TRADE LIFECYCLE INPUT\n${JSON.stringify(lifecycleInput)}\nMTF EVIDENCE\n${JSON.stringify(mtfEvidence)}\nCURRENT PRICE\n${currentPrice}\nSOURCE FIB OUTPUT\n${JSON.stringify(sourceFibContext)}\n\nAI REQUIREMENTS\n1. Return BUY and SELL probabilities whose sum is 100.\n2. If one side has the higher probability and reliable structural levels exist, populate a projected entry, projected SL and every available TP level even when confirmation is incomplete.\n3. Never use M5 price as HTF projected Entry.\n4. Actual Entry is only the confirmed HTF entry and remains fixed.\n5. If confirmation already occurred, describe the trade as BUY/SELL ACTIVE rather than WAIT and show Actual Entry.\n6. Preserve projected levels after confirmation.\n7. Do not alter selected strategy calculations or lifecycle.\n8. For FIB Retracement, projected Entry may only be 82.0%, 78.6%, 68.1% or 61.8% from supplied source output.\nReturn JSON only.`;
    const schema = { type: "object", additionalProperties: false, properties: { projectedDirection: { type: "string", enum: ["BUY", "SELL", "NO TRADE"] }, analysisState: { type: "string", enum: ["WATCH", "ENTRY_ZONE", "CONFIRMATION_PENDING", "CONFIRMED", "ACTIVE", "TP1_HIT", "INVALIDATED", "TARGET_COMPLETE", "CYCLE_COMPLETE"] }, trend: { type: "string" }, trendReason: { type: "string" }, institutionalActivity: { type: "string", enum: ["BULLISH", "BEARISH", "NEUTRAL", "INSUFFICIENT"] }, institutionalEvidence: { type: "array", items: { type: "string" } }, confirmations: { type: "array", items: { type: "string" } }, buyProbability: { type: "number", minimum: 0, maximum: 100 }, sellProbability: { type: "number", minimum: 0, maximum: 100 }, projectedProbability: { type: "number", minimum: 0, maximum: 100 }, entry: { type: ["number", "null"] }, stopLoss: { type: ["number", "null"] }, tp1: { type: ["number", "null"] }, tp2: { type: ["number", "null"] }, tp3: { type: ["number", "null"] }, tp4: { type: ["number", "null"] }, finalTp: { type: ["number", "null"] }, confirmationPrice: { type: ["number", "null"] }, reversalPrice: { type: ["number", "null"] }, opposingLiquidityTarget: { type: ["number", "null"] }, waitReason: { type: "string" }, tradeReason: { type: "string" }, invalidation: { type: "string" }, pipeline: { type: "array", items: { type: "string" } }, nextZone: { type: "string" } }, required: ["projectedDirection", "analysisState", "trend", "trendReason", "institutionalActivity", "institutionalEvidence", "confirmations", "buyProbability", "sellProbability", "projectedProbability", "entry", "stopLoss", "tp1", "tp2", "tp3", "tp4", "finalTp", "confirmationPrice", "reversalPrice", "opposingLiquidityTarget", "waitReason", "tradeReason", "invalidation", "pipeline", "nextZone"] };
    const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: "gpt-4.1-mini", input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }], max_output_tokens: 4500, text: { format: { type: "json_schema", name: "vaulttrades_ai_scanner", strict: true, schema } } }) });
    if (!response.ok) return Response.json({ error: `AI Scanner request failed: ${(await response.text()).slice(0, 300)}` }, { status: 502 });
    const raw = await response.json(), text = jsonText(raw);
    if (!text) return Response.json({ error: "AI Scanner returned no structured result." }, { status: 502 });
    const ai = JSON.parse(text);
    let buyProbability = finite(ai.buyProbability) ? Math.max(0, Math.min(100, ai.buyProbability)) : 50;
    let sellProbability = finite(ai.sellProbability) ? Math.max(0, Math.min(100, ai.sellProbability)) : 100 - buyProbability;
    const totalProbability = buyProbability + sellProbability;
    if (totalProbability <= 0) { buyProbability = 50; sellProbability = 50; } else { buyProbability = buyProbability / totalProbability * 100; sellProbability = sellProbability / totalProbability * 100; }
    const probabilityDirection: Direction = buyProbability > sellProbability ? "BUY" : sellProbability > buyProbability ? "SELL" : "NO TRADE";
    const direction: Direction = probabilityDirection !== "NO TRADE" ? probabilityDirection : (ai.projectedDirection === "BUY" || ai.projectedDirection === "SELL" ? ai.projectedDirection : prior.direction === "BUY" || prior.direction === "SELL" ? prior.direction : "NO TRADE");
    const sourceProjectedEntry = finite(prior.projectedEntry) ? prior.projectedEntry : finite(prior.entry) && prior.decision === "TRADE" ? prior.entry : null;
    const sourceProjectedStop = finite(prior.projectedStopLoss) ? prior.projectedStopLoss : finite(prior.stopLoss) && prior.decision === "TRADE" ? prior.stopLoss : null;
    const sourceProjectedTp1 = finite(prior.projectedTp1) ? prior.projectedTp1 : finite(prior.tp1) && prior.decision === "TRADE" ? prior.tp1 : null;
    const sourceProjectedTp2 = finite(prior.projectedTp2) ? prior.projectedTp2 : finite(prior.tp2) && prior.decision === "TRADE" ? prior.tp2 : null;
    const sourceProjectedTp3 = finite(prior.projectedTp3) ? prior.projectedTp3 : finite(prior.tp3) && prior.decision === "TRADE" ? prior.tp3 : null;
    const sourceProjectedTp4 = finite(prior.projectedTp4) ? prior.projectedTp4 : finite(prior.finalTp) && prior.decision === "TRADE" ? prior.finalTp : null;
    const support = finite(prior?.structure?.support) ? prior.structure.support : mtfEvidence.m15?.support ?? null;
    const resistance = finite(prior?.structure?.resistance) ? prior.structure.resistance : mtfEvidence.m15?.resistance ?? null;
    const volatility = finite(prior?.volatility?.atr) ? prior.volatility.atr : atr(candles);
    const fallbackProjection = structuralProjection(direction, currentPrice, support, resistance, volatility);
    const projectedEntry = strategyId === "fibRetracement" ? (direction === "BUY" ? fibBuyLevel?.price ?? sourceProjectedEntry : direction === "SELL" ? fibSellLevel?.price ?? sourceProjectedEntry : sourceProjectedEntry) : sourceProjectedEntry ?? fallbackProjection?.entry ?? (finite(ai.entry) ? ai.entry : null);
    const projectedStopLoss = sourceProjectedStop ?? fallbackProjection?.stop ?? (finite(ai.stopLoss) ? ai.stopLoss : null);
    const projectedTp1 = sourceProjectedTp1 ?? fallbackProjection?.tp1 ?? (finite(ai.tp1) ? ai.tp1 : null);
    const projectedTp2 = sourceProjectedTp2 ?? fallbackProjection?.tp2 ?? (finite(ai.tp2) ? ai.tp2 : null);
    const projectedTp3 = sourceProjectedTp3 ?? fallbackProjection?.tp3 ?? (finite(ai.tp3) ? ai.tp3 : null);
    const projectedTp4 = sourceProjectedTp4 ?? fallbackProjection?.tp4 ?? (finite(ai.tp4) ? ai.tp4 : finite(ai.finalTp) ? ai.finalTp : null);
    const priorActual = finite(prior.actualEntry) ? prior.actualEntry : null;
    const lifeActual = finite(lifecycleInput.actualEntry) ? lifecycleInput.actualEntry : null;
    const confirmedByAnalyzer = (prior?.decision === "TRADE" || prior?.confirmed === true || prior?.status === "CONFIRMED" || prior?.status === "ACTIVE") && (prior?.direction === direction || prior?.projectedDirection === direction);
    const actualEntry = lifeActual ?? priorActual ?? (confirmedByAnalyzer && finite(prior.entry) ? prior.entry : null);
    const lifecycle = evaluateTradeLifecycle({ direction: direction === "BUY" || direction === "SELL" ? direction : "NONE", currentPrice, projectedEntry, actualEntry, projectedStopLoss, projectedTp1, projectedTp2, projectedFinalTp: projectedTp4, priorStatus: lifecycleInput.status ?? prior?.status ?? null, tp1AlreadyHit: lifecycleInput.tp1Hit === true || prior?.tp1Hit === true, stopAlreadyHit: lifecycleInput.stopHit === true || prior?.stopHit === true, cycleComplete: lifecycleInput.cycleComplete === true });
    const active = actualEntry !== null && (lifecycle.status === "ACTIVE" || lifecycle.status === "TP1_HIT" || confirmedByAnalyzer);
    const state = lifecycle.status === "TP1_HIT" ? "TP1_HIT" : lifecycle.status === "CYCLE_COMPLETE" ? "CYCLE_COMPLETE" : active ? "ACTIVE" : (ai.analysisState === "WATCH" && direction !== "NO TRADE" ? "CONFIRMATION_PENDING" : ai.analysisState);
    const projectionTarget = direction === "BUY" || direction === "SELL" ? projectedTp4 : null;
    const projectionMath = math(direction, actualEntry ?? projectedEntry, projectedStopLoss, projectionTarget, currentPrice);
    const statusMessage = active ? `${direction} ACTIVE — confirmed entry ${actualEntry}. Projected entry ${projectedEntry ?? "—"} preserved.` : `${direction} DEVELOPING — projection available; confirmation conditions are separate.`;
    return Response.json({ ...ai, projectedDirection: direction, analysisState: state, statusMessage, buyProbability, sellProbability, probabilityDirection: direction, entry: projectedEntry, projectedEntry, actualEntry, stopLoss: projectedStopLoss, projectedStopLoss, tp1: projectedTp1, projectedTp1, tp2: projectedTp2, projectedTp2, tp3: projectedTp3, projectedTp3, tp4: projectedTp4, projectedTp4, finalTp: projectedTp4, projectedFinalTp: projectedTp4, confirmationPrice: actualEntry ?? ai.confirmationPrice, tp1Hit: lifecycle.tp1Hit, stopHit: lifecycle.stopHit, cycleStatus: lifecycle.status, projectionReason: fallbackProjection?.reason ?? "Selected strategy projection preserved.", sourceFib: sourceFibContext, fibEntryLevel: strategyId === "fibRetracement" ? (direction === "BUY" ? fibBuyLevel : fibSellLevel) : null, allowedFibEntryPercentages: strategyId === "fibRetracement" ? [82, 78.6, 68.1, 61.8] : [], volumeProfile: volume, rr: projectionMath.rr, priceValidation: projectionMath, isExecutable: active && projectionMath.valid, waitReason: active ? statusMessage : ai.waitReason, tradeReason: active ? statusMessage : ai.tradeReason, mtf: mtfEvidence, mtfHierarchy: { enabled: mtfEvidence.enabled, htfTimeframe: mtfEvidence.htfTimeframe, htfSourceOfTruth: true, m15Role: "STRONGER_CONFIRMATION", m5Role: "EXECUTION_CONFIRMATION", lowerTimeframesRewriteHtfLevels: false, projectedEntrySource: "HTF_STRATEGY_OR_STRUCTURAL_PROBABILITY_PROJECTION", actualEntryRule: "HTF_CONFIRMED_ONLY", independentLowerTimeframeCycles: true } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "AI Scanner failed." }, { status: 500 });
  }
}

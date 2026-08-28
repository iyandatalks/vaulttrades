import { ANALYZER_STRATEGY_MAP } from "../../../lib/strategies/analyzerProfiles";
import { getStrategyRules, type StrategyId } from "../../../lib/strategies";
import { analyzeAutoFibRetrace } from "../../../lib/strategies/autoFibRetrace";
import { evaluateTradeLifecycle, selectAllowedAbFibLevel } from "../../../lib/strategies/tradeLifecycle";
import { getTwelveDataTimeSeries } from "../../../lib/market-data/twelvedata";

export const runtime = "nodejs";
type Direction = "BUY" | "SELL" | "NO TRADE";
type EvidenceDirection = "BUY" | "SELL" | "NEUTRAL";
type MtfSnapshot = { timeframe: "M15" | "M5"; currentPrice: number | null; direction: EvidenceDirection; structureBreak: boolean; breakout: boolean; confirmation: boolean; state: "CONFIRMATION" | "EXECUTION" | "NEUTRAL"; support: number | null; resistance: number | null; structureReason: string };
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const clean = (v: unknown) => typeof v === "string" ? v.trim() : "";

function atr(c: Array<{ high: number; low: number; close: number }>, n = 14): number | null {
  if (c.length < n + 1) return null;
  const tr = c.map((x, i) => i === 0 ? x.high - x.low : Math.max(x.high - x.low, Math.abs(x.high - c[i - 1].close), Math.abs(x.low - c[i - 1].close)));
  let out = tr.slice(0, n).reduce((a, b) => a + b, 0) / n;
  for (let i = n; i < tr.length; i++) out = (out * (n - 1) + tr[i]) / n;
  return out;
}

function volumeProfile(c: Array<{ open: number; high: number; low: number; close: number; volume: number | null }>) {
  const v = c.map(x => x.volume).filter((x): x is number => finite(x));
  if (v.length < 21) return { currentVolume: null, averageVolume: null, ratio: null, expansion: false, candleDirection: "NEUTRAL", displacementATR: null };
  const currentVolume = v.at(-1)!;
  const averageVolume = v.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
  const ratio = averageVolume > 0 ? currentVolume / averageVolume : null;
  const last = c.at(-1)!;
  const a = atr(c);
  return { currentVolume, averageVolume, ratio, expansion: ratio !== null && ratio >= 1.5, candleDirection: last.close > last.open ? "BULLISH" : last.close < last.open ? "BEARISH" : "NEUTRAL", displacementATR: a && a > 0 ? (last.high - last.low) / a : null };
}

function inferMtfSnapshot(timeframe: "M15" | "M5", candles: Array<{ open: number; high: number; low: number; close: number }>): MtfSnapshot {
  const r = candles.slice(-24);
  const currentPrice = r.at(-1)?.close ?? null;
  if (!finite(currentPrice) || r.length < 8) return { timeframe, currentPrice, direction: "NEUTRAL", structureBreak: false, breakout: false, confirmation: false, state: timeframe === "M15" ? "CONFIRMATION" : "EXECUTION", support: null, resistance: null, structureReason: "Insufficient independent timeframe evidence." };
  const prior = r.slice(0, -1);
  const high = Math.max(...prior.slice(-8).map(x => x.high));
  const low = Math.min(...prior.slice(-8).map(x => x.low));
  const a = atr(r) ?? Math.max(currentPrice * 0.001, 0.01);
  const last = r.at(-1)!;
  const body = Math.abs(last.close - last.open);
  const bullishBreak = last.close > high && last.close > last.open && body >= a * 0.15;
  const bearishBreak = last.close < low && last.close < last.open && body >= a * 0.15;
  const directional: EvidenceDirection = last.close > r[0].close ? "BUY" : last.close < r[0].close ? "SELL" : "NEUTRAL";
  const direction: EvidenceDirection = bullishBreak ? "BUY" : bearishBreak ? "SELL" : directional;
  const recent = r.slice(-3);
  const confirmation = direction === "BUY" ? recent.filter(x => x.close > x.open).length >= 2 && last.close >= recent[0].close : direction === "SELL" ? recent.filter(x => x.close < x.open).length >= 2 && last.close <= recent[0].close : false;
  const supports = prior.map(x => x.low).filter(x => x < currentPrice);
  const resistances = prior.map(x => x.high).filter(x => x > currentPrice);
  return { timeframe, currentPrice, direction, structureBreak: bullishBreak || bearishBreak, breakout: bullishBreak || bearishBreak, confirmation, state: timeframe === "M15" ? "CONFIRMATION" : "EXECUTION", support: supports.length ? Math.max(...supports) : null, resistance: resistances.length ? Math.min(...resistances) : null, structureReason: bullishBreak || bearishBreak ? `${timeframe} ${direction === "BUY" ? "bullish" : "bearish"} structure/breakout event with directional candle confirmation.` : `${timeframe} ${direction === "BUY" ? "bullish" : direction === "SELL" ? "bearish" : "mixed"} structure; fresh breakout confirmation is not yet present.` };
}

function math(direction: Direction, entry: number | null, stop: number | null, target: number | null, current: number | null) {
  if (direction === "NO TRADE" || !finite(entry) || !finite(stop) || !finite(target)) return { rr: null, valid: false, risk: null, reward: null, entryDistancePct: null, slDistancePct: null };
  const risk = direction === "BUY" ? entry - stop : stop - entry;
  const reward = direction === "BUY" ? target - entry : entry - target;
  const rr = risk > 0 ? reward / risk : null;
  const entryDistancePct = finite(current) && current !== 0 ? Math.abs(entry - current) / Math.abs(current) * 100 : null;
  const slDistancePct = entry !== 0 ? Math.abs(entry - stop) / Math.abs(entry) * 100 : null;
  return { rr, risk, reward, entryDistancePct, slDistancePct, valid: risk > 0 && reward > 0 && rr !== null && rr >= 2 && (slDistancePct === null || slDistancePct >= 0.1) };
}

function jsonText(raw: any): string { return raw.output?.flatMap((x: any) => x.content ?? []).filter((x: any) => x.type === "output_text").map((x: any) => x.text).join("").trim() || ""; }

function structuralProjection(direction: Direction, current: number, support: number | null, resistance: number | null, volatility: number | null) {
  const a = volatility && volatility > 0 ? volatility : Math.max(Math.abs(current) * 0.002, 0.01);
  if (direction === "BUY" && finite(support)) { const entry = support, stop = support - a, upper = finite(resistance) && resistance > entry ? resistance : entry + 2 * a; return { entry, stop, tp1: entry + (upper - entry) * 0.5, tp2: upper, tp3: upper + a, tp4: upper + 2 * a, reason: "BUY projection anchored to structural support." }; }
  if (direction === "SELL" && finite(resistance)) { const entry = resistance, stop = resistance + a, lower = finite(support) && support < entry ? support : entry - 2 * a; return { entry, stop, tp1: entry - (entry - lower) * 0.5, tp2: lower, tp3: lower - a, tp4: lower - 2 * a, reason: "SELL projection anchored to structural resistance." }; }
  if (direction === "BUY") return { entry: current, stop: current - a, tp1: current + a, tp2: current + 2 * a, tp3: current + 3 * a, tp4: current + 4 * a, reason: "BUY projection anchored to current structural context." };
  if (direction === "SELL") return { entry: current, stop: current + a, tp1: current - a, tp2: current - 2 * a, tp3: current - 3 * a, tp4: current - 4 * a, reason: "SELL projection anchored to current structural context." };
  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json(); const strategyId = clean(body.strategy); const profile = ANALYZER_STRATEGY_MAP[strategyId];
    const candles = Array.isArray(body.candles) ? body.candles.filter((c: any) => finite(c?.open) && finite(c?.high) && finite(c?.low) && finite(c?.close)) : [];
    const currentPrice = finite(body.currentPrice) ? body.currentPrice : candles.at(-1)?.close ?? null;
    if (!profile) return Response.json({ error: "Invalid strategy selected." }, { status: 400 });
    if (candles.length < 30 || !finite(currentPrice)) return Response.json({ error: "Not enough chart data for AI Scanner." }, { status: 422 });
    const apiKey = process.env.OPENAI_API_KEY; if (!apiKey) return Response.json({ error: "OpenAI API key is not configured." }, { status: 500 });
    const prior = body.analysis ?? {}; const lifecycleInput = body.lifecycle ?? {}; const sourceRules = profile.sourceIds.map((id: StrategyId) => getStrategyRules(id));
    const selectedTimeframe = clean(prior?.market?.timeframe).toUpperCase();
    const mtfEnabled = ["5M", "15M", "30M", "1H", "4H", "1D", "1W", "1M"].includes(selectedTimeframe);
    let mtfEvidence: { enabled: boolean; htfTimeframe: string; m15: MtfSnapshot | null; m5: MtfSnapshot | null; relationship: string } = { enabled: false, htfTimeframe: selectedTimeframe || "UNKNOWN", m15: null, m5: null, relationship: "MTF hierarchy is inactive below M5." };
    if (mtfEnabled) { const symbol = clean(prior?.market?.asset); if (symbol) { const [m15Market, m5Market] = await Promise.all([getTwelveDataTimeSeries({ symbol, timeframe: "15m", outputsize: 100 }), getTwelveDataTimeSeries({ symbol, timeframe: "5m", outputsize: 100 })]); const m15 = inferMtfSnapshot("M15", m15Market.candles); const m5 = inferMtfSnapshot("M5", m5Market.candles); const htfDirection: Direction = prior?.projectedDirection === "BUY" || prior?.direction === "BUY" ? "BUY" : prior?.projectedDirection === "SELL" || prior?.direction === "SELL" ? "SELL" : "NO TRADE"; const sameDirection = htfDirection !== "NO TRADE" && m15.direction === htfDirection && m5.direction === htfDirection; mtfEvidence = { enabled: true, htfTimeframe: selectedTimeframe, m15, m5, relationship: sameDirection && m5.confirmation && m15.confirmation ? `${htfDirection} progression confirmed: M5 initial confirmation → M15 stronger confirmation → ${selectedTimeframe} higher-timeframe context.` : m5.confirmation && m5.direction === htfDirection ? `${htfDirection} progression: M5 initial confirmation is present; M15 is still developing.` : m15.confirmation && m15.direction === htfDirection ? `${htfDirection} progression: M15 confirmation is present; M5 evidence is not yet aligned.` : "MTF evidence is developing independently; no chronological M15→M5 gate." }; } }
    const sourceFib = strategyId === "fibRetracement" ? analyzeAutoFibRetrace({ candles: candles.map((c: any, i: number) => ({ time: typeof c.time === "number" ? c.time : Date.parse(c.datetime ?? "") || i, open: c.open, high: c.high, low: c.low, close: c.close, volume: finite(c.volume) ? c.volume : undefined })) }) : null;
    const fibBuyLevel = sourceFib ? selectAllowedAbFibLevel(sourceFib.buy.fibLevels, "BUY", currentPrice) : null; const fibSellLevel = sourceFib ? selectAllowedAbFibLevel(sourceFib.sell.fibLevels, "SELL", currentPrice) : null; const volume = volumeProfile(candles);
    const prompt = `You are the VaultTrades AI Scanner. The selected strategy is the source of truth. Keep projected levels separate from actual confirmed entry.

MTF CONFIRMATION PROGRESSION
The market move can begin on the lower timeframe and develop upward. M5 is the initial/early confirmation and execution timeframe. M15 is a stronger confirmation of a move that has developed beyond M5. Higher timeframes provide progressively stronger directional context. Do NOT require M15 to confirm before a valid M5 confirmation can execute. Do NOT invalidate an M5 confirmation merely because M15 has not confirmed yet. Do NOT invent an M15 confirmation from an M5 signal. Each timeframe must still satisfy the selected strategy's existing conditions.
M5 → M15 → higher timeframe is a progression of confirmation, not a chronological permission gate. Preserve the evidence even when M5 confirms before M15.

TP LIFECYCLE
The AI Scanner displays TP1, TP2, TP3 and TP4 as projected opportunity targets. The actual trade lifecycle is TP2-only: TP2 or SL completes the active cycle. TP1 is a milestone only; TP3 and TP4 remain projected/reference targets.

CONFIRMED ENTRY RULE
Do not call a setup confirmed merely because a projected target was reached. If projected TP2 is reached before actual confirmation, the setup expired/missed; do not retroactively enter it. Actual Entry exists only after the selected strategy's complete confirmation conditions are satisfied and is fixed thereafter.

SELECTED STRATEGY
${JSON.stringify({ id: strategyId, name: profile.name, focus: profile.focus, rules: profile.rules, indicatorSpecs: profile.indicatorSpecs, sourceRules })}
EXISTING ANALYZER RESULT
${JSON.stringify(prior)}
EXISTING LIFECYCLE INPUT
${JSON.stringify(lifecycleInput)}
MTF EVIDENCE
${JSON.stringify(mtfEvidence)}
CURRENT PRICE
${currentPrice}

Return JSON only. Preserve strategy-defined levels and distinguish DEVELOPING, CONFIRMED, ACTIVE, TP2_HIT, SL_HIT and CYCLE_COMPLETE.`;
    const schema = { type: "object", additionalProperties: false, properties: { projectedDirection: { type: "string", enum: ["BUY", "SELL", "NO TRADE"] }, analysisState: { type: "string", enum: ["WATCH", "ENTRY_ZONE", "CONFIRMATION_PENDING", "CONFIRMED", "ACTIVE", "TP2_HIT", "INVALIDATED", "TARGET_COMPLETE", "CYCLE_COMPLETE"] }, trend: { type: "string" }, trendReason: { type: "string" }, institutionalActivity: { type: "string", enum: ["BULLISH", "BEARISH", "NEUTRAL", "INSUFFICIENT"] }, institutionalEvidence: { type: "array", items: { type: "string" } }, confirmations: { type: "array", items: { type: "string" } }, buyProbability: { type: "number", minimum: 0, maximum: 100 }, sellProbability: { type: "number", minimum: 0, maximum: 100 }, projectedProbability: { type: "number", minimum: 0, maximum: 100 }, entry: { type: ["number", "null"] }, stopLoss: { type: ["number", "null"] }, tp1: { type: ["number", "null"] }, tp2: { type: ["number", "null"] }, tp3: { type: ["number", "null"] }, tp4: { type: ["number", "null"] }, finalTp: { type: ["number", "null"] }, confirmationPrice: { type: ["number", "null"] }, reversalPrice: { type: ["number", "null"] }, opposingLiquidityTarget: { type: ["number", "null"] }, waitReason: { type: "string" }, tradeReason: { type: "string" }, invalidation: { type: "string" }, pipeline: { type: "array", items: { type: "string" } }, nextZone: { type: "string" } }, required: ["projectedDirection","analysisState","trend","trendReason","institutionalActivity","institutionalEvidence","confirmations","buyProbability","sellProbability","projectedProbability","entry","stopLoss","tp1","tp2","tp3","tp4","finalTp","confirmationPrice","reversalPrice","opposingLiquidityTarget","waitReason","tradeReason","invalidation","pipeline","nextZone"] };
    const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: "gpt-4.1-mini", input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }], max_output_tokens: 4500, text: { format: { type: "json_schema", name: "vaulttrades_ai_scanner", strict: true, schema } } }) });
    if (!response.ok) return Response.json({ error: `AI Scanner request failed: ${(await response.text()).slice(0, 300)}` }, { status: 502 }); const raw = await response.json(); const text = jsonText(raw); if (!text) return Response.json({ error: "AI Scanner returned no structured result." }, { status: 502 }); const ai = JSON.parse(text);
    let buyProbability = finite(ai.buyProbability) ? Math.max(0, Math.min(100, ai.buyProbability)) : 50; let sellProbability = finite(ai.sellProbability) ? Math.max(0, Math.min(100, ai.sellProbability)) : 50; const totalProbability = buyProbability + sellProbability || 1; buyProbability = buyProbability / totalProbability * 100; sellProbability = sellProbability / totalProbability * 100;
    const probabilityDirection: Direction = buyProbability > sellProbability ? "BUY" : sellProbability > buyProbability ? "SELL" : "NO TRADE"; const direction: Direction = probabilityDirection !== "NO TRADE" ? probabilityDirection : (ai.projectedDirection === "BUY" || ai.projectedDirection === "SELL" ? ai.projectedDirection : prior.direction === "BUY" || prior.direction === "SELL" ? prior.direction : "NO TRADE");
    const sourceProjectedEntry = finite(prior.projectedEntry) ? prior.projectedEntry : finite(prior.entry) ? prior.entry : null; const sourceProjectedStop = finite(prior.projectedStopLoss) ? prior.projectedStopLoss : finite(prior.stopLoss) ? prior.stopLoss : null; const sourceProjectedTp1 = finite(prior.projectedTp1) ? prior.projectedTp1 : finite(prior.tp1) ? prior.tp1 : null; const sourceProjectedTp2 = finite(prior.projectedTp2) ? prior.projectedTp2 : finite(prior.tp2) ? prior.tp2 : null; const sourceProjectedTp3 = finite(prior.projectedTp3) ? prior.projectedTp3 : null; const sourceProjectedTp4 = finite(prior.projectedTp4) ? prior.projectedTp4 : finite(prior.finalTp) ? prior.finalTp : null;
    const support = finite(prior?.structure?.support) ? prior.structure.support : mtfEvidence.m15?.support ?? null; const resistance = finite(prior?.structure?.resistance) ? prior.structure.resistance : mtfEvidence.m15?.resistance ?? null; const volatility = finite(prior?.volatility?.atr) ? prior.volatility.atr : atr(candles); const fallback = structuralProjection(direction, currentPrice, support, resistance, volatility);
    const projectedEntry = strategyId === "fibRetracement" ? (direction === "BUY" ? fibBuyLevel?.price ?? sourceProjectedEntry : direction === "SELL" ? fibSellLevel?.price ?? sourceProjectedEntry : sourceProjectedEntry) : sourceProjectedEntry ?? fallback?.entry ?? (finite(ai.entry) ? ai.entry : null); const projectedStopLoss = sourceProjectedStop ?? fallback?.stop ?? (finite(ai.stopLoss) ? ai.stopLoss : null); const projectedTp1 = sourceProjectedTp1 ?? fallback?.tp1 ?? (finite(ai.tp1) ? ai.tp1 : null); const projectedTp2 = sourceProjectedTp2 ?? fallback?.tp2 ?? (finite(ai.tp2) ? ai.tp2 : null); const projectedTp3 = sourceProjectedTp3 ?? fallback?.tp3 ?? (finite(ai.tp3) ? ai.tp3 : null); const projectedTp4 = sourceProjectedTp4 ?? fallback?.tp4 ?? (finite(ai.tp4) ? ai.tp4 : finite(ai.finalTp) ? ai.finalTp : null);
    const priorActual = finite(prior.actualEntry) ? prior.actualEntry : null; const lifeActual = finite(lifecycleInput.actualEntry) ? lifecycleInput.actualEntry : null;
    const htfStrategyConfirmed = prior?.confirmed === true || prior?.status === "CONFIRMED" || prior?.status === "ACTIVE" || prior?.decision === "TRADE";
    const m5Confirmed = direction !== "NO TRADE" && mtfEvidence.m5?.direction === direction && mtfEvidence.m5.confirmation;
    const m15Confirmed = direction !== "NO TRADE" && mtfEvidence.m15?.direction === direction && mtfEvidence.m15.confirmation;
    const selectedIsM5 = selectedTimeframe === "5M";
    const selectedIsM15 = selectedTimeframe === "15M";
    const mtfProgressionConfirmed = selectedIsM5 ? m5Confirmed : selectedIsM15 ? m15Confirmed : m15Confirmed || m5Confirmed;
    const htfFinalConfirmed = mtfEnabled ? htfStrategyConfirmed && mtfProgressionConfirmed : htfStrategyConfirmed;
    const actualEntry = lifeActual ?? priorActual ?? (htfFinalConfirmed ? currentPrice : null);
    const lifecycle = evaluateTradeLifecycle({ direction: direction === "BUY" || direction === "SELL" ? direction : "NONE", currentPrice, projectedEntry, actualEntry, projectedStopLoss, projectedTp1, projectedTp2, projectedFinalTp: projectedTp4, priorStatus: lifecycleInput.status ?? prior?.status ?? null, tp1AlreadyHit: lifecycleInput.tp1Hit === true || prior?.tp1Hit === true, tp2AlreadyHit: lifecycleInput.tp2Hit === true || prior?.tp2Hit === true, stopAlreadyHit: lifecycleInput.stopHit === true || prior?.stopHit === true, cycleComplete: lifecycleInput.cycleComplete === true });
    const cycleComplete = lifecycle.status === "TP2_HIT" || lifecycle.status === "SL_HIT" || lifecycle.status === "CYCLE_COMPLETE"; const active = actualEntry !== null && lifecycle.status === "ACTIVE"; const state = cycleComplete ? lifecycle.status : active ? "ACTIVE" : htfFinalConfirmed ? "CONFIRMED" : direction !== "NO TRADE" ? "CONFIRMATION_PENDING" : ai.analysisState;
    const projectionMath = math(direction, actualEntry ?? projectedEntry, projectedStopLoss, projectedTp2 ?? projectedTp1, currentPrice); const statusMessage = active ? `${direction} ACTIVE — confirmed entry ${actualEntry}. TP2 is the lifecycle target; TP1 is a milestone.` : cycleComplete ? lifecycle.message : htfFinalConfirmed ? `${direction} CONFIRMED — actual entry ${actualEntry}.` : `${direction} DEVELOPING — confirmation conditions pending.`;
    return Response.json({ ...ai, projectedDirection: direction, analysisState: state, statusMessage, buyProbability, sellProbability, probabilityDirection: direction, entry: projectedEntry, projectedEntry, actualEntry, stopLoss: projectedStopLoss, projectedStopLoss, tp1: projectedTp1, projectedTp1, tp2: projectedTp2, projectedTp2, tp3: projectedTp3, projectedTp3, tp4: projectedTp4, projectedTp4, finalTp: projectedTp4, projectedFinalTp: projectedTp4, confirmationPrice: actualEntry ?? ai.confirmationPrice, tp1Hit: lifecycle.tp1Hit, tp2Hit: lifecycle.tp2Hit, stopHit: lifecycle.stopHit, cycleStatus: lifecycle.status, projectionReason: fallback?.reason ?? "Selected strategy projection preserved.", sourceFib: sourceFib ? { state: sourceFib.state, confidence: sourceFib.confidence } : null, fibEntryLevel: strategyId === "fibRetracement" ? (direction === "BUY" ? fibBuyLevel : fibSellLevel) : null, allowedFibEntryPercentages: strategyId === "fibRetracement" ? [82, 78.6, 68.1, 61.8] : [], volumeProfile: volume, rr: projectionMath.rr, priceValidation: projectionMath, isExecutable: htfFinalConfirmed && actualEntry !== null && projectionMath.valid && !cycleComplete, waitReason: statusMessage, tradeReason: statusMessage, invalidation: String(ai.invalidation || ""), mtf: mtfEvidence, mtfHierarchy: { enabled: mtfEvidence.enabled, htfTimeframe: mtfEvidence.htfTimeframe, htfSourceOfTruth: true, m15Role: "STRONGER_CONFIRMATION", m5Role: "INITIAL_EXECUTION_CONFIRMATION", lowerTimeframesRewriteHtfLevels: false, projectedEntrySource: "HTF_STRATEGY", actualEntryRule: selectedIsM5 ? "M5_CONFIRMED_ONLY" : selectedIsM15 ? "M15_CONFIRMED_ONLY" : "STRATEGY_CONFIRMED_WITH_MTF_PROGRESSION", independentLowerTimeframeCycles: true, lifecycleTarget: "TP2" } });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "AI Scanner failed." }, { status: 500 }); }
}

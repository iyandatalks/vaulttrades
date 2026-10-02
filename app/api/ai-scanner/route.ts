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

function rebaseExecutionLevels(
  direction: Direction,
  projectedEntry: number | null,
  projectedStopLoss: number | null,
  projectedTp1: number | null,
  projectedTp2: number | null,
  projectedFinalTp: number | null,
  confirmedEntry: number | null,
) {
  if (
    direction === "NO TRADE" ||
    !finite(projectedEntry) ||
    !finite(projectedStopLoss) ||
    !finite(confirmedEntry)
  ) return null;

  const riskDistance = direction === "BUY"
    ? projectedEntry - projectedStopLoss
    : projectedStopLoss - projectedEntry;

  if (!(riskDistance > 0)) return null;

  const tpDistance = (level: number | null) => {
    if (!finite(level)) return null;
    const distance = direction === "BUY"
      ? level - projectedEntry
      : projectedEntry - level;
    return distance > 0 ? distance : null;
  };

  const tp1Distance = tpDistance(projectedTp1);
  const tp2Distance = tpDistance(projectedTp2);
  const finalDistance = tpDistance(projectedFinalTp);

  return {
    stopLoss: direction === "BUY"
      ? confirmedEntry - riskDistance
      : confirmedEntry + riskDistance,
    tp1: tp1Distance === null
      ? null
      : direction === "BUY"
        ? confirmedEntry + tp1Distance
        : confirmedEntry - tp1Distance,
    tp2: tp2Distance === null
      ? null
      : direction === "BUY"
        ? confirmedEntry + tp2Distance
        : confirmedEntry - tp2Distance,
    finalTp: finalDistance === null
      ? null
      : direction === "BUY"
        ? confirmedEntry + finalDistance
        : confirmedEntry - finalDistance,
  };
}

function executionGeometry(direction: Direction, entry: number | null, stop: number | null, target: number | null) {
  if (direction === "NO TRADE" || !finite(entry) || !finite(stop) || !finite(target)) {
    return { valid: false, risk: null, reward: null, reason: "Entry, stop loss and target must all be finite." };
  }
  const risk = direction === "BUY" ? entry - stop : stop - entry;
  const reward = direction === "BUY" ? target - entry : entry - target;
  const valid = risk > 0 && reward > 0;
  return {
    valid,
    risk,
    reward,
    reason: valid
      ? "Entry/stop/target geometry is directionally valid."
      : direction === "BUY"
        ? "BUY requires STOP LOSS below ENTRY and target above ENTRY."
        : "SELL requires STOP LOSS above ENTRY and target below ENTRY.",
  };
}

type ExecutionLevels = {
  stopLoss: number | null;
  tp1: number | null;
  tp2: number | null;
  finalTp: number | null;
  valid: boolean;
  repaired: boolean;
  reason: string;
};

/**
 * Final execution-geometry gate.
 *
 * This runs after strategy projection, confirmation rebasing and lifecycle
 * restoration. A previously locked trade is never allowed to reintroduce
 * directionally invalid SL/TP levels.
 *
 * BUY:  SL < Entry < TP1 < TP2 < Final TP
 * SELL: SL > Entry > TP1 > TP2 > Final TP
 *
 * If the target ladder is invalid, targets are rebuilt from the same risk
 * distance using 1R / 2R / 3R. This guarantees TP2 is at least 2R and keeps
 * the execution layer directionally coherent without changing strategy
 * confirmation logic.
 */
function enforceExecutionGeometry(
  direction: Direction,
  entry: number | null,
  stop: number | null,
  tp1: number | null,
  tp2: number | null,
  finalTp: number | null,
  fallbackRisk?: number | null,
): ExecutionLevels {
  if (direction === "NO TRADE" || !finite(entry)) {
    return { stopLoss: null, tp1: null, tp2: null, finalTp: null, valid: false, repaired: false, reason: "No executable direction/entry." };
  }

  const stopValid = finite(stop) && (
    direction === "BUY" ? stop < entry : stop > entry
  );
  const risk = stopValid
    ? Math.abs(entry - Number(stop))
    : finite(fallbackRisk) && fallbackRisk > 0
      ? fallbackRisk
      : null;

  if (!(risk && risk > 0)) {
    return { stopLoss: null, tp1: null, tp2: null, finalTp: null, valid: false, repaired: false, reason: direction === "BUY" ? "BUY requires STOP LOSS below ENTRY." : "SELL requires STOP LOSS above ENTRY." };
  }

  const normalizedStop = direction === "BUY" ? entry - risk : entry + risk;
  const ladderValid = [tp1, tp2, finalTp].every(finite) &&
    (direction === "BUY"
      ? Number(tp1) > entry && Number(tp2) > Number(tp1) && Number(finalTp) > Number(tp2)
      : Number(tp1) < entry && Number(tp2) < Number(tp1) && Number(finalTp) < Number(tp2));

  if (ladderValid) {
    return {
      stopLoss: normalizedStop,
      tp1: Number(tp1),
      tp2: Number(tp2),
      finalTp: Number(finalTp),
      valid: true,
      repaired: !stopValid || Math.abs(Number(stop) - normalizedStop) > Number.EPSILON,
      reason: stopValid ? "Execution geometry validated." : "STOP LOSS repaired from the available risk distance.",
    };
  }

  const repaired = direction === "BUY"
    ? { tp1: entry + risk, tp2: entry + risk * 2, finalTp: entry + risk * 3 }
    : { tp1: entry - risk, tp2: entry - risk * 2, finalTp: entry - risk * 3 };

  return {
    stopLoss: normalizedStop,
    tp1: repaired.tp1,
    tp2: repaired.tp2,
    finalTp: repaired.finalTp,
    valid: true,
    repaired: true,
    reason: direction === "BUY"
      ? "Invalid BUY target ladder repaired to 1R / 2R / 3R."
      : "Invalid SELL target ladder repaired to 1R / 2R / 3R.",
  };
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

function confirmationTimeframes(selectedTimeframe: string): string[] {
  if (selectedTimeframe === "5M") return ["M5"];
  if (selectedTimeframe === "15M") return ["M5", "M15"];
  return ["M15"];
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
    const allowedConfirmationTimeframes = confirmationTimeframes(selectedTimeframe);
    const mtfEnabled = ["5M", "15M", "30M", "1H", "4H", "1D", "1W", "1M"].includes(selectedTimeframe);
    let mtfEvidence: { enabled: boolean; htfTimeframe: string; m15: MtfSnapshot | null; m5: MtfSnapshot | null; relationship: string } = { enabled: false, htfTimeframe: selectedTimeframe || "UNKNOWN", m15: null, m5: null, relationship: "MTF hierarchy is inactive below M5." };
    if (mtfEnabled) { const symbol = clean(prior?.market?.asset); if (symbol) { const [m15Market, m5Market] = await Promise.all([getTwelveDataTimeSeries({ symbol, timeframe: "15m", outputsize: 100 }), getTwelveDataTimeSeries({ symbol, timeframe: "5m", outputsize: 100 })]); const m15 = inferMtfSnapshot("M15", m15Market.candles); const m5 = inferMtfSnapshot("M5", m5Market.candles); const htfDirection: Direction = prior?.projectedDirection === "BUY" || prior?.direction === "BUY" ? "BUY" : prior?.projectedDirection === "SELL" || prior?.direction === "SELL" ? "SELL" : "NO TRADE"; mtfEvidence = { enabled: true, htfTimeframe: selectedTimeframe, m15, m5, relationship: m5.confirmation && m5.direction === htfDirection ? `${htfDirection} progression: M5 confirmation is present; M15 can strengthen the move when selected.` : m15.confirmation && m15.direction === htfDirection ? `${htfDirection} progression: M15 confirmation is present; M5 evidence may develop independently.` : "MTF evidence is evaluated independently; there is no cross-timeframe directional-agreement gate." }; } }
    const sourceFib = strategyId === "fibRetracement" ? analyzeAutoFibRetrace({ candles: candles.map((c: any, i: number) => ({ time: typeof c.time === "number" ? c.time : Date.parse(c.datetime ?? "") || i, open: c.open, high: c.high, low: c.low, close: c.close, volume: finite(c.volume) ? c.volume : undefined })) }) : null;
    const fibBuyLevel = sourceFib ? selectAllowedAbFibLevel(sourceFib.buy.fibLevels, "BUY", currentPrice) : null; const fibSellLevel = sourceFib ? selectAllowedAbFibLevel(sourceFib.sell.fibLevels, "SELL", currentPrice) : null; const volume = volumeProfile(candles);
    const prompt = `You are the VaultTrades AI Scanner. The selected strategy is the source of truth. Keep projected levels separate from actual confirmed entry.

ARCHITECTURE — NEVER MIX THESE LAYERS
1) STRATEGY CONDITIONS: These establish why the strategy setup/AOI exists. Report them separately as strategyConditionsMet.
2) ENTRY CONFIRMATION: This is the actual price event that permits entry after the setup exists. Use the selected strategy's entryConfirmationRule and the selected timeframe mapping. Report it separately as entryConfirmation.
3) UNIVERSAL VALIDATION: Analyzer Rules 1–6 remain unchanged and must still be evaluated and displayed. However, once the strategy conditions are met AND Entry Confirmation is YES, those remaining validation conditions are informational and MUST NOT gate the confirmed trade. Do not turn a failed secondary gate into CONFIRMATION = NO after a valid entry confirmation has occurred.
4) LIFECYCLE: ACTIVE, TP1, TP2, SL, COMPLETED/INVALIDATED are post-entry lifecycle states. They are NEVER entry confirmation and must never be used to manufacture confirmation.

SELECTED-TIMEFRAME ENTRY CONFIRMATION MAPPING
- Selected M5: Entry Confirmation is evaluated on M5 only.
- Selected M15: Entry Confirmation may be valid on M5 OR M15. M5 may confirm first; M15 does not have to confirm first.
- Selected HTF (30M, 1H, 4H, 1D, 1W, 1M): Entry Confirmation is evaluated on M15.
The selected confirmation timeframe is the timeframe used to confirm the trade. Do not require simultaneous M5/M15 directional agreement.

ENTRY CONFIRMATION FOR THIS STRATEGY
${profile.entryConfirmationRule}
Allowed confirmation timeframes for this selection: ${allowedConfirmationTimeframes.join(" or ")}

ENTRY CONFIRMATION OUTPUT RULE
entryConfirmationReason must describe ONLY the entry-trigger event and its evidence on the confirmation timeframe (for example MSS, breaker reaction, engulfing, FVG/retest or the source-defined trigger). Do not copy strategy conditions, universal validation failures, ATR/volume/SMC gates, lifecycle state, or a generic "still required" list into this field. When confirmation is NO, state the specific entry-trigger event that is missing. When confirmation is YES, state the exact trigger that occurred and the confirmation price/level.

ACTUAL ENTRY OUTPUT RULE
The schema field 'entry' is the actual trade entry price AFTER Entry Confirmation is YES. It is not the projected entry. Before confirmation, 'entry' may be null. The projected entry is preserved separately from the existing strategy projection.

MTF CONFIRMATION PROGRESSION
The market move can begin on the lower timeframe and develop upward. M5 is the initial/early confirmation and execution timeframe. M15 is a stronger confirmation when selected or when the move develops into it. Higher timeframes provide progressively stronger directional context. Do NOT require M15 to confirm before a valid M5 confirmation can execute. Do NOT invalidate an M5 confirmation merely because M15 has not confirmed yet. Do NOT invent an M15 confirmation from an M5 signal.

TP LIFECYCLE
The AI Scanner displays TP1, TP2, TP3 and TP4 as projected opportunity targets. The actual trade lifecycle is separate from entry confirmation. TP1 is not entry confirmation and must never invalidate an unconfirmed setup. Do not use projected TP1/TP2/TP3/TP4 as confirmation.

CONFIRMED ENTRY RULE
A confirmed entry requires strategyConditionsMet = true and entryConfirmation = true. Once Entry Confirmation is YES, universal validation results and projected geometry remain visible for risk/context reporting but cannot veto the confirmed entry. Actual Entry is recorded from the confirmed entry event and then fixed.

SELECTED STRATEGY
${JSON.stringify({ id: strategyId, name: profile.name, focus: profile.focus, rules: profile.rules, indicatorSpecs: profile.indicatorSpecs, entryConfirmationRule: profile.entryConfirmationRule, confirmationTimeframe: profile.confirmationTimeframe, selectedTimeframe, allowedConfirmationTimeframes, sourceRules })}
EXISTING ANALYZER RESULT
${JSON.stringify(prior)}
EXISTING LIFECYCLE INPUT
${JSON.stringify(lifecycleInput)}
MTF EVIDENCE
${JSON.stringify(mtfEvidence)}
CURRENT PRICE
${currentPrice}

Return JSON only. Preserve strategy-defined levels and distinguish strategy setup, entry confirmation, universal validation and lifecycle. Never use ACTIVE/LIVE/TP1/TP2/SL/COMPLETED as entry confirmation.`;
    const schema = { type: "object", additionalProperties: false, properties: { projectedDirection: { type: "string", enum: ["BUY", "SELL", "NO TRADE"] }, analysisState: { type: "string", enum: ["WATCH", "ENTRY_ZONE", "CONFIRMATION_PENDING", "VALIDATION_PENDING", "CONFIRMED", "ACTIVE", "TP2_HIT", "INVALIDATED", "TARGET_COMPLETE", "CYCLE_COMPLETE"] }, strategyConditionsMet: { type: "boolean" }, entryConfirmation: { type: "boolean" }, entryConfirmationReason: { type: "string" }, confirmationTimeframe: { type: "string" }, universalValidationPassed: { type: "boolean" }, trend: { type: "string" }, trendReason: { type: "string" }, institutionalActivity: { type: "string", enum: ["BULLISH", "BEARISH", "NEUTRAL", "INSUFFICIENT"] }, institutionalEvidence: { type: "array", items: { type: "string" } }, confirmations: { type: "array", items: { type: "string" } }, buyProbability: { type: "number", minimum: 0, maximum: 100 }, sellProbability: { type: "number", minimum: 0, maximum: 100 }, projectedProbability: { type: "number", minimum: 0, maximum: 100 }, entry: { type: ["number", "null"] }, stopLoss: { type: ["number", "null"] }, tp1: { type: ["number", "null"] }, tp2: { type: ["number", "null"] }, tp3: { type: ["number", "null"] }, tp4: { type: ["number", "null"] }, finalTp: { type: ["number", "null"] }, confirmationPrice: { type: ["number", "null"] }, reversalPrice: { type: ["number", "null"] }, opposingLiquidityTarget: { type: ["number", "null"] }, waitReason: { type: "string" }, tradeReason: { type: "string" }, invalidation: { type: "string" }, pipeline: { type: "array", items: { type: "string" } }, nextZone: { type: "string" } }, required: ["projectedDirection","analysisState","strategyConditionsMet","entryConfirmation","entryConfirmationReason","confirmationTimeframe","universalValidationPassed","trend","trendReason","institutionalActivity","institutionalEvidence","confirmations","buyProbability","sellProbability","projectedProbability","entry","stopLoss","tp1","tp2","tp3","tp4","finalTp","confirmationPrice","reversalPrice","opposingLiquidityTarget","waitReason","tradeReason","invalidation","pipeline","nextZone"] };
    const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: "gpt-4.1-mini", input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }], max_output_tokens: 4500, text: { format: { type: "json_schema", name: "vaulttrades_ai_scanner", strict: true, schema } } }) });
    if (!response.ok) return Response.json({ error: `AI Scanner request failed: ${(await response.text()).slice(0, 300)}` }, { status: 502 }); const raw = await response.json(); const text = jsonText(raw); if (!text) return Response.json({ error: "AI Scanner returned no structured result." }, { status: 502 }); const ai = JSON.parse(text);
    let buyProbability = finite(ai.buyProbability) ? Math.max(0, Math.min(100, ai.buyProbability)) : 50; let sellProbability = finite(ai.sellProbability) ? Math.max(0, Math.min(100, ai.sellProbability)) : 50; const totalProbability = buyProbability + sellProbability || 1; buyProbability = buyProbability / totalProbability * 100; sellProbability = sellProbability / totalProbability * 100;
    const probabilityDirection: Direction = buyProbability > sellProbability ? "BUY" : sellProbability > buyProbability ? "SELL" : "NO TRADE";
    const direction: Direction =
      prior.direction === "BUY" || prior.direction === "SELL"
        ? prior.direction
        : prior.projectedDirection === "BUY" || prior.projectedDirection === "SELL"
          ? prior.projectedDirection
          : ai.projectedDirection === "BUY" || ai.projectedDirection === "SELL"
            ? ai.projectedDirection
            : "NO TRADE";
    const sourceProjectedEntry = finite(prior.projectedEntry) ? prior.projectedEntry : finite(prior.entry) ? prior.entry : null; const sourceProjectedStop = finite(prior.projectedStopLoss) ? prior.projectedStopLoss : finite(prior.stopLoss) ? prior.stopLoss : null; const sourceProjectedTp1 = finite(prior.projectedTp1) ? prior.projectedTp1 : finite(prior.tp1) ? prior.tp1 : null; const sourceProjectedTp2 = finite(prior.projectedTp2) ? prior.projectedTp2 : finite(prior.tp2) ? prior.tp2 : null; const sourceProjectedTp3 = finite(prior.projectedTp3) ? prior.projectedTp3 : null; const sourceProjectedTp4 = finite(prior.projectedTp4) ? prior.projectedTp4 : finite(prior.finalTp) ? prior.finalTp : null;
    const support = finite(prior?.structure?.support) ? prior.structure.support : mtfEvidence.m15?.support ?? null; const resistance = finite(prior?.structure?.resistance) ? prior.structure.resistance : mtfEvidence.m15?.resistance ?? null; const volatility = finite(prior?.volatility?.atr) ? prior.volatility.atr : atr(candles); const fallback = structuralProjection(direction, currentPrice, support, resistance, volatility);
    const projectedEntry = strategyId === "fibRetracement" ? (direction === "BUY" ? fibBuyLevel?.price ?? sourceProjectedEntry : direction === "SELL" ? fibSellLevel?.price ?? sourceProjectedEntry : sourceProjectedEntry) : sourceProjectedEntry ?? fallback?.entry ?? null; const projectedStopLoss = sourceProjectedStop ?? fallback?.stop ?? (finite(ai.stopLoss) ? ai.stopLoss : null); const projectedTp1 = sourceProjectedTp1 ?? fallback?.tp1 ?? (finite(ai.tp1) ? ai.tp1 : null); const projectedTp2 = sourceProjectedTp2 ?? fallback?.tp2 ?? (finite(ai.tp2) ? ai.tp2 : null); const projectedTp3 = sourceProjectedTp3 ?? fallback?.tp3 ?? (finite(ai.tp3) ? ai.tp3 : null); const projectedTp4 = sourceProjectedTp4 ?? fallback?.tp4 ?? (finite(ai.tp4) ? ai.tp4 : finite(ai.finalTp) ? ai.finalTp : null);
    const strategyConditionsMet = ai.strategyConditionsMet === true;
    const entryConfirmation = ai.entryConfirmation === true;
    const reportedConfirmationTimeframe = clean(ai.confirmationTimeframe).toUpperCase();
    const selectedConfirmationTimeframe = allowedConfirmationTimeframes.includes(reportedConfirmationTimeframe) ? reportedConfirmationTimeframe : allowedConfirmationTimeframes[0];
    const universalValidationPassed = ai.universalValidationPassed === true;
    const priorActual = finite(prior.actualEntry) ? prior.actualEntry : null;
    const lifeActual = finite(lifecycleInput.actualEntry) ? lifecycleInput.actualEntry : null;
    const baseConfirmedSignal = direction !== "NO TRADE" && strategyConditionsMet && entryConfirmation;

    // Once a trade is ACTIVE, its execution geometry is immutable until the lifecycle
    // completes. Strategy projections may continue to move for a future setup, but they
    // must never rewrite the running trade's entry, SL or targets.
    const lifecycleLocked =
      lifecycleInput?.status === "ACTIVE" &&
      (direction === "BUY" || direction === "SELL") &&
      (lifecycleInput?.direction === direction || lifecycleInput?.priorDirection === direction) &&
      finite(lifecycleInput?.actualEntry) &&
      finite(lifecycleInput?.stopLoss);

    const lockedEntry = lifecycleLocked ? Number(lifecycleInput.actualEntry) : null;
    const lockedStopLoss = lifecycleLocked ? Number(lifecycleInput.stopLoss) : null;
    const lockedTp1 = lifecycleLocked && finite(lifecycleInput?.tp1) ? Number(lifecycleInput.tp1) : null;
    const lockedTp2 = lifecycleLocked && finite(lifecycleInput?.tp2) ? Number(lifecycleInput.tp2) : null;
    const lockedFinalTp = lifecycleLocked && finite(lifecycleInput?.finalTp) ? Number(lifecycleInput.finalTp) : null;
    const projectedRisk = finite(projectedEntry) && finite(projectedStopLoss)
      ? Math.abs(projectedEntry - projectedStopLoss)
      : null;
    const lifecycleRisk = lifecycleLocked && finite(lockedEntry) && finite(lockedStopLoss)
      ? Math.abs(lockedEntry - lockedStopLoss)
      : null;
    const geometryRisk = lifecycleRisk ?? projectedRisk ?? (fallback && finite(fallback.entry) && finite(fallback.stop)
      ? Math.abs(fallback.entry - fallback.stop)
      : null);

    // Persisted lifecycle levels are untrusted execution state. Validate them
    // before they are allowed to overwrite the current strategy geometry.
    const lockedGeometry = lifecycleLocked
      ? enforceExecutionGeometry(
          direction,
          lockedEntry,
          lockedStopLoss,
          lockedTp1,
          lockedTp2,
          lockedFinalTp,
          geometryRisk,
        )
      : null;


    // Execution integrity is separate from the strategy's confirmation rules. A confirmed
    // strategy event can only become an active trade if its actual entry has a coherent
    // stop/target geometry. This prevents stale/AI-generated prices from creating an
    // impossible lifecycle without changing the strategy's entry conditions.
    const hasExplicitAiEntry = finite(ai.confirmationPrice) || finite(ai.entry);
    const aiEntryCandidate = finite(ai.confirmationPrice)
      ? ai.confirmationPrice
      : finite(ai.entry)
        ? ai.entry
        : currentPrice;
    const storedEntryCandidate = lockedEntry ?? lifeActual ?? priorActual;
    const candidateEntry = storedEntryCandidate ?? (baseConfirmedSignal ? aiEntryCandidate : null);
    const candidateTarget = projectedTp2 ?? projectedTp1;

    // First repair/validate the strategy projection. This is deliberately a
    // post-strategy execution gate: valid strategy levels are preserved, while
    // impossible direction/target geometry is repaired without changing the
    // strategy's confirmation conditions.
    const projectedExecution = enforceExecutionGeometry(
      direction,
      projectedEntry,
      projectedStopLoss,
      projectedTp1,
      projectedTp2,
      projectedTp4,
      projectedRisk,
    );

    // Before confirmation, the single visible ENTRY is the strategy projection.
    // Once confirmation produces an actual entry, SL/TP are rebased from the
    // projected-entry geometry onto that confirmed entry. This prevents a
    // confirmed entry from inheriting SL/TP distances from a different price.
    const projectedGeometry = executionGeometry(
      direction,
      projectedEntry,
      projectedExecution.stopLoss,
      projectedExecution.tp2 ?? projectedExecution.tp1 ?? candidateTarget,
    );

    let actualEntry: number | null = null;
    if (lifecycleLocked && lockedEntry !== null && lockedGeometry?.valid) {
      actualEntry = lockedEntry;
    } else if (baseConfirmedSignal && candidateEntry !== null && projectedGeometry.valid) {
      actualEntry = candidateEntry;
    } else if (baseConfirmedSignal && !hasExplicitAiEntry) {
      actualEntry = currentPrice;
    }

    const confirmedExecution = !lifecycleLocked && actualEntry !== null
      ? rebaseExecutionLevels(
          direction,
          projectedEntry,
          projectedExecution.stopLoss,
          projectedExecution.tp1,
          projectedExecution.tp2,
          projectedExecution.finalTp,
          actualEntry,
        )
      : null;

    const rawExecutionStopLoss = lockedGeometry?.stopLoss ?? confirmedExecution?.stopLoss ?? projectedExecution.stopLoss;
    const rawExecutionTp1 = lockedGeometry?.tp1 ?? confirmedExecution?.tp1 ?? projectedExecution.tp1;
    const rawExecutionTp2 = lockedGeometry?.tp2 ?? confirmedExecution?.tp2 ?? projectedExecution.tp2;
    const rawExecutionFinalTp = lockedGeometry?.finalTp ?? confirmedExecution?.finalTp ?? projectedExecution.finalTp;

    // Final gate: even after lifecycle restoration/rebasing, never expose an
    // impossible SL/TP relationship to the UI or execution lifecycle.
    const executionLevels = actualEntry !== null
      ? enforceExecutionGeometry(
          direction,
          actualEntry,
          rawExecutionStopLoss,
          rawExecutionTp1,
          rawExecutionTp2,
          rawExecutionFinalTp,
          geometryRisk,
        )
      : projectedExecution;

    const executionStopLoss = executionLevels.stopLoss;
    const executionTp1 = executionLevels.tp1;
    const executionTp2 = executionLevels.tp2;
    const executionFinalTp = executionLevels.finalTp;

    const confirmedSignal = baseConfirmedSignal && actualEntry !== null;
    const lifecycle = evaluateTradeLifecycle({
      direction: direction === "BUY" || direction === "SELL" ? direction : "NONE",
      currentPrice,
      projectedEntry,
      actualEntry,
      projectedStopLoss: executionStopLoss,
      projectedTp1: executionTp1,
      projectedTp2: executionTp2,
      projectedFinalTp: executionFinalTp,
      priorStatus: lifecycleInput.status ?? prior?.status ?? null,
      priorDirection: lifecycleInput.priorDirection ?? prior?.priorDirection ?? null,
      oppositeConfirmed: lifecycleInput.oppositeConfirmed === true,
      tp1AlreadyHit: false,
      tp2AlreadyHit: false,
      stopAlreadyHit: lifecycleInput.stopHit === true || prior?.stopHit === true,
      cycleComplete: lifecycleInput.cycleComplete === true
    });
    const cycleComplete = lifecycle.status === "SL_HIT" || lifecycle.status === "CYCLE_COMPLETE";
    const active = actualEntry !== null && lifecycle.status === "ACTIVE";
    const state = cycleComplete
      ? lifecycle.status
      : active
        ? "ACTIVE"
        : confirmedSignal
          ? "CONFIRMED"
          : strategyConditionsMet
            ? "CONFIRMATION_PENDING"
            : ai.analysisState;
    // The UI must use the same validated execution levels as the lifecycle,
    // including the CONFIRMED-but-not-yet-ACTIVE state. Never fall back to raw
    // projected TP/SL values after the execution gate has repaired them.
    const displayedStopLoss = executionStopLoss;
    const displayedTp1 = executionTp1;
    const displayedTp2 = executionTp2;
    const displayedFinalTp = executionFinalTp;
    const projectionMath = math(direction, actualEntry ?? projectedEntry, displayedStopLoss, displayedTp2 ?? displayedTp1, currentPrice);
    const executionValidation = executionGeometry(direction, actualEntry ?? projectedEntry, displayedStopLoss, displayedTp2 ?? displayedTp1);
    const statusMessage = active
      ? `${direction} ACTIVE — confirmed entry ${actualEntry}. Lifecycle is separate from entry confirmation.`
      : cycleComplete
        ? lifecycle.message
        : confirmedSignal
          ? `${direction} CONFIRMED — Entry Confirmation: YES (${selectedConfirmationTimeframe}).`
          : strategyConditionsMet
            ? `${direction} SETUP CONFIRMED — waiting for a valid entry price.`
            : `${direction} DEVELOPING — strategy conditions pending.`;
    return Response.json({
      ...ai,
      projectedDirection: direction,
      analysisState: state,
      statusMessage,
      lockedExecutionLevels: active || lifecycleLocked,
      buyProbability,
      sellProbability,
      probabilityDirection,
      entry: actualEntry ?? projectedEntry,
      projectedEntry,
      actualEntry,
      stopLoss: displayedStopLoss,
      projectedStopLoss: displayedStopLoss,
      tp1: displayedTp1,
      projectedTp1: displayedTp1,
      tp2: displayedTp2,
      projectedTp2: displayedTp2,
      tp3: projectedTp3,
      projectedTp3,
      tp4: displayedFinalTp,
      projectedTp4: displayedFinalTp,
      finalTp: displayedFinalTp,
      projectedFinalTp: displayedFinalTp,
      confirmationPrice: entryConfirmation && finite(ai.confirmationPrice) ? ai.confirmationPrice : null,
      tp1Hit: false,
      tp2Hit: false,
      stopHit: lifecycle.stopHit,
      cycleStatus: lifecycle.status,
      projectionReason: fallback?.reason ?? "Selected strategy projection preserved.",
      sourceFib: sourceFib ? { state: sourceFib.state, confidence: sourceFib.confidence } : null,
      fibEntryLevel: strategyId === "fibRetracement" ? (direction === "BUY" ? fibBuyLevel : fibSellLevel) : null,
      allowedFibEntryPercentages: strategyId === "fibRetracement" ? [82, 78.6, 68.1, 61.8] : [],
      volumeProfile: volume,
      rr: projectionMath.rr,
      priceValidation: projectionMath,
      executionValidation,
      isExecutable: confirmedSignal && actualEntry !== null && !cycleComplete,
      waitReason: statusMessage,
      tradeReason: statusMessage,
      invalidation: String(ai.invalidation || ""),
      mtf: mtfEvidence,
      confirmation: {
        strategyConditionsMet,
        entryConfirmation,
        entryConfirmationReason: String(ai.entryConfirmationReason || ""),
        confirmationTimeframe: selectedConfirmationTimeframe,
        universalValidationPassed
      },
      mtfHierarchy: {
        enabled: mtfEvidence.enabled,
        htfTimeframe: mtfEvidence.htfTimeframe,
        htfSourceOfTruth: true,
        m15Role: "STRONGER_CONFIRMATION",
        m5Role: "INITIAL_EXECUTION_CONFIRMATION",
        lowerTimeframesRewriteHtfLevels: false,
        projectedEntrySource: "HTF_STRATEGY",
        actualEntryRule: "STRATEGY_ENTRY_CONFIRMATION",
        independentLowerTimeframeCycles: true,
        lifecycleTarget: "OPPOSITE_CONFIRMED_SETUP_OR_SL"
      }
    });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "AI Scanner failed." }, { status: 500 }); }
}

import { ANALYZER_STRATEGY_MAP, type IndicatorName } from "../../../lib/strategies/analyzerProfiles";
import { getStrategyRules, type StrategyId } from "../../../lib/strategies";

const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1H", "4H", "1D", "1W", "1M"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];
const INDICATORS: IndicatorName[] = ["SMA", "EMA", "Ichimoku", "Bollinger Bands", "ATR", "VWAP", "Supertrend", "SAR", "RSI", "MACD", "KST", "Stochastic", "ADX", "Percent B", "MFI", "DPO", "RVOL", "A/D"];
const STRATEGY_IDS = Object.keys(ANALYZER_STRATEGY_MAP);
type Direction = "BUY" | "SELL" | "NO TRADE";

const num = (v: unknown) => { const n = typeof v === "number" ? v : Number(v); return Number.isFinite(n) ? n : null; };
const arr = (v: unknown) => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map(x => x.trim()).filter(Boolean) : [];
const validTimeframes = (v: unknown): Timeframe[] => Array.isArray(v) ? v.filter((x): x is Timeframe => typeof x === "string" && TIMEFRAMES.includes(x as Timeframe)).slice(0, 2) : [];
const validIndicators = (v: unknown): IndicatorName[] => Array.isArray(v) ? v.filter((x): x is IndicatorName => typeof x === "string" && INDICATORS.includes(x as IndicatorName)).slice(0, 3) : [];

function normalizeProjection(raw: any, strategy: string, sourceExecution: string[]) {
  if (!raw || typeof raw !== "object") return null;
  const p = {
    available: Boolean(raw.available),
    setupType: String(raw.setupType || strategy),
    zoneLow: num(raw.zoneLow), zoneHigh: num(raw.zoneHigh),
    expectedEntry: num(raw.expectedEntry), expectedStopLoss: num(raw.expectedStopLoss),
    expectedTp1: num(raw.expectedTp1), expectedTp2: num(raw.expectedTp2), expectedFinalTp: num(raw.expectedFinalTp),
    retestRequired: Boolean(raw.retestRequired), retestStatus: String(raw.retestStatus || "WAITING"),
    confirmationRequired: String(raw.confirmationRequired || ""), confirmationStatus: String(raw.confirmationStatus || "PENDING")
  };
  if (!p.available) return p;
  const { expectedEntry: entry, expectedStopLoss: sl, expectedTp1: tp1, expectedTp2: tp2, expectedFinalTp: finalTp } = p;
  if ([entry, sl, tp1, tp2, finalTp].some(v => v === null)) {
    return { ...p, available: false, setupType: `${p.setupType} — projected levels incomplete` };
  }
  const direction: Direction = (String(raw.direction || "") === "SELL") ? "SELL" : "BUY";
  const risk = direction === "BUY" ? (entry as number) - (sl as number) : (sl as number) - (entry as number);
  const targetsOrdered = direction === "BUY"
    ? (tp1 as number) > (entry as number) && (tp2 as number) >= (tp1 as number) && (finalTp as number) >= (tp2 as number)
    : (tp1 as number) < (entry as number) && (tp2 as number) <= (tp1 as number) && (finalTp as number) <= (tp2 as number);
  const stopCorrect = direction === "BUY" ? (sl as number) < (entry as number) : (sl as number) > (entry as number);
  const rr = risk > 0 ? Math.abs(((finalTp as number) - (entry as number)) / risk) : 0;
  const coherent = risk > 0 && stopCorrect && targetsOrdered && rr >= 1.0;
  if (!coherent) {
    return { ...p, available: false, setupType: `${p.setupType} — projected risk structure failed validation`, expectedEntry: null, expectedStopLoss: null, expectedTp1: null, expectedTp2: null, expectedFinalTp: null };
  }
  if (sourceExecution.length === 0) return { ...p, available: false, setupType: `${p.setupType} — no source execution rule available` };
  return p;
}

function safeJson(value: unknown, fallback: any) {
  try { return JSON.parse(String(value ?? "")); } catch { return fallback; }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const image = form.get("image");
    const strategyId = String(form.get("strategy") || "");
    const selectedTimeframes = validTimeframes(safeJson(form.get("timeframes"), []));
    const indicatorMode = String(form.get("indicatorMode") || "AUTO") === "MANUAL" ? "MANUAL" : "AUTO";
    const manualIndicators = validIndicators(safeJson(form.get("manualIndicators"), []));

    if (!(image instanceof File)) return Response.json({ error: "Chart image is required." }, { status: 400 });
    if (!STRATEGY_IDS.includes(strategyId)) return Response.json({ error: "Invalid strategy selected." }, { status: 400 });
    if (!selectedTimeframes.length) return Response.json({ error: "Select at least one timeframe." }, { status: 400 });

    const profile = ANALYZER_STRATEGY_MAP[strategyId];
    const activeIndicators = indicatorMode === "AUTO" ? profile.defaultIndicators : manualIndicators;
    const sourceRules = profile.sourceIds.map((id: StrategyId) => getStrategyRules(id));
    const sourceExecution = sourceRules.flatMap(r => r.executionRules);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return Response.json({ error: "OpenAI API key is not configured." }, { status: 500 });

    const bytes = await image.arrayBuffer();
    const imageUrl = `data:${image.type || "image/png"};base64,${Buffer.from(bytes).toString("base64")}`;
    const higher = selectedTimeframes.length === 2 ? selectedTimeframes[1] : selectedTimeframes[0];
    const lower = selectedTimeframes.length === 2 ? selectedTimeframes[0] : selectedTimeframes[0];

    const prompt = `You are VaultTrades Analyzer. You are NOT a generic trading assistant. The selected customer strategy is the analytical framework and its internal source rules are authoritative. AI interprets visible chart evidence through those rules; AI does not invent or replace the strategy.

CUSTOMER STRATEGY: ${profile.name}
TIMEFRAMES: ${selectedTimeframes.join(" + ")}
HIGHER CONTEXT: ${higher}
LOWER SETUP/ENTRY: ${lower}
AUTO/MANUAL INDICATORS: ${indicatorMode} / ${activeIndicators.join(", ") || "None"}
STRATEGY FOCUS: ${JSON.stringify(profile.focus)}
STRATEGY GUARDRAILS: ${JSON.stringify(profile.rules)}

AUTHORITATIVE SOURCE RULES:
${JSON.stringify(sourceRules, null, 2)}

NON-NEGOTIABLE SOURCE RULE:
Every conclusion must be traceable to the selected source rules plus visible chart evidence. Do not apply generic ICT/SMC/forex assumptions to a non-institutional strategy. For Institutional, use its SMC rules and score BOS, CHoCH, OB, FVG, Liquidity Sweep and Displacement 1-10; require at least two >=7 for a NEW trade. For every other strategy, use that strategy's own source sequence instead.

THE INDICATOR/DASHBOARD IS COMMUNICATIVE EVIDENCE:
The uploaded chart may contain the strategy's own dashboard, state text, entry/SL/TP levels, historical labels, breakout markers, structure markers, result tags, or other execution information. Read these as first-class evidence. Do not require the customer to provide proprietary indicator output, prior analysis, source code, or another screenshot. The developer's source rules have already been supplied internally.

LIFECYCLE FIRST:
Before deciding whether a NEW trade exists, determine the current lifecycle from visible evidence:
- WAITING / CHANNEL / NEUTRAL
- DIRECTION established
- BREAKOUT / REVERSAL / DEVELOPING
- READY for execution
- ACTIVE trade
- TP1 HIT / TP2 HIT / TP3 or FINAL TP HIT
- STOP LOSS / INVALIDATED
- COMPLETED
A current ACTIVE trade is not a NEW TRADE. If an active trade is visible, tradeDecision must normally be NO TRADE because the user should not chase it, while currentState=ACTIVE and currentTrade must describe the running position and target progress.

A NO TRADE verdict means NO NEW ENTRY NOW. It must never mean "nothing is happening" when a source state, active trade, prior setup, developing setup, breakout, rejection, consolidation, or next expected setup can be identified.

CURRENT TRADE:
If visible, capture direction, entry, SL, TP1, TP2, final TP, progress and status. If TP1 has already been reached, say TP1 HIT and show the remaining targets. If TP2 has been reached, say TP2 HIT. If the final target has been reached, say COMPLETED. Never replace a visible active trade with WAITING simply because there is no new entry event.

PRIOR SETUP / FOOTPRINT:
Scan the entire visible chart from the oldest visible candle to the current candle. Reconstruct the most recent qualifying setup(s) that are supported by the selected source. Prefer up to five reliable footprints, newest first. A footprint can be confirmed from visible source labels, entry/SL/TP lines, result tags, dashboard state, or the price sequence itself when the source rules permit reconstruction. Report approximate time if visible, direction, setup type, entry, SL, TP1/TP2/final, lifecycle outcome, and evidence. Do not ask the customer to supply history. If history is genuinely outside the visible chart, state that the visible range is insufficient rather than calling the strategy broken.

ANTICIPATED NEXT SETUP:
When there is no current new entry, identify what the selected source is waiting for and WHERE it is expected. Never say only "waiting for market" or "waiting for pullback". State the expected price/zone if derivable, what confirmation is required, and what would invalidate the idea. If a projected entry/SL/TP1/TP2/final can be derived from the source execution rules and visible levels, populate them even when tradeDecision=NO TRADE. These are EXPECTED levels, not live execution levels.

SOURCE-SPECIFIC EXAMPLES:
For Volatility & Breakout, communicate channel/direction/breakout/acceptance/recovery, location safety, momentum/confirmation, W/M reversal or continuation, OB state, invalidation and the source RR lifecycle. Do not reduce it to EMA/ATR/RVOL.
For Continuation, preserve expansion, correction, structural hold, recovery and confirmed continuation as distinct states.
For Fib Retracement, preserve source-defined anchors, retracement/flip logic, confirmation and target ladder.
For Swing/Engulfing, preserve sweep, structure and engulfing confirmation sequence.
For Proprietary Flow, preserve observation, bias lock, execution and qualification states without exposing the internal implementation name.
For Institutional, apply the supplied SMC scoring and session/risk rules only.

RISK MATH:
For BUY, risk = entry - SL and targets must be above entry. For SELL, risk = SL - entry and targets must be below entry. Validate all numbers mathematically. Confidence must reflect source-condition completeness and evidence quality, not profitability. If the source defines an RR ladder, respect it. Never fabricate a level solely to fill a field.

CHOPPY / UNCLEAR:
If the selected source rules cannot establish a valid state from the visible evidence, return NO TRADE but explain the actual market state and the exact source condition still missing. Do not use generic filler.

USER-FACING OUTPUT:
Do not expose internal module names, Pine code, proprietary parameter recipes, or implementation names. Do not repeat the strategy name or indicator list in the analysis body because those are already shown above the chart. The output should read like a knowledgeable analyst translating the selected strategy's own language.

Return JSON only.`;

    const schema = {
      type: "object", additionalProperties: false,
      properties: {
        tradeDecision: { type: "string", enum: ["TRADE", "NO TRADE"] },
        direction: { type: "string", enum: ["BUY", "SELL", "NO TRADE"] },
        confidence: { type: "number", minimum: 0, maximum: 100 },
        asset: { type: "string" }, timeframe: { type: "string" }, marketCondition: { type: "string" }, directionalBias: { type: "string" },
        decisionReason: { type: "string" }, marketState: { type: "string" }, setup: { type: "string" },
        confirmedConditions: { type: "array", items: { type: "string" } }, missingConditions: { type: "array", items: { type: "string" } }, invalidation: { type: "string" },
        entry: { type: ["number", "null"] }, stopLoss: { type: ["number", "null"] }, tp1: { type: ["number", "null"] }, tp2: { type: ["number", "null"] }, finalTp: { type: ["number", "null"] },
        strategyAnalysis: { type: "object", additionalProperties: false, properties: { marketStructure: { type: "string" }, priceAction: { type: "string" }, liquidity: { type: "string" }, momentum: { type: "string" }, volatility: { type: "string" }, indicatorConfirmation: { type: "string" } }, required: ["marketStructure", "priceAction", "liquidity", "momentum", "volatility", "indicatorConfirmation"] },
        aiIndicators: { type: "array", items: { type: "object", additionalProperties: false, properties: { name: { type: "string" }, reason: { type: "string" } }, required: ["name", "reason"] } },
        bollinger: { type: "object", additionalProperties: false, properties: { status: { type: "string" }, period: { type: ["number", "null"] }, standardDeviation: { type: ["number", "null"] }, series: { type: "string" }, maType: { type: "string" }, reason: { type: "string" }, optimized: { type: "boolean" } }, required: ["status", "period", "standardDeviation", "series", "maType", "reason", "optimized"] },
        projection: { type: "object", additionalProperties: false, properties: { available: { type: "boolean" }, direction: { type: "string", enum: ["BUY", "SELL", "NO TRADE"] }, setupType: { type: "string" }, zoneLow: { type: ["number", "null"] }, zoneHigh: { type: ["number", "null"] }, expectedEntry: { type: ["number", "null"] }, expectedStopLoss: { type: ["number", "null"] }, expectedTp1: { type: ["number", "null"] }, expectedTp2: { type: ["number", "null"] }, expectedFinalTp: { type: ["number", "null"] }, retestRequired: { type: "boolean" }, retestStatus: { type: "string" }, confirmationRequired: { type: "string" }, confirmationStatus: { type: "string" } }, required: ["available", "direction", "setupType", "zoneLow", "zoneHigh", "expectedEntry", "expectedStopLoss", "expectedTp1", "expectedTp2", "expectedFinalTp", "retestRequired", "retestStatus", "confirmationRequired", "confirmationStatus"] },
        previousSetup: { type: "object", additionalProperties: false, properties: { found: { type: "boolean" }, timestamp: { type: "string" }, direction: { type: "string" }, entry: { type: ["number", "null"] }, stopLoss: { type: ["number", "null"] }, tp1: { type: ["number", "null"] }, tp2: { type: ["number", "null"] }, finalTp: { type: ["number", "null"] }, outcome: { type: "string" }, evidence: { type: "array", items: { type: "string" } } }, required: ["found", "timestamp", "direction", "entry", "stopLoss", "tp1", "tp2", "finalTp", "outcome", "evidence"] },
        historicalFootprints: { type: "array", items: { type: "object", additionalProperties: false, properties: { timestamp: { type: "string" }, direction: { type: "string", enum: ["BUY", "SELL", "UNKNOWN"] }, setupType: { type: "string" }, entry: { type: ["number", "null"] }, stopLoss: { type: ["number", "null"] }, tp1: { type: ["number", "null"] }, tp2: { type: ["number", "null"] }, finalTp: { type: ["number", "null"] }, lifecycle: { type: "string" }, evidence: { type: "array", items: { type: "string" } } }, required: ["timestamp", "direction", "setupType", "entry", "stopLoss", "tp1", "tp2", "finalTp", "lifecycle", "evidence"] } },
        currentState: { type: "string", enum: ["WAITING", "DEVELOPING", "READY", "ACTIVE", "COMPLETED", "INVALIDATED"] },
        currentTrade: { type: "object", additionalProperties: false, properties: { visible: { type: "boolean" }, direction: { type: "string" }, entry: { type: ["number", "null"] }, stopLoss: { type: ["number", "null"] }, tp1: { type: ["number", "null"] }, tp2: { type: ["number", "null"] }, finalTp: { type: ["number", "null"] }, progress: { type: "string" }, status: { type: "string" }, evidence: { type: "array", items: { type: "string" } } }, required: ["visible", "direction", "entry", "stopLoss", "tp1", "tp2", "finalTp", "progress", "status", "evidence"] },
        nextAction: { type: "string" }
      },
      required: ["tradeDecision", "direction", "confidence", "asset", "timeframe", "marketCondition", "directionalBias", "decisionReason", "marketState", "setup", "confirmedConditions", "missingConditions", "invalidation", "entry", "stopLoss", "tp1", "tp2", "finalTp", "strategyAnalysis", "aiIndicators", "bollinger", "projection", "previousSetup", "historicalFootprints", "currentState", "currentTrade", "nextAction"]
    };

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "gpt-4.1-mini", input: [{ role: "user", content: [{ type: "input_text", text: prompt }, { type: "input_image", image_url: imageUrl }] }], max_output_tokens: 6500, text: { format: { type: "json_schema", name: "vaulttrades_analyzer_v4", strict: true, schema } } })
    });
    if (!response.ok) { console.error("OpenAI analyzer failed", await response.text()); return Response.json({ error: "OpenAI analysis failed." }, { status: 500 }); }
    const body = await response.json();
    const text = body.output?.flatMap((item: any) => item.content ?? []).filter((c: any) => c.type === "output_text").map((c: any) => c.text).join("")?.trim();
    if (!text) return Response.json({ error: "The analyzer returned no structured result." }, { status: 500 });
    const parsed = JSON.parse(text);

    const requestedDirection: Direction = parsed.direction === "BUY" || parsed.direction === "SELL" ? parsed.direction : "NO TRADE";
    const currentTrade = parsed.currentTrade && typeof parsed.currentTrade === "object" ? {
      visible: Boolean(parsed.currentTrade.visible), direction: String(parsed.currentTrade.direction || "NONE"),
      entry: num(parsed.currentTrade.entry), stopLoss: num(parsed.currentTrade.stopLoss), tp1: num(parsed.currentTrade.tp1), tp2: num(parsed.currentTrade.tp2), finalTp: num(parsed.currentTrade.finalTp),
      progress: String(parsed.currentTrade.progress || ""), status: String(parsed.currentTrade.status || ""), evidence: arr(parsed.currentTrade.evidence)
    } : { visible: false, direction: "NONE", entry: null, stopLoss: null, tp1: null, tp2: null, finalTp: null, progress: "", status: "", evidence: [] };

    const riskFor = (direction: Direction, entry: number | null, sl: number | null) => entry !== null && sl !== null ? direction === "BUY" ? entry - sl : direction === "SELL" ? sl - entry : null : null;
    const confirmedEntry = num(parsed.entry), confirmedStop = num(parsed.stopLoss);
    const confirmedRisk = riskFor(requestedDirection, confirmedEntry, confirmedStop);
    const targetOk = (value: unknown) => { const n = num(value); if (n === null || confirmedEntry === null) return null; return requestedDirection === "BUY" ? n > confirmedEntry ? n : null : requestedDirection === "SELL" ? n < confirmedEntry ? n : null : null; };
    const confirmedFinal = targetOk(parsed.finalTp);
    const finalRR = confirmedRisk && confirmedRisk > 0 && confirmedFinal !== null ? Math.abs((confirmedFinal - confirmedEntry!) / confirmedRisk) : null;
    const newTradeValid = parsed.tradeDecision === "TRADE" && requestedDirection !== "NO TRADE" && confirmedRisk !== null && confirmedRisk > 0 && targetOk(parsed.tp1) !== null && targetOk(parsed.tp2) !== null && confirmedFinal !== null && (finalRR === null || finalRR >= 1);

    const historicalFootprints = Array.isArray(parsed.historicalFootprints) ? parsed.historicalFootprints.slice(0, 5).map((x: any) => ({ timestamp: String(x?.timestamp || "Timestamp not visible"), direction: ["BUY", "SELL", "UNKNOWN"].includes(String(x?.direction)) ? String(x.direction) : "UNKNOWN", setupType: String(x?.setupType || "Historical setup"), entry: num(x?.entry), stopLoss: num(x?.stopLoss), tp1: num(x?.tp1), tp2: num(x?.tp2), finalTp: num(x?.finalTp), lifecycle: String(x?.lifecycle || "UNRESOLVED"), evidence: arr(x?.evidence) })) : [];
    const prior = parsed.previousSetup?.found ? parsed.previousSetup : historicalFootprints.find((x: any) => !["ACTIVE", "DEVELOPING"].includes(x.lifecycle)) || null;
    const normalizedPrevious = prior ? { found: true, timestamp: String(prior.timestamp || "Timestamp not visible"), direction: String(prior.direction || "UNKNOWN"), entry: num(prior.entry), stopLoss: num(prior.stopLoss), tp1: num(prior.tp1), tp2: num(prior.tp2), finalTp: num(prior.finalTp), outcome: String(prior.outcome || prior.lifecycle || "UNRESOLVED"), evidence: arr(prior.evidence) } : { found: false, timestamp: "No reliable prior setup visible", direction: "UNKNOWN", entry: null, stopLoss: null, tp1: null, tp2: null, finalTp: null, outcome: "No reliable prior setup in the visible range", evidence: [] };

    const projection = normalizeProjection(parsed.projection, profile.name, sourceExecution);
    const safeCurrentState = currentTrade.visible ? "ACTIVE" : ["WAITING", "DEVELOPING", "READY", "ACTIVE", "COMPLETED", "INVALIDATED"].includes(String(parsed.currentState)) ? parsed.currentState : "WAITING";
    const safeDecision = newTradeValid && !currentTrade.visible ? "TRADE" : "NO TRADE";
    const safeDirection: Direction = safeDecision === "TRADE" ? requestedDirection : "NO TRADE";
    const safeEntry = safeDecision === "TRADE" ? confirmedEntry : null;
    const safeStop = safeDecision === "TRADE" ? confirmedStop : null;
    const safeRisk = safeDecision === "TRADE" ? confirmedRisk : null;
    const safeTarget = (value: unknown) => safeDecision === "TRADE" ? targetOk(value) : null;

    const aiIndicators = Array.isArray(parsed.aiIndicators) ? parsed.aiIndicators.filter((x: any) => typeof x?.name === "string").slice(0, 3).map((x: any) => ({ name: x.name, selected: true, reason: String(x.reason || "Strategy-aligned confirmation") })) : activeIndicators.map(name => ({ name, selected: true, reason: "Strategy-aligned confirmation" }));
    const bollinger = parsed.bollinger && typeof parsed.bollinger === "object" ? parsed.bollinger : { status: "NOT REQUIRED", period: null, standardDeviation: null, series: "", maType: "", reason: "Not required by the selected strategy.", optimized: false };

    return Response.json({
      success: true,
      strategy: { id: profile.id, name: profile.name, category: profile.category },
      market: { asset: String(parsed.asset || "Information unavailable"), timeframe: String(parsed.timeframe || selectedTimeframes.join(" + ")), marketCondition: String(parsed.marketCondition || "Information unavailable"), directionalBias: String(parsed.directionalBias || "Information unavailable") },
      aiIndicators, bollinger, strategyAnalysis: parsed.strategyAnalysis,
      decision: safeDecision,
      tradeSignal: { direction: safeDirection, confidence: Math.max(0, Math.min(100, Math.round(Number(parsed.confidence) || 0))), entry: safeEntry, stopLoss: safeStop, risk: safeRisk, tp1: safeTarget(parsed.tp1), tp2: safeTarget(parsed.tp2), finalTp: safeTarget(parsed.finalTp), invalidation: String(parsed.invalidation || "") },
      decisionReason: String(parsed.decisionReason || ""), marketState: String(parsed.marketState || ""), setup: String(parsed.setup || ""),
      confirmedConditions: arr(parsed.confirmedConditions), missingConditions: arr(parsed.missingConditions), projection, previousSetup: normalizedPrevious, historicalFootprints,
      currentState: safeCurrentState, currentTrade, nextAction: String(parsed.nextAction || "Wait for the next valid strategy event.")
    });
  } catch (error) {
    console.error("VaultTrades analyzer-v4 error", error);
    return Response.json({ error: "Unable to analyze the chart." }, { status: 500 });
  }
}

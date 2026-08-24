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

function normalizeProjection(raw: any, direction: Direction, strategy: string) {
  if (!raw || typeof raw !== "object") return null;
  const p = {
    available: Boolean(raw.available), setupType: String(raw.setupType || ""), zoneLow: num(raw.zoneLow), zoneHigh: num(raw.zoneHigh),
    expectedEntry: num(raw.expectedEntry), expectedStopLoss: num(raw.expectedStopLoss), expectedTp1: num(raw.expectedTp1), expectedTp2: num(raw.expectedTp2), expectedFinalTp: num(raw.expectedFinalTp),
    retestRequired: Boolean(raw.retestRequired), retestStatus: String(raw.retestStatus || ""), confirmationRequired: String(raw.confirmationRequired || ""), confirmationStatus: String(raw.confirmationStatus || "")
  };
  if (!p.available) return p;
  const { zoneLow, zoneHigh, expectedEntry: entry, expectedStopLoss: sl, expectedTp1: tp1, expectedTp2: tp2, expectedFinalTp: finalTp } = p;
  if ([zoneLow, zoneHigh, entry, sl, tp1, tp2, finalTp].some(v => v === null)) return { ...p, available: false, setupType: `${p.setupType || strategy} — projected levels incomplete` };
  const validZone = (zoneLow as number) < (zoneHigh as number) && (entry as number) >= (zoneLow as number) && (entry as number) <= (zoneHigh as number);
  const coherent = direction === "BUY"
    ? validZone && (sl as number) < (zoneLow as number) && (tp1 as number) > (zoneHigh as number) && (tp2 as number) >= (tp1 as number) && (finalTp as number) >= (tp2 as number)
    : direction === "SELL"
      ? validZone && (sl as number) > (zoneHigh as number) && (tp1 as number) < (zoneLow as number) && (tp2 as number) <= (tp1 as number) && (finalTp as number) <= (tp2 as number)
      : false;
  if (!coherent) return { ...p, available: false, setupType: `${p.setupType || strategy} — projected levels rejected because the risk structure is incoherent`, zoneLow: null, zoneHigh: null, expectedEntry: null, expectedStopLoss: null, expectedTp1: null, expectedTp2: null, expectedFinalTp: null };
  return p;
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const image = form.get("image");
    const strategyId = String(form.get("strategy") || "");
    const selectedTimeframes = validTimeframes(JSON.parse(String(form.get("timeframes") || "[]")));
    const indicatorMode = String(form.get("indicatorMode") || "AUTO") === "MANUAL" ? "MANUAL" : "AUTO";
    const manualIndicators = validIndicators(JSON.parse(String(form.get("manualIndicators") || "[]")));
    if (!(image instanceof File)) return Response.json({ error: "Chart image is required." }, { status: 400 });
    if (!STRATEGY_IDS.includes(strategyId)) return Response.json({ error: "Invalid strategy selected." }, { status: 400 });
    if (!selectedTimeframes.length) return Response.json({ error: "Select at least one timeframe." }, { status: 400 });

    const profile = ANALYZER_STRATEGY_MAP[strategyId];
    const activeIndicators = indicatorMode === "AUTO" ? profile.defaultIndicators : manualIndicators;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return Response.json({ error: "OpenAI API key is not configured." }, { status: 500 });

    const sourceRules = profile.sourceIds.map((id: StrategyId) => getStrategyRules(id));
    const bytes = await image.arrayBuffer();
    const imageUrl = `data:${image.type || "image/png"};base64,${Buffer.from(bytes).toString("base64")}`;
    const higher = selectedTimeframes.length === 2 ? selectedTimeframes[1] : selectedTimeframes[0];
    const lower = selectedTimeframes.length === 2 ? selectedTimeframes[0] : selectedTimeframes[0];

    const prompt = `You are VaultTrades Analyzer, an AI-powered trading chart analysis and education system. The selected strategy is the primary analytical framework. The system must determine whether a valid setup exists; it must be comfortable returning NO TRADE. Never invent information from a screenshot.

DISPLAY STRATEGY: ${profile.name}
CATEGORY: ${profile.category}
TIMEFRAMES SELECTED: ${selectedTimeframes.join(" + ")}
HIGHER TIMEFRAME CONTEXT: ${higher}
LOWER TIMEFRAME SETUP/ENTRY: ${lower}
INDICATOR MODE: ${indicatorMode}
INDICATORS AVAILABLE: ${activeIndicators.length ? activeIndicators.join(", ") : "None"}
DEFAULT STRATEGY INDICATORS: ${profile.defaultIndicators.join(", ")}
STRATEGY FOCUS: ${JSON.stringify(profile.focus)}
STRATEGY GUARDRAILS: ${JSON.stringify(profile.rules)}

INTERNAL SOURCE-OF-TRUTH RULES (use only to improve accuracy; do not expose internal strategy names, proprietary sequences, parameter recipes, or source-code details in the user-facing output):
${JSON.stringify(sourceRules, null, 2)}

ANALYSIS HIERARCHY:
1. MARKET STRUCTURE — bullish, bearish, ranging or transitional; HH/HL/LH/LL, support, resistance, breakout, rejection, consolidation.
2. SELECTED STRATEGY CONDITIONS — determine whether the selected framework is actually present.
3. PRICE ACTION — rejection, momentum, displacement, consolidation, breakout, retest, reversal, continuation.
4. INDICATOR CONFIRMATION — confirm or contradict the price-action thesis; indicators never create the trade by themselves.
5. VOLATILITY — ATR/Bollinger where relevant.
6. ENTRY — logical entry zone/level only when supported.
7. INVALIDATION — logical invalidation/stop zone.
8. TARGETS — logical targets only when supported.
9. RISK/REWARD — calculate only when the necessary numbers are reliable.
10. CONFIDENCE — score strategy-condition completeness, not profitability.

AUTO INDICATOR RULE:
When AUTO is selected, choose up to three indicators from the available list that best align with the selected strategy, normally using the profile defaults. You may replace one only when screenshot/timeframe/asset conditions make another listed indicator more appropriate. Explain the reason briefly. When MANUAL is selected, use only the supplied indicators and warn if they are poorly aligned.

BOLLINGER RULE:
If Bollinger Bands are relevant to the strategy or manually selected, use AUTO CONFIGURATION with default Period 20, Standard Deviation 2, Series Close, MA Type SMA, but dynamically optimize when the visible chart/strategy/timeframe provides a reason. State the chosen settings. If not relevant, status is NOT REQUIRED.

MULTI-TIMEFRAME RULE:
If two timeframes are selected, higher timeframe = market context and directional bias; lower timeframe = setup/entry. Do not reverse this relationship. If only one is selected, use it for both.

NEVER INVENT INFORMATION:
If asset, price, timeframe, indicator values, support/resistance or entry levels are not clearly visible/reliably inferable, say "Information unavailable from the uploaded chart." Do not manufacture values. Only calculate when the necessary information is reliable.

NO-TRADE RULE:
Return tradeDecision=NO TRADE when the selected strategy conditions are not satisfied, the market is incompatible with the strategy, a required event is not visible, the screenshot is insufficient, or risk structure cannot be established. Examples include trend-following in a range, mean reversion during a strong trend, breakout-retest without an identifiable original breakout, liquidity sweep without a meaningful sweep, divergence without reliable divergence, or insufficient chart information.

TRADE RULE:
Return tradeDecision=TRADE only when the selected strategy has sufficient visible confluence and a coherent entry, invalidation and target structure. Direction must be BUY or SELL. Never represent a setup as guaranteed or certain financial advice.

ACTIVE / EXISTING SETUP COMMUNICATION — CRITICAL:
The uploaded screenshot is NOT merely a trigger for a new trade. It may contain a communicative strategy dashboard, execution table, labels, entry/SL/TP lines, state text, reason text, historical trade tags, or a currently running trade. Read those elements as first-class evidence.

Before deciding NO TRADE, explicitly determine whether the chart/dashboard shows:
- an ACTIVE/RUNNING trade;
- its direction (LONG/SHORT or BUY/SELL);
- entry;
- stop loss;
- TP1/TP2/TP3 or final TP;
- whether TP1, TP2, or another target has already been hit;
- whether the setup is still active, completed, invalidated, or waiting;
- the latest previous setup and its visible outcome.

If an active trade is visible, NEVER describe the result as "no information" and NEVER erase the active trade simply because there is no new entry event. The correct customer-facing outcome is usually:
- tradeDecision = NO TRADE when the user should not enter/chase an already-running trade;
- currentState = ACTIVE;
- currentTrade contains the visible direction, entry, SL, targets and progress;
- decisionReason clearly explains that the existing trade is already underway and whether TP1/TP2 has been reached;
- nextAction tells the user whether to HOLD/OBSERVE, WAIT FOR COMPLETION, or WAIT FOR A NEW SETUP.

An ACTIVE trade is different from a NEW TRADE. "NO TRADE" must mean "do not open a new position now", not "there is nothing happening."

If the dashboard shows a completed historical trade, report it under previousSetup and explain its outcome. If it shows a setup developing but not yet executable, use currentState = DEVELOPING or WAITING and explain exactly what event/confirmation is still required.

The strategy source is intended to be communicative. Translate the source engine's state machine into useful customer-facing language:
WAIT/CHANNEL, DIRECTION, BREAKOUT, REVERSAL, READY, ACTIVE, TP1 HIT, TP2 HIT, TP3 HIT/COMPLETED, STOP LOSS/INVALIDATED, and previous setup where visible. Do not expose proprietary source-code names or implementation details.

ANTICIPATED SETUP:
Keep anticipated setup separate from confirmed trade. A projected setup is a plan for what must happen next, not an active trade. If an active trade exists, anticipated setup must describe the next legitimate opportunity rather than pretending the active trade is a new entry.

PREVIOUS SETUP:
Inspect the visible chart history for the most recent prior setup using the same selected framework. Do not invent one. If a timestamp is visible, report it; otherwise say Timestamp not visible. State whether it appears to have reached a target, invalidation, or remains unresolved based only on visible evidence.


HISTORICAL FOOTPRINT SCAN — CRITICAL:
The chart image is a historical record, not only a snapshot of the current candle. Scan the ENTIRE visible chart area from oldest visible candles to the current candle and reconstruct the most recent qualifying setup(s) that can be supported by visible evidence from the selected strategy. The purpose is to leave a verifiable footprint that a customer can compare against the same area on their TradingView chart.

For every historical setup you report, identify only what is visibly supported:
- approximate timestamp/date if visible; otherwise "Timestamp not visible";
- direction BUY/SELL;
- setup type in customer-safe language;
- visible entry price if shown;
- visible SL and TP1/TP2/TP3/final target if shown;
- lifecycle state: ACTIVE, TP1 HIT, TP2 HIT, FINAL TP HIT, STOP LOSS, INVALIDATED, DEVELOPING, or UNRESOLVED;
- concise evidence explaining which visible strategy footprint supports it.

Scan backward far enough to find the latest completed setup before the current setup/state. Do not stop at the current candle. Do not call a historical setup "untraceable" merely because there is no new trade at the current candle. If the source indicator/dashboard contains historical labels, result tags, entry/SL/TP lines, state text, breakout markers, structure markers, or other strategy-generated footprints, treat those as high-value evidence.

If multiple footprints are visible, return them in chronological order, newest first. Prefer up to 5 reliable footprints. If a footprint cannot be verified from the image, omit it rather than guessing. If no reliable historical footprint is visible, explicitly say that the visible chart history is insufficient; do not manufacture history.

The historical footprint is evidence for the Analyzer, not a new trading signal. A completed previous setup plus no current qualifying setup means the market may be developing, consolidating, ranging, or awaiting the next source-defined event. Explain which one is supported by the visible evidence.

USER-FACING LANGUAGE:
Do NOT expose proprietary internal source strategy names, internal sequence labels, exact Pine implementation details, or private strategy parameters. Explain the market evidence in educational terms. Keep the dashboard sections: ANTICIPATED SETUP, MARKET STATE, PREVIOUS SETUP, EDUCATIONAL BREAKDOWN.

Return ONLY JSON matching the schema.`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }, { type: "input_image", image_url: imageUrl }] }],
        max_output_tokens: 6000,
        text: { format: { type: "json_schema", name: "vaulttrades_analyzer", strict: true, schema: {
          type: "object", additionalProperties: false,
          properties: {
            tradeDecision: { type: "string", enum: ["TRADE", "NO TRADE"] },
            direction: { type: "string", enum: ["BUY", "SELL", "NO TRADE"] },
            confidence: { type: "number", minimum: 0, maximum: 100 },
            asset: { type: "string" }, timeframe: { type: "string" }, marketCondition: { type: "string" }, directionalBias: { type: "string" },
            decisionReason: { type: "string" }, marketState: { type: "string" }, setup: { type: "string" },
            confirmedConditions: { type: "array", items: { type: "string" } }, missingConditions: { type: "array", items: { type: "string" } }, invalidation: { type: "string" },
            entry: { type: ["number", "null"] }, stopLoss: { type: ["number", "null"] }, tp1: { type: ["number", "null"] }, tp2: { type: ["number", "null"] }, finalTp: { type: ["number", "null"] },
            strategyAnalysis: { type: "object", additionalProperties: false, properties: {
              marketStructure: { type: "string" }, priceAction: { type: "string" }, liquidity: { type: "string" }, momentum: { type: "string" }, volatility: { type: "string" }, indicatorConfirmation: { type: "string" }
            }, required: ["marketStructure", "priceAction", "liquidity", "momentum", "volatility", "indicatorConfirmation"] },
            aiIndicators: { type: "array", items: { type: "object", additionalProperties: false, properties: { name: { type: "string" }, reason: { type: "string" } }, required: ["name", "reason"] } },
            bollinger: { type: "object", additionalProperties: false, properties: { status: { type: "string" }, period: { type: ["number", "null"] }, standardDeviation: { type: ["number", "null"] }, series: { type: "string" }, maType: { type: "string" }, reason: { type: "string" }, optimized: { type: "boolean" } }, required: ["status", "period", "standardDeviation", "series", "maType", "reason", "optimized"] },
            projection: { type: "object", additionalProperties: false, properties: {
              available: { type: "boolean" }, setupType: { type: "string" }, zoneLow: { type: ["number", "null"] }, zoneHigh: { type: ["number", "null"] }, expectedEntry: { type: ["number", "null"] }, expectedStopLoss: { type: ["number", "null"] }, expectedTp1: { type: ["number", "null"] }, expectedTp2: { type: ["number", "null"] }, expectedFinalTp: { type: ["number", "null"] }, retestRequired: { type: "boolean" }, retestStatus: { type: "string" }, confirmationRequired: { type: "string" }, confirmationStatus: { type: "string" }
            }, required: ["available", "setupType", "zoneLow", "zoneHigh", "expectedEntry", "expectedStopLoss", "expectedTp1", "expectedTp2", "expectedFinalTp", "retestRequired", "retestStatus", "confirmationRequired", "confirmationStatus"] },
            previousSetup: { type: "object", additionalProperties: false, properties: { found: { type: "boolean" }, timestamp: { type: "string" }, direction: { type: "string" }, entry: { type: ["number", "null"] }, stopLoss: { type: ["number", "null"] }, tp1: { type: ["number", "null"] }, tp2: { type: ["number", "null"] }, finalTp: { type: ["number", "null"] }, outcome: { type: "string" }, evidence: { type: "array", items: { type: "string" } } }, required: ["found", "timestamp", "direction", "entry", "stopLoss", "tp1", "tp2", "finalTp", "outcome", "evidence"] },
            historicalFootprints: { type: "array", items: { type: "object", additionalProperties: false, properties: { timestamp: { type: "string" }, direction: { type: "string", enum: ["BUY", "SELL", "UNKNOWN"] }, setupType: { type: "string" }, entry: { type: ["number", "null"] }, stopLoss: { type: ["number", "null"] }, tp1: { type: ["number", "null"] }, tp2: { type: ["number", "null"] }, finalTp: { type: ["number", "null"] }, lifecycle: { type: "string" }, evidence: { type: "array", items: { type: "string" } } }, required: ["timestamp", "direction", "setupType", "entry", "stopLoss", "tp1", "tp2", "finalTp", "lifecycle", "evidence"] } },

            currentState: { type: "string", enum: ["WAITING", "DEVELOPING", "READY", "ACTIVE", "COMPLETED", "INVALIDATED"] },
            currentTrade: { type: "object", additionalProperties: false, properties: {
              visible: { type: "boolean" }, direction: { type: "string" }, entry: { type: ["number", "null"] }, stopLoss: { type: ["number", "null"] },
              tp1: { type: ["number", "null"] }, tp2: { type: ["number", "null"] }, finalTp: { type: ["number", "null"] },
              progress: { type: "string" }, status: { type: "string" }, evidence: { type: "array", items: { type: "string" } }
            }, required: ["visible", "direction", "entry", "stopLoss", "tp1", "tp2", "finalTp", "progress", "status", "evidence"] },
            nextAction: { type: "string" }
          },
          required: ["tradeDecision", "direction", "confidence", "asset", "timeframe", "marketCondition", "directionalBias", "decisionReason", "marketState", "setup", "confirmedConditions", "missingConditions", "invalidation", "entry", "stopLoss", "tp1", "tp2", "finalTp", "strategyAnalysis", "aiIndicators", "bollinger", "projection", "previousSetup", "historicalFootprints", "currentState", "currentTrade", "nextAction"]
        } } }
      })
    });

    if (!response.ok) { const details = await response.text(); console.error("OpenAI analysis failed", details); return Response.json({ error: "OpenAI analysis failed." }, { status: 500 }); }
    const result = await response.json();
    const text = result.output?.flatMap((item: any) => item.content ?? []).filter((c: any) => c.type === "output_text").map((c: any) => c.text).join("")?.trim();
    if (!text) return Response.json({ error: "The analyzer returned no structured result." }, { status: 500 });
    const parsed = JSON.parse(text);

    const requestedDirection: Direction = parsed.direction === "BUY" || parsed.direction === "SELL" ? parsed.direction : "NO TRADE";
    const tradeDecision = parsed.tradeDecision === "TRADE" && requestedDirection !== "NO TRADE" ? "TRADE" : "NO TRADE";
    const confirmed = tradeDecision === "TRADE";
    const direction: Direction = confirmed ? requestedDirection : "NO TRADE";
    const entry = confirmed ? num(parsed.entry) : null;
    const stopLoss = confirmed ? num(parsed.stopLoss) : null;
    const target = (v: unknown) => { const n = num(v); if (!confirmed || n === null || entry === null) return null; return direction === "BUY" ? (n > entry ? n : null) : (n < entry ? n : null); };
    const risk = confirmed && entry !== null && stopLoss !== null ? direction === "BUY" ? entry - stopLoss : stopLoss - entry : null;
    const coherentRisk = risk !== null && risk > 0;
    const safeDecision = confirmed && coherentRisk ? "TRADE" : "NO TRADE";
    const safeDirection: Direction = safeDecision === "TRADE" ? direction : "NO TRADE";
    const safeEntry = safeDecision === "TRADE" ? entry : null;
    const safeStop = safeDecision === "TRADE" ? stopLoss : null;
    const safeTp1 = safeDecision === "TRADE" ? target(parsed.tp1) : null;
    const safeTp2 = safeDecision === "TRADE" ? target(parsed.tp2) : null;
    const safeFinalTp = safeDecision === "TRADE" ? target(parsed.finalTp) : null;
    const projection = normalizeProjection(parsed.projection, safeDirection, profile.name);
    const aiIndicators = Array.isArray(parsed.aiIndicators) ? parsed.aiIndicators.filter((x: any) => typeof x?.name === "string").slice(0, 3).map((x: any) => ({ name: x.name, selected: true, reason: String(x.reason || "Strategy-aligned confirmation") })) : activeIndicators.map(name => ({ name, selected: true, reason: "Strategy-aligned confirmation" }));
    const bollinger = parsed.bollinger && typeof parsed.bollinger === "object" ? parsed.bollinger : { status: "NOT REQUIRED", period: null, standardDeviation: null, series: "", maType: "", reason: "Not required by the selected strategy.", optimized: false };
    const historicalFootprints = Array.isArray(parsed.historicalFootprints) ? parsed.historicalFootprints.slice(0, 5).map((x: any) => ({ timestamp: String(x?.timestamp || "Timestamp not visible"), direction: ["BUY", "SELL", "UNKNOWN"].includes(String(x?.direction)) ? String(x.direction) : "UNKNOWN", setupType: String(x?.setupType || "Historical setup"), entry: num(x?.entry), stopLoss: num(x?.stopLoss), tp1: num(x?.tp1), tp2: num(x?.tp2), finalTp: num(x?.finalTp), lifecycle: String(x?.lifecycle || "UNRESOLVED"), evidence: arr(x?.evidence) })) : [];
    const historicalPrior = historicalFootprints.find((x: any) => !["ACTIVE", "DEVELOPING"].includes(x.lifecycle));
    const normalizedPreviousSetup = parsed.previousSetup?.found ? parsed.previousSetup : historicalPrior ? { found: true, timestamp: historicalPrior.timestamp, direction: historicalPrior.direction, entry: historicalPrior.entry, stopLoss: historicalPrior.stopLoss, tp1: historicalPrior.tp1, tp2: historicalPrior.tp2, finalTp: historicalPrior.finalTp, outcome: historicalPrior.lifecycle, evidence: historicalPrior.evidence } : parsed.previousSetup || null;

    return Response.json({
      success: true,
      strategy: { id: profile.id, name: profile.name, category: profile.category },
      market: { asset: String(parsed.asset || "Information unavailable"), timeframe: String(parsed.timeframe || selectedTimeframes.join(" + ")), marketCondition: String(parsed.marketCondition || "Information unavailable"), directionalBias: String(parsed.directionalBias || "Information unavailable") },
      aiIndicators, bollinger,
      strategyAnalysis: parsed.strategyAnalysis,
      decision: safeDecision,
      tradeSignal: { direction: safeDirection, confidence: Math.max(0, Math.min(100, Math.round(Number(parsed.confidence) || 0))), entry: safeEntry, stopLoss: safeStop, risk: safeDecision === "TRADE" && coherentRisk ? risk : null, tp1: safeTp1, tp2: safeTp2, finalTp: safeFinalTp, invalidation: String(parsed.invalidation || "") },
      decisionReason: String(parsed.decisionReason || ""), marketState: String(parsed.marketState || ""), setup: String(parsed.setup || ""),
      confirmedConditions: arr(parsed.confirmedConditions), missingConditions: arr(parsed.missingConditions), projection, previousSetup: normalizedPreviousSetup,
      historicalFootprints,
      currentState: ["WAITING", "DEVELOPING", "READY", "ACTIVE", "COMPLETED", "INVALIDATED"].includes(String(parsed.currentState)) ? parsed.currentState : "WAITING",
      currentTrade: parsed.currentTrade && typeof parsed.currentTrade === "object" ? {
        visible: Boolean(parsed.currentTrade.visible),
        direction: String(parsed.currentTrade.direction || "NONE"),
        entry: num(parsed.currentTrade.entry),
        stopLoss: num(parsed.currentTrade.stopLoss),
        tp1: num(parsed.currentTrade.tp1),
        tp2: num(parsed.currentTrade.tp2),
        finalTp: num(parsed.currentTrade.finalTp),
        progress: String(parsed.currentTrade.progress || ""),
        status: String(parsed.currentTrade.status || ""),
        evidence: arr(parsed.currentTrade.evidence)
      } : { visible: false, direction: "NONE", entry: null, stopLoss: null, tp1: null, tp2: null, finalTp: null, progress: "", status: "", evidence: [] },
      nextAction: String(parsed.nextAction || "Wait for the next valid strategy event.")
    });
  } catch (error) {
    console.error("VaultTrades analysis error", error);
    return Response.json({ error: "Unable to analyze the chart." }, { status: 500 });
  }
}

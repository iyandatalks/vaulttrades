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

ANTICIPATED SETUP:
Keep anticipated setup separate from confirmed trade. A projected setup is a plan for what must happen next, not an active trade.

PREVIOUS SETUP:
Inspect the visible chart history for the most recent prior setup using the same selected framework. Do not invent one. If a timestamp is visible, report it; otherwise say Timestamp not visible. State whether it appears to have reached a target, invalidation, or remains unresolved based only on visible evidence.

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
            previousSetup: { type: "object", additionalProperties: false, properties: { found: { type: "boolean" }, timestamp: { type: "string" }, direction: { type: "string" }, entry: { type: ["number", "null"] }, stopLoss: { type: ["number", "null"] }, tp1: { type: ["number", "null"] }, tp2: { type: ["number", "null"] }, finalTp: { type: ["number", "null"] }, outcome: { type: "string" }, evidence: { type: "array", items: { type: "string" } } }, required: ["found", "timestamp", "direction", "entry", "stopLoss", "tp1", "tp2", "finalTp", "outcome", "evidence"] }
          },
          required: ["tradeDecision", "direction", "confidence", "asset", "timeframe", "marketCondition", "directionalBias", "decisionReason", "marketState", "setup", "confirmedConditions", "missingConditions", "invalidation", "entry", "stopLoss", "tp1", "tp2", "finalTp", "strategyAnalysis", "aiIndicators", "bollinger", "projection", "previousSetup"]
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

    return Response.json({
      success: true,
      strategy: { id: profile.id, name: profile.name, category: profile.category },
      market: { asset: String(parsed.asset || "Information unavailable"), timeframe: String(parsed.timeframe || selectedTimeframes.join(" + ")), marketCondition: String(parsed.marketCondition || "Information unavailable"), directionalBias: String(parsed.directionalBias || "Information unavailable") },
      aiIndicators, bollinger,
      strategyAnalysis: parsed.strategyAnalysis,
      decision: safeDecision,
      tradeSignal: { direction: safeDirection, confidence: Math.max(0, Math.min(100, Math.round(Number(parsed.confidence) || 0))), entry: safeEntry, stopLoss: safeStop, risk: safeDecision === "TRADE" && coherentRisk ? risk : null, tp1: safeTp1, tp2: safeTp2, finalTp: safeFinalTp, invalidation: String(parsed.invalidation || "") },
      decisionReason: String(parsed.decisionReason || ""), marketState: String(parsed.marketState || ""), setup: String(parsed.setup || ""),
      confirmedConditions: arr(parsed.confirmedConditions), missingConditions: arr(parsed.missingConditions), projection, previousSetup: parsed.previousSetup || null
    });
  } catch (error) {
    console.error("VaultTrades analysis error", error);
    return Response.json({ error: "Unable to analyze the chart." }, { status: 500 });
  }
}

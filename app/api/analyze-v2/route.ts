import { ANALYZER_STRATEGY_MAP, type IndicatorName } from "../../../lib/strategies/analyzerProfiles";
import { getStrategyRules, type StrategyId } from "../../../lib/strategies";

const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1H", "4H", "1D", "1W", "1M"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];
const INDICATORS: IndicatorName[] = ["SMA", "EMA", "Ichimoku", "Bollinger Bands", "ATR", "VWAP", "Supertrend", "SAR", "RSI", "MACD", "KST", "Stochastic", "ADX", "Percent B", "MFI", "DPO", "RVOL", "A/D", "SMI"];
const STRATEGY_IDS = Object.keys(ANALYZER_STRATEGY_MAP);
type Decision = "TRADE" | "NO TRADE";
type Direction = "BUY" | "SELL" | "NO TRADE";
type CurrentState = "WAITING" | "DEVELOPING" | "READY" | "ACTIVE" | "COMPLETED" | "INVALIDATED";

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
const arr = (v: unknown) => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map(x => x.trim()).filter(Boolean) : [];
const validTimeframes = (v: unknown): Timeframe[] => Array.isArray(v) ? v.filter((x): x is Timeframe => typeof x === "string" && TIMEFRAMES.includes(x as Timeframe)).slice(0, 2) : [];
const validIndicators = (v: unknown): IndicatorName[] => Array.isArray(v) ? v.filter((x): x is IndicatorName => typeof x === "string" && INDICATORS.includes(x as IndicatorName)).slice(0, 12) : [];

function parseJsonField(form: FormData, key: string, fallback: unknown) {
  try { return JSON.parse(String(form.get(key) || JSON.stringify(fallback))); } catch { return fallback; }
}

function tradeMath(direction: Direction, entry: number | null, stopLoss: number | null, tp: number | null, currentPrice: number | null) {
  if ((direction !== "BUY" && direction !== "SELL") || entry === null || stopLoss === null || tp === null) {
    return { valid: false, reason: "Entry, stop and TP are not all available." , risk: null, reward: null, rr: null, slPct: null, entryDistancePct: null };
  }
  const risk = direction === "BUY" ? entry - stopLoss : stopLoss - entry;
  const reward = direction === "BUY" ? tp - entry : entry - tp;
  const rr = risk > 0 ? reward / risk : null;
  const slPct = entry !== 0 ? Math.abs(entry - stopLoss) / Math.abs(entry) * 100 : null;
  const entryDistancePct = currentPrice !== null && currentPrice !== 0 ? Math.abs(entry - currentPrice) / Math.abs(currentPrice) * 100 : null;
  const validGeometry = risk > 0 && reward > 0;
  const validSl = slPct !== null && slPct >= 0.1;
  const validEntry = entryDistancePct === null || entryDistancePct <= 0.5;
  const validRr = rr !== null && rr >= 2;
  return { valid: validGeometry && validSl && validEntry && validRr, reason: !validGeometry ? "Entry/SL/TP geometry is invalid." : !validSl ? "Stop loss is less than the required 0.1% from entry." : !validEntry ? "Entry is more than 0.5% from current price." : !validRr ? "R:R is below the required 1:2." : "All measurable price-level rules passed.", risk, reward, rr, slPct, entryDistancePct };
}

function normalizeProjection(raw: any, direction: Direction, strategy: string) {
  if (!raw || typeof raw !== "object") return null;
  const p = {
    available: Boolean(raw.available),
    setupType: String(raw.setupType || "none"),
    zoneLow: num(raw.zoneLow), zoneHigh: num(raw.zoneHigh),
    expectedEntry: num(raw.expectedEntry), expectedStopLoss: num(raw.expectedStopLoss),
    expectedTp1: num(raw.expectedTp1), expectedTp2: num(raw.expectedTp2), expectedFinalTp: num(raw.expectedFinalTp),
    retestRequired: Boolean(raw.retestRequired), retestStatus: String(raw.retestStatus || "NOT_REQUIRED"),
    confirmationRequired: String(raw.confirmationRequired || ""), confirmationStatus: String(raw.confirmationStatus || "NOT_REQUIRED"),
  };
  if (!p.available) return p;
  const values = [p.zoneLow, p.zoneHigh, p.expectedEntry, p.expectedStopLoss, p.expectedTp1, p.expectedTp2, p.expectedFinalTp];
  if (values.some(v => v === null)) return { ...p, available: false, setupType: `${strategy} — projection incomplete` };
  const zLow = p.zoneLow as number, zHigh = p.zoneHigh as number, entry = p.expectedEntry as number, sl = p.expectedStopLoss as number, tp1 = p.expectedTp1 as number, tp2 = p.expectedTp2 as number, finalTp = p.expectedFinalTp as number;
  const inZone = zLow < zHigh && entry >= zLow && entry <= zHigh;
  const coherent = direction === "BUY" ? inZone && sl < zLow && tp1 > entry && tp2 >= tp1 && finalTp >= tp2 : direction === "SELL" ? inZone && sl > zHigh && tp1 < entry && tp2 <= tp1 && finalTp <= tp2 : false;
  return coherent ? p : { ...p, available: false, setupType: `${strategy} — projection rejected by geometry`, zoneLow: null, zoneHigh: null, expectedEntry: null, expectedStopLoss: null, expectedTp1: null, expectedTp2: null, expectedFinalTp: null };
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const image = form.get("image");
    const strategyId = String(form.get("strategy") || "");
    const selectedTimeframes = validTimeframes(parseJsonField(form, "timeframes", []));
    const indicatorMode = String(form.get("indicatorMode") || "AUTO") === "MANUAL" ? "MANUAL" : "AUTO";
    const manualIndicators = validIndicators(parseJsonField(form, "manualIndicators", []));

    if (!(image instanceof File)) return Response.json({ error: "Chart image is required." }, { status: 400 });
    if (!STRATEGY_IDS.includes(strategyId)) return Response.json({ error: "Invalid strategy selected." }, { status: 400 });
    if (!selectedTimeframes.length) return Response.json({ error: "Select at least one timeframe." }, { status: 400 });

    const profile = ANALYZER_STRATEGY_MAP[strategyId];
    const candidateIndicators = indicatorMode === "AUTO" ? profile.defaultIndicators : manualIndicators;
    const sourceRules = profile.sourceIds.map((id: StrategyId) => getStrategyRules(id));
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return Response.json({ error: "OpenAI API key is not configured." }, { status: 500 });

    const bytes = await image.arrayBuffer();
    const imageUrl = `data:${image.type || "image/png"};base64,${Buffer.from(bytes).toString("base64")}`;
    const higher = selectedTimeframes.length === 2 ? selectedTimeframes[1] : selectedTimeframes[0];
    const lower = selectedTimeframes[0];

    const prompt = `
You are VaultTrades Analyzer. You are a chart interpretation engine, not a generic indicator chatbot.

SELECTED STRATEGY: ${profile.name}
CATEGORY: ${profile.category}
TIMEFRAMES: ${selectedTimeframes.join(" + ")}
HIGHER-TIMEFRAME CONTEXT: ${higher}
LOWER-TIMEFRAME SETUP/ENTRY: ${lower}
INDICATOR MODE: ${indicatorMode}
STRATEGY-RELEVANT INDICATOR CANDIDATES: ${candidateIndicators.length ? candidateIndicators.join(", ") : "None"}
STRATEGY FOCUS: ${JSON.stringify(profile.focus)}
STRATEGY RULES: ${JSON.stringify(profile.rules)}
SOURCE-OF-TRUTH RULES: ${JSON.stringify(sourceRules)}

============================================================
UNIVERSAL ANALYZER RULES 1–6 — MANDATORY FOR EVERY STRATEGY
============================================================

RULE 1 — VISUAL CHART ANALYSIS
1. Describe actual market structure: Uptrend, Downtrend, Ranging, Choppy or transitional.
2. Identify visible key support/resistance and recent price action.
3. If there are >5 consecutive inside bars OR materially conflicting signals across 3+ visible timeframes, the final NEW TRADE decision is NO TRADE for choppy/insufficient clarity.
4. Do not use generic filler such as “ranging with no sustained higher highs” unless the image actually demonstrates that condition.

RULE 2 — SMC DETECTION
Score ALL six when visible, 1–10:
- BOS
- CHoCH
- Order Block
- FVG
- Liquidity Sweep
- Displacement
Provide concise evidence for every score. A score is not a reason by itself.
NEW BUY/SELL GATE: at least TWO SMC scores must be >=7. If fewer than two are >=7, NEW TRADE MUST be NO TRADE.
The SMC gate is universal, but SMC observations must still be interpreted in the context of the selected strategy rather than replacing its lifecycle.

RULE 3 — SESSION & CONFLUENCE
Identify London, New York or Asian session when the chart time permits. State higher-timeframe alignment. Mention visible/known news only when genuinely available; never invent news. State risk-on/risk-off only when supported by visible or reliable context.
Asian: trade only if confluence >=9/10 AND a major news event is genuinely established.
London/NY overlap: preferred.
Pre-London 07:00–08:00 GMT: acceptable only for an exceptional setup.

RULE 4 — SIGNAL VALIDATION
For a NEW BUY/SELL, calculate:
BUY risk = Entry - SL; BUY reward = TP1 - Entry.
SELL risk = SL - Entry; SELL reward = Entry - TP1.
R:R = reward / risk and must be >=2.0.
SL distance must be >=0.1% from entry.
Entry must be within 0.5% of current price when current price is visible/reliable.
Risk per trade must not exceed 1.5% of account equity. If account equity/position sizing is not supplied, say “Account-risk sizing not verifiable from the chart” rather than claiming it passed.
BUY means every strategy-specific condition AND every measurable universal gate passed. SELL is the bearish equivalent. Otherwise NO TRADE.

RULE 5 — CONFIDENCE
90–100 = multiple strong confluences/perfect setup.
80–89 = strong with 2–3 solid confirmations.
70–79 = decent, minor issues.
60–69 = marginal, wait for clarity.
50–59 = weak/high failure risk.
30–49 = poor/avoid.
10–29 = very poor or image quality too low.
Confidence must reflect actual evidence completeness. Do not inflate it because an indicator is aligned.

RULE 6 — QUALITY CHECK
Before returning JSON, re-check R:R math, SL/TP geometry, minimum SL distance, entry proximity, risk sizing when measurable, SMC >=7 count, confidence versus evidence, and whether the narrative logically matches structure, price action, liquidity, momentum, volatility and the selected strategy lifecycle.

============================================================
STRATEGY-SPECIFIC INTELLIGENCE
============================================================

The selected strategy is the PRIMARY THESIS. Use its authoritative source sequence exactly. Do not combine strategies. Do not invent mandatory conditions. Do not reduce the strategy to its indicators.

Indicators are SUPPORTING EVIDENCE, not the strategy itself. AUTO does NOT mean “always three indicators.” Select every candidate indicator that materially helps evaluate this strategy and the visible chart; the number may be 0, 1, 2, 3, 4 or more. Do not select an indicator just to fill a quota. For each selected indicator, state why it matters and whether it confirms, contradicts or is unavailable.

For example, an Institutional setup may need EMA context + ATR + ADX + RVOL + VWAP because those answer different questions; another strategy may require fewer. The strategy decides the evidence set.

If MANUAL indicators are selected, use them as supplemental evidence, but do not pretend they replace mandatory source conditions.

============================================================
STATE / LIFECYCLE COMMUNICATION
============================================================

Distinguish:
WAITING = no meaningful setup evidence yet.
DEVELOPING = strategy thesis is forming but trigger is incomplete.
READY = all strategy conditions except final execution event are satisfied.
ACTIVE = a trade is visibly already running; this is NOT a new entry.
COMPLETED = visible previous trade reached its objective.
INVALIDATED = visible previous/current setup failed its invalidation condition.

A DEVELOPING or READY state must never be converted into BUY/SELL merely because price moved in the expected direction.

The uploaded chart is a historical record. Scan the entire visible chart from older candles to the current candle. Identify the most recent reliable historical strategy footprint and its lifecycle/outcome when visible. If a dashboard, label, entry, SL, TP, state text or other strategy artifact is visible, treat it as high-value evidence. Do not say “no information” merely because there is no new signal on the current candle.

If an ACTIVE trade is visible, return tradeDecision=NO TRADE for a NEW position, currentState=ACTIVE, populate currentTrade, explain its progress and tell the user whether to HOLD/OBSERVE, WAIT FOR COMPLETION or wait for a new setup. Do not erase the active trade.

============================================================
LEVELS / PROJECTIONS
============================================================

Confirmed entry/SL/TP values must come from visible chart evidence or a clearly visible strategy execution level. Never manufacture numbers.
For BUY: SL below entry; TP above entry.
For SELL: SL above entry; TP below entry.
If a level is not reliable, return null.

A projected/developing plan is educational and separate from a confirmed trade. Project only when the strategy gives a logical location and the chart provides the level. Projection levels must also have coherent geometry; otherwise projection.available=false.

============================================================
OUTPUT QUALITY
============================================================

The user needs communicative reasoning. Do not return only “WATCH — 65”. Explain:
- what the market is doing;
- what the selected strategy sees;
- what is confirmed;
- what is missing;
- which SMC evidence is strong;
- what the exact trigger is;
- where the setup becomes invalid;
- whether a valid trade geometry exists;
- what the trader should do next.

Return ONLY JSON matching the schema.
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }, { type: "input_image", image_url: imageUrl }] }],
        max_output_tokens: 7000,
        text: { format: { type: "json_schema", name: "vaulttrades_analyzer", strict: true, schema: {
          type: "object", additionalProperties: false,
          properties: {
            tradeDecision: { type: "string", enum: ["TRADE", "NO TRADE"] },
            direction: { type: "string", enum: ["BUY", "SELL", "NO TRADE"] },
            confidence: { type: "number", minimum: 0, maximum: 100 },
            asset: { type: "string" }, timeframe: { type: "string" }, currentPrice: { type: ["number", "null"] }, marketCondition: { type: "string" }, directionalBias: { type: "string" },
            session: { type: "string" }, htfAlignment: { type: "string" }, newsContext: { type: "string" }, sentiment: { type: "string" },
            decisionReason: { type: "string" }, marketState: { type: "string" }, setup: { type: "string" },
            confirmedConditions: { type: "array", items: { type: "string" } }, missingConditions: { type: "array", items: { type: "string" } }, invalidation: { type: "string" }, aiCoach: { type: "string" },
            entry: { type: ["number", "null"] }, stopLoss: { type: ["number", "null"] }, risk: { type: ["number", "null"] }, tp1: { type: ["number", "null"] }, tp2: { type: ["number", "null"] }, finalTp: { type: ["number", "null"] },
            rr: { type: ["number", "null"] }, slDistancePct: { type: ["number", "null"] }, entryDistancePct: { type: ["number", "null"] },
            strategyAnalysis: { type: "object", additionalProperties: false, properties: { marketStructure: { type: "string" }, priceAction: { type: "string" }, liquidity: { type: "string" }, momentum: { type: "string" }, volatility: { type: "string" }, indicatorConfirmation: { type: "string" } }, required: ["marketStructure", "priceAction", "liquidity", "momentum", "volatility", "indicatorConfirmation"] },
            smcScores: { type: "object", additionalProperties: false, properties: { BOS: { type: "number", minimum: 1, maximum: 10 }, CHoCH: { type: "number", minimum: 1, maximum: 10 }, OrderBlock: { type: "number", minimum: 1, maximum: 10 }, FVG: { type: "number", minimum: 1, maximum: 10 }, LiquiditySweep: { type: "number", minimum: 1, maximum: 10 }, Displacement: { type: "number", minimum: 1, maximum: 10 } }, required: ["BOS", "CHoCH", "OrderBlock", "FVG", "LiquiditySweep", "Displacement"] },
            smcEvidence: { type: "array", items: { type: "string" } },
            aiIndicators: { type: "array", items: { type: "object", additionalProperties: false, properties: { name: { type: "string", enum: INDICATORS }, selected: { type: "boolean" }, reason: { type: "string" }, reading: { type: "string" } }, required: ["name", "selected", "reason", "reading"] } },
            bollinger: { type: "object", additionalProperties: false, properties: { status: { type: "string", enum: ["USED", "NOT REQUIRED", "UNAVAILABLE"] }, period: { type: ["number", "null"] }, standardDeviation: { type: ["number", "null"] }, series: { type: "string" }, maType: { type: "string" }, reason: { type: "string" }, optimized: { type: "boolean" } }, required: ["status", "period", "standardDeviation", "series", "maType", "reason", "optimized"] },
            previousSetup: { type: "object", additionalProperties: false, properties: { found: { type: "boolean" }, timestamp: { type: "string" }, direction: { type: "string" }, entry: { type: ["number", "null"] }, stopLoss: { type: ["number", "null"] }, tp1: { type: ["number", "null"] }, tp2: { type: ["number", "null"] }, finalTp: { type: ["number", "null"] }, outcome: { type: "string" }, evidence: { type: "array", items: { type: "string" } } }, required: ["found", "timestamp", "direction", "entry", "stopLoss", "tp1", "tp2", "finalTp", "outcome", "evidence"] },
            currentState: { type: "string", enum: ["WAITING", "DEVELOPING", "READY", "ACTIVE", "COMPLETED", "INVALIDATED"] },
            currentTrade: { type: "object", additionalProperties: false, properties: { visible: { type: "boolean" }, direction: { type: "string" }, entry: { type: ["number", "null"] }, stopLoss: { type: ["number", "null"] }, tp1: { type: ["number", "null"] }, tp2: { type: ["number", "null"] }, finalTp: { type: ["number", "null"] }, progress: { type: "string" }, status: { type: "string" }, evidence: { type: "array", items: { type: "string" } } }, required: ["visible", "direction", "entry", "stopLoss", "tp1", "tp2", "finalTp", "progress", "status", "evidence"] },
            nextAction: { type: "string" },
            projection: { type: "object", additionalProperties: false, properties: { available: { type: "boolean" }, setupType: { type: "string" }, zoneLow: { type: ["number", "null"] }, zoneHigh: { type: ["number", "null"] }, expectedEntry: { type: ["number", "null"] }, expectedStopLoss: { type: ["number", "null"] }, expectedTp1: { type: ["number", "null"] }, expectedTp2: { type: ["number", "null"] }, expectedFinalTp: { type: ["number", "null"] }, retestRequired: { type: "boolean" }, retestStatus: { type: "string" }, confirmationRequired: { type: "string" }, confirmationStatus: { type: "string" } }, required: ["available", "setupType", "zoneLow", "zoneHigh", "expectedEntry", "expectedStopLoss", "expectedTp1", "expectedTp2", "expectedFinalTp", "retestRequired", "retestStatus", "confirmationRequired", "confirmationStatus"] },
            chartAnnotations: { type: "array", items: { type: "object", additionalProperties: false, properties: { type: { type: "string" }, label: { type: "string" }, price: { type: ["number", "null"] }, points: { type: "array", items: { type: "object", additionalProperties: false, properties: { x: { type: "number", minimum: 0, maximum: 1000 }, y: { type: "number", minimum: 0, maximum: 1000 } }, required: ["x", "y"] } }, color: { type: "string" } }, required: ["type", "label", "price", "points", "color"] } },
          },
          required: ["tradeDecision", "direction", "confidence", "asset", "timeframe", "currentPrice", "marketCondition", "directionalBias", "session", "htfAlignment", "newsContext", "sentiment", "decisionReason", "marketState", "setup", "confirmedConditions", "missingConditions", "invalidation", "aiCoach", "entry", "stopLoss", "risk", "tp1", "tp2", "finalTp", "rr", "slDistancePct", "entryDistancePct", "strategyAnalysis", "smcScores", "smcEvidence", "aiIndicators", "bollinger", "previousSetup", "currentState", "currentTrade", "nextAction", "projection", "chartAnnotations"],
        } } },
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      console.error("OpenAI analyzer error", details);
      return Response.json({ error: "OpenAI analysis failed.", details }, { status: 500 });
    }

    const raw = await response.json();
    const outputText = raw.output?.flatMap((item: any) => item.content ?? []).filter((c: any) => c.type === "output_text").map((c: any) => c.text).join("").trim();
    if (!outputText) return Response.json({ error: "The analyzer returned no structured result." }, { status: 500 });

    const parsed = JSON.parse(outputText);
    const direction: Direction = parsed.direction === "BUY" || parsed.direction === "SELL" ? parsed.direction : "NO TRADE";
    const currentPrice = num(parsed.currentPrice);
    const entry = num(parsed.entry), stopLoss = num(parsed.stopLoss), tp1 = num(parsed.tp1), tp2 = num(parsed.tp2), finalTp = num(parsed.finalTp);
    const math = tradeMath(direction, entry, stopLoss, tp1, currentPrice);
    const smc = parsed.smcScores || {};
    const strongSmcCount = [smc.BOS, smc.CHoCH, smc.OrderBlock, smc.FVG, smc.LiquiditySweep, smc.Displacement].filter((v: any) => Number(v) >= 7).length;
    const currentTrade = parsed.currentTrade && typeof parsed.currentTrade === "object" ? parsed.currentTrade : { visible: false, direction: "", entry: null, stopLoss: null, tp1: null, tp2: null, finalTp: null, progress: "", status: "", evidence: [] };
    const activeVisible = Boolean(currentTrade.visible);

    let tradeDecision: Decision = parsed.tradeDecision === "TRADE" ? "TRADE" : "NO TRADE";
    let finalDirection: Direction = direction;
    const gateFailures: string[] = [];
    if (tradeDecision === "TRADE") {
      if (strongSmcCount < 2) gateFailures.push(`SMC confluence failed: only ${strongSmcCount} SMC signal(s) scored 7/10 or higher; at least 2 are required.`);
      if (!math.valid) gateFailures.push(math.reason);
      if (entry === null || stopLoss === null || tp1 === null) gateFailures.push("Confirmed trade geometry is incomplete.");
      if (activeVisible) gateFailures.push("A visible active trade is already underway; do not open a new position.");
      if (gateFailures.length) { tradeDecision = "NO TRADE"; finalDirection = "NO TRADE"; }
    }

    const confidenceRaw = Number(parsed.confidence);
    let confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(100, Math.round(confidenceRaw))) : 0;
    if (strongSmcCount < 2) confidence = Math.min(confidence, 69);
    if (tradeDecision !== "TRADE" && !activeVisible && parsed.currentState === "WAITING") confidence = Math.min(confidence, 69);

    const normalizedMathRisk = math.risk !== null && math.risk > 0 ? math.risk : null;
    const normalizedProjection = normalizeProjection(parsed.projection, finalDirection, profile.name);
    const confirmedConditions = arr(parsed.confirmedConditions);
    const missingConditions = [...arr(parsed.missingConditions), ...gateFailures];
    const analysisDirection = activeVisible ? "NO TRADE" : finalDirection;
    const currentState: CurrentState = activeVisible ? "ACTIVE" : parsed.currentState;

    const responsePayload = {
      success: true,
      strategy: { id: strategyId, name: profile.name, category: profile.category },
      market: { asset: String(parsed.asset || "Information unavailable"), timeframe: String(parsed.timeframe || selectedTimeframes.join(" + ")), marketCondition: String(parsed.marketCondition || ""), directionalBias: String(parsed.directionalBias || "") },
      session: { name: String(parsed.session || "Information unavailable"), higherTimeframeAlignment: String(parsed.htfAlignment || "Information unavailable"), newsContext: String(parsed.newsContext || "No reliable news context visible"), sentiment: String(parsed.sentiment || "Information unavailable") },
      aiIndicators: Array.isArray(parsed.aiIndicators) ? parsed.aiIndicators : [],
      bollinger: parsed.bollinger || { status: "NOT REQUIRED", period: null, standardDeviation: null, series: "Close", maType: "SMA", reason: "Not relevant to the selected strategy.", optimized: false },
      smcScores: smc,
      smcEvidence: arr(parsed.smcEvidence),
      strategyAnalysis: parsed.strategyAnalysis || {},
      decision: tradeDecision,
      tradeSignal: {
        direction: analysisDirection,
        confidence,
        entry: tradeDecision === "TRADE" ? entry : null,
        stopLoss: tradeDecision === "TRADE" ? stopLoss : null,
        risk: tradeDecision === "TRADE" ? normalizedMathRisk : null,
        tp1: tradeDecision === "TRADE" ? tp1 : null,
        tp2: tradeDecision === "TRADE" ? tp2 : null,
        finalTp: tradeDecision === "TRADE" ? finalTp : null,
        rr: tradeDecision === "TRADE" ? math.rr : null,
        slDistancePct: tradeDecision === "TRADE" ? math.slPct : null,
        entryDistancePct: tradeDecision === "TRADE" ? math.entryDistancePct : null,
        invalidation: String(parsed.invalidation || "")
      },
      decisionReason: activeVisible ? `An existing ${String(currentTrade.direction || "").toUpperCase()} trade is visible. No new entry should be opened; interpret its lifecycle instead.` : tradeDecision === "TRADE" ? String(parsed.decisionReason || "All selected strategy and universal gates passed.") : [String(parsed.decisionReason || "The selected strategy is not fully confirmed."), ...gateFailures].filter(Boolean).join(" "),
      marketState: String(parsed.marketState || "Market state unavailable."),
      setup: String(parsed.setup || "No reliable setup established."),
      confirmedConditions,
      missingConditions,
      invalidation: String(parsed.invalidation || "No clear invalidation established."),
      aiCoach: String(parsed.aiCoach || "Wait for the next strategy-defined confirmation."),
      previousSetup: parsed.previousSetup || { found: false, timestamp: "Timestamp not visible", direction: "NO TRADE", entry: null, stopLoss: null, tp1: null, tp2: null, finalTp: null, outcome: "No reliable previous setup found.", evidence: [] },
      currentState,
      currentTrade: activeVisible ? currentTrade : { ...currentTrade, visible: false },
      nextAction: String(parsed.nextAction || (activeVisible ? "Observe the active trade lifecycle; do not chase a new entry." : "Wait for the exact missing strategy confirmation.")),
      projection: normalizedProjection,
      chartAnnotations: Array.isArray(parsed.chartAnnotations) ? parsed.chartAnnotations : [],
    };

    return Response.json(responsePayload);
  } catch (error) {
    console.error("Analyzer error", error);
    return Response.json({ error: "Unable to analyze the chart." }, { status: 500 });
  }
}

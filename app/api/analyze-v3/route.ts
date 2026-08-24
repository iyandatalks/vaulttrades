import { ANALYZER_STRATEGY_MAP, type IndicatorName } from "../../../lib/strategies/analyzerProfiles";
import { getStrategyRules, type StrategyId } from "../../../lib/strategies";

const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1H", "4H", "1D", "1W", "1M"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];
const INDICATORS: IndicatorName[] = ["SMA", "EMA", "Ichimoku", "Bollinger Bands", "ATR", "VWAP", "Supertrend", "SAR", "RSI", "MACD", "KST", "Stochastic", "ADX", "Percent B", "MFI", "DPO", "RVOL", "A/D"];
const STRATEGY_IDS = Object.keys(ANALYZER_STRATEGY_MAP);

type Direction = "BUY" | "SELL" | "NO TRADE";

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
const arr = (v: unknown) => Array.isArray(v)
  ? v.filter((x): x is string => typeof x === "string").map(x => x.trim()).filter(Boolean)
  : [];
const validTimeframes = (v: unknown): Timeframe[] => Array.isArray(v)
  ? v.filter((x): x is Timeframe => typeof x === "string" && TIMEFRAMES.includes(x as Timeframe)).slice(0, 2)
  : [];
const validIndicators = (v: unknown): IndicatorName[] => Array.isArray(v)
  ? v.filter((x): x is IndicatorName => typeof x === "string" && INDICATORS.includes(x as IndicatorName)).slice(0, 3)
  : [];

function normalizeProjection(raw: any, direction: Direction, strategy: string) {
  if (!raw || typeof raw !== "object") return null;
  const p = {
    available: Boolean(raw.available),
    setupType: String(raw.setupType || ""),
    zoneLow: num(raw.zoneLow),
    zoneHigh: num(raw.zoneHigh),
    expectedEntry: num(raw.expectedEntry),
    expectedStopLoss: num(raw.expectedStopLoss),
    expectedTp1: num(raw.expectedTp1),
    expectedTp2: num(raw.expectedTp2),
    expectedFinalTp: num(raw.expectedFinalTp),
    retestRequired: Boolean(raw.retestRequired),
    retestStatus: String(raw.retestStatus || ""),
    confirmationRequired: String(raw.confirmationRequired || ""),
    confirmationStatus: String(raw.confirmationStatus || "")
  };
  if (!p.available) return p;
  const { zoneLow, zoneHigh, expectedEntry: entry, expectedStopLoss: sl, expectedTp1: tp1, expectedTp2: tp2, expectedFinalTp: finalTp } = p;
  if ([zoneLow, zoneHigh, entry, sl, tp1, tp2, finalTp].some(v => v === null)) {
    return { ...p, available: false, setupType: `${p.setupType || strategy} — projected levels incomplete` };
  }
  const validZone = (zoneLow as number) < (zoneHigh as number) && (entry as number) >= (zoneLow as number) && (entry as number) <= (zoneHigh as number);
  const coherent = direction === "BUY"
    ? validZone && (sl as number) < (zoneLow as number) && (tp1 as number) > (zoneHigh as number) && (tp2 as number) >= (tp1 as number) && (finalTp as number) >= (tp2 as number)
    : direction === "SELL"
      ? validZone && (sl as number) > (zoneHigh as number) && (tp1 as number) < (zoneLow as number) && (tp2 as number) <= (tp1 as number) && (finalTp as number) <= (tp2 as number)
      : false;
  if (!coherent) {
    return { ...p, available: false, setupType: `${p.setupType || strategy} — projected risk structure rejected`, zoneLow: null, zoneHigh: null, expectedEntry: null, expectedStopLoss: null, expectedTp1: null, expectedTp2: null, expectedFinalTp: null };
  }
  const risk = direction === "BUY" ? (entry as number) - (sl as number) : (sl as number) - (entry as number);
  const reward = direction === "BUY" ? (finalTp as number) - (entry as number) : (entry as number) - (finalTp as number);
  if (!(risk > 0) || !(reward / risk >= 2)) {
    return { ...p, available: false, setupType: `${p.setupType || strategy} — projected R:R below 1:2`, zoneLow: null, zoneHigh: null, expectedEntry: null, expectedStopLoss: null, expectedTp1: null, expectedTp2: null, expectedFinalTp: null };
  }
  return p;
}

const schema = {
  type: "object", additionalProperties: false,
  properties: {
    tradeDecision: { type: "string", enum: ["TRADE", "NO TRADE"] },
    direction: { type: "string", enum: ["BUY", "SELL", "NO TRADE"] },
    confidence: { type: "number", minimum: 0, maximum: 100 },
    asset: { type: "string" },
    timeframe: { type: "string" },
    marketCondition: { type: "string" },
    directionalBias: { type: "string" },
    decisionReason: { type: "string" },
    marketState: { type: "string" },
    setup: { type: "string" },
    confirmedConditions: { type: "array", items: { type: "string" } },
    missingConditions: { type: "array", items: { type: "string" } },
    invalidation: { type: "string" },
    entry: { type: ["number", "null"] },
    stopLoss: { type: ["number", "null"] },
    tp1: { type: ["number", "null"] },
    tp2: { type: ["number", "null"] },
    finalTp: { type: ["number", "null"] },
    strategyAnalysis: { type: "object", additionalProperties: false, properties: {
      marketStructure: { type: "string" },
      priceAction: { type: "string" },
      liquidity: { type: "string" },
      momentum: { type: "string" },
      volatility: { type: "string" },
      indicatorConfirmation: { type: "string" }
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
      visible: { type: "boolean" }, direction: { type: "string" }, entry: { type: ["number", "null"] }, stopLoss: { type: ["number", "null"] }, tp1: { type: ["number", "null"] }, tp2: { type: ["number", "null"] }, finalTp: { type: ["number", "null"] }, progress: { type: "string" }, status: { type: "string" }, evidence: { type: "array", items: { type: "string" } }
    }, required: ["visible", "direction", "entry", "stopLoss", "tp1", "tp2", "finalTp", "progress", "status", "evidence"] },
    nextAction: { type: "string" }
  },
  required: ["tradeDecision", "direction", "confidence", "asset", "timeframe", "marketCondition", "directionalBias", "decisionReason", "marketState", "setup", "confirmedConditions", "missingConditions", "invalidation", "entry", "stopLoss", "tp1", "tp2", "finalTp", "strategyAnalysis", "aiIndicators", "bollinger", "projection", "previousSetup", "historicalFootprints", "currentState", "currentTrade", "nextAction"]
};

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const image = form.get("image");
    const strategyId = String(form.get("strategy") || "");
    let selectedTimeframes: Timeframe[] = [];
    let manualIndicators: IndicatorName[] = [];
    try { selectedTimeframes = validTimeframes(JSON.parse(String(form.get("timeframes") || "[]"))); } catch {}
    try { manualIndicators = validIndicators(JSON.parse(String(form.get("manualIndicators") || "[]"))); } catch {}
    const indicatorMode = String(form.get("indicatorMode") || "AUTO") === "MANUAL" ? "MANUAL" : "AUTO";

    if (!(image instanceof File)) return Response.json({ error: "Chart image is required." }, { status: 400 });
    if (!STRATEGY_IDS.includes(strategyId)) return Response.json({ error: "Invalid strategy selected." }, { status: 400 });
    if (!selectedTimeframes.length) return Response.json({ error: "Select at least one timeframe." }, { status: 400 });

    const profile = ANALYZER_STRATEGY_MAP[strategyId];
    const activeIndicators = indicatorMode === "AUTO" ? profile.defaultIndicators : manualIndicators;
    const sourceRules = profile.sourceIds.map((id: StrategyId) => getStrategyRules(id));
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return Response.json({ error: "OpenAI API key is not configured." }, { status: 500 });

    const bytes = await image.arrayBuffer();
    const imageUrl = `data:${image.type || "image/png"};base64,${Buffer.from(bytes).toString("base64")}`;
    const higher = selectedTimeframes.length === 2 ? selectedTimeframes[1] : selectedTimeframes[0];
    const lower = selectedTimeframes.length === 2 ? selectedTimeframes[0] : selectedTimeframes[0];

    const institutionalExtra = strategyId === "institutional" ? `
INSTITUTIONAL SCORING CONTRACT:
- Score BOS, CHoCH, Order Block, FVG, Liquidity Sweep and Displacement individually from 1-10 when visible.
- A NEW BUY/SELL is allowed only if at least TWO of those components score >=7/10 and the risk rules pass.
- Choppy market: >5 consecutive inside bars OR conflicting signals across 3+ supplied timeframes => NO NEW TRADE.
- Session: Asian requires >=9/10 confluence plus a major visible/news catalyst; London/NY overlap is preferred; pre-London exceptional setups may qualify.
- Validate entry proximity, SL distance, TP distance and R:R >=1:2 mathematically.
- Confidence is a confluence-quality score, not a probability of profit.
` : "";

    const prompt = `You are VaultTrades Analyzer. You are NOT a generic chart commentator. You are the interpreter of the selected VaultTrades strategy source.

CUSTOMER STRATEGY: ${profile.name}
CATEGORY: ${profile.category}
SELECTED TIMEFRAMES: ${selectedTimeframes.join(" + ")}
HIGHER-TIMEFRAME CONTEXT: ${higher}
LOWER-TIMEFRAME SETUP/ENTRY: ${lower}
INDICATOR MODE: ${indicatorMode}
INDICATORS: ${activeIndicators.length ? activeIndicators.join(", ") : "None"}

SOURCE AUTHORITY:
The following source rules are authoritative. They are the only strategy definition you may use. Do not replace them with generic trading logic, internet concepts, or an invented strategy. Interpret the visible chart through these rules.
${JSON.stringify(sourceRules, null, 2)}
${institutionalExtra}

CORE OPERATING PRINCIPLE:
The strategy source produces a state machine, not only a new-entry signal. The Analyzer must translate that state machine into customer language. The market can be WAITING, DEVELOPING, READY, ACTIVE, COMPLETED or INVALIDATED. NO TRADE means "do not open a NEW position now". It NEVER means "nothing is happening".

1) SOURCE-FIRST AUDIT
- Read the entire visible chart, including labels, execution panels, entry/SL/TP lines, breakout/reversal markers, state text, reason text and historical tags.
- Treat a strategy-generated dashboard or execution table as first-class evidence.
- Evaluate the selected source's sequence in order. Do not skip mandatory states.
- Optional indicators confirm the source; they do not replace it.
- If the source has an explicit lifecycle, preserve it.

2) CURRENT STATE BEFORE NEW TRADE
Before deciding NO TRADE, determine whether a current setup is ACTIVE, DEVELOPING, READY, COMPLETED or INVALIDATED.
If an active trade is visible, capture its direction, entry, SL, TP1, TP2, final TP and progress. If TP1 or TP2 is visibly hit, say so. A running trade must not be reported as "no information".
If an active trade exists, tradeDecision is normally NO TRADE because the user should not chase it, while currentState=ACTIVE and currentTrade.visible=true.

3) PREVIOUS SETUP / FOOTPRINT
Scan the full visible history from left to right. Find the latest reliable prior setup generated by the SAME selected source. A previous footprint can be a completed BUY/SELL, an invalidated setup, a target hit, or a prior setup still developing.
Use visible labels/levels first. If labels are absent, reconstruct only what can be supported by price structure and the source rules. Never ask the customer to provide proprietary indicator output or a previous analysis.
Return up to five reliable historical footprints, newest first. Include timestamp if visible, direction, setup type, entry/SL/TPs when visible, lifecycle and evidence. Never fabricate history.

4) ANTICIPATED SETUP
If there is no new trade now, state what the strategy is waiting for NEXT and the exact price/structure area when it can be derived. Examples: pullback to a specific support/OB/channel zone, retest of a confirmed break, recovery above a structural level, or a new source-defined signal event. Never say only "waiting for market" or "waiting for a pullback" without specifying what must be revisited.
Projected entry/SL/TP1/TP2/final TP may be supplied only when they can be derived from the source rules and visible price evidence. They are EXPECTED levels, not an active trade.

5) STRATEGY-SPECIFIC DECISION
For Volatility & Breakout, evaluate the 20/20 channel, structural direction, breakout/acceptance/recovery, location room, momentum, volume/rejection, order-block context, W/M reversal path, confirmation threshold, signal-event transition and entry->SL->2R/3R/5R lifecycle exactly as described by the source.
For Continuation, evaluate expansion -> correction -> structural hold -> recovery -> confirmed break -> entry. A breakout alone is not continuation.
For Swing/Engulfing, evaluate the source's liquidity sweep, BOS/CHoCH, engulfing/displacement, EMA, volume, opposing liquidity and minimum-RR logic.
For FIB Retracement, use only the Auto Fib source's anchors, retracement/flip/target logic and risk structure.
For Proprietary Flow, preserve its observation, bias-lock and execution sequence without exposing the internal method name.
For Institutional, use the supplied institutional SMC scoring contract above.
For every other mapped strategy, use its actual sourceRules and do not substitute generic logic.

6) RISK QUALITY CONTROL
Before any NEW TRADE verdict:
- Validate directionally coherent entry/SL/TP geometry.
- Calculate risk and reward from the actual numbers.
- Require the strategy's own minimum R:R.
- If the numbers fail, do not call it a trade.
For projected levels, validate the same geometry. Do not display a mathematically incoherent projection.

7) CONFIDENCE
Confidence measures completeness and strength of the selected strategy's confluence, not expected profit. Keep confidence consistent with evidence. Do not assign high confidence to a partial setup.

8) NO FABRICATION
If a required source condition cannot be observed or reliably inferred from the image, mark that condition missing. Do not invent price, indicator values, news, timestamps or strategy events. If the chart is insufficient, explain exactly what is missing.

9) CUSTOMER-FACING LANGUAGE
Do not expose internal module names, Pine source names, proprietary parameter recipes or source code. Do not repeat the strategy name or indicator list in the verdict because those are already shown above the chart.
The verdict should answer immediately: current decision, direction, current state, active/prior setup, expected next setup and levels. Then provide analysis, conditions met, conditions still required and educational explanation.

10) OUTPUT QUALITY
The final response must be internally consistent. A BUY must not have an SL above entry. A SELL must not have an SL below entry. TP order must be directional. R:R must be mathematically valid. Current active trade and previous setup must not disappear simply because there is no NEW entry.

Return ONLY JSON matching the supplied schema.`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }, { type: "input_image", image_url: imageUrl }] }],
        max_output_tokens: 7000,
        text: { format: { type: "json_schema", name: "vaulttrades_analyzer_v3", strict: true, schema }
        }
      })
    });

    if (!response.ok) {
      const details = await response.text();
      console.error("OpenAI source-authoritative analyzer failed", details);
      return Response.json({ error: "OpenAI analysis failed." }, { status: 500 });
    }

    const result = await response.json();
    const text = result.output?.flatMap((item: any) => item.content ?? [])
      .filter((c: any) => c.type === "output_text")
      .map((c: any) => c.text)
      .join("")?.trim();
    if (!text) return Response.json({ error: "The analyzer returned no structured result." }, { status: 500 });

    const parsed = JSON.parse(text);
    const requestedDirection: Direction = parsed.direction === "BUY" || parsed.direction === "SELL" ? parsed.direction : "NO TRADE";
    const requestedTrade = parsed.tradeDecision === "TRADE" && requestedDirection !== "NO TRADE";
    const rawEntry = num(parsed.entry);
    const rawStop = num(parsed.stopLoss);
    const risk = requestedTrade && rawEntry !== null && rawStop !== null
      ? requestedDirection === "BUY" ? rawEntry - rawStop : rawStop - rawEntry
      : null;
    const coherentRisk = risk !== null && risk > 0;
    const safeDecision = requestedTrade && coherentRisk ? "TRADE" : "NO TRADE";
    const safeDirection: Direction = safeDecision === "TRADE" ? requestedDirection : "NO TRADE";
    const safeEntry = safeDecision === "TRADE" ? rawEntry : null;
    const safeStop = safeDecision === "TRADE" ? rawStop : null;
    const target = (v: unknown) => {
      const n = num(v);
      if (n === null || safeDecision !== "TRADE" || safeEntry === null) return null;
      return safeDirection === "BUY" ? (n > safeEntry ? n : null) : (n < safeEntry ? n : null);
    };

    const projectionDirection: Direction = parsed.direction === "BUY" || parsed.direction === "SELL" ? parsed.direction : "NO TRADE";
    const projection = normalizeProjection(parsed.projection, projectionDirection, profile.name);
    const aiIndicators = Array.isArray(parsed.aiIndicators)
      ? parsed.aiIndicators.slice(0, 3).map((x: any) => ({ name: String(x?.name || ""), selected: true, reason: String(x?.reason || "Source-aligned confirmation") })).filter((x: any) => x.name)
      : activeIndicators.map(name => ({ name, selected: true, reason: "Source-aligned confirmation" }));
    const bollinger = parsed.bollinger && typeof parsed.bollinger === "object"
      ? parsed.bollinger
      : { status: "NOT REQUIRED", period: null, standardDeviation: null, series: "", maType: "", reason: "Not required by the selected source.", optimized: false };

    const historicalFootprints = Array.isArray(parsed.historicalFootprints)
      ? parsed.historicalFootprints.slice(0, 5).map((x: any) => ({
          timestamp: String(x?.timestamp || "Timestamp not visible"),
          direction: ["BUY", "SELL", "UNKNOWN"].includes(String(x?.direction)) ? String(x.direction) : "UNKNOWN",
          setupType: String(x?.setupType || "Historical setup"),
          entry: num(x?.entry), stopLoss: num(x?.stopLoss), tp1: num(x?.tp1), tp2: num(x?.tp2), finalTp: num(x?.finalTp),
          lifecycle: String(x?.lifecycle || "UNRESOLVED"), evidence: arr(x?.evidence)
        }))
      : [];
    const historicalPrior = historicalFootprints.find((x: any) => !["ACTIVE", "DEVELOPING"].includes(x.lifecycle));
    const previousSetup = parsed.previousSetup?.found
      ? parsed.previousSetup
      : historicalPrior
        ? { found: true, timestamp: historicalPrior.timestamp, direction: historicalPrior.direction, entry: historicalPrior.entry, stopLoss: historicalPrior.stopLoss, tp1: historicalPrior.tp1, tp2: historicalPrior.tp2, finalTp: historicalPrior.finalTp, outcome: historicalPrior.lifecycle, evidence: historicalPrior.evidence }
        : parsed.previousSetup;

    const currentTrade = parsed.currentTrade && typeof parsed.currentTrade === "object"
      ? {
          visible: Boolean(parsed.currentTrade.visible),
          direction: String(parsed.currentTrade.direction || "NONE"),
          entry: num(parsed.currentTrade.entry), stopLoss: num(parsed.currentTrade.stopLoss), tp1: num(parsed.currentTrade.tp1), tp2: num(parsed.currentTrade.tp2), finalTp: num(parsed.currentTrade.finalTp),
          progress: String(parsed.currentTrade.progress || ""), status: String(parsed.currentTrade.status || ""), evidence: arr(parsed.currentTrade.evidence)
        }
      : { visible: false, direction: "NONE", entry: null, stopLoss: null, tp1: null, tp2: null, finalTp: null, progress: "", status: "", evidence: [] };

    return Response.json({
      success: true,
      strategy: { id: profile.id, name: profile.name, category: profile.category },
      market: { asset: String(parsed.asset || "Information unavailable"), timeframe: String(parsed.timeframe || selectedTimeframes.join(" + ")), marketCondition: String(parsed.marketCondition || "Information unavailable"), directionalBias: String(parsed.directionalBias || "Information unavailable") },
      aiIndicators,
      bollinger,
      strategyAnalysis: parsed.strategyAnalysis,
      decision: safeDecision,
      tradeSignal: {
        direction: safeDirection,
        confidence: Math.max(0, Math.min(100, Math.round(Number(parsed.confidence) || 0))),
        entry: safeEntry,
        stopLoss: safeStop,
        risk: safeDecision === "TRADE" && coherentRisk ? risk : null,
        tp1: target(parsed.tp1),
        tp2: target(parsed.tp2),
        finalTp: target(parsed.finalTp),
        invalidation: String(parsed.invalidation || "")
      },
      decisionReason: String(parsed.decisionReason || ""),
      marketState: String(parsed.marketState || ""),
      setup: String(parsed.setup || ""),
      confirmedConditions: arr(parsed.confirmedConditions),
      missingConditions: arr(parsed.missingConditions),
      projection,
      previousSetup,
      historicalFootprints,
      currentState: ["WAITING", "DEVELOPING", "READY", "ACTIVE", "COMPLETED", "INVALIDATED"].includes(String(parsed.currentState)) ? parsed.currentState : "WAITING",
      currentTrade,
      nextAction: String(parsed.nextAction || "Wait for the next valid strategy event.")
    });
  } catch (error) {
    console.error("VaultTrades source-authoritative analyzer error", error);
    return Response.json({ error: "Unable to analyze the chart." }, { status: 500 });
  }
}

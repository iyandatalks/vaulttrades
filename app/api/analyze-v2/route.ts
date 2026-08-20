import { getStrategyRules, type StrategyId } from "../../../lib/strategies";
import { STRATEGY_LEARNING_METADATA } from "../../../lib/strategies/learningMetadata";

const TIMEFRAMES = ["M1", "M5", "M10", "M15", "M30", "H1", "H4", "D1"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];
const STRATEGY_IDS = ["killZone", "ema20", "continuation", "supplyDemand", "714Observing", "sweepEngulfing", "swingDeveloping", "autoFibRetrace"] as const;
type Direction = "BUY" | "SELL" | "BUY DEVELOPING" | "SELL DEVELOPING" | "WAITING" | "NO TRADE";

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
const arr = (v: unknown) => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map(x => x.trim()).filter(Boolean) : [];
const dir = (v: unknown): Direction => ["BUY", "SELL", "BUY DEVELOPING", "SELL DEVELOPING", "WAITING", "NO TRADE"].includes(String(v)) ? v as Direction : "WAITING";

type Projection = {
  available: boolean;
  setupType: string;
  zoneLow: number | null;
  zoneHigh: number | null;
  expectedEntry: number | null;
  expectedStopLoss: number | null;
  expectedTp1: number | null;
  expectedTp2: number | null;
  expectedFinalTp: number | null;
  retestRequired: boolean;
  retestStatus: string;
  confirmationRequired: string;
  confirmationStatus: string;
};

function normalizeProjection(raw: any, direction: Direction, strategy: string): Projection | null {
  if (!raw || typeof raw !== "object") return null;
  const p: Projection = {
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
    confirmationStatus: String(raw.confirmationStatus || ""),
  };

  if (!p.available) return p;
  const nums = [p.zoneLow, p.zoneHigh, p.expectedEntry, p.expectedStopLoss, p.expectedTp1, p.expectedTp2, p.expectedFinalTp];
  if (nums.some(v => v === null)) return { ...p, available: false, setupType: `${p.setupType || "Projected setup"} — levels are incomplete` };

  const zoneLow = p.zoneLow as number;
  const zoneHigh = p.zoneHigh as number;
  const entry = p.expectedEntry as number;
  const sl = p.expectedStopLoss as number;
  const tp1 = p.expectedTp1 as number;
  const tp2 = p.expectedTp2 as number;
  const finalTp = p.expectedFinalTp as number;
  const validZone = zoneLow < zoneHigh && entry >= zoneLow && entry <= zoneHigh;
  const isBuy = direction === "BUY" || direction === "BUY DEVELOPING" || (direction === "WAITING" && /buy|long|bull/i.test(p.setupType));
  const isSell = direction === "SELL" || direction === "SELL DEVELOPING" || (direction === "WAITING" && /sell|short|bear/i.test(p.setupType));
  const coherentBuy = validZone && sl < zoneLow && tp1 > zoneHigh && tp2 >= tp1 && finalTp >= tp2;
  const coherentSell = validZone && sl > zoneHigh && tp1 < zoneLow && tp2 <= tp1 && finalTp <= tp2;
  const coherent = isBuy ? coherentBuy : isSell ? coherentSell : false;

  if (!coherent) {
    return {
      ...p,
      available: false,
      setupType: `${p.setupType || strategy} — projected levels rejected because the entry zone, stop and targets do not form a coherent risk structure`,
      zoneLow: null,
      zoneHigh: null,
      expectedEntry: null,
      expectedStopLoss: null,
      expectedTp1: null,
      expectedTp2: null,
      expectedFinalTp: null,
    };
  }
  return p;
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const image = form.get("image");
    const strategy = String(form.get("strategy") || "");
    const timeframe = String(form.get("timeframe") || "");
    if (!(image instanceof File)) return Response.json({ error: "Chart image is required." }, { status: 400 });
    if (!STRATEGY_IDS.includes(strategy as any)) return Response.json({ error: "Invalid strategy selected." }, { status: 400 });
    if (!TIMEFRAMES.includes(timeframe as Timeframe)) return Response.json({ error: "A valid timeframe must be selected." }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return Response.json({ error: "OpenAI API key is not configured." }, { status: 500 });

    const rules = getStrategyRules(strategy as StrategyId);
    const learning = STRATEGY_LEARNING_METADATA[strategy as StrategyId];
    const bytes = await image.arrayBuffer();
    const imageUrl = `data:${image.type || "image/png"};base64,${Buffer.from(bytes).toString("base64")}`;

    const prompt = `You are VaultTrades Analyzer. This is a learning-first chart analysis engine, not a signal generator. The selected strategy is the only source of truth. Do not combine strategies or invent conditions. Analyze only visible or reliably inferable evidence.

SELECTED STRATEGY: ${strategy}
SELECTED TIMEFRAME: ${timeframe}

STRATEGY RULES:
${JSON.stringify(rules, null, 2)}

LEARNING PRESENTATION:
${JSON.stringify(learning ?? {}, null, 2)}

IMPORTANT SETUP-STRUCTURE RULES:
1. A "Fib range" or anchor range is NOT the same thing as an "entry zone". Never present the entire swing/anchor range as the entry zone.
2. The entry zone must be a specific, narrow retracement or supply/demand area supported by the selected strategy. For Auto Fib, prefer the actual Fib retracement band supported by the visible structure (for example 61.8%-78.6% only when the selected anchors and chart evidence support it), rather than the full high-to-low anchor range.
3. The entry zone must contain the expected entry level. It must NOT contain the stop loss or any take-profit level.
4. For a BUY setup, the structure must be: stop loss < zone low <= expected entry <= zone high < TP1 <= TP2 <= final TP.
5. For a SELL setup, the structure must be: stop loss > zone high >= expected entry >= zone low > TP1 >= TP2 >= final TP.
6. If those relationships cannot be established from the visible chart and strategy rules, do NOT manufacture numbers. Set projection.available=false and explain exactly what is missing.
7. A projected setup is an anticipated plan, not a confirmed trade. Do not call it an active signal until the strategy's confirmation conditions are actually visible.
8. Explain the difference between WHERE price is expected to react (zone), WHERE an entry would be taken (level), WHERE the idea is invalidated (SL), and WHERE the trade would aim (TPs). A beginner must be able to understand the sequence without guessing.
9. If the current price has already moved through the proposed zone or the proposed levels are internally inconsistent, do not reuse them simply because the Fib range exists. Recalculate from the valid current structure or report that no coherent projection is available.

Your result must make WAIT useful. Explain WHY the strategy is confirmed, developing, waiting, or invalid; identify the exact condition being awaited and the anticipated entry/zone when the strategy supports one. Never force a trade. If evidence is missing, explicitly name the missing condition and what the trader should wait for. Entry, SL and targets are only valid when supported by visible evidence and strategy rules. Confidence measures strategy-condition completeness, not profitability.

Also inspect the visible chart history for the MOST RECENT PRIOR SETUP that appears to satisfy this same strategy. This is historical context only. Do not invent a setup that is not visible. If no prior setup can be identified, set previousSetup.found=false and explain why. If a timestamp is visible, report it; otherwise use "Timestamp not visible". State whether the prior setup appears to have reached a target, invalidation, or remains unresolved based only on visible evidence.

Return ONLY JSON. decisionReason must begin with TAKE TRADE:, NO TRADE:, or WAIT:. Developing levels belong only in projection and are expected, not confirmed.`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }, { type: "input_image", image_url: imageUrl }] }],
        max_output_tokens: 5000,
        text: { format: { type: "json_schema", name: "vaulttrades_learning_analysis", strict: true, schema: {
          type: "object", additionalProperties: false,
          properties: {
            direction: { type: "string", enum: ["BUY", "SELL", "BUY DEVELOPING", "SELL DEVELOPING", "WAITING", "NO TRADE"] },
            confidence: { type: "number", minimum: 0, maximum: 100 }, strategy: { type: "string" }, timeframe: { type: "string" },
            decisionReason: { type: "string" }, marketState: { type: "string" }, setup: { type: "string" },
            confirmedConditions: { type: "array", items: { type: "string" } }, missingConditions: { type: "array", items: { type: "string" } },
            invalidation: { type: "string" }, entry: { type: ["number", "null"] }, stopLoss: { type: ["number", "null"] }, risk: { type: ["number", "null"] },
            tp1: { type: ["number", "null"] }, tp2: { type: ["number", "null"] }, finalTp: { type: ["number", "null"] }, finalTpReason: { type: "string" },
            projection: { type: "object", additionalProperties: false, properties: {
              available: { type: "boolean" }, setupType: { type: "string" }, zoneLow: { type: ["number", "null"] }, zoneHigh: { type: ["number", "null"] },
              expectedEntry: { type: ["number", "null"] }, expectedStopLoss: { type: ["number", "null"] }, expectedTp1: { type: ["number", "null"] }, expectedTp2: { type: ["number", "null"] }, expectedFinalTp: { type: ["number", "null"] },
              retestRequired: { type: "boolean" }, retestStatus: { type: "string" }, confirmationRequired: { type: "string" }, confirmationStatus: { type: "string" }
            }, required: ["available", "setupType", "zoneLow", "zoneHigh", "expectedEntry", "expectedStopLoss", "expectedTp1", "expectedTp2", "expectedFinalTp", "retestRequired", "retestStatus", "confirmationRequired", "confirmationStatus"] },
            previousSetup: { type: "object", additionalProperties: false, properties: {
              found: { type: "boolean" }, timestamp: { type: "string" }, direction: { type: "string" }, entry: { type: ["number", "null"] }, stopLoss: { type: ["number", "null"] },
              tp1: { type: ["number", "null"] }, tp2: { type: ["number", "null"] }, finalTp: { type: ["number", "null"] }, outcome: { type: "string" }, evidence: { type: "array", items: { type: "string" } }
            }, required: ["found", "timestamp", "direction", "entry", "stopLoss", "tp1", "tp2", "finalTp", "outcome", "evidence"] },
            chartAnnotations: { type: "array", items: { type: "object", additionalProperties: false, properties: {
              type: { type: "string" }, label: { type: "string" }, price: { type: ["number", "null"] }, points: { type: "array", items: { type: "object", additionalProperties: false, properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] } }, color: { type: "string" }
            }, required: ["type", "label", "price", "points", "color"] } }
          },
          required: ["direction", "confidence", "strategy", "timeframe", "decisionReason", "marketState", "setup", "confirmedConditions", "missingConditions", "invalidation", "entry", "stopLoss", "risk", "tp1", "tp2", "finalTp", "finalTpReason", "projection", "previousSetup", "chartAnnotations"]
        } } }
      })
    });

    if (!response.ok) {
      const details = await response.text();
      console.error("OpenAI analysis failed", details);
      return Response.json({ error: "OpenAI analysis failed.", details }, { status: 500 });
    }
    const result = await response.json();
    const text = result.output?.flatMap((item: any) => item.content ?? []).filter((c: any) => c.type === "output_text").map((c: any) => c.text).join("")?.trim();
    if (!text) return Response.json({ error: "The analyzer returned no structured result." }, { status: 500 });

    const parsed = JSON.parse(text);
    const d = dir(parsed.direction);
    const confirmed = d === "BUY" || d === "SELL";
    const entry = confirmed ? num(parsed.entry) : null;
    const stopLoss = confirmed ? num(parsed.stopLoss) : null;
    const risk = confirmed && entry !== null && stopLoss !== null ? (d === "BUY" ? entry - stopLoss : stopLoss - entry) : null;
    const safeRisk = risk !== null && risk > 0 ? risk : null;
    const target = (v: unknown) => { const n = num(v); if (!confirmed || n === null || entry === null) return null; return d === "BUY" ? (n > entry ? n : null) : (n < entry ? n : null); };
    const projection = normalizeProjection(parsed.projection, d, strategy);

    return Response.json({
      success: true, strategy, timeframe,
      strategyInfo: { description: rules.description, shortExplanation: learning?.shortExplanation ?? rules.description, recommendedTradingTimes: learning?.recommendedTradingTimes ?? rules.timeframes },
      analysis: `${String(parsed.decisionReason || "")}\n\nMARKET STATE:\n${String(parsed.marketState || "")}\n\nSETUP:\n${String(parsed.setup || "")}`,
      tradeSignal: { direction: d, confidence: Math.max(0, Math.min(100, Math.round(Number(parsed.confidence) || 0))), entry, stopLoss, risk: safeRisk, tp1: target(parsed.tp1), tp2: target(parsed.tp2), finalTp: target(parsed.finalTp), invalidation: String(parsed.invalidation || "") },
      decisionReason: String(parsed.decisionReason || ""), marketState: String(parsed.marketState || ""), setup: String(parsed.setup || ""),
      confirmedConditions: arr(parsed.confirmedConditions), missingConditions: arr(parsed.missingConditions), projection,
      previousSetup: parsed.previousSetup || null, chartAnnotations: Array.isArray(parsed.chartAnnotations) ? parsed.chartAnnotations : []
    });
  } catch (error) {
    console.error("VaultTrades analysis error", error);
    return Response.json({ error: "Unable to analyze the chart." }, { status: 500 });
  }
}

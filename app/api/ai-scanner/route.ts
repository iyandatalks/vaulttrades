import { ANALYZER_STRATEGY_MAP } from "../../../lib/strategies/analyzerProfiles";
import { getStrategyRules, type StrategyId } from "../../../lib/strategies";

export const runtime = "nodejs";

type Direction = "BUY" | "SELL" | "NO TRADE";

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const clean = (v: unknown) => typeof v === "string" ? v.trim() : "";

function atr(candles: Array<{ high: number; low: number; close: number }>, length = 14): number | null {
  if (candles.length < length + 1) return null;
  const tr: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) tr.push(candles[i].high - candles[i].low);
    else {
      const p = candles[i - 1], c = candles[i];
      tr.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
    }
  }
  let out = tr.slice(0, length).reduce((a, b) => a + b, 0) / length;
  for (let i = length; i < tr.length; i++) out = (out * (length - 1) + tr[i]) / length;
  return out;
}

function volumeProfile(candles: Array<{ open: number; high: number; low: number; close: number; volume: number | null }>) {
  const volumes = candles.map(c => c.volume).filter((v): v is number => finite(v));
  if (volumes.length < 21) return { currentVolume: null, averageVolume: null, ratio: null, expansion: false, candleDirection: "NEUTRAL", displacementATR: null };
  const currentVolume = volumes.at(-1)!;
  const baselineValues = volumes.slice(-21, -1);
  const averageVolume = baselineValues.reduce((a, b) => a + b, 0) / baselineValues.length;
  const ratio = averageVolume > 0 ? currentVolume / averageVolume : null;
  const last = candles.at(-1)!;
  const a = atr(candles, 14);
  return {
    currentVolume,
    averageVolume,
    ratio,
    expansion: ratio !== null && ratio >= 1.5,
    candleDirection: last.close > last.open ? "BULLISH" : last.close < last.open ? "BEARISH" : "NEUTRAL",
    displacementATR: a && a > 0 ? (last.high - last.low) / a : null,
  };
}

function math(direction: Direction, entry: number | null, stop: number | null, target: number | null, current: number | null) {
  if (direction === "NO TRADE" || !finite(entry) || !finite(stop) || !finite(target)) return { rr: null, valid: false, risk: null, reward: null, entryDistancePct: null, slDistancePct: null };
  const risk = direction === "BUY" ? entry - stop : stop - entry;
  const reward = direction === "BUY" ? target - entry : entry - target;
  const rr = risk > 0 ? reward / risk : null;
  const entryDistancePct = current && current !== 0 ? Math.abs(entry - current) / Math.abs(current) * 100 : null;
  const slDistancePct = entry !== 0 ? Math.abs(entry - stop) / Math.abs(entry) * 100 : null;
  return { rr, risk, reward, entryDistancePct, slDistancePct, valid: risk > 0 && reward > 0 && rr !== null && rr >= 2 && (entryDistancePct === null || entryDistancePct <= 0.5) && (slDistancePct === null || slDistancePct >= 0.1) };
}

function jsonText(raw: any): string {
  return raw.output?.flatMap((x: any) => x.content ?? []).filter((x: any) => x.type === "output_text").map((x: any) => x.text).join("").trim() || "";
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

    const volume = volumeProfile(candles);
    const sourceRules = profile.sourceIds.map((id: StrategyId) => getStrategyRules(id));
    const prior = body.analysis ?? {};

    const prompt = `You are the VaultTrades AI Scanner. You are an educational projection layer on top of an existing strategy analyzer.

IMPORTANT: DO NOT CHANGE THE SELECTED STRATEGY OR UNIVERSAL ANALYZER RULES 1-6. Do not invent a new strategy. Add value by explaining why the market is being watched, what would make the trade valid, and what price path is probable from the evidence.

SELECTED STRATEGY
${JSON.stringify({ id: strategyId, name: profile.name, focus: profile.focus, rules: profile.rules, indicatorSpecs: profile.indicatorSpecs, sourceRules })}

EXISTING ANALYZER RESULT
${JSON.stringify(prior)}

LIVE CANDLE EVIDENCE
Current price: ${currentPrice}
${JSON.stringify(candles.slice(-80))}

DETERMINISTIC VOLUME PROFILE
${JSON.stringify(volume)}

AI SCANNER REQUIREMENTS
1. State the clear directional trend: UPTREND, DOWNTREND, RANGE, CHOPPY or TRANSITION. Explain why and warn against trading against a clear trend.
2. Profile institutional activity from measurable evidence only. Treat this as institutional-order evidence, not a claim of seeing actual bank orders. Strong evidence is a combination of volume expansion, directional displacement, BOS/structure shift, liquidity event, order-block/rejection behavior and strategy-specific confirmation.
3. Identify the strongest confirmations currently present. Three strong confirmations can justify a high-quality developing setup even if the universal trade gate is not yet complete. Do not require a perfect 100/100 score.
4. Project the likely direction and probability as an educational model estimate based on current evidence. This is NOT a calibrated win probability and must never be presented as guaranteed.
5. Always project an ENTRY, STRUCTURAL STOP LOSS, TP1, TP2 and FINAL TP when a coherent directional setup can be inferred, even when the status is WATCH. These are projected levels, not an authorization to enter.
6. Confirmation is a price/event that activates the setup. After confirmation, reaching the projected SL invalidates the setup. Reversal is a deeper structural level/event that would indicate the thesis is changing; it is not the same as the SL.
7. The primary target is opposing liquidity. Use the visible opposing liquidity/structure as the final target. Do not manufacture arbitrary targets. Validate R:R mathematically; if opposing liquidity cannot provide 1:2, say so and keep the trade as WATCH/NO TRADE.
8. Keep the strategy's own pipeline. Explain the next event that must occur.
9. Return useful price values rather than blank placeholders whenever evidence permits.

Return JSON only.`;

    const schema = {
      type: "object", additionalProperties: false,
      properties: {
        projectedDirection: { type: "string", enum: ["BUY", "SELL", "NO TRADE"] },
        analysisState: { type: "string", enum: ["WATCH", "CONFIRMATION_PENDING", "CONFIRMED", "ACTIVE", "INVALIDATED", "TARGET_COMPLETE"] },
        trend: { type: "string" },
        trendReason: { type: "string" },
        institutionalActivity: { type: "string", enum: ["BULLISH", "BEARISH", "NEUTRAL", "INSUFFICIENT"] },
        institutionalEvidence: { type: "array", items: { type: "string" } },
        confirmations: { type: "array", items: { type: "string" } },
        projectedProbability: { type: "number", minimum: 0, maximum: 100 },
        entry: { type: ["number", "null"] },
        stopLoss: { type: ["number", "null"] },
        tp1: { type: ["number", "null"] },
        tp2: { type: ["number", "null"] },
        finalTp: { type: ["number", "null"] },
        confirmationPrice: { type: ["number", "null"] },
        reversalPrice: { type: ["number", "null"] },
        opposingLiquidityTarget: { type: ["number", "null"] },
        waitReason: { type: "string" },
        tradeReason: { type: "string" },
        invalidation: { type: "string" },
        pipeline: { type: "array", items: { type: "string" } },
        nextZone: { type: "string" }
      },
      required: ["projectedDirection","analysisState","trend","trendReason","institutionalActivity","institutionalEvidence","confirmations","projectedProbability","entry","stopLoss","tp1","tp2","finalTp","confirmationPrice","reversalPrice","opposingLiquidityTarget","waitReason","tradeReason","invalidation","pipeline","nextZone"]
    };

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "gpt-4.1-mini", input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }], max_output_tokens: 4500, text: { format: { type: "json_schema", name: "vaulttrades_ai_scanner", strict: true, schema } } })
    });
    if (!response.ok) return Response.json({ error: `AI Scanner request failed: ${(await response.text()).slice(0, 300)}` }, { status: 502 });
    const raw = await response.json();
    const text = jsonText(raw);
    if (!text) return Response.json({ error: "AI Scanner returned no structured result." }, { status: 502 });
    const ai = JSON.parse(text);
    const target = finite(ai.opposingLiquidityTarget) ? ai.opposingLiquidityTarget : finite(ai.finalTp) ? ai.finalTp : null;
    const projectionMath = math(ai.projectedDirection as Direction, finite(ai.entry) ? ai.entry : null, finite(ai.stopLoss) ? ai.stopLoss : null, target, currentPrice);
    const state = ai.analysisState as string;

    return Response.json({
      ...ai,
      volumeProfile: volume,
      rr: projectionMath.rr,
      priceValidation: projectionMath,
      isExecutable: state === "ACTIVE" && projectionMath.valid
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "AI Scanner failed." }, { status: 500 });
  }
}

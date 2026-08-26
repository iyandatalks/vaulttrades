import { ANALYZER_STRATEGY_MAP } from "../../../lib/strategies/analyzerProfiles";
import { getStrategyRules, type StrategyId } from "../../../lib/strategies";
import { analyzeAutoFibRetrace } from "../../../lib/strategies/autoFibRetrace";
import { evaluateTradeLifecycle, selectAllowedAbFibLevel } from "../../../lib/strategies/tradeLifecycle";

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

function math(direction: Direction, entry: number | null, stop: number | null, target: number | null, current: number | null, enforceEntryProximity = false) {
  if (direction === "NO TRADE" || !finite(entry) || !finite(stop) || !finite(target)) return { rr: null, valid: false, risk: null, reward: null, entryDistancePct: null, slDistancePct: null };
  const risk = direction === "BUY" ? entry - stop : stop - entry;
  const reward = direction === "BUY" ? target - entry : entry - target;
  const rr = risk > 0 ? reward / risk : null;
  const entryDistancePct = current && current !== 0 ? Math.abs(entry - current) / Math.abs(current) * 100 : null;
  const slDistancePct = entry !== 0 ? Math.abs(entry - stop) / Math.abs(entry) * 100 : null;
  return { rr, risk, reward, entryDistancePct, slDistancePct, valid: risk > 0 && reward > 0 && rr !== null && rr >= 2 && (enforceEntryProximity ? (entryDistancePct === null || entryDistancePct <= 0.5) : true) && (slDistancePct === null || slDistancePct >= 0.1) };
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
    const lifecycleInput = body.lifecycle ?? {};

    // The Auto Fib source is an indicator and therefore must be queried directly.
    // Its Fibonacci ladder is authoritative for AB/FIB projected entry locations.
    const sourceFib = strategyId === "fibRetracement"
      ? analyzeAutoFibRetrace({
          candles: candles.map((c: any, index: number) => ({
            time: typeof c.time === "number" ? c.time : Date.parse(c.datetime ?? "") || index,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: finite(c.volume) ? c.volume : undefined,
          })),
        })
      : null;

    const fibBuyLevel = sourceFib ? selectAllowedAbFibLevel(sourceFib.buy.fibLevels, "BUY", currentPrice) : null;
    const fibSellLevel = sourceFib ? selectAllowedAbFibLevel(sourceFib.sell.fibLevels, "SELL", currentPrice) : null;
    const sourceFibContext = sourceFib ? {
      state: sourceFib.state,
      confidence: sourceFib.confidence,
      buy: { ready: sourceFib.buy.ready, flipActive: sourceFib.buy.flipActive, fibLevels: sourceFib.buy.fibLevels.filter(x => [82, 78.6, 68.1, 61.8].includes(x.pct)), tp1: sourceFib.buy.tp1, tp2: sourceFib.buy.tp2, tp3: sourceFib.buy.tp3, tp4: sourceFib.buy.tp4 },
      sell: { ready: sourceFib.sell.ready, flipActive: sourceFib.sell.flipActive, fibLevels: sourceFib.sell.fibLevels.filter(x => [82, 78.6, 68.1, 61.8].includes(x.pct)), tp1: sourceFib.sell.tp1, tp2: sourceFib.sell.tp2, tp3: sourceFib.sell.tp3, tp4: sourceFib.sell.tp4 },
      projection: sourceFib.projection,
      orderBlocks: sourceFib.orderBlocks,
      confluence: { buy: sourceFib.buyConfluence, sell: sourceFib.sellConfluence },
    } : null;

    const prompt = `You are the VaultTrades AI Scanner. You are an educational probability/projection layer on top of an existing strategy analyzer.

IMPORTANT: DO NOT CHANGE THE SELECTED STRATEGY OR UNIVERSAL ANALYZER RULES 1-6. Do not invent a new strategy. The selected strategy/indicator output is the source of truth.

SELECTED STRATEGY
${JSON.stringify({ id: strategyId, name: profile.name, focus: profile.focus, rules: profile.rules, indicatorSpecs: profile.indicatorSpecs, sourceRules })}

EXISTING ANALYZER RESULT
${JSON.stringify(prior)}

EXISTING TRADE LIFECYCLE INPUT
${JSON.stringify(lifecycleInput)}

LIVE CANDLE EVIDENCE
Current price: ${currentPrice}
${JSON.stringify(candles.slice(-80))}

DETERMINISTIC VOLUME PROFILE
${JSON.stringify(volume)}

SOURCE FIB OUTPUT (WHEN SELECTED STRATEGY IS FIB RETRACEMENT)
${JSON.stringify(sourceFibContext)}

AI SCANNER REQUIREMENTS
1. State the clear directional trend: UPTREND, DOWNTREND, RANGE, CHOPPY or TRANSITION. Explain why and warn against trading against a clear trend.
2. Profile institutional activity from measurable evidence only. Treat this as institutional-order evidence, not a claim of seeing actual bank orders.
3. Identify the strongest confirmations currently present. Probability is a graded evidence score, not a guarantee.
4. Project the likely direction and probability as an educational model estimate based on current evidence.
5. Project ENTRY, STRUCTURAL STOP LOSS, TP1, TP2 and FINAL TP when a coherent directional setup can be inferred. These are projected levels, not authorization to enter.
6. NEVER use current price as the projected entry merely because current price is available. Projected entry must come from the selected strategy's valid price structure.
7. Confirmation is a price/event that activates the setup. Actual entry is recorded only after the existing analyzer has confirmed the trade.
8. Once an actual entry exists, do not output WAIT. The status must describe the active trade. If projected TP1 is already hit, explicitly state TP1 HIT and do not present the trade as waiting for entry.
9. Preserve projected SL/TP levels. Do not move them with current price.
10. Keep the strategy's own pipeline and lifecycle. Do not complete a cycle because of a pullback, retest, lengthening or lower-timeframe counter-cycle.
11. For FIB Retracement / AB strategy, projected entry may ONLY be one of 82.0%, 78.6%, 68.1% or 61.8%. 61.8% is the FINAL permitted entry level. Never create a fifth Fibonacci entry level and never replace a FIB entry with current price.
12. For FIB Retracement, the supplied SOURCE FIB OUTPUT is authoritative. Choose from its permitted levels only. If the strategy does not provide a valid permitted level, return null rather than inventing an entry.
13. The last/live cycle's actual entry must remain the confirmed entry price. Do not rewrite it when price moves.
14. The primary target is opposing liquidity where the strategy supports it. Validate R:R mathematically without changing source-defined levels.

Return JSON only.`;

    const schema = {
      type: "object", additionalProperties: false,
      properties: {
        projectedDirection: { type: "string", enum: ["BUY", "SELL", "NO TRADE"] },
        analysisState: { type: "string", enum: ["WATCH", "ENTRY_ZONE", "CONFIRMATION_PENDING", "CONFIRMED", "ACTIVE", "TP1_HIT", "INVALIDATED", "TARGET_COMPLETE", "CYCLE_COMPLETE"] },
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

    const aiDirection: Direction = ai.projectedDirection as Direction;
    const direction: Direction = strategyId === "fibRetracement"
      ? (aiDirection === "BUY" || aiDirection === "SELL" ? aiDirection : (finite(prior.direction) ? prior.direction : sourceFib?.buyConfluence !== undefined && sourceFib.buyConfluence >= sourceFib.sellConfluence ? "BUY" : "SELL"))
      : aiDirection;

    const projectedEntry = strategyId === "fibRetracement"
      ? direction === "BUY" ? fibBuyLevel?.price ?? null : direction === "SELL" ? fibSellLevel?.price ?? null : null
      : finite(ai.entry) ? ai.entry : null;

    const priorDirection = prior?.direction === "BUY" || prior?.direction === "SELL" ? prior.direction : null;
    const priorConfirmed = prior?.decision === "TRADE" && priorDirection === direction && finite(prior.entry);
    const actualEntry = finite(lifecycleInput.actualEntry)
      ? lifecycleInput.actualEntry
      : priorConfirmed ? prior.entry : null;

    const projectedStopLoss = finite(ai.stopLoss) ? ai.stopLoss : finite(prior.stopLoss) ? prior.stopLoss : null;
    const projectedTp1 = finite(ai.tp1) ? ai.tp1 : finite(prior.tp1) ? prior.tp1 : null;
    const projectedTp2 = finite(ai.tp2) ? ai.tp2 : finite(prior.tp2) ? prior.tp2 : null;
    const projectedFinalTp = finite(ai.finalTp) ? ai.finalTp : finite(prior.finalTp) ? prior.finalTp : null;
    const target = finite(ai.opposingLiquidityTarget) ? ai.opposingLiquidityTarget : projectedFinalTp;

    const lifecycle = evaluateTradeLifecycle({
      direction: direction === "BUY" || direction === "SELL" ? direction : "NONE",
      currentPrice,
      projectedEntry,
      actualEntry,
      projectedStopLoss,
      projectedTp1,
      projectedTp2,
      projectedFinalTp,
      priorStatus: lifecycleInput.status ?? null,
      tp1AlreadyHit: lifecycleInput.tp1Hit === true,
      stopAlreadyHit: lifecycleInput.stopHit === true,
      cycleComplete: lifecycleInput.cycleComplete === true,
    });

    const isFib = strategyId === "fibRetracement";
    const projectionMath = math(direction, actualEntry ?? projectedEntry, projectedStopLoss, target, currentPrice, false);
    const state = lifecycle.status === "ACTIVE" ? "ACTIVE" : lifecycle.status === "TP1_HIT" ? "TP1_HIT" : lifecycle.status === "SL_HIT" || lifecycle.status === "CYCLE_COMPLETE" ? "CYCLE_COMPLETE" : ai.analysisState;
    const statusMessage = lifecycle.message;
    const finalProjectedEntry = isFib && projectedEntry !== null ? projectedEntry : (finite(ai.entry) ? ai.entry : projectedEntry);

    return Response.json({
      ...ai,
      projectedDirection: direction,
      analysisState: state,
      statusMessage,
      entry: finalProjectedEntry,
      projectedEntry: finalProjectedEntry,
      actualEntry,
      stopLoss: projectedStopLoss,
      projectedStopLoss,
      tp1: projectedTp1,
      projectedTp1,
      tp2: projectedTp2,
      projectedTp2,
      finalTp: projectedFinalTp,
      projectedFinalTp,
      tp1Hit: lifecycle.tp1Hit,
      stopHit: lifecycle.stopHit,
      cycleStatus: lifecycle.status,
      sourceFib: sourceFibContext,
      fibEntryLevel: isFib ? (direction === "BUY" ? fibBuyLevel : fibSellLevel) : null,
      allowedFibEntryPercentages: isFib ? [82, 78.6, 68.1, 61.8] : [],
      volumeProfile: volume,
      rr: projectionMath.rr,
      priceValidation: projectionMath,
      isExecutable: lifecycle.status === "ACTIVE" && projectionMath.valid,
      waitReason: lifecycle.status === "ACTIVE" || lifecycle.status === "TP1_HIT" ? statusMessage : ai.waitReason,
      tradeReason: lifecycle.status === "ACTIVE" || lifecycle.status === "TP1_HIT" ? statusMessage : ai.tradeReason,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "AI Scanner failed." }, { status: 500 });
  }
}
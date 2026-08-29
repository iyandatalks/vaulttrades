import { createHash } from "crypto";
import { createClient } from "../../../lib/supabase/server";
import { getTwelveDataTimeSeries } from "../../../lib/market-data/twelvedata";
import { getMarketProviderRoute, type MarketType } from "../../../lib/market-data/provider";
import {
  DEFAULT_ADAPTIVE_EXECUTION_CONFIG,
  evaluateAdaptiveExecution,
  evaluatePreferredM15M5,
} from "../../../lib/strategies/adaptiveExecution";
import { ANALYZER_STRATEGY_MAP } from "../../../lib/strategies/analyzerProfiles";

export const runtime = "nodejs";

const ALLOWED_MARKETS = new Set<MarketType>(["FOREX", "INDICES", "CRYPTO", "STOCKS"]);
const ADAPTIVE_STRATEGY_ID = "adaptiveExecution";

const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function fingerprint(input: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function makeTradeId(symbol: string, timeframe: string) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return `VT-${stamp}-${symbol.replace(/[^A-Z0-9]/gi, "")}-${timeframe.toUpperCase()}-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function candlePayload(c: { datetime?: string; open: number; high: number; low: number; close: number; volume?: number | null }) {
  return { datetime: c.datetime, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume ?? null };
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

    const body = await request.json();
    const marketType = clean(body?.marketType).toUpperCase() as MarketType;
    const symbol = clean(body?.symbol).toUpperCase();
    const requestedTimeframe = clean(body?.timeframe).toLowerCase();
    const strategyId = clean(body?.strategy);
    const profile = ANALYZER_STRATEGY_MAP[strategyId];

    if (strategyId !== ADAPTIVE_STRATEGY_ID || !profile) {
      return Response.json({ error: "Adaptive Execution Engine is the only strategy accepted by this route." }, { status: 400 });
    }
    if (!ALLOWED_MARKETS.has(marketType)) return Response.json({ error: "Market is not supported by the Adaptive Execution signal route." }, { status: 400 });
    if (!symbol) return Response.json({ error: "Select a market symbol." }, { status: 400 });
    if (requestedTimeframe !== "5m" && requestedTimeframe !== "15m") {
      return Response.json({ error: "Adaptive Execution Engine supports M5 execution and M15 confirmation. Select M5 or M15." }, { status: 400 });
    }

    const providerRoute = getMarketProviderRoute(marketType);
    if (!providerRoute.available) return Response.json({ error: providerRoute.reason || "Market data is unavailable." }, { status: 503 });

    const [m15Market, m5Market] = await Promise.all([
      getTwelveDataTimeSeries({ symbol, timeframe: "15m", outputsize: 250 }),
      getTwelveDataTimeSeries({ symbol, timeframe: "5m", outputsize: 250 }),
    ]);

    if (m15Market.candles.length < 205 || m5Market.candles.length < 205) {
      return Response.json({ error: "Not enough M15/M5 live market history was returned for Adaptive Execution." }, { status: 422 });
    }

    const m15Candles = m15Market.candles.map(candlePayload);
    const m5Candles = m5Market.candles.map(candlePayload);
    const mtf = evaluatePreferredM15M5(m15Candles, m5Candles, DEFAULT_ADAPTIVE_EXECUTION_CONFIG);
    const previousM5 = evaluateAdaptiveExecution(m5Candles.slice(0, -1), DEFAULT_ADAPTIVE_EXECUTION_CONFIG);
    const previousM15 = evaluateAdaptiveExecution(m15Candles.slice(0, -1), DEFAULT_ADAPTIVE_EXECUTION_CONFIG);
    const currentM5 = mtf.m5;
    const currentM15 = mtf.m15;
    const newM5Signal = currentM5.confirmed && currentM5.direction !== previousM5.direction;
    const newM15Signal = currentM15.confirmed && currentM15.direction !== previousM15.direction;

    // M5 and M15 are independent confirmation states. M5 is the early/execution
    // timeframe; M15 is the stronger confirmation timeframe. Neither waits for
    // the other. The selected trading timeframe determines executability.
    const executable = requestedTimeframe === "5m"
      ? currentM5.confirmed && newM5Signal
      : currentM15.confirmed && newM15Signal;
    const selectedResult = requestedTimeframe === "5m" ? currentM5 : currentM15;
    const direction = executable ? selectedResult.direction : "NO TRADE";
    const result = executable ? selectedResult : { ...selectedResult, direction: "NO TRADE" as const, confirmed: false, entry: null, stopLoss: null, risk: null, tp1: null, tp2: null, tp3: null, tp4: null };
    const currentPrice = requestedTimeframe === "15m"
      ? (m15Market.currentPrice ?? m15Market.candles.at(-1)?.close ?? null)
      : (m5Market.currentPrice ?? m5Market.candles.at(-1)?.close ?? null);

    const responseBase = {
      market: { type: marketType, asset: requestedTimeframe === "15m" ? m15Market.symbol : m5Market.symbol, timeframe: requestedTimeframe, currentPrice },
      strategy: { id: profile.id, name: profile.name, category: profile.category },
      chart: { candles: requestedTimeframe === "15m" ? m15Market.candles : m5Market.candles, channel20: { upper: null, lower: null, middle: null } },
      decision: executable ? "TRADE" : "NO TRADE",
      direction,
      confidence: executable ? result.score : Math.min(result.score, 69),
      entry: executable ? result.entry : null,
      stopLoss: executable ? result.stopLoss : null,
      tp1: executable ? result.tp1 : null,
      tp2: executable ? result.tp2 : null,
      finalTp: executable ? result.tp4 : null,
      rr: executable && result.risk && result.tp1 && result.entry ? Math.abs(result.tp1 - result.entry) / result.risk : null,
      strategyEngine: {
        source: "ADAPTIVE_EXECUTION_ENGINE",
        authoritative: true,
        preferredTimeframe: mtf.preferredTimeframe,
        executable,
        newM5Signal,
        newM15Signal,
        reason: executable
          ? `${requestedTimeframe === "5m" ? "M5" : "M15"} independently confirmed a new ${direction} setup.`
          : mtf.reason,
        m15: currentM15,
        m5: currentM5,
      },
      confirmedConditions: executable ? [
        `Adaptive Engine score: ${result.score}/100.`,
        `M15 confirmation state: ${currentM15.direction} (${currentM15.score}/100).`,
        `M5 confirmation state: ${currentM5.direction} (${currentM5.score}/100).`,
        `${requestedTimeframe === "5m" ? "M5" : "M15"} independently satisfied the selected timeframe confirmation conditions.`,
      ] : [],
      missingConditions: executable ? [] : [
        ...(requestedTimeframe === "15m"
          ? (currentM15.confirmed ? [] : ["M15 Adaptive confirmation is not established at the 70-point threshold."]) 
          : (currentM5.confirmed ? [] : ["M5 Adaptive execution confirmation is not established at the 70-point threshold."])),
        ...(requestedTimeframe === "15m"
          ? (newM15Signal ? [] : ["No new M15 confirmation transition; an already-confirmed M15 condition is not a new signal."])
          : (newM5Signal ? [] : ["No new M5 confirmation transition; an already-confirmed M5 condition is not a new signal."])),
      ],
      smcScores: {},
      pipeline: [
        "Adaptive Execution Engine is authoritative.",
        "M5 = early confirmation and preferred execution timeframe.",
        "M15 = stronger confirmation timeframe.",
        "M5 → M15 is progression, not a chronological permission gate.",
        executable ? `${requestedTimeframe === "5m" ? "M5" : "M15"} new signal confirmed.` : "No new signal on the selected timeframe.",
      ],
      nextZone: mtf.reason,
      invalidation: executable && result.stopLoss !== null
        ? `Close through ${result.stopLoss} invalidates the active ${direction} setup; a confirmed opposite setup also replaces this lifecycle.`
        : "Wait for a new confirmed setup on the selected timeframe.",
      nextAction: executable
        ? `${direction} confirmed on ${requestedTimeframe === "5m" ? "M5" : "M15"}; lifecycle is active.`
        : `WAIT — no new confirmed ${requestedTimeframe === "5m" ? "M5" : "M15"} signal.`,
      educationalNote: "The Adaptive Execution Engine is the sole confirmation authority. AI Scanner cannot create an Adaptive BUY/SELL signal.",
      scanner: {
        projectedDirection: executable ? direction : "NO TRADE",
        analysisState: executable ? "CONFIRMED" : "WATCH",
        statusMessage: executable ? `CONFIRMED ${direction} — ${requestedTimeframe.toUpperCase()}` : `WATCH — ${requestedTimeframe.toUpperCase()} Adaptive Engine`,
        cycleStatus: executable ? "ACTIVE" : "WATCH",
        trend: `${result.trend} · ${result.momentum}`,
        trendReason: mtf.reason,
        confirmations: [
          `M15: ${currentM15.direction} · ${currentM15.score}/100`,
          `M5: ${currentM5.direction} · ${currentM5.score}/100`,
          `Trend ${result.scores.trend} · Momentum ${result.scores.momentum} · Strength ${result.scores.strength} · Structure ${result.scores.structure} · ATR Trigger ${result.scores.trigger}`,
        ],
        projectedProbability: executable ? result.score : null,
        entry: executable ? result.entry : null,
        projectedEntry: executable ? result.entry : null,
        actualEntry: executable ? result.entry : null,
        stopLoss: executable ? result.stopLoss : null,
        projectedStopLoss: executable ? result.stopLoss : null,
        tp1: executable ? result.tp1 : null,
        projectedTp1: executable ? result.tp1 : null,
        tp2: executable ? result.tp2 : null,
        projectedTp2: executable ? result.tp2 : null,
        finalTp: executable ? result.tp4 : null,
        projectedFinalTp: executable ? result.tp4 : null,
        rr: executable && result.risk && result.tp1 && result.entry ? Math.abs(result.tp1 - result.entry) / result.risk : null,
        tradeReason: executable ? `${requestedTimeframe === "5m" ? "M5" : "M15"} independently confirmed the Adaptive setup.` : "No new confirmed setup on the selected timeframe.",
        invalidation: executable && result.stopLoss !== null ? `SL ${result.stopLoss}; confirmed opposite setup replaces this lifecycle.` : "Pending new confirmed setup",
        pipeline: ["M5 early confirmation", "M15 stronger confirmation", executable ? `${requestedTimeframe.toUpperCase()} signal fired` : "Waiting"],
        nextZone: mtf.reason,
        waitReason: executable ? "" : `The deterministic Adaptive Engine did not produce a new confirmed ${requestedTimeframe.toUpperCase()} signal.`,
        tp1Hit: false,
        stopHit: false,
        confirmationPrice: executable ? result.entry : null,
        reversalPrice: null,
        opposingLiquidityTarget: executable ? result.tp4 : null,
        volumeProfile: { currentVolume: null, averageVolume: null, ratio: null, expansion: false, candleDirection: "NEUTRAL", displacementATR: null },
      },
    };

    if (executable && result.entry !== null && result.stopLoss !== null && result.tp1 !== null) {
      const payload = {
        canonical_symbol: symbol,
        direction,
        strategy_id: profile.id,
        strategy_name: profile.name,
        timeframe: requestedTimeframe === "5m" ? "M5" : "M15",
        entry: result.entry,
        stop_loss: result.stopLoss,
        tp1: result.tp1,
        tp2: result.tp2,
        tp3: result.tp3,
        tp4: result.tp4,
        confidence: result.score,
        rr: result.risk ? Math.abs(result.tp1 - result.entry) / result.risk : null,
      };
      const signalFingerprint = fingerprint(payload);
      const { data: existing } = await supabase.from("scanner_signals").select("*").eq("auth_user_id", user.id).eq("signal_fingerprint", signalFingerprint).maybeSingle();
      if (existing) return Response.json({ ...responseBase, signal: existing, signalPublished: false, duplicate: true });

      const tradeId = makeTradeId(symbol, payload.timeframe);
      const now = new Date().toISOString();

      // A confirmed opposite setup on the same strategy/timeframe replaces the
      // previous lifecycle. Same-direction continuation does not close it.
      const { data: priorSignals } = await supabase
        .from("scanner_signals")
        .select("id,direction,status,execution_payload")
        .eq("auth_user_id", user.id)
        .eq("canonical_symbol", symbol)
        .eq("strategy_id", profile.id)
        .eq("timeframe", payload.timeframe)
        .in("status", ["CONFIRMED", "ACTIVE"])
        .neq("direction", direction)
        .order("fired_at", { ascending: false })
        .limit(20);

      if (priorSignals?.length) {
        for (const priorSignal of priorSignals) {
          const priorPayload = priorSignal.execution_payload && typeof priorSignal.execution_payload === "object"
            ? priorSignal.execution_payload as Record<string, unknown>
            : {};
          await supabase.from("scanner_signals").update({
            status: "INVALIDATED",
            completed_at: now,
            updated_at: now,
            execution_payload: {
              ...priorPayload,
              status: "INVALIDATED",
              lifecycle_status: "INVALIDATED",
              completed_at: now,
              invalidated_by: tradeId,
              invalidation_reason: `Confirmed opposite ${direction} setup on ${payload.timeframe}.`,
            },
          }).eq("id", priorSignal.id).eq("auth_user_id", user.id);
        }
      }

      const executionPayload = {
        trade_id: tradeId,
        symbol,
        side: direction,
        entry: result.entry,
        stop_loss: result.stopLoss,
        take_profit: result.tp1,
        strategy: profile.id,
        strategy_id: profile.id,
        strategy_name: profile.name,
        timeframe: payload.timeframe,
        status: "ACTIVE",
        execution_enabled: false,
        execution_provider: "MetaKit",
        authority: "ADAPTIVE_EXECUTION_ENGINE",
        confirmation_progression: "M5 → M15 → higher timeframe",
        lifecycle_rule: "Ends on SL or confirmed opposite setup; TP1-TP4 are projected/reference levels only.",
      };
      const row = {
        auth_user_id: user.id,
        trade_id: tradeId,
        signal_fingerprint: signalFingerprint,
        market_category: marketType,
        canonical_symbol: symbol,
        direction,
        strategy_id: profile.id,
        strategy_name: profile.name,
        timeframe: payload.timeframe,
        entry: result.entry,
        stop_loss: result.stopLoss,
        tp1: result.tp1,
        tp2: result.tp2,
        tp3: result.tp3,
        tp4: result.tp4,
        confidence: result.score,
        rr: result.risk ? Math.abs(result.tp1 - result.entry) / result.risk : null,
        status: "ACTIVE",
        confirmation_conditions: responseBase.confirmedConditions,
        missing_conditions: [],
        execution_payload: executionPayload,
        source_snapshot: responseBase.strategyEngine,
        fired_at: now,
        completed_at: null,
        updated_at: now,
      };
      const { data: signal, error } = await supabase.from("scanner_signals").insert(row).select("*").single();
      if (error) return Response.json({ ...responseBase, signalPublished: false, error: `Adaptive signal could not be recorded: ${error.message}` }, { status: 500 });
      return Response.json({ ...responseBase, signal, signalPublished: true, duplicate: false });
    }

    return Response.json({ ...responseBase, signal: null, signalPublished: false, duplicate: false });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Adaptive Execution failed." }, { status: 500 });
  }
}

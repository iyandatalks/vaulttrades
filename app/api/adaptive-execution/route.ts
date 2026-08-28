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

function makeTradeId(symbol: string) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return `VT-${stamp}-${symbol.replace(/[^A-Z0-9]/gi, "")}-M5-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
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
      return Response.json({ error: "Adaptive Execution Engine uses M5 execution with M15 confirmation. Select M5 or M15." }, { status: 400 });
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
    const currentM5 = mtf.m5;
    const currentM15 = mtf.m15;
    const newM5Signal = currentM5.confirmed && currentM5.direction !== previousM5.direction;
    const executable = mtf.executable && newM5Signal;
    const direction = executable ? currentM5.direction : "NO TRADE";
    const result = executable ? currentM5 : { ...currentM5, direction: "NO TRADE" as const, confirmed: false, entry: null, stopLoss: null, risk: null, tp1: null, tp2: null, tp3: null, tp4: null };
    const currentPrice = m5Market.currentPrice ?? m5Market.candles.at(-1)?.close ?? null;

    const responseBase = {
      market: { type: marketType, asset: m5Market.symbol, timeframe: requestedTimeframe, currentPrice },
      strategy: { id: profile.id, name: profile.name, category: profile.category },
      chart: { candles: m5Market.candles, channel20: { upper: null, lower: null, middle: null } },
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
        reason: mtf.reason,
        m15: currentM15,
        m5: currentM5,
      },
      confirmedConditions: [
        `Adaptive Engine score: ${result.score}/100.`,
        `M15 confirmation: ${currentM15.direction} (${currentM15.score}/100).`,
        `M5 execution: ${currentM5.direction} (${currentM5.score}/100).`,
        ...(executable ? ["M15 and M5 directions are aligned and M5 produced a new signal transition."] : []),
      ],
      missingConditions: executable ? [] : [
        ...(currentM15.confirmed ? [] : ["M15 Adaptive confirmation is not established at the 70-point threshold."]),
        ...(currentM5.confirmed ? [] : ["M5 Adaptive execution confirmation is not established at the 70-point threshold."]),
        ...(mtf.executable ? [] : ["M15 and M5 are not aligned for executable entry."]),
        ...(newM5Signal ? [] : ["No new M5 signal transition; an already-active condition is not a new fired signal."]),
      ],
      smcScores: {},
      pipeline: [
        "Adaptive Execution Engine is authoritative.",
        "M15 = confirmation timeframe.",
        "M5 = preferred execution timeframe.",
        executable ? "NEW M5 execution signal confirmed." : "No new executable signal.",
      ],
      nextZone: mtf.reason,
      invalidation: executable && result.stopLoss !== null ? `Close through ${result.stopLoss} invalidates the active ${direction} trade.` : "Wait for aligned M15 confirmation and a new M5 execution transition.",
      nextAction: executable ? `${direction} confirmed on M5 with M15 alignment.` : "WAIT — Adaptive Engine has not produced a new aligned M5 execution signal.",
      educationalNote: "The Adaptive Execution Engine is the sole confirmation authority for this strategy. AI Scanner may describe the market, but it cannot create an Adaptive BUY/SELL signal.",
      scanner: {
        projectedDirection: executable ? direction : "NO TRADE",
        analysisState: executable ? "CONFIRMED" : "WATCH",
        statusMessage: executable ? `CONFIRMED ${direction} — M15 → M5` : "WATCH — M15 → M5 Adaptive Engine",
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
        tradeReason: executable ? "M15 confirmation and a new aligned M5 Adaptive Execution signal." : "No new aligned Adaptive Execution signal.",
        invalidation: executable && result.stopLoss !== null ? `SL ${result.stopLoss}` : "Pending new aligned signal",
        pipeline: ["M15 confirmation", "M5 execution", executable ? "Signal fired" : "Waiting"],
        nextZone: mtf.reason,
        waitReason: executable ? "" : "The deterministic Adaptive Engine did not produce a new aligned execution event.",
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
        timeframe: "M5",
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

      const tradeId = makeTradeId(symbol);
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
        timeframe: "M5",
        status: "CONFIRMED",
        execution_enabled: false,
        execution_provider: "MetaKit",
        authority: "ADAPTIVE_EXECUTION_ENGINE",
        confirmation_timeframe: "M15",
        execution_timeframe: "M5",
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
        timeframe: "M5",
        entry: result.entry,
        stop_loss: result.stopLoss,
        tp1: result.tp1,
        tp2: result.tp2,
        tp3: result.tp3,
        tp4: result.tp4,
        confidence: result.score,
        rr: result.risk ? Math.abs(result.tp1 - result.entry) / result.risk : null,
        status: "CONFIRMED",
        confirmation_conditions: responseBase.confirmedConditions,
        missing_conditions: [],
        execution_payload: executionPayload,
        source_snapshot: responseBase.strategyEngine,
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

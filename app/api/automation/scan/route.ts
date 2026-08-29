import { createClient } from "@supabase/supabase-js";
import { MARKET_SYMBOLS } from "../../../lib/markets";
import { getTwelveDataTimeSeries } from "../../../lib/market-data/twelvedata";
import { getMarketProviderRoute, type MarketType } from "../../../lib/market-data/provider";
import { DEFAULT_ADAPTIVE_EXECUTION_CONFIG, evaluateAdaptiveExecution } from "../../../lib/strategies/adaptiveExecution";
import { evaluateEma20 } from "../../../lib/strategies/ema20Engine";
import { ANALYZER_STRATEGY_MAP } from "../../../lib/strategies/analyzerProfiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HISTORY_BARS = 250;
const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const enabled = (name: string, fallback: boolean) => {
  const value = process.env[name]?.trim().toLowerCase();
  return value === undefined ? fallback : !["off", "false", "0", "disabled"].includes(value);
};

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Automated scanner requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function johannesburgMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  return Number(parts.find((p) => p.type === "hour")?.value ?? 0) * 60 + Number(parts.find((p) => p.type === "minute")?.value ?? 0);
}

function inEmaWindow(date = new Date()) {
  const [startH, startM] = (process.env.VAULT_EMA_START ?? "01:30").split(":").map(Number);
  const [endH, endM] = (process.env.VAULT_EMA_LAST_SIGNAL ?? "08:45").split(":").map(Number);
  const now = johannesburgMinutes(date);
  return now >= startH * 60 + startM && now <= endH * 60 + endM;
}

function fingerprint(value: Record<string, unknown>) { return JSON.stringify(value, Object.keys(value).sort()); }

async function publish(supabase: ReturnType<typeof serviceClient>, payload: Record<string, unknown>) {
  const signalFingerprint = fingerprint(payload);
  const { data: duplicate, error: lookupError } = await supabase.from("scanner_signals").select("id,trade_id,status").is("auth_user_id", null).eq("signal_fingerprint", signalFingerprint).maybeSingle();
  if (lookupError) throw lookupError;
  if (duplicate) return { published: false, duplicate: true, signal: duplicate };

  const now = new Date().toISOString();
  const tradeId = `AUTO-${Date.now()}-${String(payload.canonical_symbol).replace(/[^A-Z0-9]/gi, "")}-${String(payload.timeframe).toUpperCase()}`;
  const direction = payload.direction as string;
  const strategyId = payload.strategy_id as string;

  const { data: prior, error: priorError } = await supabase.from("scanner_signals")
    .select("id,direction,status,execution_payload")
    .is("auth_user_id", null)
    .eq("canonical_symbol", payload.canonical_symbol)
    .eq("strategy_id", strategyId)
    .eq("timeframe", payload.timeframe)
    .in("status", ["CONFIRMED", "ACTIVE"])
    .neq("direction", direction)
    .order("fired_at", { ascending: false }).limit(20);
  if (priorError) throw priorError;
  for (const previous of prior ?? []) {
    const lifecycle = previous.execution_payload && typeof previous.execution_payload === "object" ? previous.execution_payload as Record<string, unknown> : {};
    await supabase.from("scanner_signals").update({
      status: "INVALIDATED",
      completed_at: now,
      updated_at: now,
      execution_payload: { ...lifecycle, status: "INVALIDATED", lifecycle_status: "INVALIDATED", completed_at: now, invalidated_by: tradeId, invalidation_reason: `Confirmed opposite ${direction} setup.` },
    }).eq("id", previous.id).is("auth_user_id", null);
  }

  const row = {
    auth_user_id: null,
    trade_id: tradeId,
    signal_fingerprint: signalFingerprint,
    market_category: payload.market_category,
    canonical_symbol: payload.canonical_symbol,
    direction,
    strategy_id: strategyId,
    strategy_name: payload.strategy_name,
    timeframe: payload.timeframe,
    entry: payload.entry,
    stop_loss: payload.stop_loss,
    tp1: payload.tp1,
    tp2: payload.tp2,
    tp3: payload.tp3,
    tp4: payload.tp4,
    confidence: payload.confidence,
    rr: payload.rr,
    status: "ACTIVE",
    confirmation_conditions: payload.confirmation_conditions ?? [],
    missing_conditions: [],
    execution_payload: { trade_id: tradeId, symbol: payload.canonical_symbol, side: direction, entry: payload.entry, stop_loss: payload.stop_loss, take_profit: payload.tp1, strategy: strategyId, strategy_id: strategyId, strategy_name: payload.strategy_name, timeframe: payload.timeframe, status: "ACTIVE", execution_enabled: false, execution_provider: "MetaKit", authority: "AUTOMATED_MARKET_ENGINE", lifecycle_rule: "Ends on SL or confirmed opposite setup; projected TP levels do not invalidate a pre-entry setup." },
    source_snapshot: payload.source_snapshot ?? {},
    fired_at: now,
    completed_at: null,
    updated_at: now,
  };
  const { data: signal, error } = await supabase.from("scanner_signals").insert(row).select("id,trade_id,status").single();
  if (error) throw error;
  return { published: true, duplicate: false, signal };
}

async function scanAdaptive(supabase: ReturnType<typeof serviceClient>, marketCategory: "FOREX" | "CRYPTO", symbol: string, timeframe: "5m" | "15m") {
  const provider = getMarketProviderRoute(marketCategory as MarketType);
  if (!provider.available) return { symbol, strategy: "adaptiveExecution", timeframe, skipped: provider.reason };
  const market = await getTwelveDataTimeSeries({ symbol, timeframe, outputsize: HISTORY_BARS });
  const candles = market.candles.map((c) => ({ open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume ?? null }));
  const current = evaluateAdaptiveExecution(candles, DEFAULT_ADAPTIVE_EXECUTION_CONFIG);
  const previous = evaluateAdaptiveExecution(candles.slice(0, -1), DEFAULT_ADAPTIVE_EXECUTION_CONFIG);
  const isNew = current.confirmed && current.direction !== previous.direction;
  if (!isNew || !current.entry || !current.stopLoss || !current.tp1) return { symbol, strategy: "adaptiveExecution", timeframe, published: false, reason: "NO_NEW_ENTRY_CONFIRMATION", score: current.score };
  const strategyName = ANALYZER_STRATEGY_MAP.adaptiveExecution.name;
  const result = await publish(supabase, {
    market_category: marketCategory, canonical_symbol: symbol, direction: current.direction, strategy_id: "adaptiveExecution", strategy_name: strategyName, timeframe: timeframe.toUpperCase(), entry: current.entry, stop_loss: current.stopLoss, tp1: current.tp1, tp2: current.tp2, tp3: current.tp3, tp4: current.tp4, confidence: current.score, rr: current.risk && current.tp1 ? Math.abs(current.tp1 - current.entry) / current.risk : null,
    confirmation_conditions: [`Entry Confirmation: YES — ${timeframe.toUpperCase()} independently confirmed a new ${current.direction} setup.`, `Adaptive score: ${current.score}/100.`, `Trend ${current.scores.trend}, Momentum ${current.scores.momentum}, Strength ${current.scores.strength}, Structure ${current.scores.structure}, ATR Trigger ${current.scores.trigger}.`],
    source_snapshot: { source: "ADAPTIVE_EXECUTION_ENGINE", authoritative: true, selectedTimeframe: timeframe.toUpperCase(), entryConfirmation: "YES", result: current },
  });
  return { symbol, strategy: "adaptiveExecution", timeframe, ...result };
}

async function scanEma(supabase: ReturnType<typeof serviceClient>, marketCategory: "FOREX" | "CRYPTO", symbol: string) {
  if (!inEmaWindow()) return { symbol, strategy: "ema20", timeframe: process.env.VAULT_EMA_TIMEFRAME ?? "M5", skipped: "OUTSIDE_01_30_08_45_WINDOW" };
  const timeframe = (process.env.VAULT_EMA_TIMEFRAME ?? "M5").toLowerCase();
  if (timeframe !== "5m" && timeframe !== "15m") return { symbol, strategy: "ema20", skipped: "INVALID_EMA_TIMEFRAME" };
  const market = await getTwelveDataTimeSeries({ symbol, timeframe, outputsize: HISTORY_BARS });
  const candles = market.candles.map((c) => ({ datetime: c.datetime, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume ?? null }));
  const current = evaluateEma20(candles);
  if (!current.newLong && !current.newShort) return { symbol, strategy: "ema20", timeframe: timeframe.toUpperCase(), published: false, reason: "NO_NEW_ENTRY_CONFIRMATION" };
  const direction = current.newLong ? "BUY" : "SELL";
  const entry = current.newLong ? current.longEntry : current.shortEntry;
  const stopLoss = current.newLong ? current.longSL : current.shortSL;
  const tp = current.newLong ? current.longTP : current.shortTP;
  if (![entry, stopLoss, tp].every(finite)) return { symbol, strategy: "ema20", timeframe: timeframe.toUpperCase(), published: false, reason: "NATIVE_ENTRY_LEVELS_UNAVAILABLE" };
  const result = await publish(supabase, {
    market_category: marketCategory, canonical_symbol: symbol, direction, strategy_id: "ema20", strategy_name: ANALYZER_STRATEGY_MAP.ema20.name, timeframe: timeframe.toUpperCase(), entry, stop_loss: stopLoss, tp1: tp, tp2: tp, tp3: tp, tp4: tp, confidence: current.longConfirmationScore || current.shortConfirmationScore, rr: 1.81,
    confirmation_conditions: [`Entry Confirmation: YES — EMA20 Pine-equivalent engine produced NEW_${direction}.`, "UT Bot OR SMI source confirmation is part of the authoritative EMA20 engine."],
    source_snapshot: { source: "EMA20_PINE_EQUIVALENT_ENGINE", authoritative: true, entryConfirmation: "YES", engine: current },
  });
  return { symbol, strategy: "ema20", timeframe: timeframe.toUpperCase(), ...result };
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) return Response.json({ error: "Unauthorized automated scanner invocation." }, { status: 401 });
  const supabase = serviceClient();
  const results: unknown[] = [];
  const schedule = request.headers.get("x-vercel-cron-schedule") ?? "manual";
  const job = schedule === "*/5 * * * *" ? "ADAPTIVE_M5" : schedule === "1,16,31,46 * * * *" ? "ADAPTIVE_M15" : schedule === "2,17,32,47 * * * *" ? "EMA" : (new URL(request.url).searchParams.get("job") ?? "ADAPTIVE_M5").toUpperCase();
  for (const [marketLabel, symbols] of Object.entries(MARKET_SYMBOLS)) {
    const marketCategory = marketLabel === "Forex" ? "FOREX" : marketLabel === "Crypto" ? "CRYPTO" : null;
    if (!marketCategory || !enabled(`VAULT_AUTOMATION_${marketCategory}`, true)) continue;
    for (const symbol of symbols) {
      if (job === "ADAPTIVE_M5" && enabled("VAULT_AUTOMATION_ADAPTIVE", true)) results.push(await scanAdaptive(supabase, marketCategory, symbol, "5m"));
      if (job === "ADAPTIVE_M15" && enabled("VAULT_AUTOMATION_ADAPTIVE", true)) results.push(await scanAdaptive(supabase, marketCategory, symbol, "15m"));
      if (job === "EMA" && enabled("VAULT_AUTOMATION_EMA", false)) results.push(await scanEma(supabase, marketCategory, symbol));
    }
  }
  return Response.json({ ok: true, engine: "AUTOMATED_MARKET_ENGINE", executionEnabled: false, job, results });
}

import { createHash } from "crypto";
import { createServiceClient } from "../supabase/service";
import { ANALYZER_STRATEGY_MAP } from "../strategies/analyzerProfiles";
import { isPreferredTradeTimeframe } from "../strategies/adaptiveExecution";

const ALLOWED_MARKETS = new Set([
  "XAU/USD", "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD",
  "BTC/USD", "ETH/USD", "SOL/USD",
]);

export type AutomatedScannerSignal = {
  authUserId: string;
  runKey: string;
  marketType: string;
  symbol: string;
  timeframe: string;
  strategyId: string;
  scanner: {
    projectedDirection?: "BUY" | "SELL" | "NO TRADE";
    analysisState?: string;
    isExecutable?: boolean;
    actualEntry?: number | null;
    stopLoss?: number | null;
    tp1?: number | null;
    tp2?: number | null;
    tp3?: number | null;
    tp4?: number | null;
    projectedTp1?: number | null;
    projectedTp2?: number | null;
    projectedTp3?: number | null;
    projectedTp4?: number | null;
    projectedStopLoss?: number | null;
    projectedProbability?: number;
    confirmations?: string[];
    waitReason?: string;
    tradeReason?: string;
    rr?: number | null;
  };
  analysis?: Record<string, unknown>;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function makeTradeId(input: AutomatedScannerSignal, direction: "BUY" | "SELL") {
  const suffix = hash({
    runKey: input.runKey,
    authUserId: input.authUserId,
    symbol: input.symbol,
    timeframe: input.timeframe,
    strategyId: input.strategyId,
    direction,
  }).slice(0, 16).toUpperCase();
  return `VT-AUTO-${suffix}`;
}

export async function publishAutomatedScannerSignal(input: AutomatedScannerSignal) {
  const supabase = createServiceClient();
  const scanner = input.scanner;
  const direction = scanner.projectedDirection;
  const symbol = clean(input.symbol).toUpperCase();
  const timeframe = clean(input.timeframe);
  const strategy = ANALYZER_STRATEGY_MAP[input.strategyId];

  if (!clean(input.authUserId) || !clean(input.runKey)) {
    return { published: false, duplicate: false, error: "Automation user and run identity are required." };
  }
  if (!ALLOWED_MARKETS.has(symbol)) {
    return { published: false, duplicate: false, error: `Market '${symbol}' is outside the Phase 1 VaultTrades signal universe.` };
  }
  if (!strategy) {
    return { published: false, duplicate: false, error: `Unknown strategy '${input.strategyId}'.` };
  }
  if (!isPreferredTradeTimeframe(timeframe)) {
    return { published: false, duplicate: false };
  }
  if (!scanner.isExecutable || (direction !== "BUY" && direction !== "SELL") || scanner.actualEntry == null) {
    return { published: false, duplicate: false };
  }

  const marketCategory = clean(input.marketType || "FOREX").toUpperCase();
  const payload = {
    automation_run_key: input.runKey,
    auth_user_id: input.authUserId,
    market_category: marketCategory,
    canonical_symbol: symbol,
    direction,
    strategy_id: strategy.id,
    strategy_name: strategy.name,
    timeframe: timeframe.toUpperCase(),
    entry: scanner.actualEntry,
    stop_loss: scanner.stopLoss ?? scanner.projectedStopLoss ?? null,
    tp1: scanner.tp1 ?? scanner.projectedTp1 ?? null,
    tp2: scanner.tp2 ?? scanner.projectedTp2 ?? null,
    tp3: scanner.tp3 ?? scanner.projectedTp3 ?? null,
    tp4: scanner.tp4 ?? scanner.projectedTp4 ?? null,
    confidence: finite(scanner.projectedProbability) ? scanner.projectedProbability : null,
    rr: scanner.rr ?? null,
  };

  const signalFingerprint = hash(payload);
  const { data: existing, error: lookupError } = await supabase
    .from("scanner_signals")
    .select("*")
    .eq("auth_user_id", input.authUserId)
    .eq("signal_fingerprint", signalFingerprint)
    .maybeSingle();

  if (lookupError) {
    return { published: false, duplicate: false, error: lookupError.message };
  }
  if (existing) {
    return { published: false, duplicate: true, signal: existing };
  }

  const now = new Date().toISOString();
  const tradeId = makeTradeId(input, direction);
  const executionPayload = {
    trade_id: tradeId,
    symbol,
    side: direction,
    entry: payload.entry,
    stop_loss: payload.stop_loss,
    take_profit: payload.tp1,
    strategy: strategy.id,
    strategy_id: strategy.id,
    strategy_name: strategy.name,
    timeframe: payload.timeframe,
    status: "ACTIVE",
    execution_enabled: false,
    execution_provider: "MetaKit",
    authority: "AUTOMATED_SCANNER",
    automation_run_key: input.runKey,
  };

  const row = {
    auth_user_id: input.authUserId,
    trade_id: tradeId,
    signal_fingerprint: signalFingerprint,
    market_category: marketCategory,
    canonical_symbol: symbol,
    direction,
    strategy_id: strategy.id,
    strategy_name: strategy.name,
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
    confirmation_conditions: scanner.confirmations ?? [],
    missing_conditions: [],
    execution_payload: executionPayload,
    source_snapshot: {
      source: "AUTOMATED_SCANNER",
      automation_run_key: input.runKey,
      strategy_id: strategy.id,
      strategy_name: strategy.name,
      analysisState: scanner.analysisState,
      isExecutable: scanner.isExecutable,
      waitReason: scanner.waitReason,
      tradeReason: scanner.tradeReason,
      analysis: input.analysis ?? {},
    },
    fired_at: now,
    completed_at: null,
    updated_at: now,
  };

  const { data, error } = await supabase.from("scanner_signals").insert(row).select("*").single();
  if (error) {
    if (error.code === "23505") {
      const { data: duplicate } = await supabase
        .from("scanner_signals")
        .select("*")
        .eq("auth_user_id", input.authUserId)
        .eq("signal_fingerprint", signalFingerprint)
        .maybeSingle();
      return { published: false, duplicate: true, signal: duplicate ?? null };
    }
    return { published: false, duplicate: false, error: error.message };
  }

  return { published: true, duplicate: false, signal: data };
}

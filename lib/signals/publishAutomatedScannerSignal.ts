import { createHash } from "crypto";
import { createServiceClient } from "../supabase/service";
import { STRATEGIES } from "../strategies";
import type { EntryConfirmationResult } from "../strategies/entryConfirmation";

const SIGNAL_MAX_AGE_HOURS = 2;
const ALLOWED_MARKETS = new Set(["XAU/USD", "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD", "BTC/USD", "ETH/USD", "SOL/USD"]);
const AUTOMATED_STRATEGIES = new Set(["adaptiveAutomated", "emaAutomated", "autoFibRetrace"]);
const PREFERRED_TIMEFRAMES = new Set(["M5", "M15"]);

type AutomatedScannerSignal = {
  authUserId: string; runKey: string; marketType: string; symbol: string; timeframe: string; strategyId: string;
  scanner: { projectedDirection?: "BUY" | "SELL" | "NO TRADE"; analysisState?: string; isExecutable?: boolean; actualEntry?: number | null; stopLoss?: number | null; tp1?: number | null; tp2?: number | null; tp3?: number | null; tp4?: number | null; projectedTp1?: number | null; projectedTp2?: number | null; projectedTp3?: number | null; projectedTp4?: number | null; projectedStopLoss?: number | null; projectedProbability?: number; confirmations?: string[]; waitReason?: string; tradeReason?: string; rr?: number | null };
  analysis?: Record<string, unknown>;
};
function clean(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function hash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function freshSignalCutoff() { return new Date(Date.now() - SIGNAL_MAX_AGE_HOURS * 60 * 60 * 1000).toISOString(); }

export async function publishAutomatedScannerSignal(input: AutomatedScannerSignal) {
  const supabase = createServiceClient(); const scanner = input.scanner; const direction = scanner.projectedDirection; const symbol = clean(input.symbol).toUpperCase(); const timeframe = clean(input.timeframe).toUpperCase();
  const strategy = AUTOMATED_STRATEGIES.has(input.strategyId) ? STRATEGIES[input.strategyId as keyof typeof STRATEGIES]?.rules : null;
  if (!clean(input.authUserId) || !clean(input.runKey)) return { published: false, duplicate: false, error: "Automation user and run identity are required." };
  if (!ALLOWED_MARKETS.has(symbol)) return { published: false, duplicate: false, error: `Market '${symbol}' is outside the Phase 1 VaultTrades signal universe.` };
  if (!strategy) return { published: false, duplicate: false, error: `Unknown automated strategy '${input.strategyId}'.` };
  if (!PREFERRED_TIMEFRAMES.has(timeframe)) return { published: false, duplicate: false, error: `Timeframe '${timeframe}' is not an automated execution timeframe. Only M5 and M15 are supported.` };
  if (!scanner.isExecutable || (direction !== "BUY" && direction !== "SELL") || scanner.actualEntry == null) return { published: false, duplicate: false };
  const entryConfirmation = input.analysis?.entryConfirmation as EntryConfirmationResult | undefined;
  if (!entryConfirmation || typeof entryConfirmation !== "object" || entryConfirmation.valid !== true) return { published: false, duplicate: false, error: "Entry confirmation is incomplete. The scanner must complete the canonical confirmation sequence before publication." };
  const marketCategory = clean(input.marketType || "FOREX").toUpperCase(); const confirmationBar = clean(input.analysis?.confirmationBar);
  const identity = { auth_user_id: input.authUserId, market_category: marketCategory, canonical_symbol: symbol, direction, strategy_id: strategy.id, timeframe, confirmation_bar: confirmationBar || null, entry: scanner.actualEntry };
  const signalFingerprint = hash(identity);
  const { data: existing, error: lookupError } = await supabase.from("scanner_signals").select("*").eq("auth_user_id", input.authUserId).eq("signal_fingerprint", signalFingerprint).maybeSingle();
  if (lookupError) return { published: false, duplicate: false, error: lookupError.message }; if (existing) return { published: false, duplicate: true, signal: existing };
  const now = new Date().toISOString(); const cutoff = freshSignalCutoff(); const tradeId = `VT-AUTO-${signalFingerprint.slice(0, 16).toUpperCase()}`;
  const { data: recentSameDirection, error: recentError } = await supabase.from("scanner_signals").select("id,trade_id,status,fired_at").eq("auth_user_id", input.authUserId).eq("canonical_symbol", symbol).eq("strategy_id", strategy.id).eq("timeframe", timeframe).eq("direction", direction).in("status", ["CONFIRMED", "ACTIVE"]).gte("fired_at", cutoff).order("fired_at", { ascending: false }).limit(1);
  if (recentError) return { published: false, duplicate: false, error: recentError.message };
  if (recentSameDirection?.length) return { published: false, duplicate: true, signal: recentSameDirection[0], reason: "A fresh signal for the same symbol, strategy, timeframe and direction already exists within the two-hour execution window." };
  const { data: priorSignals, error: priorError } = await supabase.from("scanner_signals").select("id,direction,status,execution_payload").eq("auth_user_id", input.authUserId).eq("canonical_symbol", symbol).eq("strategy_id", strategy.id).eq("timeframe", timeframe).in("status", ["CONFIRMED", "ACTIVE"]).neq("direction", direction).order("fired_at", { ascending: false }).limit(20);
  if (priorError) return { published: false, duplicate: false, error: priorError.message };
  for (const prior of priorSignals ?? []) { const lifecycle = prior.execution_payload && typeof prior.execution_payload === "object" ? prior.execution_payload as Record<string, unknown> : {}; await supabase.from("scanner_signals").update({ status: "INVALIDATED", completed_at: now, updated_at: now, execution_payload: { ...lifecycle, status: "INVALIDATED", lifecycle_status: "INVALIDATED", completed_at: now, invalidated_by: tradeId, invalidation_reason: `Confirmed opposite ${direction} setup on ${timeframe}.` } }).eq("id", prior.id).eq("auth_user_id", input.authUserId); }
  const payload = { entry: scanner.actualEntry, stop_loss: scanner.stopLoss ?? scanner.projectedStopLoss ?? null, tp1: scanner.tp1 ?? scanner.projectedTp1 ?? null, tp2: scanner.tp2 ?? scanner.projectedTp2 ?? null, tp3: scanner.tp3 ?? scanner.projectedTp3 ?? null, tp4: scanner.tp4 ?? scanner.projectedTp4 ?? null, confidence: finite(scanner.projectedProbability) ? scanner.projectedProbability : null, rr: scanner.rr ?? null };
  const executionPayload = { trade_id: tradeId, symbol, side: direction, entry: payload.entry, stop_loss: payload.stop_loss, take_profit: payload.tp1, strategy: strategy.id, strategy_id: strategy.id, strategy_name: strategy.name, timeframe, status: "ACTIVE", execution_enabled: false, execution_provider: "MetaKit", authority: "AUTOMATED_SCANNER", automation_run_key: input.runKey, lifecycle_rule: "Ends on SL or confirmed opposite setup; projected TP levels do not invalidate a pre-entry setup.", signal_freshness_hours: SIGNAL_MAX_AGE_HOURS };
  const row = { auth_user_id: input.authUserId, trade_id: tradeId, signal_fingerprint: signalFingerprint, market_category: marketCategory, canonical_symbol: symbol, direction, strategy_id: strategy.id, strategy_name: strategy.name, timeframe, entry: payload.entry, stop_loss: payload.stop_loss, tp1: payload.tp1, tp2: payload.tp2, tp3: payload.tp3, tp4: payload.tp4, confidence: payload.confidence, rr: payload.rr, status: "ACTIVE", confirmation_conditions: scanner.confirmations ?? [], missing_conditions: [], execution_payload: executionPayload, source_snapshot: { source: "AUTOMATED_SCANNER", automation_run_key: input.runKey, strategy_id: strategy.id, strategy_name: strategy.name, analysisState: scanner.analysisState, isExecutable: scanner.isExecutable, waitReason: scanner.waitReason, tradeReason: scanner.tradeReason, confirmationBar: confirmationBar || null, entryConfirmation, analysis: input.analysis ?? {} }, fired_at: now, completed_at: null, updated_at: now };
  const { data, error } = await supabase.from("scanner_signals").insert(row).select("*").single();
  if (error) { if (error.code === "23505") { const { data: duplicate } = await supabase.from("scanner_signals").select("*").eq("auth_user_id", input.authUserId).eq("signal_fingerprint", signalFingerprint).maybeSingle(); return { published: false, duplicate: true, signal: duplicate ?? null }; } return { published: false, duplicate: false, error: error.message }; }
  return { published: true, duplicate: false, signal: data };
}

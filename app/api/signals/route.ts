import { createHash } from "crypto";
import { createClient } from "../../../lib/supabase/server";
import { ANALYZER_STRATEGY_MAP } from "../../../lib/strategies/analyzerProfiles";

export const runtime = "nodejs";

const ALLOWED_MARKETS = new Set([
  "XAU/USD", "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD",
  "BTC/USD", "ETH/USD", "SOL/USD",
]);

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";

function fingerprint(input: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function makeTradeId(symbol: string, timeframe: string) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return `VT-${stamp}-${symbol.replace("/", "")}-${timeframe.toUpperCase()}-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { data, error } = await supabase
    .from("scanner_signals")
    .select("id,trade_id,market_category,canonical_symbol,direction,strategy_id,strategy_name,timeframe,entry,stop_loss,tp1,tp2,tp3,tp4,confidence,rr,status,confirmation_conditions,missing_conditions,execution_payload,fired_at,created_at,updated_at")
    .eq("auth_user_id", user.id)
    .order("fired_at", { ascending: false })
    .limit(100);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ signals: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json();
  const symbol = clean(body?.canonical_symbol || body?.symbol).toUpperCase();
  const direction = clean(body?.direction).toUpperCase();
  const timeframe = clean(body?.timeframe);
  const strategyId = clean(body?.strategy_id || body?.strategy);
  const suppliedStrategyName = clean(body?.strategy_name);
  const status = clean(body?.status || "CONFIRMED").toUpperCase();

  if (!ALLOWED_MARKETS.has(symbol)) return Response.json({ error: "Market is not in the Phase 1 VaultTrades signal universe." }, { status: 400 });
  if (direction !== "BUY" && direction !== "SELL") return Response.json({ error: "Only confirmed BUY or SELL signals can enter the signal ledger." }, { status: 400 });
  if (!timeframe || !strategyId) return Response.json({ error: "Strategy and timeframe are required." }, { status: 400 });

  // The selected Analyzer strategy is the authoritative source of every signal.
  const selectedStrategy = ANALYZER_STRATEGY_MAP[strategyId];
  if (!selectedStrategy) return Response.json({ error: `Unknown strategy '${strategyId}'. Signal confirmation is rejected.` }, { status: 400 });

  // Never allow a signal to be labelled as a different strategy than the one selected.
  if (suppliedStrategyName && suppliedStrategyName !== selectedStrategy.name) {
    return Response.json({
      error: "Strategy identity mismatch. The signal strategy must exactly match the selected Analyzer strategy.",
      expected: { strategy_id: selectedStrategy.id, strategy_name: selectedStrategy.name },
      received: { strategy_id: strategyId, strategy_name: suppliedStrategyName },
    }, { status: 409 });
  }

  // Adaptive Execution Engine is restricted to its preferred M5/M15 signal timeframes.
  if (strategyId === "adaptiveExecution" && !["5m", "15m", "M5", "M15"].includes(timeframe)) {
    return Response.json({ error: "Adaptive Execution Engine signals may only be confirmed on M5 or M15." }, { status: 400 });
  }

  if (status !== "CONFIRMED") return Response.json({ error: "Phase 1 only publishes CONFIRMED signals. Projections and developing states stay in the Scanner." }, { status: 400 });

  const sourceSnapshot = body?.source_snapshot && typeof body.source_snapshot === "object" ? body.source_snapshot : {};
  const sourceStrategyId = clean(sourceSnapshot?.strategy_id || sourceSnapshot?.strategyId);
  const sourceStrategyName = clean(sourceSnapshot?.strategy_name || sourceSnapshot?.strategyName);

  // A source snapshot, when supplied, must point to the exact same strategy.
  if (sourceStrategyId && sourceStrategyId !== selectedStrategy.id) return Response.json({ error: "Source snapshot strategy does not match the selected Analyzer strategy." }, { status: 409 });
  if (sourceStrategyName && sourceStrategyName !== selectedStrategy.name) return Response.json({ error: "Source snapshot strategy name does not match the selected Analyzer strategy." }, { status: 409 });

  const payload = {
    trade_id: clean(body?.trade_id) || null,
    market_category: clean(body?.market_category || body?.marketType || "FOREX").toUpperCase(),
    canonical_symbol: symbol,
    direction,
    strategy_id: selectedStrategy.id,
    strategy_name: selectedStrategy.name,
    timeframe,
    entry: finite(body?.entry) ? body.entry : null,
    stop_loss: finite(body?.stop_loss) ? body.stop_loss : null,
    tp1: finite(body?.tp1) ? body.tp1 : null,
    tp2: finite(body?.tp2) ? body.tp2 : null,
    tp3: finite(body?.tp3) ? body.tp3 : null,
    tp4: finite(body?.tp4) ? body.tp4 : null,
    confidence: finite(body?.confidence) ? body.confidence : null,
    rr: finite(body?.rr) ? body.rr : null,
  };

  const signalFingerprint = fingerprint(payload);
  const { data: existing } = await supabase
    .from("scanner_signals")
    .select("*")
    .eq("auth_user_id", user.id)
    .eq("signal_fingerprint", signalFingerprint)
    .maybeSingle();

  if (existing) return Response.json({ signal: existing, duplicate: true });

  const tradeId = payload.trade_id || makeTradeId(symbol, timeframe);
  const executionPayload = {
    trade_id: tradeId,
    symbol,
    side: direction,
    entry: payload.entry,
    stop_loss: payload.stop_loss,
    take_profit: payload.tp1,
    strategy: selectedStrategy.id,
    strategy_id: selectedStrategy.id,
    strategy_name: selectedStrategy.name,
    timeframe,
    status: "CONFIRMED",
    execution_enabled: false,
    execution_provider: "MetaKit",
  };

  const normalizedSourceSnapshot = {
    ...(sourceSnapshot as Record<string, unknown>),
    strategy_id: selectedStrategy.id,
    strategy_name: selectedStrategy.name,
  };

  const row = {
    auth_user_id: user.id,
    trade_id: tradeId,
    signal_fingerprint: signalFingerprint,
    market_category: payload.market_category,
    canonical_symbol: symbol,
    direction,
    strategy_id: selectedStrategy.id,
    strategy_name: selectedStrategy.name,
    timeframe,
    entry: payload.entry,
    stop_loss: payload.stop_loss,
    tp1: payload.tp1,
    tp2: payload.tp2,
    tp3: payload.tp3,
    tp4: payload.tp4,
    confidence: payload.confidence,
    rr: payload.rr,
    status: "CONFIRMED",
    confirmation_conditions: Array.isArray(body?.confirmation_conditions) ? body.confirmation_conditions : [],
    missing_conditions: Array.isArray(body?.missing_conditions) ? body.missing_conditions : [],
    execution_payload: executionPayload,
    source_snapshot: normalizedSourceSnapshot,
  };

  const { data, error } = await supabase.from("scanner_signals").insert(row).select("*").single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ signal: data, duplicate: false }, { status: 201 });
}

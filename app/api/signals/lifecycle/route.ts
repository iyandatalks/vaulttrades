import { createClient } from "../../../../lib/supabase/server";
import { getTwelveDataTimeSeries } from "../../../../lib/market-data/twelvedata";

export const runtime = "nodejs";

const TERMINAL = new Set(["TP1_HIT", "SL_HIT"]);
const TRACKED_TIMEFRAMES = new Set(["5m", "15m", "M5", "M15"]);

type SignalRow = {
  id: string;
  trade_id: string;
  canonical_symbol: string;
  direction: "BUY" | "SELL";
  timeframe: string;
  entry: number | null;
  stop_loss: number | null;
  tp1: number | null;
  status: string;
  execution_payload: Record<string, unknown> | null;
  source_snapshot: Record<string, unknown> | null;
};

function evaluate(signal: SignalRow, high: number, low: number, close: number) {
  if (signal.entry == null || signal.stop_loss == null || signal.tp1 == null) return "ACTIVE";

  const stopHit = signal.direction === "BUY" ? low <= signal.stop_loss : high >= signal.stop_loss;
  const tp1Hit = signal.direction === "BUY" ? high >= signal.tp1 : low <= signal.tp1;

  // If one candle touches both levels, the intrabar order cannot be known from
  // OHLC alone. Use SL-first as the conservative lifecycle rule.
  if (stopHit) return "SL_HIT";
  if (tp1Hit) return "TP1_HIT";
  return "ACTIVE";
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { data: rows, error } = await supabase
    .from("scanner_signals")
    .select("id,trade_id,canonical_symbol,direction,timeframe,entry,stop_loss,tp1,status,execution_payload,source_snapshot")
    .eq("auth_user_id", user.id)
    .in("status", ["CONFIRMED", "ACTIVE"])
    .order("fired_at", { ascending: false })
    .limit(100);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const signals = (rows ?? []) as SignalRow[];
  const tracked = signals.filter((signal) => TRACKED_TIMEFRAMES.has(signal.timeframe));
  const updates: Array<{ trade_id: string; status: string }> = [];

  for (const signal of tracked) {
    try {
      const market = await getTwelveDataTimeSeries({
        symbol: signal.canonical_symbol,
        timeframe: signal.timeframe,
        outputsize: 2,
      });

      const candle = market.candles.at(-1);
      const currentPrice = market.currentPrice;
      if (!candle && currentPrice == null) continue;

      const high = candle?.high ?? currentPrice!;
      const low = candle?.low ?? currentPrice!;
      const close = candle?.close ?? currentPrice!;
      const nextStatus = evaluate(signal, high, low, close);

      if (nextStatus === signal.status) continue;

      const checkedAt = new Date().toISOString();
      const existingPayload = signal.execution_payload ?? {};
      const existingSnapshot = signal.source_snapshot ?? {};
      const lifecycle = {
        ...(typeof existingPayload.lifecycle === "object" && existingPayload.lifecycle !== null ? existingPayload.lifecycle : {}),
        last_price: currentPrice,
        last_candle_high: high,
        last_candle_low: low,
        last_candle_close: close,
        checked_at: checkedAt,
        completed_at: TERMINAL.has(nextStatus) ? checkedAt : null,
        result: nextStatus === "TP1_HIT" ? "WIN" : nextStatus === "SL_HIT" ? "LOSS" : "ACTIVE",
      };

      const { error: updateError } = await supabase
        .from("scanner_signals")
        .update({
          status: nextStatus,
          completed_at: TERMINAL.has(nextStatus) ? checkedAt : null,
          execution_payload: { ...existingPayload, lifecycle },
          source_snapshot: { ...existingSnapshot, lifecycle },
        })
        .eq("id", signal.id)
        .eq("auth_user_id", user.id);

      if (!updateError) updates.push({ trade_id: signal.trade_id, status: nextStatus });
    } catch (lifecycleError) {
      console.error(`Signal lifecycle check failed for ${signal.trade_id}`, lifecycleError);
    }
  }

  return Response.json({ checked: tracked.length, updated: updates.length, updates });
}

export async function GET() {
  return POST();
}

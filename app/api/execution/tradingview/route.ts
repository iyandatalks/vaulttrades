import { NextResponse } from "next/server";
import { createAdminClient } from "../../../lib/supabase/admin";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const accessKey = text(body.access_key || body.accessKey || body.secret);
    if (!accessKey) {
      return NextResponse.json({ error: "access_key is required" }, { status: 401 });
    }

    const symbol = text(body.symbol || body.canonical_symbol || body.ticker);
    const direction = text(body.direction || body.action).toUpperCase();
    const timeframe = text(body.timeframe || body.tf || "M15");
    const strategyId = text(body.strategy_id || body.strategy || "tradingview");
    const strategyName = text(body.strategy_name || body.strategy || "TradingView");
    const entry = num(body.entry || body.entry_price);
    const stopLoss = num(body.stop_loss || body.sl);
    const tp1 = num(body.tp1 || body.tp);
    const tp2 = num(body.tp2);
    const tp3 = num(body.tp3);
    const tp4 = num(body.tp4);
    const confidence = num(body.confidence);
    const rr = num(body.rr);
    const suppliedTradeId = text(body.signal_id || body.trade_id);

    if (!symbol || !["BUY", "SELL"].includes(direction) || entry === null || stopLoss === null || tp1 === null) {
      return NextResponse.json({
        error: "Invalid signal. Required: symbol, direction (BUY/SELL), entry, stop_loss/sl and tp1/tp."
      }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: license, error: licenseError } = await admin
      .from("product_licenses")
      .select("id,user_id,status,start_at,end_at,platform,mt_login,broker_name,broker_server")
      .eq("access_key", accessKey)
      .eq("status", "active")
      .maybeSingle();

    if (licenseError) throw licenseError;
    if (!license?.user_id) {
      return NextResponse.json({ error: "Invalid or inactive VaultTrades access key" }, { status: 401 });
    }

    const now = Date.now();
    if (license.end_at && new Date(license.end_at).getTime() <= now) {
      return NextResponse.json({ error: "VaultTrades access key has expired" }, { status: 403 });
    }

    const fingerprint = text(body.signal_fingerprint) || [
      license.user_id,
      symbol.toUpperCase(),
      direction,
      strategyId,
      timeframe,
      entry,
      stopLoss,
      tp1,
      tp2 ?? "",
      tp3 ?? "",
      tp4 ?? "",
      text(body.timestamp || body.time || "")
    ].join("|");

    const tradeId = suppliedTradeId || `TV-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const { data: existing } = await admin
      .from("scanner_signals")
      .select("id,trade_id,status")
      .eq("signal_fingerprint", fingerprint)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        signal_id: existing.id,
        trade_id: existing.trade_id,
        status: existing.status
      });
    }

    const payload = {
      source: "tradingview",
      trade_id: tradeId,
      symbol,
      direction,
      timeframe,
      entry,
      stop_loss: stopLoss,
      tp1,
      tp2,
      tp3,
      tp4,
      confidence,
      rr,
      raw: body,
      received_at: new Date().toISOString()
    };

    const { data: signal, error: signalError } = await admin
      .from("scanner_signals")
      .insert({
        auth_user_id: license.user_id,
        trade_id: tradeId,
        signal_fingerprint: fingerprint,
        market_category: text(body.market_category || "FOREX"),
        canonical_symbol: symbol.toUpperCase(),
        direction,
        strategy_id: strategyId,
        strategy_name: strategyName,
        timeframe,
        entry,
        stop_loss: stopLoss,
        tp1,
        tp2,
        tp3,
        tp4,
        confidence,
        rr,
        status: "EXECUTION_PENDING",
        confirmation_conditions: Array.isArray(body.confirmation_conditions) ? body.confirmation_conditions : [],
        missing_conditions: Array.isArray(body.missing_conditions) ? body.missing_conditions : [],
        execution_payload: payload,
        source_snapshot: body,
        fired_at: new Date().toISOString()
      })
      .select("id,trade_id,status")
      .single();

    if (signalError) throw signalError;

    const { data: queue, error: queueError } = await admin
      .from("automated_trader_execution_queue")
      .insert({
        signal_id: signal.id,
        signal_fingerprint: fingerprint,
        strategy_id: strategyId,
        strategy_name: strategyName,
        canonical_symbol: symbol.toUpperCase(),
        direction,
        timeframe,
        entry,
        stop_loss: stopLoss,
        tp1,
        tp2,
        tp3,
        tp4,
        status: "queued",
        payload: {
          ...payload,
          auth_user_id: license.user_id,
          mt_login: license.mt_login,
          broker_name: license.broker_name,
          broker_server: license.broker_server
        }
      })
      .select("id,status")
      .single();

    if (queueError) {
      await admin.from("scanner_signals").update({ status: "CONFIRMED" }).eq("id", signal.id);
      throw queueError;
    }

    return NextResponse.json({
      ok: true,
      duplicate: false,
      signal_id: signal.id,
      trade_id: signal.trade_id,
      queue_id: queue.id,
      status: "EXECUTION_PENDING"
    }, { status: 201 });
  } catch (error) {
    console.error("TradingView execution webhook error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "TradingView webhook failed" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "VaultTrades TradingView execution webhook",
    method: "POST",
    status: "ready"
  });
}

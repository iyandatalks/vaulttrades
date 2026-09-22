import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const num = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const time = (value: unknown) => {
  if (value === null || value === undefined || value === "") return new Date().toISOString();
  const raw = String(value);
  const n = Number(raw);
  if (Number.isFinite(n)) return new Date(n).toISOString();
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const allowedEventStatus: Record<string, string> = {
  TP1_HIT: "TP1_HIT",
  TP2_HIT: "TP2_HIT",
  TP3_HIT: "TP3_HIT",
  TP4_HIT: "TP4_HIT",
  TP5_HIT: "TP5_HIT",
  STOP_LOSS_HIT: "STOPPED",
  TRADE_CLOSED: "CLOSED",
};

const authSecret = (request: Request, body?: Record<string, unknown>) =>
  text(request.headers.get("x-vaulttrades-webhook-secret")) ||
  text(body?.webhook_secret ?? body?.webhookSecret ?? body?.secret);

const checkSecret = (request: Request, body?: Record<string, unknown>) => {
  const configuredSecret = text(process.env.VAULTTRADES_TRADINGVIEW_WEBHOOK_SECRET);
  const receivedSecret = authSecret(request, body);
  if (!configuredSecret) return { ok: false, status: 500, error: "WEBHOOK_SECRET_NOT_CONFIGURED" };
  if (!receivedSecret) return { ok: false, status: 401, error: "WEBHOOK_SECRET_MISSING" };
  if (receivedSecret !== configuredSecret) return { ok: false, status: 401, error: "AUTH_FAILED" };
  return { ok: true as const };
};

export async function GET(request: Request) {
  const auth = checkSecret(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const url = new URL(request.url);
  const strategyId = text(url.searchParams.get("strategy_id"));
  const symbol = text(url.searchParams.get("symbol")).toUpperCase() || "XAUUSD";
  const mode = text(url.searchParams.get("execution_mode")).toUpperCase() || "LIVE";

  if (mode !== "LIVE") {
    return NextResponse.json({ ok: true, status: "NO_EXECUTION", signals: [] });
  }

  const db = createServiceClient();
  let query = db.from("automation_signals")
    .select("id,signal_id,signal_fingerprint,strategy_id,strategy_name,symbol,direction,timeframe,entry_price,stop_loss,tp1,tp2,tp3,tp4,tp5,rr,execution_mode,event,source,generated_at,received_at,status,payload")
    .eq("status", "OPEN")
    .eq("execution_mode", "LIVE")
    .eq("symbol", symbol)
    .order("generated_at", { ascending: true })
    .limit(1);

  if (strategyId) query = query.eq("strategy_id", strategyId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: "PERSISTENCE_FAILED", detail: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    status: data?.length ? "SIGNAL_READY" : "WAITING",
    signals: data ?? [],
  });
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let body: Record<string, unknown>;

  try { body = await request.json(); }
  catch { return NextResponse.json({ ok: false, request_id: requestId, error: "INVALID_JSON" }, { status: 400 }); }

  const auth = checkSecret(request, body);
  if (!auth.ok) return NextResponse.json({ ok: false, request_id: requestId, error: auth.error }, { status: auth.status });

  const signalId = text(body.signal_id ?? body.trade_id);
  const event = text(body.event).toUpperCase() || "CONFIRMED_ENTRY";
  const receivedAt = new Date().toISOString();

  // MT5 acknowledges that a TradingView signal has been consumed/executed.
  if (event === "MT5_ACK") {
    if (!signalId) return NextResponse.json({ ok: false, request_id: requestId, error: "SIGNAL_ID_REQUIRED" }, { status: 422 });

    const db = createServiceClient();
    const updates: Record<string, unknown> = {
      status: "EXECUTED",
      last_update_at: receivedAt,
      updated_at: receivedAt,
      payload: body,
    };
    if (body.ticket !== undefined) updates.mt5_ticket = num(body.ticket);
    if (body.order_ticket !== undefined) updates.mt5_order_ticket = num(body.order_ticket);

    const { data, error } = await db.from("automation_signals")
      .update(updates)
      .eq("signal_id", signalId)
      .select("id,signal_id,status")
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, request_id: requestId, error: "PERSISTENCE_FAILED", detail: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ ok: false, request_id: requestId, error: "SIGNAL_NOT_FOUND", signal_id: signalId }, { status: 404 });

    return NextResponse.json({ ok: true, request_id: requestId, event, signal: data });
  }

  const strategyId = text(body.strategy_id);
  const strategyName = text(body.strategy_name) || null;
  const symbol = text(body.symbol || body.ticker).toUpperCase();
  const direction = text(body.direction ?? body.action).toUpperCase();
  const timeframe = text(body.timeframe);
  const source = text(body.source) || "TradingView";
  const executionMode = (text(body.execution_mode) || "OBSERVE").toUpperCase();
  const generatedAt = time(body.timestamp ?? body.generated_at);

  if (!signalId || !strategyId || !symbol || !direction || !timeframe || !generatedAt)
    return NextResponse.json({ ok:false, request_id:requestId, error:"VALIDATION_FAILED", required:["signal_id","strategy_id","symbol","direction","timeframe","timestamp"] }, {status:422});
  if (!["BUY","SELL"].includes(direction)) return NextResponse.json({ok:false,request_id:requestId,error:"INVALID_DIRECTION"},{status:422});
  if (!["OBSERVE","LIVE"].includes(executionMode)) return NextResponse.json({ok:false,request_id:requestId,error:"INVALID_EXECUTION_MODE"},{status:422});

  const entry=num(body.entry ?? body.entry_price);
  if(entry===null) return NextResponse.json({ok:false,request_id:requestId,error:"ENTRY_REQUIRED"},{status:422});

  const db = createServiceClient();

  if (event !== "CONFIRMED_ENTRY" && allowedEventStatus[event]) {
    const updates: Record<string, unknown> = { status: allowedEventStatus[event], last_update_at: receivedAt, updated_at: receivedAt, payload: body };
    if (/^TP[1-5]_HIT$/.test(event)) updates[event.toLowerCase().replace("_hit","_hit_at")] = receivedAt;
    if (event === "STOP_LOSS_HIT") updates.stop_loss_hit_at = receivedAt;
    if (event === "TRADE_CLOSED") { updates.closed_at = receivedAt; updates.close_reason = text(body.close_reason) || "TradingView"; }

    const {data,error}=await db.from("automation_signals").update(updates).eq("signal_id",signalId).select("id,signal_id,status").maybeSingle();
    if(error) return NextResponse.json({ok:false,request_id:requestId,error:"PERSISTENCE_FAILED",detail:error.message},{status:500});
    if(!data) return NextResponse.json({ok:false,request_id:requestId,error:"SIGNAL_NOT_FOUND",signal_id:signalId},{status:404});
    return NextResponse.json({ok:true,request_id:requestId,event,signal:data});
  }

  const row = {
    signal_id: signalId, signal_fingerprint: text(body.signal_fingerprint)||null,
    strategy_id: strategyId, strategy_name: strategyName, symbol, direction, timeframe,
    entry_price: entry, stop_loss:num(body.stop_loss), tp1:num(body.tp1), tp2:num(body.tp2), tp3:num(body.tp3), tp4:num(body.tp4), tp5:num(body.tp5),
    rr:num(body.rr), confidence:num(body.confidence), execution_mode:executionMode, event, source,
    generated_at:generatedAt, received_at:receivedAt, status:"OPEN", last_update_at:receivedAt, payload:body, updated_at:receivedAt
  };

  const {data,error}=await db.from("automation_signals").upsert(row,{onConflict:"signal_id"}).select("id,signal_id,strategy_id,symbol,direction,timeframe,entry_price,stop_loss,tp1,status,execution_mode,generated_at,received_at").single();
  if(error) return NextResponse.json({ok:false,request_id:requestId,error:"PERSISTENCE_FAILED",detail:error.message},{status:500});
  return NextResponse.json({ok:true,request_id:requestId,mode:executionMode,signal:data});
}

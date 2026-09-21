import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function authText(value: unknown) {
  return text(value).replace(/^[\"']|[\"']$/g, "").trim();
}
function num(value: unknown) { const n = Number(value); return Number.isFinite(n) ? n : null; }

function parseSignal(body: any) {
  const rawSymbol = text(body.symbol || body.canonical_symbol || body.ticker).toUpperCase();
  const symbol = rawSymbol.replace(/^[A-Z0-9_]+:/, "").replace(/[^A-Z0-9]/g, "");
  const direction = text(body.direction || body.action).toUpperCase();
  const timeframe = text(body.timeframe || body.tf || "M15").toUpperCase();
  const strategyId = text(body.strategy_id || body.strategy || "tradingview");
  const strategyName = text(body.strategy_name || body.strategy || "TradingView");
  const entry = num(body.entry || body.entry_price);
  const stopLoss = num(body.stop_loss || body.sl);
  const tp1 = num(body.tp1 || body.tp);
  const tp2 = num(body.tp2);
  const tp3 = num(body.tp3);
  const tp4 = num(body.tp4);
  const tp5 = num(body.tp5);
  const confirmationTimeframe = text(body.confirmation_timeframe || body.confirmationTimeframe);
  const entryQuality = text(body.entry_quality || body.entryQuality);
  const confidence = num(body.confidence);
  const rr = num(body.rr);
  const executionMode = text(body.execution_mode || "OBSERVE").toUpperCase();
  return { symbol, direction, timeframe, strategyId, strategyName, entry, stopLoss, tp1, tp2, tp3, tp4, tp5, confirmationTimeframe, entryQuality, confidence, rr, executionMode };
}

async function auditWebhook(admin: ReturnType<typeof createAdminClient>, event: {
  requestId: string; stage: string; status: string; signal?: ReturnType<typeof parseSignal>;
  signalId?: string | null; queueId?: string | null; errorCode?: string | null; errorMessage?: string | null; payload?: Record<string, unknown>;
}) {
  try {
    const sanitized = event.payload ? { ...event.payload } : undefined;
    if (sanitized) {
      delete sanitized.webhook_secret;
      delete sanitized.webhookSecret;
      delete sanitized.secret;
      delete sanitized.access_key;
      delete sanitized.accessKey;
    }
    await admin.from("tradingview_webhook_events").insert({
      request_id: event.requestId,
      stage: event.stage,
      status: event.status,
      symbol: event.signal?.symbol ?? null,
      direction: event.signal?.direction ?? null,
      timeframe: event.signal?.timeframe ?? null,
      strategy_id: event.signal?.strategyId ?? null,
      execution_mode: event.signal?.executionMode ?? null,
      signal_id: event.signalId && /^[0-9a-fA-F-]{36}$/.test(event.signalId) ? event.signalId : null,
      queue_id: event.queueId ?? null,
      error_code: event.errorCode ?? null,
      error_message: event.errorMessage ?? null,
      payload: sanitized ?? null,
    });
  } catch (auditError) {
    console.error("[tradingview-webhook] audit write failed", auditError);
  }
}

function validateStrategyTimeframe(strategyId: string, timeframe: string) {
  if (strategyId === "vault_auto_select_fib_retrace_latest") {
    const allowed = ["M1", "M5", "M10", "M15", "M30", "H1", "H4", "D1"];
    if (!allowed.includes(timeframe)) {
      return "FIB Retracement supports M1, M5, M10, M15, M30, H1, H4 and D1.";
    }
    return null;
  }
  if (strategyId === "justine-session-liquidity-m15") {
    const allowed = ["M1", "M5", "M10", "M15", "M30", "H1", "H4", "D1"];
    if (!allowed.includes(timeframe)) {
      return "Justine Session Liquidity supports M1, M5, M10, M15, M30, H1, H4 and D1.";
    }
    return null;
  }
  if (strategyId === "ema20-pullback-morning-engine") {
    const allowed = ["M1", "M5", "M10", "M15", "M30", "H1", "H4", "D1"];
    if (!allowed.includes(timeframe)) {
      return "EMA20 Pullback Morning Engine supports M1, M5, M10, M15, M30, H1, H4 and D1.";
    }
    return null;
  }
  return "Unsupported TradingView strategy_id. This webhook accepts VaultTrades FIB M1/M5/M10/M15/M30/H1/H4/D1, Justine M1/M5/M10/M15/M30/H1/H4/D1 and EMA20 Pullback Morning Engine M1/M5/M10/M15/M30/H1/H4/D1.";
}

export async function POST(request: Request) {
  try {
    const requestId = request.headers.get("x-vercel-id") || crypto.randomUUID();
    const rawBody = await request.text();
    const admin = createAdminClient();

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      const start = rawBody.indexOf("{");
      const end = rawBody.lastIndexOf("}");
      if (start >= 0 && end > start) {
        try { body = JSON.parse(rawBody.slice(start, end + 1)); } catch { body = null; }
      } else {
        body = null;
      }
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      await auditWebhook(admin, {
        requestId,
        stage: "RECEIVED",
        status: "REJECTED",
        errorCode: "INVALID_JSON_PAYLOAD",
        errorMessage: "TradingView webhook received a non-JSON payload. The endpoint is reachable, but no structured signal object was found.",
        payload: { raw_body: rawBody.slice(0, 8000) }
      });
      return NextResponse.json({
        ok: false,
        error: "Invalid TradingView payload",
        code: "INVALID_JSON_PAYLOAD",
        message: "The webhook endpoint received the request, but the body was not a JSON signal payload."
      }, { status: 400 });
    }

    const signal = parseSignal(body);
    await auditWebhook(admin, { requestId, stage: "RECEIVED", status: "RECEIVED", signal, payload: body });
    const webhookSecret = authText(body.webhook_secret ?? body.webhookSecret ?? body.secret);
    const configuredSecret = authText(process.env.VAULTTRADES_TRADINGVIEW_WEBHOOK_SECRET);
    const suppliedAccessKey = authText(body.access_key ?? body.accessKey);
    const masterMode = Boolean(configuredSecret && webhookSecret && webhookSecret === configuredSecret);
    if (!configuredSecret && !suppliedAccessKey) {
      await auditWebhook(admin, { requestId, stage: "AUTHENTICATION", status: "FAILED", signal, errorCode: "SERVER_SECRET_NOT_CONFIGURED", errorMessage: "VAULTTRADES_TRADINGVIEW_WEBHOOK_SECRET is not configured in the production runtime.", payload: body });
      return NextResponse.json({ error: "TradingView webhook authentication is not configured on the server." }, { status: 500 });
    }

    if (signal.symbol !== "XAUUSD") {
      await auditWebhook(admin, { requestId, stage: "VALIDATION", status: "REJECTED", signal, errorCode: "UNSUPPORTED_SYMBOL", errorMessage: "Unsupported symbol", payload: body });
      return NextResponse.json({ error: "Unsupported symbol. This webhook currently accepts XAUUSD only." }, { status: 400 });
    }

    const strategyTimeframeError = validateStrategyTimeframe(signal.strategyId, signal.timeframe);
    if (strategyTimeframeError) {
      await auditWebhook(admin, { requestId, stage: "VALIDATION", status: "REJECTED", signal, errorCode: "STRATEGY_TIMEFRAME", errorMessage: strategyTimeframeError, payload: body });
      return NextResponse.json({ error: strategyTimeframeError }, { status: 400 });
    }

    if (!["BUY", "SELL"].includes(signal.direction) || signal.entry === null || signal.stopLoss === null || signal.tp1 === null) {
      await auditWebhook(admin, { requestId, stage: "VALIDATION", status: "REJECTED", signal, errorCode: "INVALID_SIGNAL_FIELDS", errorMessage: "Required direction/entry/stop_loss/tp1 fields are missing or invalid.", payload: body });
      return NextResponse.json({ error: "Invalid signal. Required: direction (BUY/SELL), entry, stop_loss/sl and tp1/tp." }, { status: 400 });
    }

    if (!["OBSERVE", "LIVE"].includes(signal.executionMode)) {
      await auditWebhook(admin, { requestId, stage: "VALIDATION", status: "REJECTED", signal, errorCode: "INVALID_EXECUTION_MODE", errorMessage: "execution_mode must be OBSERVE or LIVE", payload: body });
      return NextResponse.json({ error: "execution_mode must be OBSERVE or LIVE" }, { status: 400 });
    }

    let licenses: any[] = [];

    if (masterMode) {
      const { data, error } = await admin
        .from("product_licenses")
        .select("id,user_id,status,start_at,end_at,platform,mt_login,broker_name,broker_server")
        .eq("status", "active")
        .eq("platform", "mt5")
        .eq("entitlement_code", "automation");
      if (error) throw error;
      const now = Date.now();
      licenses = (data || []).filter((license) => !license.end_at || new Date(license.end_at).getTime() > now);
    } else if (suppliedAccessKey) {
      const { data: license, error } = await admin
        .from("product_licenses")
        .select("id,user_id,status,start_at,end_at,platform,mt_login,broker_name,broker_server")
        .eq("access_key", suppliedAccessKey)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      if (!license?.user_id) {
        await auditWebhook(admin, { requestId, stage: "AUTHENTICATION", status: "REJECTED", signal, errorCode: "ACCESS_KEY_INVALID", errorMessage: "Invalid or inactive VaultTrades access key", payload: body });
        return NextResponse.json({ error: "Invalid or inactive VaultTrades access key" }, { status: 401 });
      }
      if (license.end_at && new Date(license.end_at).getTime() <= Date.now()) {
        await auditWebhook(admin, { requestId, stage: "AUTHENTICATION", status: "REJECTED", signal, errorCode: "ACCESS_KEY_EXPIRED", errorMessage: "VaultTrades access key has expired", payload: body });
        return NextResponse.json({ error: "VaultTrades access key has expired" }, { status: 403 });
      }
      licenses = [license];
    } else {
      await auditWebhook(admin, { requestId, stage: "AUTHENTICATION", status: "REJECTED", signal, errorCode: "AUTH_FAILED", errorMessage: "Webhook authentication failed", payload: body });
      return NextResponse.json({ error: "Webhook authentication failed" }, { status: 401 });
    }

    if (licenses.length === 0 && masterMode && signal.executionMode === "OBSERVE") {
      const { data: observers, error: observerError } = await admin
        .from("users")
        .select("id,auth_user_id")
        .eq("role", "admin")
        .eq("is_active", true)
        .not("auth_user_id", "is", null);
      if (observerError) throw observerError;

      licenses = (observers || []).map((observer) => ({
        id: null,
        user_id: observer.id,
        auth_user_id: observer.auth_user_id,
        status: "active",
        platform: "observe",
        mt_login: null,
        broker_name: null,
        broker_server: null,
        observer_only: true
      }));
    }

    if (licenses.length === 0) {
      await auditWebhook(admin, { requestId, stage: "ROUTING", status: "NO_ACCOUNT", signal, errorCode: "NO_ACTIVE_ACCOUNT", errorMessage: "No active automation account or observer was available", payload: body });
      return NextResponse.json({
        ok: true,
        mode: masterMode ? "MASTER_FANOUT" : "SINGLE_ACCOUNT",
        symbol: signal.symbol,
        timeframe: signal.timeframe,
        strategy_id: signal.strategyId,
        queued: 0,
        message: "Signal received, but no active automation account is currently enabled."
      });
    }

    const licenseUserIds = [...new Set(licenses.map((license) => license.user_id).filter(Boolean))];
    const { data: appUsers, error: appUsersError } = await admin
      .from("users")
      .select("id,auth_user_id")
      .in("id", licenseUserIds);
    if (appUsersError) throw appUsersError;

    const authUserByAppUser = new Map(
      (appUsers || [])
        .filter((appUser) => appUser.auth_user_id)
        .map((appUser) => [appUser.id, appUser.auth_user_id])
    );

    licenses = licenses
      .map((license) => ({ ...license, auth_user_id: authUserByAppUser.get(license.user_id) || null }))
      .filter((license) => license.auth_user_id);

    if (licenses.length === 0) {
      return NextResponse.json({
        ok: true,
        mode: masterMode ? "MASTER_FANOUT" : "SINGLE_ACCOUNT",
        symbol: signal.symbol,
        timeframe: signal.timeframe,
        strategy_id: signal.strategyId,
        queued: 0,
        message: "Active automation licenses were found, but none are linked to a Supabase Auth user."
      });
    }

    const baseTradeId = text(body.signal_id || body.trade_id) || `TV-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const baseFingerprint = text(body.signal_fingerprint) || [
      signal.symbol, signal.direction, signal.strategyId, signal.timeframe,
      signal.entry, signal.stopLoss, signal.tp1, signal.tp2 ?? "", signal.tp3 ?? "",
      signal.tp4 ?? "", signal.tp5 ?? "", text(body.timestamp || body.time || "")
    ].join("|");
    const results: any[] = [];

    for (const license of licenses) {
      const fingerprint = `${baseFingerprint}|${license.user_id}`;

      const tradeId = licenses.length === 1 && !masterMode
        ? baseTradeId
        : `${baseTradeId}-${String(license.user_id).slice(0, 8)}`;

      const { data: existing } = await admin
        .from("scanner_signals")
        .select("id,trade_id,status")
        .eq("auth_user_id", license.auth_user_id)
        .eq("signal_fingerprint", fingerprint)
        .maybeSingle();

      if (existing) {
        await auditWebhook(admin, { requestId, stage: "DEDUPLICATION", status: "DUPLICATE", signal, signalId: existing.id, payload: body });
        results.push({ user_id: license.user_id, duplicate: true, signal_id: existing.id, trade_id: existing.trade_id, status: existing.status });
        continue;
      }

      const coachContext = {
        symbol: signal.symbol,
        direction: signal.direction,
        timeframe: signal.timeframe,
        entry: signal.entry,
        stop_loss: signal.stopLoss,
        tp1: signal.tp1,
        tp2: signal.tp2,
        tp3: signal.tp3,
        tp4: signal.tp4,
        tp5: signal.tp5,
        confirmation_timeframe: signal.confirmationTimeframe,
        entry_quality: signal.entryQuality,
        confidence: signal.confidence,
        rr: signal.rr,
        strategy_id: signal.strategyId,
        strategy_name: signal.strategyName,
        confirmation_conditions: Array.isArray(body.confirmation_conditions) ? body.confirmation_conditions : [],
        missing_conditions: Array.isArray(body.missing_conditions) ? body.missing_conditions : [],
        market_profile: body.market_profile ?? null,
        session_profile: body.session_profile ?? null,
        liquidity_targets: Array.isArray(body.liquidity_targets) ? body.liquidity_targets : [],
        signal_status: "FIRED"
      };

      const payload = {
        source: "tradingview",
        trade_id: tradeId,
        symbol: signal.symbol,
        direction: signal.direction,
        timeframe: signal.timeframe,
        strategy_id: signal.strategyId,
        strategy_name: signal.strategyName,
        entry: signal.entry,
        stop_loss: signal.stopLoss,
        tp1: signal.tp1,
        tp2: signal.tp2,
        tp3: signal.tp3,
        tp4: signal.tp4,
        tp5: signal.tp5,
        confirmation_timeframe: signal.confirmationTimeframe,
        entry_quality: signal.entryQuality,
        confidence: signal.confidence,
        rr: signal.rr,
        execution_mode: signal.executionMode,
        coach_context: coachContext,
        raw: body,
        received_at: new Date().toISOString()
      };

      const { data: createdSignal, error: signalError } = await admin.from("scanner_signals").insert({
        auth_user_id: license.auth_user_id,
        trade_id: tradeId,
        signal_fingerprint: fingerprint,
        market_category: "GOLD",
        canonical_symbol: signal.symbol,
        direction: signal.direction,
        strategy_id: signal.strategyId,
        strategy_name: signal.strategyName,
        timeframe: signal.timeframe,
        entry: signal.entry,
        stop_loss: signal.stopLoss,
        tp1: signal.tp1,
        tp2: signal.tp2,
        tp3: signal.tp3,
        tp4: signal.tp4,
        tp5: signal.tp5,
        confidence: signal.confidence,
        rr: signal.rr,
        status: "EXECUTION_PENDING",
        confirmation_conditions: coachContext.confirmation_conditions,
        missing_conditions: coachContext.missing_conditions,
        execution_payload: payload,
        source_snapshot: body,
        fired_at: new Date().toISOString()
      }).select("id,trade_id,status").single();

      if (signalError) throw signalError;

      const { data: queue, error: queueError } = await admin.from("automated_trader_execution_queue").insert({
        signal_id: createdSignal.id,
        signal_fingerprint: fingerprint,
        auth_user_id: license.auth_user_id,
        execution_mode: signal.executionMode,
        strategy_id: signal.strategyId,
        strategy_name: signal.strategyName,
        canonical_symbol: signal.symbol,
        direction: signal.direction,
        timeframe: signal.timeframe,
        entry: signal.entry,
        stop_loss: signal.stopLoss,
        tp1: signal.tp1,
        tp2: signal.tp2,
        tp3: signal.tp3,
        tp4: signal.tp4,
        tp5: signal.tp5,
        confirmation_timeframe: signal.confirmationTimeframe,
        entry_quality: signal.entryQuality,
        status: "queued",
        payload: {
          ...payload,
          auth_user_id: license.auth_user_id,
          mt_login: license.mt_login,
          broker_name: license.broker_name,
          broker_server: license.broker_server
        }
      }).select("id,status,execution_mode").single();

      if (queueError) {
        await admin.from("scanner_signals").update({ status: "EXECUTION_FAILED", completed_at: null }).eq("id", createdSignal.id);
        await auditWebhook(admin, { requestId, stage: "QUEUE", status: "FAILED", signal, signalId: createdSignal.id, errorCode: queueError.code ?? "QUEUE_INSERT_FAILED", errorMessage: queueError.message, payload: body });
        throw queueError;
      }
      await auditWebhook(admin, { requestId, stage: "PERSISTED", status: "SUCCESS", signal, signalId: createdSignal.id, queueId: queue.id, payload: body });

      results.push({
        user_id: license.user_id,
        duplicate: false,
        signal_id: createdSignal.id,
        trade_id: createdSignal.trade_id,
        queue_id: queue.id,
        status: queue.status
      });
    }

    return NextResponse.json({
      ok: true,
      mode: masterMode ? "MASTER_FANOUT" : "SINGLE_ACCOUNT",
      symbol: signal.symbol,
      timeframe: signal.timeframe,
      strategy_id: signal.strategyId,
      queued: results.filter((r) => !r.duplicate).length,
      duplicates: results.filter((r) => r.duplicate).length,
      results
    }, { status: 201 });
  } catch (error) {
    console.error("TradingView execution webhook error", error);
    try {
      const requestId = request.headers.get("x-vercel-id") || "unknown";
      const admin = createAdminClient();
      await auditWebhook(admin, { requestId, stage: "EXCEPTION", status: "FAILED", errorCode: "WEBHOOK_EXCEPTION", errorMessage: error instanceof Error ? error.message : String(error) });
    } catch {}
    return NextResponse.json({ error: "TradingView webhook failed" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "VaultTrades TradingView execution webhook",
    method: "POST",
    status: "ready",
    authentication: "private",
    symbol: "XAUUSD",
    strategies: {
      fib: { strategy_id: "vault_auto_select_fib_retrace_latest", timeframes: ["M1","M5","M10","M15","M30","H1","H4","D1"] },
      justine: { strategy_id: "justine-session-liquidity-m15", timeframes: ["M1","M5","M10","M15","M30","H1","H4","D1"] },
      ema: { strategy_id: "ema20-pullback-morning-engine", timeframes: ["M1", "M5", "M10", "M15", "M30", "H1", "H4", "D1"] }
    }
  });
}
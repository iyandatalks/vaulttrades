import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
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
  const confidence = num(body.confidence);
  const rr = num(body.rr);
  const executionMode = text(body.execution_mode || "OBSERVE").toUpperCase();
  return { symbol, direction, timeframe, strategyId, strategyName, entry, stopLoss, tp1, tp2, tp3, tp4, confidence, rr, executionMode };
}

function validateStrategyTimeframe(strategyId: string, timeframe: string) {
  if (strategyId === "vault_auto_select_fib_retrace_latest" && timeframe !== "M5") {
    return "FIB Retracement must send timeframe M5.";
  }
  if (strategyId === "justine-session-liquidity-m15" && timeframe !== "M15") {
    return "Justine Session Liquidity must send timeframe M15.";
  }
  if (strategyId === "vault_auto_select_fib_retrace_latest" || strategyId === "justine-session-liquidity-m15") {
    return null;
  }
  return "Unsupported TradingView strategy_id. This webhook accepts the VaultTrades FIB M5 and Justine M15 strategies.";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const webhookSecret = text(body.webhook_secret || body.webhookSecret || body.secret);
    const configuredSecret = text(process.env.VAULTTRADES_TRADINGVIEW_WEBHOOK_SECRET);
    const suppliedAccessKey = text(body.access_key || body.accessKey);
    const masterMode = Boolean(configuredSecret && webhookSecret && webhookSecret === configuredSecret);
    const signal = parseSignal(body);

    if (signal.symbol !== "XAUUSD") {
      return NextResponse.json({ error: "Unsupported symbol. This webhook currently accepts XAUUSD only." }, { status: 400 });
    }

    const strategyTimeframeError = validateStrategyTimeframe(signal.strategyId, signal.timeframe);
    if (strategyTimeframeError) {
      return NextResponse.json({ error: strategyTimeframeError }, { status: 400 });
    }

    if (!["BUY", "SELL"].includes(signal.direction) || signal.entry === null || signal.stopLoss === null || signal.tp1 === null) {
      return NextResponse.json({ error: "Invalid signal. Required: direction (BUY/SELL), entry, stop_loss/sl and tp1/tp." }, { status: 400 });
    }

    if (!["OBSERVE", "LIVE"].includes(signal.executionMode)) {
      return NextResponse.json({ error: "execution_mode must be OBSERVE or LIVE" }, { status: 400 });
    }

    const admin = createAdminClient();
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
      if (!license?.user_id) return NextResponse.json({ error: "Invalid or inactive VaultTrades access key" }, { status: 401 });
      if (license.end_at && new Date(license.end_at).getTime() <= Date.now()) return NextResponse.json({ error: "VaultTrades access key has expired" }, { status: 403 });
      licenses = [license];
    } else {
      return NextResponse.json({ error: "Webhook authentication failed" }, { status: 401 });
    }

    if (licenses.length === 0) {
      return NextResponse.json({
        ok: true,
        mode: masterMode ? "MASTER_FANOUT" : "SINGLE_ACCOUNT",
        symbol: signal.symbol,
        timeframe: signal.timeframe,
        strategy_id: signal.strategyId,
        queued: 0,
        message: "Signal received, but no active MT5 copy-trading accounts are currently enabled."
      });
    }

    // product_licenses.user_id references public.users.id, while scanner_signals.auth_user_id
    // and automated_trader_execution_queue.auth_user_id reference auth.users.id. Resolve
    // the application-user -> Supabase-auth-user mapping before writing the signal/queue.
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
      signal.tp4 ?? "", text(body.timestamp || body.time || "")
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
        auth_user_id: license.user_id,
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
        await admin.from("scanner_signals").update({ status: "CONFIRMED" }).eq("id", createdSignal.id);
        throw queueError;
      }

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
      fib: { strategy_id: "vault_auto_select_fib_retrace_latest", timeframe: "M5" },
      justine: { strategy_id: "justine-session-liquidity-m15", timeframe: "M15" }
    }
  });
}
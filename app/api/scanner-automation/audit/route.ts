import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { scanVaultAutoFib, VAULT_AUTO_FIB_CRYPTO_SYMBOLS, VAULT_AUTO_FIB_FOREX_SYMBOLS } from "../../../../lib/scanner-automation/vaultAutoFib";
import type {
  SupervisedQueueRow,
  SupervisedScannerRun,
  SupervisedSignal,
  SupervisionResponse,
  TradingViewWebhookEvent,
  VaultAutoFibRunResult,
} from "../../../../lib/scanner-automation/supervisionTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEFAULT_WINDOW_HOURS = 24;
const MAX_WINDOW_HOURS = 168;

function clampWindow(value: string | null) {
  const parsed = Number(value ?? DEFAULT_WINDOW_HOURS);
  if (!Number.isFinite(parsed)) return DEFAULT_WINDOW_HOURS;
  return Math.min(MAX_WINDOW_HOURS, Math.max(1, Math.floor(parsed)));
}

function isAuthorizedAudit(request: Request) {
  return process.env.VERCEL_ENV === "preview"
    && process.env.VERCEL_GIT_COMMIT_REF === "fib-signal-audit"
    && new URL(request.url).searchParams.get("audit") === "1";
}

async function getSupervision(request: Request): Promise<Response> {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();

  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: appUser, error: appUserError } = await admin
    .from("users")
    .select("role,is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (appUserError) {
    return Response.json({ error: appUserError.message }, { status: 500 });
  }

  if (appUser?.role !== "admin" || appUser.is_active !== true) {
    return Response.json(
      { error: "Scanner supervision is restricted to active administrators." },
      { status: 403 },
    );
  }

  const windowHours = clampWindow(new URL(request.url).searchParams.get("hours"));
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();

  const [eventsResult, signalsResult, queueResult, runsResult] = await Promise.all([
    admin
      .from("tradingview_webhook_events")
      .select("id,received_at,stage,status,symbol,direction,timeframe,strategy_id,execution_mode,signal_id,queue_id,error_code,error_message")
      .gte("received_at", since)
      .order("received_at", { ascending: false })
      .limit(100),
    admin
      .from("scanner_signals")
      .select("id,trade_id,canonical_symbol,direction,strategy_id,timeframe,status,fired_at,execution_payload")
      .eq("auth_user_id", user.id)
      .gte("fired_at", since)
      .eq("execution_payload->>source", "tradingview")
      .order("fired_at", { ascending: false })
      .limit(100),
    admin
      .from("automated_trader_execution_queue")
      .select("id,signal_id,strategy_id,canonical_symbol,direction,timeframe,status,execution_mode,created_at,claimed_at,executed_at")
      .eq("auth_user_id", user.id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("scanner_automation_runs")
      .select("id,started_at,completed_at,status,reason,signals_detected,signals_published,duplicates,error_message,details")
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(30),
  ]);

  const events = (eventsResult.data ?? []) as TradingViewWebhookEvent[];
  const signals = (signalsResult.data ?? []) as SupervisedSignal[];
  const queue = (queueResult.data ?? []) as SupervisedQueueRow[];
  const runs = (runsResult.data ?? []) as SupervisedScannerRun[];

  const latestEvent = events[0] ?? null;
  const latestSignal = signals[0] ?? null;
  const latestRun = runs[0] ?? null;
  const activityTimes = [
    latestEvent?.received_at,
    latestSignal?.fired_at,
    latestRun?.completed_at ?? latestRun?.started_at,
  ].filter((value): value is string => Boolean(value));
  const lastActivityAt = activityTimes.sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;

  const response: SupervisionResponse = {
    ok: true,
    supervisionWindowHours: windowHours,
    tradingView: {
      received: events.filter((event) => event.stage === "RECEIVED").length,
      persisted: events.filter((event) => event.stage === "PERSISTED" && event.status === "SUCCESS").length,
      rejected: events.filter((event) => event.status === "REJECTED").length,
      failed: events.filter((event) => event.status === "FAILED").length,
      duplicates: events.filter((event) => event.stage === "DEDUPLICATION" && event.status === "DUPLICATE").length,
      latestEvent,
      latestSignal,
      events,
      signals,
    },
    executionQueue: {
      total: queue.length,
      queued: queue.filter((row) => row.status === "queued").length,
      claimed: queue.filter((row) => row.status === "claimed").length,
      executed: queue.filter((row) => row.status === "executed").length,
      failed: queue.filter((row) => row.status === "failed").length,
      rows: queue,
    },
    scannerEngine: {
      latestRun,
      runs,
    },
    health: {
      webhookReceiving: events.some((event) => event.stage === "RECEIVED"),
      signalPersisting:
        signals.length > 0
        || events.some((event) => event.stage === "PERSISTED" && event.status === "SUCCESS"),
      queueAvailable: !queueResult.error,
      scannerRunObserved: runs.length > 0,
      lastActivityAt,
    },
    errors: {
      events: eventsResult.error?.message ?? null,
      signals: signalsResult.error?.message ?? null,
      queue: queueResult.error?.message ?? null,
      runs: runsResult.error?.message ?? null,
    },
  };

  return Response.json(response);
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  if (url.searchParams.get("supervision") === "1") {
    return getSupervision(request);
  }

  if (!isAuthorizedAudit(request)) {
    return Response.json({ error: "Preview audit endpoint only." }, { status: 401 });
  }

  const symbols = [...VAULT_AUTO_FIB_FOREX_SYMBOLS, ...VAULT_AUTO_FIB_CRYPTO_SYMBOLS];
  const startedAt = Date.now();

  try {
    const signals = await scanVaultAutoFib(symbols);
    const result: VaultAutoFibRunResult = {
      status: "COMPLETED",
      reason: null,
      timeframe: "M15",
      symbolsScanned: symbols,
      signalsDetected: signals.length,
      signalsPublished: 0,
      duplicates: 0,
      errors: [],
    };

    return Response.json({
      ...result,
      signals,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    const result: VaultAutoFibRunResult = {
      status: "SKIPPED",
      reason: error instanceof Error ? error.message : String(error),
      timeframe: "M15",
      symbolsScanned: symbols,
      signalsDetected: 0,
      signalsPublished: 0,
      duplicates: 0,
      errors: [error instanceof Error ? error.message : String(error)],
    };

    return Response.json({
      ...result,
      signals: [],
      durationMs: Date.now() - startedAt,
    }, { status: 500 });
  }
}
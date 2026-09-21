import { scanVaultAutoFib, VAULT_AUTO_FIB_CRYPTO_SYMBOLS, VAULT_AUTO_FIB_FOREX_SYMBOLS } from "../../../../lib/scanner-automation/vaultAutoFib";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: Request) {
  return process.env.VERCEL_ENV === "preview"
    && process.env.VERCEL_GIT_COMMIT_REF === "fib-signal-audit"
    && new URL(request.url).searchParams.get("audit") === "1";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("supervision") === "1") {
    const auth = await createClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

    const admin = createAdminClient();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [events, signals, queue, runs] = await Promise.all([
      admin.from("tradingview_webhook_events").select("id,received_at,stage,status,symbol,direction,timeframe,strategy_id,execution_mode,signal_id,queue_id,error_code,error_message").gte("received_at", since).order("received_at", { ascending: false }).limit(100),
      admin.from("scanner_signals").select("id,trade_id,canonical_symbol,direction,strategy_id,timeframe,status,fired_at,execution_payload").eq("auth_user_id", user.id).gte("fired_at", since).eq("execution_payload->>source", "tradingview").order("fired_at", { ascending: false }).limit(100),
      admin.from("automated_trader_execution_queue").select("id,signal_id,strategy_id,canonical_symbol,direction,timeframe,status,execution_mode,created_at,claimed_at,executed_at").eq("auth_user_id", user.id).order("created_at", { ascending: false }).limit(100),
      admin.from("scanner_automation_runs").select("id,started_at,completed_at,status,reason,signals_detected,signals_published,duplicates,error_message,details").order("started_at", { ascending: false }).limit(30),
    ]);
    const latestEvent = events.data?.[0] ?? null;
    const latestSignal = signals.data?.[0] ?? null;
    const latestRun = runs.data?.[0] ?? null;
    return Response.json({
      ok: true,
      supervisionWindowHours: 24,
      userId: user.id,
      tradingView: {
        received24h: events.data?.filter((e: any) => e.stage === "RECEIVED").length ?? 0,
        persisted24h: events.data?.filter((e: any) => e.stage === "PERSISTED").length ?? 0,
        rejected24h: events.data?.filter((e: any) => e.status === "REJECTED").length ?? 0,
        failed24h: events.data?.filter((e: any) => e.status === "FAILED").length ?? 0,
        latestEvent,
        latestSignal,
        signals: signals.data ?? [],
        events: events.data ?? [],
      },
      executionQueue: {
        total: queue.data?.length ?? 0,
        queued: queue.data?.filter((q: any) => q.status === "queued").length ?? 0,
        claimed: queue.data?.filter((q: any) => q.status === "claimed").length ?? 0,
        executed: queue.data?.filter((q: any) => q.status === "executed").length ?? 0,
        failed: queue.data?.filter((q: any) => q.status === "failed").length ?? 0,
        rows: queue.data ?? [],
      },
      scannerEngine: {
        latestRun,
        runs: runs.data ?? [],
      },
      errors: {
        events: events.error?.message ?? null,
        signals: signals.error?.message ?? null,
        queue: queue.error?.message ?? null,
        runs: runs.error?.message ?? null,
      },
    });
  }

  if (!isAuthorized(request)) return Response.json({ error: "Preview audit endpoint only." }, { status: 401 });

  const symbols = [...VAULT_AUTO_FIB_FOREX_SYMBOLS, ...VAULT_AUTO_FIB_CRYPTO_SYMBOLS];
  const startedAt = Date.now();
  try {
    const signals = await scanVaultAutoFib(symbols);
    return Response.json({
      status: "COMPLETED",
      symbolsScanned: symbols,
      symbolsCount: symbols.length,
      signalsDetected: signals.length,
      signals,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    return Response.json({
      status: "FAILED",
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../../lib/supabase/admin";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const accessKey = text(body.access_key || body.accessKey);
    const workerId = text(body.worker_id || "mt5-ea");
    const executionMode = text(body.execution_mode || "LIVE").toUpperCase();

    if (!accessKey) {
      return NextResponse.json({ error: "access_key is required" }, { status: 401 });
    }
    if (!["OBSERVE", "LIVE"].includes(executionMode)) {
      return NextResponse.json({ error: "execution_mode must be OBSERVE or LIVE" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: license, error: licenseError } = await admin
      .from("product_licenses")
      .select("user_id,status,end_at,mt_login,broker_name,broker_server")
      .eq("access_key", accessKey)
      .eq("status", "active")
      .maybeSingle();

    if (licenseError) throw licenseError;
    if (!license?.user_id) {
      return NextResponse.json({ error: "Invalid or inactive VaultTrades access key" }, { status: 401 });
    }
    if (license.end_at && new Date(license.end_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: "VaultTrades access key has expired" }, { status: 403 });
    }

    const { data: jobs, error: claimError } = await admin.rpc("claim_mt5_execution_job", {
      p_user_id: license.user_id,
      p_worker_id: workerId,
      p_execution_mode: executionMode
    });

    if (claimError) throw claimError;

    const job = Array.isArray(jobs) ? jobs[0] : jobs;
    if (!job) {
      return NextResponse.json({ ok: true, available: false, execution_mode: executionMode });
    }

    return NextResponse.json({
      ok: true,
      available: true,
      execution_mode: executionMode,
      job: {
        id: job.id,
        signal_id: job.signal_id,
        signal_fingerprint: job.signal_fingerprint,
        strategy_id: job.strategy_id,
        strategy_name: job.strategy_name,
        symbol: job.canonical_symbol,
        direction: job.direction,
        timeframe: job.timeframe,
        entry: job.entry,
        stop_loss: job.stop_loss,
        tp1: job.tp1,
        tp2: job.tp2,
        tp3: job.tp3,
        tp4: job.tp4,
        execution_mode: job.execution_mode,
        payload: job.payload,
        broker: {
          mt_login: license.mt_login,
          broker_name: license.broker_name,
          broker_server: license.broker_server
        },
        claimed_at: job.claimed_at,
        claimed_by: job.claimed_by
      }
    });
  } catch (error) {
    console.error("MT5 queue poll error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "MT5 queue poll failed" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "VaultTrades MT5 execution queue",
    method: "POST",
    modes: ["OBSERVE", "LIVE"]
  });
}

import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../../lib/supabase/admin";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const accessKey = text(body.access_key || body.accessKey);
    const queueId = text(body.queue_id || body.id);
    const workerId = text(body.worker_id || "mt5-ea");
    const status = text(body.status).toLowerCase();
    const executionReference = text(body.execution_reference || body.ticket || body.order_id);
    const failureReason = text(body.failure_reason || body.error);

    if (!accessKey || !queueId) {
      return NextResponse.json({ error: "access_key and queue_id are required" }, { status: 400 });
    }
    if (!["executed", "failed", "cancelled", "observed"].includes(status)) {
      return NextResponse.json({ error: "status must be executed, failed, cancelled or observed" }, { status: 400 });
    }
    if (status === "executed" && !executionReference) {
      return NextResponse.json({ error: "execution_reference is required for executed status" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: license, error: licenseError } = await admin
      .from("product_licenses")
      .select("user_id,status,end_at")
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

    const update = {
      status,
      claimed_by: workerId,
      executed_at: ["executed", "failed", "cancelled", "observed"].includes(status) ? new Date().toISOString() : null,
      execution_reference: executionReference || null,
      failure_reason: failureReason || null
    };

    const { data: queue, error: updateError } = await admin
      .from("automated_trader_execution_queue")
      .update(update)
      .eq("id", queueId)
      .eq("auth_user_id", license.user_id)
      .eq("status", "claimed")
      .eq("claimed_by", workerId)
      .select("id,status,execution_reference,failure_reason,executed_at")
      .maybeSingle();

    if (updateError) throw updateError;
    if (!queue) {
      return NextResponse.json({ error: "Queue item is not claimed by this worker or does not belong to this account" }, { status: 409 });
    }

    return NextResponse.json({ ok: true, queue });
  } catch (error) {
    console.error("MT5 queue acknowledgement error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "MT5 acknowledgement failed" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "VaultTrades MT5 execution acknowledgement",
    method: "POST"
  });
}

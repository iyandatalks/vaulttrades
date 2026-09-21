import { createServiceClient } from "../../../../lib/supabase/service";
import { runScheduledVaultAutoFib } from "../../../../lib/scanner-automation/vaultAutoFibRun";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function isAuthorized(request: Request) {
  const secret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret) return false;

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("validate_scanner_automation_cron_secret", {
    p_secret: secret,
  });

  return !error && data === true;
}

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return Response.json({ error: "Unauthorized cron invocation." }, { status: 401 });
  }

  const supabase = createServiceClient();
  const startedAt = new Date().toISOString();
  const { data: createdRun, error: runCreateError } = await supabase
    .from("scanner_automation_runs")
    .insert({
      started_at: startedAt,
      status: "RUNNING",
    })
    .select("id")
    .single();

  try {
    const vaultAutoFib = await runScheduledVaultAutoFib();

    if (createdRun?.id) {
      await supabase
        .from("scanner_automation_runs")
        .update({
          completed_at: new Date().toISOString(),
          status: vaultAutoFib.status,
          reason: vaultAutoFib.reason,
          signals_detected: vaultAutoFib.signalsDetected,
          signals_published: vaultAutoFib.signalsPublished,
          duplicates: vaultAutoFib.duplicates,
          details: vaultAutoFib,
        })
        .eq("id", createdRun.id);
    }

    return Response.json(
      {
        vaultAutoFib,
        run_id: createdRun?.id ?? null,
        supervision_persistence_error: runCreateError?.message ?? null,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (createdRun?.id) {
      await supabase
        .from("scanner_automation_runs")
        .update({
          completed_at: new Date().toISOString(),
          status: "FAILED",
          error_message: message,
        })
        .eq("id", createdRun.id);
    }

    return Response.json(
      {
        status: "FAILED",
        error: message,
        run_id: createdRun?.id ?? null,
        supervision_persistence_error: runCreateError?.message ?? null,
      },
      { status: 500 },
    );
  }
}

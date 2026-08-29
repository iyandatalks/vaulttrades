import { createServiceClient } from "../supabase/service";

export async function startScannerRun(runKey: string, metadata: Record<string, unknown> = {}) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .schema("scanner_automation")
    .from("runs")
    .insert({
      run_key: runKey,
      execution_identity: "vaulttrades-scheduled-scanner",
      status: "RUNNING",
      observe_only: true,
      metadata,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { created: false, duplicate: true, run: null, error: null };
    }
    return { created: false, duplicate: false, run: null, error: error.message };
  }

  return { created: true, duplicate: false, run: data, error: null };
}

export async function finishScannerRun(
  runKey: string,
  result: {
    status: "COMPLETED" | "FAILED" | "SKIPPED";
    marketsEvaluated?: number;
    strategiesEvaluated?: number;
    signalsDetected?: number;
    signalsPublished?: number;
    duplicateSignals?: number;
    observeOnly?: boolean;
    errorMessage?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .schema("scanner_automation")
    .from("runs")
    .update({
      finished_at: new Date().toISOString(),
      status: result.status,
      markets_evaluated: result.marketsEvaluated ?? 0,
      strategies_evaluated: result.strategiesEvaluated ?? 0,
      signals_detected: result.signalsDetected ?? 0,
      signals_published: result.signalsPublished ?? 0,
      duplicate_signals: result.duplicateSignals ?? 0,
      observe_only: result.observeOnly ?? true,
      error_message: result.errorMessage ?? null,
      metadata: result.metadata ?? {},
    })
    .eq("run_key", runKey)
    .select("*")
    .single();

  return { run: data, error: error?.message ?? null };
}

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

  try {
    const vaultAutoFib = await runScheduledVaultAutoFib();
    return Response.json({ vaultAutoFib }, { status: 200 });
  } catch (error) {
    return Response.json(
      { status: "FAILED", error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

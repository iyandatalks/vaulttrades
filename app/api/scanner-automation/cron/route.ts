import { runScheduledScanner } from "../../../../lib/scanner-automation/scheduler";
import { runScheduledVaultAutoFib } from "../../../../lib/scanner-automation/vaultAutoFibRun";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}
function jobForSchedule(request: Request): "ADAPTIVE_M5" | "ADAPTIVE_M15" | "EMA" {
  const schedule = request.headers.get("x-vercel-cron-schedule") ?? "";
  if (schedule === "*/5 * * * *") return "ADAPTIVE_M5";
  if (schedule === "1,16,31,46 * * * *") return "ADAPTIVE_M15";
  if (schedule === "2,17,32,47 * * * *") return "EMA";
  const requested = new URL(request.url).searchParams.get("job");
  if (requested === "ADAPTIVE_M15" || requested === "EMA") return requested;
  return "ADAPTIVE_M5";
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: "Unauthorized cron invocation." }, { status: 401 });
  try {
    const scanner = await runScheduledScanner(jobForSchedule(request));
    const vaultAutoFib = await runScheduledVaultAutoFib();
    return Response.json({ scanner, vaultAutoFib }, { status: "FAILED" in vaultAutoFib && vaultAutoFib.status === "FAILED" ? 500 : 200 });
  } catch (error) {
    return Response.json({ status: "FAILED", error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

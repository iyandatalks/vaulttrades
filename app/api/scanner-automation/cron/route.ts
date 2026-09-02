import { runScheduledVaultAutoFib } from "../../../../lib/scanner-automation/vaultAutoFibRun";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const bearer = Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
  const auditMode = process.env.VERCEL_ENV === "preview"
    && process.env.VERCEL_GIT_COMMIT_REF === "fib-signal-audit"
    && new URL(request.url).searchParams.get("audit") === "1";
  return bearer || auditMode;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: "Unauthorized cron invocation." }, { status: 401 });
  try {
    const vaultAutoFib = await runScheduledVaultAutoFib();
    return Response.json({ vaultAutoFib }, { status: "FAILED" in vaultAutoFib && vaultAutoFib.status === "FAILED" ? 500 : 200 });
  } catch (error) {
    return Response.json({ status: "FAILED", error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

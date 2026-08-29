import { runScheduledScanner } from "../../../../lib/scanner-automation/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: "Unauthorized cron invocation." }, { status: 401 });

  try {
    const result = await runScheduledScanner();
    return Response.json(result, { status: result.status === "FAILED" ? 500 : 200 });
  } catch (error) {
    return Response.json({
      status: "FAILED",
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

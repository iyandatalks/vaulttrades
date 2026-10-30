import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { sendAdminAnalyzerPush } from "@/lib/analyzer-web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  try {
    const result = await sendAdminAnalyzerPush(auth.user.id, {
      title: "VaultTrades push test",
      body: "Private Analyzer alerts are connected to this Android Chrome device.",
      url: "/admin/analyzer-alerts",
      tag: "vaulttrades-push-test",
    });
    if (result.total === 0) return NextResponse.json({ error: "NO_ACTIVE_DEVICE" }, { status: 409 });
    if (result.sent === 0) return NextResponse.json({ error: "PUSH_DELIVERY_FAILED", ...result }, { status: 502 });
    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    const code = error?.message === "WEB_PUSH_NOT_CONFIGURED" ? "WEB_PUSH_NOT_CONFIGURED" : "PUSH_DELIVERY_FAILED";
    return NextResponse.json({ error: code }, { status: 503 });
  }
}

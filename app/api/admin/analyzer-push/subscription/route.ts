import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const body = await request.json().catch(() => null);
  const sub = body?.subscription;
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const authSecret = sub?.keys?.auth;
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://") ||
      typeof p256dh !== "string" || typeof authSecret !== "string") {
    return NextResponse.json({ error: "INVALID_PUSH_SUBSCRIPTION" }, { status: 400 });
  }
  const { error } = await auth.db.from("admin_analyzer_push_subscriptions").upsert({
    auth_user_id: auth.user.id, endpoint, p256dh, auth_secret: authSecret,
    user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
    device_label: "Android Chrome", enabled: true, updated_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ error: "SUBSCRIPTION_SAVE_FAILED" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const body = await request.json().catch(() => ({}));
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  if (!endpoint) return NextResponse.json({ error: "ENDPOINT_REQUIRED" }, { status: 400 });
  const { error } = await auth.db.from("admin_analyzer_push_subscriptions")
    .delete().eq("auth_user_id", auth.user.id).eq("endpoint", endpoint);
  if (error) return NextResponse.json({ error: "SUBSCRIPTION_DELETE_FAILED" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { data, error } = await auth.db.from("admin_analyzer_push_subscriptions")
    .select("id,device_label,enabled,created_at,last_success_at,last_error_at")
    .eq("auth_user_id", auth.user.id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "SUBSCRIPTION_LOAD_FAILED" }, { status: 500 });
  return NextResponse.json({ subscriptions: data ?? [] });
}

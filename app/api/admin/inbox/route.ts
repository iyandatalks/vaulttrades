import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }) };
  const db = createServiceClient();
  const { data: profile } = await db.from("users").select("id,role").eq("auth_user_id", user.id).maybeSingle();
  if (profile?.role !== "admin") return { error: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
  return { user, db };
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.db.from("admin_inbox_notifications")
    .select("id,event_type,title,body,severity,auth_user_id,customer_email,related_id,action_href,metadata,created_at,read_at")
    .order("created_at", { ascending: false }).limit(150);
  if (error) return NextResponse.json({ error: "INBOX_LOAD_FAILED" }, { status: 500 });
  return NextResponse.json({
    notifications: data || [],
    unreadCount: (data || []).filter((item: any) => !item.read_at).length,
  });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids.filter((id: unknown) => typeof id === "string").slice(0, 150) : [];
  if (!ids.length) return NextResponse.json({ error: "NOTIFICATION_IDS_REQUIRED" }, { status: 400 });
  const { error } = await auth.db.from("admin_inbox_notifications")
    .update({ read_at: new Date().toISOString() }).in("id", ids).is("read_at", null);
  if (error) return NextResponse.json({ error: "INBOX_UPDATE_FAILED" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

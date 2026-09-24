import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

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
  const { db } = auth;
  const { data, error } = await db.from("copy_support_requests").select("id,auth_user_id,request_type,message,status,created_at,resolved_at,resolved_by").order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: "SUPPORT_LIST_FAILED" }, { status: 500 });
  return NextResponse.json({ requests: data || [] });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { user, db } = auth;
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "EMAIL_REQUIRED" }, { status: 400 });

  const { data: target } = await db.from("users").select("auth_user_id,email").eq("email", email).maybeSingle();
  if (!target?.auth_user_id) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });

  const now = new Date().toISOString();
  const { data: follower } = await db.from("copy_followers").select("id").eq("auth_user_id", target.auth_user_id).maybeSingle();

  if (follower) {
    await db.from("copy_followers").update({
      status: "disabled",
      copy_enabled: false,
      license_status: "revoked",
      updated_at: now,
    }).eq("id", follower.id);
    await db.from("copy_links").update({ status: "revoked", updated_at: now }).eq("follower_id", follower.id);
  }

  await db.from("copy_pairing_codes").update({ revoked_at: now }).eq("auth_user_id", target.auth_user_id).is("revoked_at", null);

  await db.from("copy_support_requests").update({
    status: "resolved",
    resolved_at: now,
    resolved_by: user.id,
  }).eq("auth_user_id", target.auth_user_id).eq("status", "open");

  return NextResponse.json({ ok: true, message: "Copier license reset. The customer may generate one new pairing code." });
}

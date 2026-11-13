import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }) };
  const db = createAdminClient();
  const { data: profile } = await db.from("users").select("id,role").eq("auth_user_id", user.id).maybeSingle();
  if (profile?.role !== "admin") return { response: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
  return { user, db };
}

export async function GET() {
  const access = await requireAdmin();
  if ("response" in access) return access.response;
  const { data, error } = await access.db.from("member_ea_licensing_requests")
    .select("id,user_id,auth_user_id,member_email,broker_name,broker_server,mt5_login,product_code,status,admin_notes,download_storage_path,submitted_at,license_generated_at")
    .order("submitted_at", { ascending: true })
    .limit(200);
  if (error) return NextResponse.json({ error: "QUEUE_UNAVAILABLE" }, { status: 500 });
  return NextResponse.json({ requests: data ?? [] });
}

export async function PATCH(request: Request) {
  const access = await requireAdmin();
  if ("response" in access) return access.response;
  const body = await request.json().catch(() => ({}));
  const id = String(body.id ?? "");
  const status = String(body.status ?? "");
  const adminNotes = String(body.adminNotes ?? "").trim().slice(0, 2000);
  if (!id || !["in_progress", "rejected"].includes(status)) {
    return NextResponse.json({ error: "INVALID_UPDATE" }, { status: 400 });
  }

  const { data: row, error } = await access.db.from("member_ea_licensing_requests")
    .update({ status, admin_notes: adminNotes || null, reviewed_by: access.user.id, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id,auth_user_id,member_email,product_code,status")
    .single();

  if (error || !row) return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });

  if (status === "rejected") {
    await access.db.from("copy_profile_notifications").insert({
      auth_user_id: row.auth_user_id,
      title: "EA licensing request needs attention",
      body: adminNotes || "Please contact VaultTrades support to clarify your MT5 licensing submission.",
      action_href: "/member-portal",
      notification_type: "ea_licensing_update",
      created_by: access.user.id,
      metadata: { request_id: row.id, product_code: row.product_code, status },
    });
  }

  return NextResponse.json({ ok: true, request: row });
}

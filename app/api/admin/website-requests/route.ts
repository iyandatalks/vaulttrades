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
  const { data, error } = await access.db.from("member_website_requests")
    .select("id,user_id,auth_user_id,member_email,domain_preference,preferred_name_1,preferred_name_2,preferred_name_3,custom_domain,status,admin_notes,assigned_domain,submitted_at")
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
  const assignedDomain = String(body.assignedDomain ?? "").trim().toLowerCase().slice(0, 253);
  if (!id || !["in_progress", "ready", "rejected"].includes(status)) {
    return NextResponse.json({ error: "INVALID_UPDATE" }, { status: 400 });
  }
  if (status === "ready" && !assignedDomain) {
    return NextResponse.json({ error: "Enter the assigned website domain before marking this request ready." }, { status: 400 });
  }
  const { data: row, error } = await access.db.from("member_website_requests").update({
    status,
    admin_notes: adminNotes || null,
    assigned_domain: assignedDomain || null,
    reviewed_by: access.user.id,
    updated_at: new Date().toISOString(),
  }).eq("id", id).select("id,auth_user_id,status,assigned_domain,admin_notes").single();
  if (error || !row) return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });

  await access.db.from("copy_profile_notifications").insert({
    auth_user_id: row.auth_user_id,
    title: status === "ready" ? "Your website setup is ready" : status === "rejected" ? "Your website request needs attention" : "Your website request is being reviewed",
    body: status === "ready"
      ? `Your website setup has been marked ready. Assigned domain: ${row.assigned_domain}`
      : adminNotes || (status === "in_progress" ? "VaultTrades has started reviewing your website request." : "Please contact VaultTrades to clarify your website request."),
    action_href: "/member-portal",
    notification_type: "website_request_update",
    created_by: access.user.id,
    metadata: { request_id: row.id, status, assigned_domain: row.assigned_domain },
  });
  return NextResponse.json({ ok: true, request: row });
}

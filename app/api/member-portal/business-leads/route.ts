import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const PARTNER_STATUSES = ["new", "contacted", "qualified", "converted", "closed"] as const;
const MEMBERSHIP_CODES = ["nexus", "vaulttrades_nexus", "nexus_plus", "vaulttrades_nexus_plus", "vortex", "vaulttrades_vortex"];

async function getAccess() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }) };
  const db = createAdminClient();
  const { data: profile } = await db.from("users").select("id,email,role").eq("auth_user_id", user.id).maybeSingle();
  if (!profile) return { response: NextResponse.json({ error: "PROFILE_NOT_FOUND" }, { status: 404 }) };
  if (profile.role !== "admin") {
    const { data: licences } = await db.from("product_licenses")
      .select("entitlement_code,start_at,end_at,status")
      .eq("user_id", profile.id).eq("status", "active").in("entitlement_code", MEMBERSHIP_CODES);
    const now = Date.now();
    const eligible = (licences ?? []).some(row => {
      const start = row.start_at ? new Date(row.start_at).getTime() : 0;
      const end = row.end_at ? new Date(row.end_at).getTime() : Number.POSITIVE_INFINITY;
      return Number.isFinite(start) && start <= now && end > now;
    });
    if (!eligible) return { response: NextResponse.json({ error: "MEMBERSHIP_REQUIRED" }, { status: 403 }) };
  }
  return { db, user, profile };
}

export async function GET() {
  const access = await getAccess();
  if ("response" in access) return access.response;
  const { db, user, profile } = access;
  let query = db.from("marketing_leads")
    .select("id,first_name,email,cellphone,source,campaign,created_at,partner_status,partner_notes,partner_updated_at,partner_display_name,partner_code,partner_share_consent", { count: "exact" })
    .eq("partner_share_consent", true)
    .order("created_at", { ascending: false }).limit(250);
  if (profile.role !== "admin") query = query.eq("partner_auth_user_id", user.id);
  const { data, error, count } = await query;
  if (error) {
    console.error("Business leads load failed:", error.message);
    return NextResponse.json({ error: "Unable to load your business leads." }, { status: 500 });
  }
  const leads = data ?? [];
  const counts = {
    total: count ?? leads.length,
    new: leads.filter(x => x.partner_status === "new").length,
    contacted: leads.filter(x => x.partner_status === "contacted").length,
    qualified: leads.filter(x => x.partner_status === "qualified").length,
    converted: leads.filter(x => x.partner_status === "converted").length,
  };
  return NextResponse.json({ leads, counts, isAdmin: profile.role === "admin" });
}

export async function PATCH(request: Request) {
  const access = await getAccess();
  if ("response" in access) return access.response;
  const { db, user, profile } = access;
  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const status = typeof body.status === "string" ? body.status : "";
  const notes = typeof body.notes === "string" ? body.notes.slice(0, 2000) : "";
  if (!id || !PARTNER_STATUSES.includes(status as typeof PARTNER_STATUSES[number])) {
    return NextResponse.json({ error: "Choose a valid lead and follow-up status." }, { status: 400 });
  }
  let update = db.from("marketing_leads").update({
    partner_status: status,
    partner_notes: notes,
    partner_updated_at: new Date().toISOString(),
  }).eq("id", id).eq("partner_share_consent", true);
  if (profile.role !== "admin") update = update.eq("partner_auth_user_id", user.id);
  const { data, error } = await update.select("id,partner_status,partner_notes,partner_updated_at").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "This lead is not assigned to your business or could not be updated." }, { status: 404 });
  return NextResponse.json({ ok: true, lead: data });
}

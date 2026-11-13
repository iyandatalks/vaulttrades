import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MEMBERSHIP_CODES = ["nexus","vaulttrades_nexus","nexus_plus","vaulttrades_nexus_plus","vortex","vaulttrades_vortex"];
function isActive(row: any) {
  const start = row.start_at ? new Date(row.start_at).getTime() : 0;
  const end = row.end_at ? new Date(row.end_at).getTime() : Number.POSITIVE_INFINITY;
  return row.status === "active" && Number.isFinite(start) && start <= Date.now() && end > Date.now();
}
function planFrom(rows: any[]) {
  const codes = new Set(rows.filter(isActive).map(row => String(row.entitlement_code).toLowerCase()));
  if (codes.has("vortex") || codes.has("vaulttrades_vortex")) return "vortex";
  if (codes.has("nexus_plus") || codes.has("vaulttrades_nexus_plus")) return "nexus_plus";
  if (codes.has("nexus") || codes.has("vaulttrades_nexus")) return "nexus";
  return null;
}

export async function GET(request: Request) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const db = createAdminClient();
  const { data: profile } = await db.from("users").select("id,role").eq("auth_user_id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "PROFILE_NOT_FOUND" }, { status: 404 });
  let plan: string | null = profile.role === "admin" ? "vortex" : null;
  if (profile.role !== "admin") {
    const { data: licenses } = await db.from("product_licenses").select("entitlement_code,status,start_at,end_at")
      .eq("user_id", profile.id).in("entitlement_code", MEMBERSHIP_CODES).eq("status", "active");
    plan = planFrom(licenses ?? []);
  }
  if (!plan) return NextResponse.json({ error: "ACTIVE_MEMBERSHIP_REQUIRED" }, { status: 403 });

  const url = new URL(request.url);
  const month = url.searchParams.get("month") ?? new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" }).slice(0,7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ error: "INVALID_MONTH" }, { status: 400 });
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1, -2, 0, 0));
  const end = new Date(Date.UTC(year, monthNumber, 1, -2, 0, 0));
  const [{ data: resources, error: resourceError }, { data: events, error: eventError }] = await Promise.all([
    db.from("member_knowledge_resources").select("id,section_id,title,description,resource_kind,resource_url,plan_codes,sort_order,created_at")
      .eq("is_published", true).order("sort_order").order("created_at"),
    db.from("member_community_events").select("id,title,description,starts_at,ends_at,meeting_url")
      .eq("is_published", true).gte("starts_at", start.toISOString()).lt("starts_at", end.toISOString()).order("starts_at"),
  ]);
  if (resourceError || eventError) return NextResponse.json({ error: "MEMBER_CONTENT_UNAVAILABLE" }, { status: 500 });
  const rank = (value: string | null) => value === "vortex" ? 3 : value === "nexus_plus" ? 2 : value === "nexus" ? 1 : 0;
  const resourcesForPlan = (resources ?? []).filter(item => !item.plan_codes?.length || item.plan_codes.some((code: string) => rank(plan) >= rank(code)));
  return NextResponse.json({ resources: resourcesForPlan, events: events ?? [], month, plan, isAdmin: profile.role === "admin" });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const membershipCodes = ["nexus", "vaulttrades_nexus", "nexus_plus", "vaulttrades_nexus_plus", "vortex", "vaulttrades_vortex"];

export async function GET() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ hasMembership: false, isAdmin: false }, { status: 200 });
  const db = createAdminClient();
  const { data: profile } = await db.from("users").select("id,role").eq("auth_user_id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ hasMembership: false, isAdmin: false }, { status: 200 });
  if (profile.role === "admin") return NextResponse.json({ hasMembership: true, isAdmin: true, plan: "vortex" });
  const { data: licenses } = await db.from("product_licenses")
    .select("entitlement_code,status,start_at,end_at")
    .eq("user_id", profile.id)
    .in("entitlement_code", membershipCodes)
    .eq("status", "active");
  const now = Date.now();
  const active = (licenses ?? []).filter(row => {
    const start = row.start_at ? new Date(row.start_at).getTime() : 0;
    const end = row.end_at ? new Date(row.end_at).getTime() : Number.POSITIVE_INFINITY;
    return Number.isFinite(start) && start <= now && end > now;
  });
  const codes = new Set(active.map(row => String(row.entitlement_code).toLowerCase()));
  const plan = codes.has("vortex") || codes.has("vaulttrades_vortex") ? "vortex"
    : codes.has("nexus_plus") || codes.has("vaulttrades_nexus_plus") ? "nexus_plus"
    : codes.has("nexus") || codes.has("vaulttrades_nexus") ? "nexus" : null;
  return NextResponse.json({ hasMembership: Boolean(plan), isAdmin: false, plan });
}

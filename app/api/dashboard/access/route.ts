import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

const FEATURES = ["analyzer", "scanner", "automation", "ai_coach", "journal", "referral"] as const;

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ authenticated: false, access: {} }, { status: 401 });

    const admin = createAdminClient();
    const { data: profile } = await admin.from("users").select("id,role,is_active,license_status").eq("auth_user_id", user.id).maybeSingle();
    if (!profile) return NextResponse.json({ authenticated: true, access: {} });

    if (profile.role === "admin") {
      return NextResponse.json({ authenticated: true, admin: true, access: Object.fromEntries(FEATURES.map(feature => [feature, true])) });
    }

    const access: Record<string, boolean> = {};
    for (const feature of FEATURES) {
      const { data } = await admin.rpc("has_feature_access", { p_auth_user_id: user.id, p_feature_code: feature });
      access[feature] = data === true;
    }

    if (profile.is_active === true && profile.license_status === "active") {
      access.ai_coach = true;
      access.journal = true;
    }

    return NextResponse.json({ authenticated: true, admin: false, access });
  } catch (error) {
    console.error("Dashboard access error", error);
    return NextResponse.json({ error: "Unable to load dashboard access." }, { status: 500 });
  }
}

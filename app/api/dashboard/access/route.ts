import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { getProductAccess } from "../../../../lib/product-access";

const FEATURES = [
  "analyzer",
  "copy",
  "ai_coach",
  "journal",
  "funded_account_wealth_builder",
  "founders_mentorship",
  "risk_manager",
] as const;

const emptyAccess = () => Object.fromEntries(FEATURES.map(feature => [feature, false]));

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ authenticated: false, access: {} }, { status: 401 });

    const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
    const db = hasServiceRole ? createAdminClient() : supabase;
    const { data: profile } = await db
      .from("users")
      .select("id,role,referral_code")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!profile) return NextResponse.json({ authenticated: true, access: {} });

    // Admin preview must remain usable in Preview deployments without exposing or
    // copying the production service-role secret. The signed-in user's own profile
    // is readable/updatable through the existing RLS policies.
    if (profile.role === "admin") {
      let code = profile.referral_code ?? null;
      if (!code) {
        code = `VT-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
        await db.from("users").update({ referral_code: code }).eq("id", profile.id);
      }
      return NextResponse.json({
        authenticated: true,
        admin: true,
        supportWhatsApp: true,
        access: Object.fromEntries(FEATURES.map(feature => [feature, true])),
        referral: { enabled: true, code, url: code ? `https://vaulttradesve.com/ref/${code}` : null },
        reseller: { enabled: true, plan: "vortex" },
      });
    }

    // Customer entitlement checks use the privileged access service. If this is
    // an unconfigured Preview, fail closed rather than granting any paid access.
    if (!hasServiceRole) {
      return NextResponse.json({
        authenticated: true,
        admin: false,
        supportWhatsApp: false,
        access: emptyAccess(),
        referral: { enabled: false, code: null, url: null },
        reseller: { enabled: false, plan: null },
      });
    }

    const admin = createAdminClient();
    const productAccess = await getProductAccess(user.id);
    const membershipCodes = [
      "nexus", "vaulttrades_nexus",
      "nexus_plus", "vaulttrades_nexus_plus",
      "vortex", "vaulttrades_vortex",
    ];
    const { data: membershipLicenses } = await admin
      .from("product_licenses")
      .select("entitlement_code,status,start_at,end_at")
      .eq("user_id", profile.id)
      .in("entitlement_code", membershipCodes)
      .eq("status", "active");

    const now = Date.now();
    const activeMemberships = (membershipLicenses ?? []).filter(license => {
      const start = license.start_at ? new Date(license.start_at).getTime() : 0;
      const end = license.end_at ? new Date(license.end_at).getTime() : Number.POSITIVE_INFINITY;
      return Number.isFinite(start) && start <= now && end > now;
    });
    const codes = new Set(activeMemberships.map(license => String(license.entitlement_code).toLowerCase()));
    const resellerPlan = codes.has("vortex") || codes.has("vaulttrades_vortex") ? "vortex"
      : codes.has("nexus_plus") || codes.has("vaulttrades_nexus_plus") ? "nexus_plus"
      : codes.has("nexus") || codes.has("vaulttrades_nexus") ? "nexus"
      : null;
    const reseller = { enabled: Boolean(resellerPlan), plan: resellerPlan };

    const access: Record<string, boolean> = {
      analyzer: productAccess.analyzer,
      copy: productAccess.copy,
      founders_mentorship: productAccess.foundersMentorship,
      ai_coach: productAccess.anyPaidProduct,
      journal: productAccess.anyPaidProduct,
      funded_account_wealth_builder: productAccess.anyPaidProduct,
      risk_manager: productAccess.anyPaidProduct,
    };

    let referral: { enabled: boolean; code: string | null; url: string | null } = {
      enabled: productAccess.anyPaidProduct,
      code: null,
      url: null,
    };

    if (productAccess.anyPaidProduct && productAccess.userId) {
      const { data: referralProfile } = await admin
        .from("users")
        .select("referral_code")
        .eq("id", productAccess.userId)
        .maybeSingle();

      let code = referralProfile?.referral_code ?? null;
      if (!code) {
        code = `VT-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
        await admin.from("users").update({ referral_code: code }).eq("id", productAccess.userId);
      }

      referral = { enabled: true, code, url: `https://vaulttradesve.com/ref/${code}` };
    }

    return NextResponse.json({
      authenticated: true,
      admin: false,
      supportWhatsApp: productAccess.anyPaidProduct === true,
      access,
      referral,
      reseller,
    });
  } catch (error) {
    console.error("Dashboard access error", error);
    return NextResponse.json({ error: "Unable to load dashboard access." }, { status: 500 });
  }
}

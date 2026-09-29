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
] as const;

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ authenticated: false, access: {} }, { status: 401 });

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("users")
      .select("id,role")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!profile) return NextResponse.json({ authenticated: true, access: {} });

    const productAccess = await getProductAccess(user.id);

    if (productAccess.admin) {
      return NextResponse.json({
        authenticated: true,
        admin: true,
        access: Object.fromEntries(FEATURES.map(feature => [feature, true])),
      });
    }

    const access: Record<string, boolean> = {
      analyzer: productAccess.analyzer,
      copy: productAccess.copy,
      founders_mentorship: productAccess.foundersMentorship,
      ai_coach: productAccess.anyPaidProduct,
      journal: productAccess.anyPaidProduct,
      funded_account_wealth_builder: productAccess.anyPaidProduct,
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

      referral = {
        enabled: true,
        code,
        url: `https://vaulttradesve.com/ref/${code}`,
      };
    }

    return NextResponse.json({ authenticated: true, admin: false, access, referral });
  } catch (error) {
    console.error("Dashboard access error", error);
    return NextResponse.json({ error: "Unable to load dashboard access." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = createAdminClient();
    const { data: sites, error } = await db.from("member_website_requests")
      .select("assigned_domain,auth_user_id,user_id,created_at")
      .eq("status", "ready")
      .not("assigned_domain", "is", null)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;

    const partners = (await Promise.all((sites ?? []).map(async (site) => {
      const domain = String(site.assigned_domain ?? "").trim().toLowerCase();
      if (!domain.endsWith(".vaulttradesve.com") || domain === "www.vaulttradesve.com") return null;
      let query = db.from("users").select("first_name,referral_code,is_active").eq("is_active", true);
      query = site.auth_user_id ? query.eq("auth_user_id", site.auth_user_id) : query.eq("id", site.user_id);
      const { data: partner } = await query.maybeSingle();
      if (!partner?.referral_code) return null;
      const slug = domain.replace(".vaulttradesve.com", "");
      const name = slug === "makemoneyonline"
        ? "Make Money Online"
        : slug.includes("-")
          ? slug.split("-").map((part: string) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ")
          : `${partner.first_name || "VaultTrades"} Partner`;
      return { name, url: `https://${domain}/` };
    }))).filter(Boolean);

    return NextResponse.json({ partners }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Partner directory lookup failed:", error);
    return NextResponse.json({ partners: [], error: "Partner directory is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = (forwarded || request.headers.get("host") || "").split(":")[0].toLowerCase();
  if (!host.endsWith(".vaulttradesve.com") || host === "www.vaulttradesve.com") {
    return NextResponse.json({ isPartnerSite: false, partnerCode: "" }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const db = createAdminClient();
    const { data: site } = await db.from("member_website_requests").select("user_id,auth_user_id,status").ilike("assigned_domain", host).eq("status", "ready").maybeSingle();
    if (!site) return NextResponse.json({ isPartnerSite: true, assigned: false, partnerCode: "" }, { headers: { "Cache-Control": "no-store" } });
    let query = db.from("users").select("referral_code,first_name,is_active").eq("is_active", true);
    query = site.auth_user_id ? query.eq("auth_user_id", site.auth_user_id) : query.eq("id", site.user_id);
    const { data: partner } = await query.maybeSingle();
    if (!partner?.referral_code) return NextResponse.json({ isPartnerSite: true, assigned: false, partnerCode: "" }, { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ isPartnerSite: true, assigned: true, partnerCode: partner.referral_code, partnerName: partner.first_name || "" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Partner domain resolution failed", error);
    return NextResponse.json({ error: "Partner website details are temporarily unavailable." }, { status: 500 });
  }
}

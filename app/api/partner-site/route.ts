import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPartnerAccessToken, PARTNER_ACCESS_COOKIE, PARTNER_ACCESS_MAX_AGE } from "@/lib/partner-access";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = (forwarded || request.headers.get("host") || "").split(":")[0].toLowerCase();
  if (!host.endsWith(".vaulttradesve.com") || host === "www.vaulttradesve.com") {
    return NextResponse.json({ isPartnerSite: false, partnerCode: "" }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const db = createAdminClient();
    const { data: site } = await db.from("member_website_requests").select("user_id,auth_user_id,status,general_contact_whatsapp").ilike("assigned_domain", host).eq("status", "ready").maybeSingle();
    if (!site) return NextResponse.json({ isPartnerSite: true, assigned: false, partnerCode: "" }, { headers: { "Cache-Control": "no-store" } });
    let query = db.from("users").select("referral_code,first_name,is_active").eq("is_active", true);
    query = site.auth_user_id ? query.eq("auth_user_id", site.auth_user_id) : query.eq("id", site.user_id);
    const { data: partner } = await query.maybeSingle();
    if (!partner?.referral_code) return NextResponse.json({ isPartnerSite: true, assigned: false, partnerCode: "" }, { headers: { "Cache-Control": "no-store" } });
    const response = NextResponse.json({ isPartnerSite: true, assigned: true, partnerCode: partner.referral_code, partnerName: partner.first_name || "", generalContactWhatsApp: site.general_contact_whatsapp || "" }, { headers: { "Cache-Control": "no-store" } });
    const token = await createPartnerAccessToken(partner.referral_code);
    if (token) response.cookies.set(PARTNER_ACCESS_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      domain: ".vaulttradesve.com",
      path: "/",
      maxAge: PARTNER_ACCESS_MAX_AGE,
    });
    return response;
  } catch (error) {
    console.error("Partner domain resolution failed", error);
    return NextResponse.json({ error: "Partner website details are temporarily unavailable." }, { status: 500 });
  }
}

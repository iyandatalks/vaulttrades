import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const provinces = ["Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo", "Mpumalanga", "Northern Cape", "North West", "Western Cape"] as const;
const getLinks = () => ({
  individual: process.env.NEXT_PUBLIC_WOMENS_FOUNDERS_SINGLE_PAYMENT_URL || "",
  group: process.env.NEXT_PUBLIC_WOMENS_FOUNDERS_GROUP_PAYMENT_URL || "",
});

export async function GET() {
  try {
    const db = createAdminClient();
    const { data, error } = await db.from("womens_provincial_founders_leads").select("province,purchase_type,group_size").eq("payment_status", "paid");
    if (error) throw error;
    const rows = data || [];
    const provinceStats = provinces.map((province) => {
      const matches = rows.filter((row) => row.province === province);
      const groupLocked = matches.some((row) => row.purchase_type === "group");
      const paid = matches.reduce((sum, row) => sum + (row.purchase_type === "group" ? Number(row.group_size || 9) : 1), 0);
      return { province, paid, remaining: groupLocked ? 0 : Math.max(0, 9 - paid), groupLocked };
    });
    const paid = provinceStats.reduce((sum, row) => sum + row.paid, 0);
    const paymentLinks = getLinks();
    return NextResponse.json(
      { stats: { paid, remaining: Math.max(0, 81 - paid), target: 81, provinces: provinceStats }, paymentReady: Boolean(paymentLinks.individual && paymentLinks.group) },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("Women's founding statistics error:", error);
    return NextResponse.json({ error: "Statistics are temporarily unavailable." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const cellphone = String(body.cellphone || "").trim();
    const province = String(body.province || "");
    const purchaseType = body.purchaseType === "group" ? "group" : "individual";
    const groupMembers = Array.isArray(body.groupMembers) ? body.groupMembers.slice(0, 9).map((member: any) => ({ fullName: String(member.fullName || "").trim(), email: String(member.email || "").trim().toLowerCase(), cellphone: String(member.cellphone || "").trim() })) : [];
    if (!fullName || fullName.length > 140 || !email.includes("@") || !email.includes(".") || !cellphone || cellphone.length > 30 || !(provinces as readonly string[]).includes(province) || body.privacyConsent !== true || (purchaseType === "group" && (groupMembers.length !== 9 || groupMembers.some((member: any) => !member.fullName || !member.email.includes("@") || !member.email.includes(".") || !member.cellphone)))) {
      return NextResponse.json({ error: "Enter valid contact details, choose a province and accept the privacy notice." }, { status: 400 });
    }
    const paymentLinks = getLinks();
    const checkoutUrl = purchaseType === "group" ? paymentLinks.group : paymentLinks.individual;
    if (!checkoutUrl || !checkoutUrl.startsWith("https://")) {
      return NextResponse.json({ error: "The VaultTrades payment link for this option has not yet been connected." }, { status: 503 });
    }
    const db = createAdminClient();
    const submittedReferralCode = String(body.referralCode || "").trim().toUpperCase().slice(0, 40);
    let referralCode: string | null = null;
    let referrerUserId: string | null = null;
    if (submittedReferralCode) {
      const { data: referrer, error: referrerError } = await db.from("users")
        .select("id,referral_code")
        .eq("referral_code", submittedReferralCode)
        .eq("is_active", true)
        .maybeSingle();
      if (referrerError) throw referrerError;
      if (referrer?.id && referrer.referral_code) {
        referralCode = String(referrer.referral_code).toUpperCase();
        referrerUserId = String(referrer.id);
      }
    }
    const { data: existing, error: checkError } = await db.from("womens_provincial_founders_leads").select("id,purchase_type").eq("province", province).eq("payment_status", "paid");
    if (checkError) throw checkError;
    if ((existing || []).some((row) => row.purchase_type === "group")) {
      return NextResponse.json({ error: "A combined founding group is already confirmed for this province. Please select another province." }, { status: 409 });
    }
    const { data, error } = await db.from("womens_provincial_founders_leads").insert({
      full_name: fullName,
      email,
      cellphone,
      province,
      purchase_type: purchaseType,
      contribution_amount: purchaseType === "group" ? 950 : 105,
      group_size: purchaseType === "group" ? 9 : 1,
      group_members: purchaseType === "group" ? groupMembers : [],
      payment_status: "pending",
      source_host: String(body.sourceHost || "").slice(0, 255),
      source_path: String(body.sourcePath || "").slice(0, 255),
      referral_code: referralCode,
      referrer_user_id: referrerUserId,
      privacy_consent: true,
    }).select("id").single();
    if (error) throw error;
    const url = new URL(checkoutUrl);
    url.searchParams.set("vt_lead", data.id);
    return NextResponse.json({ checkoutUrl: url.toString(), leadId: data.id });
  } catch (error) {
    console.error("Women's founding registration error:", error);
    return NextResponse.json({ error: "We could not prepare checkout. Please try again or contact VaultTrades." }, { status: 500 });
  }
}

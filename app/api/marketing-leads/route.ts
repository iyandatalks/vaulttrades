import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const firstName = cleanText(body.firstName, 100);
    const email = cleanText(body.email, 254).toLowerCase();
    const cellphone = cleanText(body.cellphone, 30);
    const processingConsent = body.processingConsent === true;
    const emailMarketing = body.emailMarketing === true;
    const whatsappMarketing = body.whatsappMarketing === true;
    const honeypot = cleanText(body.website, 200);

    // Quietly accept automated honeypot submissions without storing them.
    if (honeypot) return NextResponse.json({ ok: true });

    if (!firstName || firstName.length < 1) {
      return NextResponse.json({ error: "Please enter your first name." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }
    const digits = cellphone.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 18) {
      return NextResponse.json({ error: "Please enter a valid cellphone number, including the country code." }, { status: 400 });
    }
    if (!processingConsent) {
      return NextResponse.json({ error: "Please confirm the privacy notice so we can respond to your request." }, { status: 400 });
    }

    const source = cleanText(body.source, 80) || "website";
    const campaign = cleanText(body.campaign, 120) || null;
    const referrer = cleanText(request.headers.get("referer"), 500) || null;
    const partnerCode = cleanText(body.partnerCode, 80).toUpperCase();
    const partnerShareConsent = body.partnerShareConsent === true;

    const db = createAdminClient();
    let partner: { id: string; auth_user_id: string; first_name: string | null; referral_code: string } | null = null;
    if (partnerCode) {
      const { data } = await db.from("users").select("id,auth_user_id,first_name,referral_code").ilike("referral_code", partnerCode).maybeSingle();
      if (data?.auth_user_id) partner = data;
    }
    if (partnerCode && !partner) {
      return NextResponse.json({ error: "This partner enquiry link could not be verified. Please contact VaultTrades or use the link supplied by your partner." }, { status: 400 });
    }
    if (partner && !partnerShareConsent) {
      return NextResponse.json({ error: "Please confirm that your contact details may be shared with the VaultTrades partner who referred you." }, { status: 400 });
    }
    const { data: savedLead, error } = await db.from("marketing_leads").insert({
      first_name: firstName,
      email,
      cellphone,
      source,
      campaign,
      referrer,
      marketing_email_consent: emailMarketing,
      marketing_whatsapp_consent: whatsappMarketing,
      privacy_notice_version: "2026-11-14",
      partner_user_id: partner?.id ?? null,
      partner_auth_user_id: partner?.auth_user_id ?? null,
      partner_code: partner?.referral_code ?? null,
      partner_display_name: partner?.first_name ?? null,
      partner_share_consent: Boolean(partner && partnerShareConsent),
    }).select("id").single();

    if (error) {
      console.error("Marketing lead insert failed:", error.message);
      return NextResponse.json({ error: "We could not save your details right now. Please try again shortly." }, { status: 500 });
    }

    if (partner?.auth_user_id) {
      
      await db.from("copy_profile_notifications").insert({
        auth_user_id: partner.auth_user_id,
        title: "New business enquiry received",
        body: `A new prospect, ${firstName}, submitted their contact details through your VaultTrades referral link. Open Business Leads to follow up.`,
        action_href: "/member-portal/business-leads",
        notification_type: "partner_new_lead",
        metadata: { lead_id: savedLead?.id ?? null, partner_code: partner.referral_code },
      });
    }
    if (partner && partnerShareConsent && savedLead?.id) {
      const { error: notificationError } = await db.from("copy_profile_notifications").insert({
        auth_user_id: partner.auth_user_id,
        title: "New business enquiry",
        body: firstName + " has submitted an enquiry through your VaultTrades lead link. Open Business Leads to review the contact details and record your follow-up.",
        action_href: "/member-portal/business-leads",
        notification_type: "business_lead_received",
        metadata: { lead_id: savedLead.id, partner_code: partner.referral_code },
      });
      if (notificationError) console.error("Partner lead notification failed:", notificationError.message);
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Marketing lead request failed:", error);
    return NextResponse.json({ error: "We could not process your request. Please try again." }, { status: 500 });
  }
}

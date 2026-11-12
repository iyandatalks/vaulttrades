import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    const supabase = await createClient();
    const { error } = await supabase.from("marketing_leads").insert({
      first_name: firstName,
      email,
      cellphone,
      source,
      campaign,
      referrer,
      marketing_email_consent: emailMarketing,
      marketing_whatsapp_consent: whatsappMarketing,
      privacy_notice_version: "2026-11-12",
    });

    if (error) {
      console.error("Marketing lead insert failed:", error.message);
      return NextResponse.json({ error: "We could not save your details right now. Please try again shortly." }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Marketing lead request failed:", error);
    return NextResponse.json({ error: "We could not process your request. Please try again." }, { status: 500 });
  }
}

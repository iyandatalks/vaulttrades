import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const db = createServiceClient();
  const [{ data: partners, error: partnersError }, { data: registrations, error: registrationsError }] = await Promise.all([
    db.from("partners").select("id,name").eq("category", "Broker").eq("is_published", true).order("sort_order", { ascending: true }).order("name", { ascending: true }),
    db.from("copy_broker_referrals")
      .select("broker_referral_partner_id:partner_id,broker_referral_partner_name:partner_name,broker_referral_user_id:broker_user_id,broker_referral_status:status,broker_referral_submitted_at:submitted_at")
      .eq("auth_user_id", user.id)
      .order("submitted_at", { ascending: false })
      .limit(1),
  ]);

  if (partnersError) return NextResponse.json({ error: "BROKER_LIST_FAILED" }, { status: 500 });
  if (registrationsError) return NextResponse.json({ error: "REFERRAL_LOOKUP_FAILED" }, { status: 500 });

  return NextResponse.json({ partners: partners || [], referral: registrations?.[0] || null });
}

export async function POST(request: Request) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const partnerId = String(body.partnerId || "").trim();
  const brokerUserId = String(body.brokerUserId || "").trim();

  if (!partnerId || !brokerUserId || brokerUserId.length > 120) {
    return NextResponse.json({ error: "BROKER_AND_USER_ID_REQUIRED", message: "Select a broker and enter your broker User ID." }, { status: 400 });
  }

  const db = createServiceClient();
  const { data: partner, error: partnerError } = await db.from("partners")
    .select("id,name")
    .eq("id", partnerId)
    .eq("category", "Broker")
    .eq("is_published", true)
    .maybeSingle();

  if (partnerError) return NextResponse.json({ error: "BROKER_LOOKUP_FAILED" }, { status: 500 });
  if (!partner) return NextResponse.json({ error: "BROKER_NOT_AVAILABLE", message: "That broker is not currently available. Refresh the page and select a published broker." }, { status: 400 });

  const submittedAt = new Date().toISOString();
  const { data: existing, error: existingError } = await db.from("copy_broker_referrals")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (existingError) return NextResponse.json({ error: "REGISTRATION_LOOKUP_FAILED" }, { status: 500 });

  const referralFields = {
    partner_id: partner.id,
    partner_name: partner.name,
    broker_user_id: brokerUserId,
    status: "pending",
    submitted_at: submittedAt,
    updated_at: submittedAt,
  };

  if (existing) {
    const { error } = await db.from("copy_broker_referrals").update(referralFields).eq("id", existing.id).eq("auth_user_id", user.id);
    if (error) return NextResponse.json({ error: "BROKER_ID_SAVE_FAILED" }, { status: 500 });
  } else {
    const { error } = await db.from("copy_broker_referrals").insert({
      auth_user_id: user.id,
      email: user.email || "",
      ...referralFields,
    });
    if (error) return NextResponse.json({ error: "BROKER_ID_SAVE_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: `${partner.name} User ID submitted successfully. VaultTrades can now review it in Admin → Partners → Internal Partners.`, status: "pending" });
}

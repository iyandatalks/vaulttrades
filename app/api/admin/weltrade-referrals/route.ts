import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAdminContext() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Unauthenticated." }, { status: 401 }) };

  const db = createServiceClient();
  const { data: profile, error } = await db
    .from("users")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error || profile?.role !== "admin") {
    return { response: NextResponse.json({ error: "Administrator access required." }, { status: 403 }) };
  }
  return { user, db };
}

export async function GET() {
  const context = await getAdminContext();
  if ("response" in context) return context.response;

  const { data, error } = await context.db
    .from("copy_customer_registrations")
    .select("id,auth_user_id,email,mt5_login,created_at,updated_at,broker_referral_status,broker_referral_mt5_login,broker_referral_verified_at,onboarding_notified_at")
    .order("created_at", { ascending: false })
    .limit(250);

  if (error) return NextResponse.json({ error: "Unable to load copy-trading registrations." }, { status: 500 });
  return NextResponse.json({ registrations: data ?? [] });
}

export async function POST(request: Request) {
  const context = await getAdminContext();
  if ("response" in context) return context.response;

  let body: { action?: string; registrationId?: string; brokerMt5Login?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }

  const registrationId = body.registrationId?.trim();
  if (!registrationId) return NextResponse.json({ error: "Registration is required." }, { status: 400 });

  const { data: registration, error: registrationError } = await context.db
    .from("copy_customer_registrations")
    .select("id,auth_user_id,email,mt5_login,broker_referral_status,onboarding_notified_at")
    .eq("id", registrationId)
    .maybeSingle();

  if (registrationError || !registration) return NextResponse.json({ error: "Registration not found." }, { status: 404 });

  if (body.action === "verify") {
    const supplied = (body.brokerMt5Login ?? "").trim();
    const submitted = (registration.mt5_login ?? "").trim();
    if (!/^\d{4,12}$/.test(supplied)) {
      return NextResponse.json({ error: "Enter the MT5 account number from the broker referral list." }, { status: 400 });
    }

    if (!submitted || supplied !== submitted) {
      await context.db.from("copy_customer_registrations").update({
        broker_referral_status: "review_required",
        broker_referral_mt5_login: supplied,
        broker_referral_verified_at: null,
        broker_referral_verified_by: null,
      }).eq("id", registration.id);
      return NextResponse.json({
        error: "The broker account does not exactly match the MT5 number submitted by this customer. Marked for manual review; no notification was sent.",
        status: "review_required",
      }, { status: 409 });
    }

    const { data: duplicates, error: duplicateError } = await context.db
      .from("copy_customer_registrations")
      .select("id")
      .eq("mt5_login", submitted);

    if (duplicateError) return NextResponse.json({ error: "Could not check account uniqueness." }, { status: 500 });
    if ((duplicates ?? []).length !== 1 || duplicates?.[0]?.id !== registration.id) {
      await context.db.from("copy_customer_registrations").update({
        broker_referral_status: "review_required",
        broker_referral_mt5_login: supplied,
        broker_referral_verified_at: null,
        broker_referral_verified_by: null,
      }).eq("id", registration.id);
      return NextResponse.json({
        error: "This MT5 number appears on multiple registrations. Manual review is required before verification.",
        status: "review_required",
      }, { status: 409 });
    }

    const { error: updateError } = await context.db.from("copy_customer_registrations").update({
      broker_referral_status: "verified",
      broker_referral_mt5_login: supplied,
      broker_referral_verified_at: new Date().toISOString(),
      broker_referral_verified_by: context.user.id,
    }).eq("id", registration.id);

    if (updateError) return NextResponse.json({ error: "Verification could not be saved." }, { status: 500 });
    return NextResponse.json({ message: "Broker referral verified. You can now send the in-profile onboarding notice.", status: "verified" });
  }

  if (body.action === "notify") {
    if (registration.broker_referral_status !== "verified") {
      return NextResponse.json({ error: "Verify the broker referral first." }, { status: 409 });
    }
    if (registration.onboarding_notified_at) {
      return NextResponse.json({ error: "An onboarding notice has already been sent for this registration." }, { status: 409 });
    }

    const { data: notice, error: noticeError } = await context.db
      .from("copy_profile_notifications")
      .insert({
        auth_user_id: registration.auth_user_id,
        title: "Your copy-trading referral is verified",
        body: "Your broker referral has been verified. Open Copy Trading in your VaultTrades profile and follow the connection steps to pair your MT5 account. Your account will show Live only after the copier connects and passes its connection checks.",
        action_href: "/copy",
        notification_type: "copy_onboarding",
        created_by: context.user.id,
        metadata: { registration_id: registration.id },
      })
      .select("id")
      .single();

    if (noticeError || !notice) return NextResponse.json({ error: "The in-profile notification could not be created." }, { status: 500 });

    const { error: updateError } = await context.db.from("copy_customer_registrations").update({
      onboarding_notified_at: new Date().toISOString(),
      onboarding_notification_id: notice.id,
    }).eq("id", registration.id).is("onboarding_notified_at", null);

    if (updateError) {
      return NextResponse.json({ error: "Notification was created, but the registration record could not be updated. Check the profile notification before retrying." }, { status: 500 });
    }

    return NextResponse.json({ message: "In-profile onboarding notification sent. Copier access and Live status have not been changed." });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}

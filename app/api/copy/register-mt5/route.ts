import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCopyAccess } from "@/lib/copy-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED", message: "Sign in to register your MT5 account." }, { status: 401 });
  }

  const access = await getCopyAccess(user.id);
  if (!access.active) {
    return NextResponse.json({
      error: "COPY_SUBSCRIPTION_REQUIRED",
      message: "An active Copy Trading subscription or admin-granted access is required before you can register an MT5 account.",
      reason: access.reason,
    }, { status: access.reason === "expired" ? 402 : 403 });
  }

  const body = await request.json().catch(() => ({}));
  const mt5Login = String(body.mt5Login || "").trim();
  if (!/^\d{4,12}$/.test(mt5Login)) {
    return NextResponse.json({ error: "MT5_ID_INVALID", message: "Enter a valid MT5 account number containing 4–12 digits." }, { status: 400 });
  }

  const db = createServiceClient();

  // Bind an unassigned paid license to this account on first registration.
  // If a license is already assigned to another login, do not silently reassign it.
  if (access.licenseId) {
    const { data: license, error: licenseError } = await db
      .from("product_licenses")
      .select("id,mt_login")
      .eq("id", access.licenseId)
      .maybeSingle();

    if (licenseError || !license) {
      return NextResponse.json({ error: "COPY_LICENSE_LOOKUP_FAILED", message: "Unable to verify your Copy Trading license." }, { status: 500 });
    }

    if (license.mt_login && String(license.mt_login) !== mt5Login) {
      return NextResponse.json({
        error: "MT5_ALREADY_BOUND",
        message: "Your subscription is already assigned to a different MT5 account. Contact support to request an account change.",
      }, { status: 409 });
    }

    if (!license.mt_login) {
      const { error: bindError } = await db
        .from("product_licenses")
        .update({ mt_login: mt5Login, updated_at: new Date().toISOString() })
        .eq("id", license.id)
        .is("mt_login", null);

      if (bindError) {
        return NextResponse.json({ error: "MT5_BIND_FAILED", message: "Unable to assign this MT5 account to your subscription." }, { status: 500 });
      }
    }
  }

  const { data: existing, error: lookupError } = await db
    .from("copy_customer_registrations")
    .select("id,mt5_login")
    .eq("auth_user_id", user.id)
    .eq("mt5_login", mt5Login)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: "MT5_REGISTRATION_LOOKUP_FAILED", message: "Unable to check your MT5 registration right now." }, { status: 500 });
  }

  if (existing) {
    return NextResponse.json({ ok: true, mt5Login, message: "This MT5 account is already registered." });
  }

  const { error: insertError } = await db.from("copy_customer_registrations").insert({
    auth_user_id: user.id,
    email: user.email || "",
    mt5_login: mt5Login,
  });

  if (insertError) {
    if (String(insertError.code || "") === "23505") {
      return NextResponse.json({ error: "MT5_ALREADY_REGISTERED", message: "This MT5 account is already registered. Refresh the page and select it." }, { status: 409 });
    }
    return NextResponse.json({ error: "MT5_REGISTRATION_FAILED", message: "Unable to save your MT5 account. Please contact support if this continues." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, mt5Login, message: "MT5 account registered. The Copier download and pairing code are now available for this account." });
}

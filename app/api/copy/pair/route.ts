import { NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCopyAccess } from "@/lib/copy-access";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const mt5Login = String(body.mt5Login || "").trim();

  if (!/^\d{4,12}$/.test(mt5Login)) {
    return NextResponse.json({
      error: "MT5_ID_REQUIRED",
      message: "A registered MT5 account ID is required to generate a pairing code.",
    }, { status: 400 });
  }

  const db = createServiceClient();

  const { data: registration } = await db
    .from("copy_customer_registrations")
    .select("id,email,mt5_login")
    .eq("auth_user_id", user.id)
    .eq("mt5_login", mt5Login)
    .maybeSingle();

  if (!registration) {
    return NextResponse.json({
      error: "MT5_NOT_REGISTERED",
      message: "This MT5 account is not registered for a VaultTrades Copy Trading subscription.",
    }, { status: 403 });
  }

  const access = await getCopyAccess(user.id, mt5Login);
  if (!access.active) {
    return NextResponse.json({
      allowed: false,
      reason: access.reason,
      error: "COPY_SUBSCRIPTION_REQUIRED",
      message: access.reason === "expired"
        ? "The Copy Trading subscription for this MT5 account has expired."
        : access.reason === "disabled"
          ? "Copy Trading access for this MT5 account is disabled."
          : access.reason === "suspended"
            ? "Copy Trading access for this MT5 account is suspended."
            : "An active VaultTrades Copy Trading subscription is required for this MT5 account.",
    }, { status: access.reason === "expired" ? 402 : 403 });
  }

  const isAdmin = access.reason === "ADMIN";

  if (!isAdmin && access.startAt) {
    const { data: existing } = await db
      .from("copy_pairing_codes")
      .select("id,expires_at,redeemed_at,revoked_at,mt5_login")
      .eq("auth_user_id", user.id)
      .eq("subscription_start_at", access.startAt)
      .eq("mt5_login", mt5Login)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        error: "PAIRING_GENERATION_LIMIT_REACHED",
        message: existing.redeemed_at
          ? "One Copier activation is allowed for this subscription and MT5 account. A new subscription is required for another MT5 account."
          : "One pairing code is already issued for this subscription and MT5 account. If it was not activated within 24 hours, contact VaultTrades Support.",
        expiresAt: existing.expires_at || null,
        redeemed: !!existing.redeemed_at,
      }, { status: 409 });
    }
  }

  const code = randomBytes(5).toString("hex").toUpperCase();
  const hash = createHash("sha256").update(code).digest("hex");
  const subscriptionEndMs = access.endAt ? new Date(access.endAt).getTime() : NaN;
  const expiresAt = Number.isFinite(subscriptionEndMs)
    ? new Date(Math.min(Date.now() + 24 * 60 * 60 * 1000, subscriptionEndMs)).toISOString()
    : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error } = await db.from("copy_pairing_codes").insert({
    auth_user_id: user.id,
    code_hash: hash,
    expires_at: expiresAt,
    subscription_start_at: access.startAt,
    subscription_end_at: access.endAt,
    mt5_login: mt5Login,
  });

  if (error) {
    if (String(error.code || "") === "23505") {
      return NextResponse.json({
        error: "PAIRING_GENERATION_LIMIT_REACHED",
        message: "One pairing code is allowed for this subscription and MT5 account.",
      }, { status: 409 });
    }
    return NextResponse.json({ error: "PAIRING_CREATE_FAILED" }, { status: 500 });
  }

  const expiresInSeconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  return NextResponse.json({
    pairingCode: code,
    expiresInSeconds,
    expiresAt,
    mt5Login,
    accessUntil: access.endAt,
  });
}

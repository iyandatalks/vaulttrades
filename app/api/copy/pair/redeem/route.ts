import { NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { getCopyAccess } from "@/lib/copy-access";

export const runtime = "nodejs";

const sha = (v: string) => createHash("sha256").update(v).digest("hex");

function denial(reason: string) {
  const status = reason === "expired" ? 402 : reason === "revoked" ? 403 : 403;
  return NextResponse.json({ allowed: false, reason, error: reason.toUpperCase() }, { status });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const code = String(body.pairingCode || "").trim().toUpperCase();
  const mtLogin = body.mtLogin ? String(body.mtLogin) : null;
  const brokerServer = body.brokerServer ? String(body.brokerServer) : null;
  const eaVersion = body.eaVersion ? String(body.eaVersion) : null;

  if (!code) return NextResponse.json({ error: "PAIRING_CODE_REQUIRED" }, { status: 400 });
  if (!mtLogin || !/^\d{4,12}$/.test(mtLogin)) {
    return NextResponse.json({ error: "MT5_ID_REQUIRED", reason: "disabled" }, { status: 400 });
  }

  const db = createServiceClient();
  const { data: pair, error } = await db
    .from("copy_pairing_codes")
    .select("id,auth_user_id,expires_at,redeemed_at,revoked_at,created_at,subscription_start_at,subscription_end_at,mt5_login")
    .eq("code_hash", sha(code))
    .maybeSingle();

  if (error || !pair) {
    return NextResponse.json({ allowed: false, reason: "revoked", error: "INVALID_PAIRING_CODE" }, { status: 401 });
  }

  if (pair.redeemed_at) {
    return NextResponse.json({ allowed: false, reason: "revoked", error: "PAIRING_CODE_ALREADY_USED" }, { status: 410 });
  }

  if (pair.revoked_at) {
    return NextResponse.json({ allowed: false, reason: "revoked", error: "PAIRING_CODE_REVOKED" }, { status: 403 });
  }

  if (new Date(pair.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ allowed: false, reason: "expired", error: "PAIRING_CODE_EXPIRED" }, { status: 402 });
  }

  if (String(pair.mt5_login || "") !== mtLogin) {
    return NextResponse.json({
      allowed: false,
      reason: "disabled",
      error: "REGISTERED_ACCOUNT_MISMATCH",
      message: "This pairing code is bound to a different registered MT5 account.",
    }, { status: 403 });
  }

  const { data: registration } = await db
    .from("copy_customer_registrations")
    .select("id,mt5_login")
    .eq("auth_user_id", pair.auth_user_id)
    .eq("mt5_login", mtLogin)
    .maybeSingle();

  if (!registration) {
    return NextResponse.json({ allowed: false, reason: "disabled", error: "REGISTERED_ACCOUNT_MISMATCH" }, { status: 403 });
  }

  const access = await getCopyAccess(String(pair.auth_user_id), mtLogin);
  if (!access.active) return denial(access.reason);

  if (!access.startAt || pair.subscription_start_at !== access.startAt || (access.endAt && pair.subscription_end_at !== access.endAt)) {
    return NextResponse.json({
      allowed: false,
      reason: "revoked",
      error: "PAIRING_CODE_NOT_CURRENT_SUBSCRIPTION",
    }, { status: 403 });
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = sha(token);
  const now = new Date().toISOString();

  const { data: previous } = await db
    .from("copy_followers")
    .select("id,auth_user_id,api_token_hash,license_generation,mt_login")
    .eq("auth_user_id", pair.auth_user_id)
    .eq("mt_login", mtLogin)
    .maybeSingle();

  const nextGeneration = Number(previous?.license_generation || 0) + 1;

  // Replacing an existing activation for this exact subscription/MT5 account
  // revokes its old token. A different MT5 account is a different subscription.
  if (previous?.id) {
    if (previous.api_token_hash) {
      await db.from("copy_revoked_tokens").upsert({
        token_hash: previous.api_token_hash,
        auth_user_id: previous.auth_user_id,
        follower_id: previous.id,
        revoked_at: now,
        reason: "revoked",
      }, { onConflict: "token_hash" });
    }

    await db.from("copy_followers").update({
      status: "disabled",
      copy_enabled: false,
      license_status: "revoked",
      updated_at: now,
    }).eq("id", previous.id);

    await db.from("copy_links").update({
      status: "revoked",
      updated_at: now,
    }).eq("follower_id", previous.id).eq("status", "active");
  }

  const { data: follower, error: fErr } = await db
    .from("copy_followers")
    .upsert({
      auth_user_id: pair.auth_user_id,
      mt_login: mtLogin,
      broker_server: brokerServer,
      ea_version: eaVersion,
      status: "online",
      copy_enabled: true,
      api_token_hash: tokenHash,
      last_heartbeat_at: now,
      pairing_code_id: pair.id,
      license_activated_at: now,
      license_expires_at: access.endAt,
      license_status: "active",
      license_generation: nextGeneration,
    }, { onConflict: "auth_user_id,mt_login" })
    .select("id,auth_user_id,mt_login,broker_server,status,copy_enabled,license_status,license_expires_at,license_generation")
    .single();

  if (fErr) {
    return NextResponse.json({ error: "FOLLOWER_CREATE_FAILED", detail: fErr.message }, { status: 500 });
  }

  await db.from("copy_pairing_codes").update({ redeemed_at: now }).eq("id", pair.id);

  const { data: master } = await db
    .from("copy_masters")
    .select("id")
    .eq("name", "VaultTrades Master")
    .maybeSingle();

  if (master) {
    await db.from("copy_links").upsert({
      master_id: master.id,
      follower_id: follower.id,
      status: "active",
      lot_mode: "fixed",
      lot_value: 0.01,
    }, { onConflict: "master_id,follower_id" });
  }

  return NextResponse.json({
    ok: true,
    allowed: true,
    token,
    followerId: follower.id,
    accessUntil: access.endAt,
    licenseGeneration: nextGeneration,
    authorizedMtLogin: mtLogin,
  });
}

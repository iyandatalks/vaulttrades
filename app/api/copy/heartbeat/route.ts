import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { accessHttpStatus, getCopyAccess, revokeFollowerAccess } from "@/lib/copy-access";

export const runtime = "nodejs";

const sha = (v: string) => createHash("sha256").update(v).digest("hex");

export async function POST(req: Request) {
  const token = req.headers.get("x-vaulttrades-copy-token") || "";
  if (!token) return NextResponse.json({ allowed: false, reason: "revoked", error: "UNAUTHORIZED" }, { status: 401 });

  const db = createServiceClient();
  const tokenHash = sha(token);

  const { data: follower } = await db
    .from("copy_followers")
    .select("id,auth_user_id,mt_login,broker_server,ea_version,license_status,license_expires_at,license_generation,status,copy_enabled")
    .eq("api_token_hash", tokenHash)
    .maybeSingle();

  if (!follower) {
    const { data: revoked } = await db
      .from("copy_revoked_tokens")
      .select("reason")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (revoked) {
      return NextResponse.json({ allowed: false, reason: revoked.reason, copyEnabled: false }, { status: 403 });
    }

    return NextResponse.json({ allowed: false, reason: "revoked", error: "UNAUTHORIZED" }, { status: 401 });
  }

  const access = await getCopyAccess(String(follower.auth_user_id), follower.mt_login);
  if (!access.active) {
    await revokeFollowerAccess(follower.id, access.reason === "revoked" || access.reason === "disabled" || access.reason === "suspended" ? access.reason : "expired");
    return NextResponse.json({
      allowed: false,
      reason: access.reason,
      copyEnabled: false,
      accessUntil: access.endAt,
      licenseStatus: access.reason,
      licenseGeneration: follower.license_generation ?? 0,
    }, { status: accessHttpStatus(access.reason) });
  }

  if (access.reason !== "ADMIN" && (follower.status === "disabled" || follower.license_status !== "active")) {
    const reason = follower.license_status === "suspended" ? "suspended" : follower.license_status === "disabled" ? "disabled" : "revoked";
    return NextResponse.json({
      allowed: false,
      reason,
      copyEnabled: false,
      accessUntil: access.endAt,
      licenseStatus: reason,
      licenseGeneration: follower.license_generation ?? 0,
    }, { status: accessHttpStatus(reason) });
  }

  const body = await req.json().catch(() => ({}));
  const now = new Date().toISOString();

  await db.from("copy_followers").update({
    status: "online",
    mt_login: body.mtLogin ? String(body.mtLogin) : follower.mt_login,
    broker_server: body.brokerServer ? String(body.brokerServer) : follower.broker_server,
    ea_version: body.eaVersion ? String(body.eaVersion) : follower.ea_version,
    last_heartbeat_at: now,
    license_expires_at: access.endAt,
  }).eq("id", follower.id);

  return NextResponse.json({
    ok: true,
    allowed: true,
    copyEnabled: true,
    accessUntil: access.endAt,
    licenseStatus: "active",
    licenseGeneration: follower.license_generation ?? 0,
  });
}

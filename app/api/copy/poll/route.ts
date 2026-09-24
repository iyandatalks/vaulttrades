import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { accessHttpStatus, getCopyAccess, revokeFollowerAccess } from "@/lib/copy-access";

export const runtime = "nodejs";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export async function GET(req: Request) {
  const token = req.headers.get("x-vaulttrades-copy-token") || "";
  if (!token) return NextResponse.json({ allowed: false, reason: "revoked", error: "UNAUTHORIZED" }, { status: 401 });

  const db = createServiceClient();
  const tokenHash = sha256(token);

  const { data: follower } = await db
    .from("copy_followers")
    .select("id,auth_user_id,mt_login,status,copy_enabled,license_status,license_expires_at,license_generation")
    .eq("api_token_hash", tokenHash)
    .maybeSingle();

  if (!follower) {
    const { data: revoked } = await db
      .from("copy_revoked_tokens")
      .select("reason")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (revoked) {
      return NextResponse.json({
        allowed: false,
        reason: revoked.reason,
        commands: [],
        licenseStatus: revoked.reason,
      }, { status: 403 });
    }

    return NextResponse.json({ allowed: false, reason: "revoked", commands: [], error: "UNAUTHORIZED" }, { status: 401 });
  }

  const access = await getCopyAccess(String(follower.auth_user_id), follower.mt_login);
  if (!access.active) {
    const reason = access.reason === "revoked" || access.reason === "disabled" || access.reason === "suspended" ? access.reason : "expired";
    await revokeFollowerAccess(follower.id, reason);
    return NextResponse.json({
      allowed: false,
      reason: access.reason,
      accessUntil: access.endAt,
      commands: [],
      licenseStatus: access.reason,
      licenseGeneration: follower.license_generation ?? 0,
    }, { status: accessHttpStatus(access.reason) });
  }

  if (follower.status === "disabled" || follower.license_status !== "active") {
    const reason = follower.license_status === "suspended" ? "suspended" : follower.license_status === "disabled" ? "disabled" : "revoked";
    return NextResponse.json({
      allowed: false,
      reason,
      accessUntil: access.endAt,
      commands: [],
      licenseStatus: reason,
      licenseGeneration: follower.license_generation ?? 0,
    }, { status: accessHttpStatus(reason) });
  }

  await db.from("copy_followers").update({
    status: "online",
    last_heartbeat_at: new Date().toISOString(),
    license_expires_at: access.endAt,
  }).eq("id", follower.id);

  if (!follower.copy_enabled) {
    return NextResponse.json({
      allowed: false,
      reason: "disabled",
      commands: [],
      accessUntil: access.endAt,
      licenseStatus: "disabled",
      licenseGeneration: follower.license_generation ?? 0,
    }, { status: 403 });
  }

  const { data: commands, error } = await db
    .from("copy_trade_executions")
    .select(
      "id,command_id,event_id,requested_volume,status,copy_trade_events(master_trade_id,event_type,symbol,direction,volume,price,stop_loss,take_profit,event_time,payload)",
    )
    .eq("follower_id", follower.id)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(25);

  if (error) return NextResponse.json({ error: "POLL_FAILED" }, { status: 500 });

  const { data: links } = await db
    .from("copy_links")
    .select("master_id,lot_mode,lot_value,symbol_map,max_slippage_points,copy_existing_positions,status")
    .eq("follower_id", follower.id)
    .eq("status", "active");

  const link = links?.[0] ?? null;

  return NextResponse.json({
    allowed: true,
    commands: commands || [],
    accessUntil: access.endAt,
    licenseStatus: "active",
    licenseGeneration: follower.license_generation ?? 0,
    settings: {
      lotMode: link?.lot_mode ?? "fixed",
      lotValue: link?.lot_value ?? 0.01,
      symbolMap: link?.symbol_map ?? {},
      maxSlippagePoints: link?.max_slippage_points ?? 50,
      copyExistingPositions: link?.copy_existing_positions ?? false,
    },
  });
}

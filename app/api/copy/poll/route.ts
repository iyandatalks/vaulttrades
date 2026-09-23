import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { getCopyAccess, revokeExpiredFollower } from "@/lib/copy-access";

export const runtime = "nodejs";

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export async function GET(req: Request) {
  const token = req.headers.get("x-vaulttrades-copy-token") || "";
  if (!token) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const db = createServiceClient();

  const { data: follower } = await db
    .from("copy_followers")
    .select("id,auth_user_id,status,copy_enabled")
    .eq("api_token_hash", sha256(token))
    .maybeSingle();

  if (!follower) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const access = await getCopyAccess(String(follower.auth_user_id));
  if (!access.active) {
    await revokeExpiredFollower(follower.id);
    return NextResponse.json({
      error: "COPY_SUBSCRIPTION_EXPIRED",
      accessUntil: access.endAt,
      commands: [],
    }, { status: 403 });
  }

  if (follower.status === "disabled") {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  await db
    .from("copy_followers")
    .update({
      status: "online",
      last_heartbeat_at: new Date().toISOString(),
    })
    .eq("id", follower.id);

  if (!follower.copy_enabled) {
    return NextResponse.json({ commands: [] });
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

  if (error) {
    return NextResponse.json({ error: "POLL_FAILED" }, { status: 500 });
  }

  const { data: links } = await db
    .from("copy_links")
    .select(
      "master_id,lot_mode,lot_value,symbol_map,max_slippage_points,copy_existing_positions,status",
    )
    .eq("follower_id", follower.id)
    .eq("status", "active");

  const link = links?.[0] ?? null;

  return NextResponse.json({
    commands: commands || [],
    accessUntil: access.endAt,
    settings: {
      lotMode: link?.lot_mode ?? "fixed",
      lotValue: link?.lot_value ?? 0.01,
      symbolMap: link?.symbol_map ?? {},
      maxSlippagePoints: link?.max_slippage_points ?? 50,
      copyExistingPositions: link?.copy_existing_positions ?? false,
    },
  });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCopyAccess, revokeExpiredFollower } from "@/lib/copy-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const db = createServiceClient();
  const access = await getCopyAccess(user.id);
  const { data: follower } = await db.from("copy_followers").select("id,mt_login,broker_server,status,copy_enabled,last_heartbeat_at,ea_version,license_status,license_expires_at,license_generation").eq("auth_user_id", user.id).maybeSingle();
  if (!follower) {
    return NextResponse.json({
      connected: false,
      subscriptionActive: access.active,
      accessUntil: access.endAt,
      account: null,
      pairing: { available: access.active && access.reason === "ADMIN" },
    });
  }

  if (!access.active && follower.status !== "disabled") {
    await revokeExpiredFollower(follower.id);
    follower.status = "disabled";
    follower.copy_enabled = false;
  }

  return NextResponse.json({
    connected: access.active && follower.status === "online" && follower.copy_enabled === true,
    subscriptionActive: access.active,
    accessUntil: access.endAt,
    account: follower,
    pairing: { available: access.active && access.reason === "ADMIN" ? true : access.active },
  });
}
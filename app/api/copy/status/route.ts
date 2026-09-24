import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCopyAccess, revokeFollowerAccess } from "@/lib/copy-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const db = createServiceClient();
  const access = await getCopyAccess(user.id);

  const { data: followers } = await db
    .from("copy_followers")
    .select("id,mt_login,broker_server,status,copy_enabled,last_heartbeat_at,ea_version,license_status,license_expires_at,license_generation,updated_at")
    .eq("auth_user_id", user.id)
    .order("updated_at", { ascending: false });

  const accounts = [];
  for (const follower of followers || []) {
    const accountAccess = await getCopyAccess(user.id, follower.mt_login);
    if (!accountAccess.active && follower.status !== "disabled") {
      const reason = accountAccess.reason === "revoked" || accountAccess.reason === "disabled" || accountAccess.reason === "suspended" ? accountAccess.reason : "expired";
      await revokeFollowerAccess(follower.id, reason);
      follower.status = "disabled";
      follower.copy_enabled = false;
      follower.license_status = reason;
    }

    accounts.push(follower);
  }

  const current = accounts[0] || null;

  return NextResponse.json({
    connected: !!current && access.active && current.status === "online" && current.copy_enabled === true,
    subscriptionActive: access.active,
    accessUntil: access.endAt,
    accessReason: access.reason,
    account: current,
    accounts,
    pairing: {
      available: access.active,
      reason: access.active ? null : access.reason,
    },
  });
}

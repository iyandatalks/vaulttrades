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

  const { data: registrations } = await db
    .from("copy_customer_registrations")
    .select("mt5_login,email,created_at,updated_at")
    .eq("auth_user_id", user.id)
    .order("updated_at", { ascending: false });

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

  // Read the configured publisher accounts and the actual master-to-follower
  // relationships. These are display-only; the Publisher/Copier execution
  // and licensing flows remain unchanged.
  const [{ data: masters }, { data: links }] = await Promise.all([
    db.from("copy_masters")
      .select("id,name,status,mt_login,broker_server,ea_version,last_heartbeat_at")
      .order("created_at", { ascending: true }),
    db.from("copy_links")
      .select("id,master_id,follower_id,status,lot_mode,lot_value")
      .in("follower_id", accounts.map((item: any) => item.id).filter(Boolean)),
  ]);

  return NextResponse.json({
    connected: !!current && access.active && current.status === "online" && current.copy_enabled === true,
    subscriptionActive: access.active,
    accessUntil: access.endAt,
    accessReason: access.reason,
    account: current,
    accounts,
    masters: masters || [],
    links: links || [],
    registeredMt5Accounts: registrations || [],
    pairing: {
      available: access.active,
      reason: access.active ? null : access.reason,
    },
  });
}

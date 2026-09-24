import { createAdminClient } from "./supabase/admin";

export type CopyAccess = {
  active: boolean;
  endAt: string | null;
  startAt: string | null;
  userId: string | null;
  mtLogin: string | null;
  licenseId?: string | null;
  reason: string;
};

function normalizeReason(status: unknown, endAt: string | null, nowMs: number) {
  const value = String(status || "").toLowerCase();
  if (value === "revoked") return "revoked";
  if (value === "suspended") return "suspended";
  if (value === "disabled" || value === "past_due" || value === "cancelled") return "disabled";
  if (endAt && new Date(endAt).getTime() <= nowMs) return "expired";
  if (value === "expired") return "expired";
  return "not_active";
}

export async function getCopyAccess(authUserId: string, mtLogin?: string | null): Promise<CopyAccess> {
  const db = createAdminClient();

  const { data: profile } = await db
    .from("users")
    .select("id,role")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (!profile) {
    return {
      active: false,
      endAt: null,
      startAt: null,
      userId: null,
      mtLogin: mtLogin || null,
      reason: "not_active",
    };
  }

  if (profile.role === "admin") {
    return {
      active: true,
      endAt: null,
      startAt: null,
      userId: profile.id,
      mtLogin: mtLogin || null,
      licenseId: null,
      reason: "ADMIN",
    };
  }

  const now = Date.now();

  // The Copy Trading license is the authoritative subscription record.
  // Each purchase creates its own product_licenses row, allowing one user
  // to hold separate subscriptions for separate registered MT5 accounts.
  let licenseQuery = db
    .from("product_licenses")
    .select("id,user_id,status,start_at,end_at,mt_login,payment_reference,updated_at")
    .eq("user_id", profile.id)
    .eq("entitlement_code", "automation");

  if (mtLogin) {
    licenseQuery = licenseQuery.eq("mt_login", String(mtLogin));
  }

  const { data: licenses } = await licenseQuery
    .order("start_at", { ascending: false })
    .limit(20);

  const matching = (licenses || []).find((license: any) => {
    const start = license.start_at ? new Date(license.start_at).getTime() : NaN;
    return Number.isFinite(start) && start <= now;
  });

  if (matching) {
    const startAt = matching.start_at ? new Date(matching.start_at).toISOString() : null;
    const endAt = matching.end_at ? new Date(matching.end_at).toISOString() : null;
    const reason = normalizeReason(matching.status, endAt, now);
    const active =
      String(matching.status || "").toLowerCase() === "active" &&
      Number.isFinite(new Date(startAt || 0).getTime()) &&
      new Date(startAt as string).getTime() <= now &&
      !!endAt &&
      new Date(endAt).getTime() > now;

    return {
      active,
      endAt,
      startAt,
      userId: profile.id,
      mtLogin: matching.mt_login || mtLogin || null,
      licenseId: matching.id,
      reason: active ? "ACTIVE" : reason,
    };
  }

  // Legacy fallback for existing automation grants that predate the
  // per-subscription product license record. This does not override a
  // matching subscription record above.
  const { data: feature } = await db
    .from("user_feature_access")
    .select("status,start_at,end_at,updated_at")
    .eq("user_id", profile.id)
    .eq("feature_code", "automation")
    .order("updated_at", { ascending: false })
    .limit(20);

  const currentFeature = (feature || []).find((row: any) => {
    const start = row.start_at ? new Date(row.start_at).getTime() : NaN;
    return Number.isFinite(start) && start <= now;
  });

  if (currentFeature) {
    const startAt = currentFeature.start_at ? new Date(currentFeature.start_at).toISOString() : null;
    const endAt = currentFeature.end_at ? new Date(currentFeature.end_at).toISOString() : null;
    const reason = normalizeReason(currentFeature.status, endAt, now);
    const active =
      String(currentFeature.status || "").toLowerCase() === "active" &&
      !!endAt &&
      new Date(endAt).getTime() > now;

    return {
      active,
      endAt,
      startAt,
      userId: profile.id,
      mtLogin: mtLogin || null,
      licenseId: null,
      reason: active ? "FEATURE_ACCESS" : reason,
    };
  }

  return {
    active: false,
    endAt: null,
    startAt: null,
    userId: profile.id,
    mtLogin: mtLogin || null,
    licenseId: null,
    reason: "not_active",
  };
}

export function accessHttpStatus(reason: string) {
  switch (reason) {
    case "expired":
      return 402;
    case "revoked":
      return 403;
    case "disabled":
      return 403;
    case "suspended":
      return 403;
    default:
      return 403;
  }
}

export async function revokeFollowerAccess(followerId: string, reason: "revoked" | "expired" | "disabled" | "suspended") {
  const db = createAdminClient();
  const now = new Date().toISOString();

  const { data: follower } = await db
    .from("copy_followers")
    .select("id,auth_user_id,api_token_hash")
    .eq("id", followerId)
    .maybeSingle();

  if (follower?.api_token_hash) {
    await db.from("copy_revoked_tokens").upsert({
      token_hash: follower.api_token_hash,
      auth_user_id: follower.auth_user_id,
      follower_id: follower.id,
      revoked_at: now,
      reason,
    }, { onConflict: "token_hash" });
  }

  await db
    .from("copy_followers")
    .update({
      status: "disabled",
      copy_enabled: false,
      license_status: reason,
      updated_at: now,
    })
    .eq("id", followerId);

  await db
    .from("copy_links")
    .update({
      status: "revoked",
      updated_at: now,
    })
    .eq("follower_id", followerId);

  await db
    .from("copy_trade_executions")
    .update({
      status: "cancelled",
      error_code: `COPY_ACCESS_${reason.toUpperCase()}`,
      error_message: `VaultTrades Copy Trading access is ${reason}.`,
      updated_at: now,
    })
    .eq("follower_id", followerId)
    .eq("status", "pending");
}

export async function revokeExpiredFollower(followerId: string) {
  await revokeFollowerAccess(followerId, "expired");
}

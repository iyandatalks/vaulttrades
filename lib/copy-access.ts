import { createAdminClient } from "./supabase/admin";

export type CopyAccess = {
  active: boolean;
  endAt: string | null;
  userId: string | null;
  reason?: string;
};

export async function getCopyAccess(authUserId: string): Promise<CopyAccess> {
  const db = createAdminClient();

  const { data: profile } = await db
    .from("users")
    .select("id,role")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (!profile) {
    return { active: false, endAt: null, userId: null, reason: "PROFILE_NOT_FOUND" };
  }

  if (profile.role === "admin") {
    return { active: true, endAt: null, userId: profile.id, reason: "ADMIN" };
  }

  const now = new Date();
  const { data: feature } = await db
    .from("user_feature_access")
    .select("status,start_at,end_at,updated_at")
    .eq("user_id", profile.id)
    .eq("feature_code", "automation")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (feature && feature.start_at) {
    const start = new Date(feature.start_at).getTime();
    const end = feature.end_at ? new Date(feature.end_at).getTime() : NaN;
    if (Number.isFinite(start) && start <= now.getTime() && Number.isFinite(end) && end > now.getTime()) {
      return { active: true, endAt: new Date(end).toISOString(), userId: profile.id, reason: "FEATURE_ACCESS" };
    }
  }

  return { active: false, endAt: feature?.end_at ? new Date(feature.end_at).toISOString() : null, userId: profile.id, reason: "SUBSCRIPTION_INACTIVE" };
}

export async function revokeExpiredFollower(followerId: string) {
  const db = createAdminClient();
  await db
    .from("copy_followers")
    .update({
      status: "disabled",
      copy_enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", followerId);

  await db
    .from("copy_links")
    .update({
      status: "revoked",
      updated_at: new Date().toISOString(),
    })
    .eq("follower_id", followerId);

  await db
    .from("copy_trade_executions")
    .update({
      status: "cancelled",
      error_code: "SUBSCRIPTION_EXPIRED",
      error_message: "VaultTrades Copy Trading subscription is no longer active.",
      updated_at: new Date().toISOString(),
    })
    .eq("follower_id", followerId)
    .eq("status", "pending");
}

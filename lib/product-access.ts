import { createAdminClient } from "./supabase/admin";

const PAID_PRODUCT_FEATURES = ["analyzer", "automation", "founders_mentorship"] as const;

export type ProductAccess = {
  admin: boolean;
  anyPaidProduct: boolean;
  analyzer: boolean;
  copy: boolean;
  foundersMentorship: boolean;
  userId: string | null;
};

export async function getProductAccess(authUserId: string): Promise<ProductAccess> {
  const db = createAdminClient();

  const { data: profile } = await db
    .from("users")
    .select("id,role")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (!profile) {
    return {
      admin: false,
      anyPaidProduct: false,
      analyzer: false,
      copy: false,
      foundersMentorship: false,
      userId: null,
    };
  }

  if (profile.role === "admin") {
    return {
      admin: true,
      anyPaidProduct: true,
      analyzer: true,
      copy: true,
      foundersMentorship: true,
      userId: profile.id,
    };
  }

  const now = Date.now();

  const { data: featureRows } = await db
    .from("user_feature_access")
    .select("feature_code,start_at,end_at,status")
    .eq("user_id", profile.id)
    .eq("status", "active")
    .in("feature_code", [...PAID_PRODUCT_FEATURES]);

  const activeFeature = (code: string) => (featureRows ?? []).some((row: any) => {
    const start = new Date(row.start_at).getTime();
    const end = row.end_at ? new Date(row.end_at).getTime() : Number.POSITIVE_INFINITY;
    return row.feature_code === code && Number.isFinite(start) && start <= now && end > now;
  });

  const { data: licenses } = await db
    .from("product_licenses")
    .select("entitlement_code,status,start_at,end_at")
    .eq("user_id", profile.id)
    .eq("status", "active");

  const activeLicense = (entitlement: string) => (licenses ?? []).some((row: any) => {
    const start = new Date(row.start_at).getTime();
    const end = row.end_at ? new Date(row.end_at).getTime() : Number.POSITIVE_INFINITY;
    return row.entitlement_code === entitlement && Number.isFinite(start) && start <= now && end > now;
  });

  const analyzer = activeFeature("analyzer") || activeLicense("analyzer");
  const copy = activeFeature("automation") || activeLicense("automation");
  const foundersMentorship = activeFeature("founders_mentorship") || activeLicense("founders_mentorship");
  const anyPaidProduct = analyzer || copy || foundersMentorship;

  return {
    admin: false,
    anyPaidProduct,
    analyzer,
    copy,
    foundersMentorship,
    userId: profile.id,
  };
}

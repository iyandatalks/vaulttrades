import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ResellerOnboardingClient from "./ResellerOnboardingClient";
import "../member-portal.css";

const MEMBERSHIP_CODES = ["nexus", "vaulttrades_nexus", "nexus_plus", "vaulttrades_nexus_plus", "vortex", "vaulttrades_vortex"];

export default async function ResellerOnboardingPage() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) redirect("/auth/login?next=/member-portal/reseller-onboarding");

  const admin = createAdminClient();
  const { data: profile } = await admin.from("users").select("id,role,referral_code").eq("auth_user_id", user.id).maybeSingle();
  if (!profile) {
    return <main className="vt-member-shell"><section className="vt-member-empty"><h1>Profile not found</h1><p>Complete your VaultTrades member profile before setting up reseller payments.</p><Link href="/profile" className="vt-member-button">Open profile</Link></section></main>;
  }

  if (profile.role !== "admin") {
    const { data: licences } = await admin.from("product_licenses").select("entitlement_code,status,start_at,end_at")
      .eq("user_id", profile.id).in("entitlement_code", MEMBERSHIP_CODES).eq("status", "active");
    const now = Date.now();
    const eligible = (licences ?? []).some(row => {
      const start = row.start_at ? new Date(row.start_at).getTime() : 0;
      const end = row.end_at ? new Date(row.end_at).getTime() : Number.POSITIVE_INFINITY;
      return Number.isFinite(start) && start <= now && end > now;
    });
    if (!eligible) redirect("/plans");
  }

  let resellerCode = String(profile.referral_code ?? "").trim().toUpperCase();
  if (!resellerCode) {
    resellerCode = `VT-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    await admin.from("users").update({ referral_code: resellerCode }).eq("id", profile.id).is("referral_code", null);
  }

  return <ResellerOnboardingClient resellerCode={resellerCode} />;
}

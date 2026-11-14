import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import BusinessLeadsClient from "./BusinessLeadsClient";
import "../member-portal.css";
import "./business-leads.css";

const CODES = ["nexus","vaulttrades_nexus","nexus_plus","vaulttrades_nexus_plus","vortex","vaulttrades_vortex"];
export const metadata = { title: "Business Leads | VaultTrades", description: "Private partner prospect tracking workspace." };

export default async function BusinessLeadsPage() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) redirect("/auth/login?next=/member-portal/business-leads");
  const db = createAdminClient();
  const { data: profile } = await db.from("users").select("id,role,referral_code").eq("auth_user_id", user.id).maybeSingle();
  if (!profile) redirect("/profile");
  const isAdmin = profile.role === "admin";
  let referralCode = profile.referral_code as string | null;
  if (!referralCode) {
    referralCode = "VT-" + randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    await db.from("users").update({ referral_code: referralCode }).eq("id", profile.id);
  }
  if (!isAdmin) {
    const { data: licences } = await db.from("product_licenses").select("entitlement_code,start_at,end_at,status")
      .eq("user_id", profile.id).eq("status", "active").in("entitlement_code", CODES);
    const now = Date.now();
    const allowed = (licences ?? []).some(x => {
      const start = x.start_at ? new Date(x.start_at).getTime() : 0;
      const end = x.end_at ? new Date(x.end_at).getTime() : Number.POSITIVE_INFINITY;
      return start <= now && end > now;
    });
    if (!allowed) redirect("/plans");
  }
  return <BusinessLeadsClient isAdmin={isAdmin} />;
}

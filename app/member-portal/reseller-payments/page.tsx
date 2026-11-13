import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ResellerPaymentsClient from "./ResellerPaymentsClient";
import "../member-portal.css";

const MEMBERSHIP_CODES = ["nexus","vaulttrades_nexus","nexus_plus","vaulttrades_nexus_plus","vortex","vaulttrades_vortex"];

export default async function ResellerPaymentsPage() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) redirect("/auth/login?next=/member-portal/reseller-payments");
  const db = createAdminClient();
  const { data: profile } = await db.from("users").select("id,role").eq("auth_user_id", user.id).maybeSingle();
  if (!profile) redirect("/profile");
  if (profile.role !== "admin") {
    const { data: licenses } = await db.from("product_licenses").select("entitlement_code,status,start_at,end_at")
      .eq("user_id", profile.id).in("entitlement_code", MEMBERSHIP_CODES).eq("status", "active");
    const now = Date.now();
    const eligible = (licenses ?? []).some(row => {
      const start = row.start_at ? new Date(row.start_at).getTime() : 0;
      const end = row.end_at ? new Date(row.end_at).getTime() : Number.POSITIVE_INFINITY;
      return Number.isFinite(start) && start <= now && end > now;
    });
    if (!eligible) redirect("/plans");
  }
  return <ResellerPaymentsClient />;
}

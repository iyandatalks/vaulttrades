import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import PartnerWebsiteManager from "./PartnerWebsiteManager";

export const dynamic = "force-dynamic";

export default async function PartnerWebsitesAdminPage() {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect("/auth/login?next=/admin/partner-websites");
  const db = createAdminClient();
  const { data: profile } = await db.from("users").select("role").eq("auth_user_id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/dashboard");
  return <main className="vt-info-page"><div className="vt-info-wrap" style={{ maxWidth: 1100 }}>
    <header className="vt-info-hero"><div className="vt-label">ADMIN · PARTNER OPERATIONS</div><h1>Partner Website Management</h1><p>Approve a partner website name, assign its exact domain to a registered partner account, or deactivate an existing assignment. Leads and checkout attribution are resolved from this domain assignment.</p><div className="vt-actions" style={{ justifyContent: "flex-start" }}><Link className="vt-secondary" href="/admin/partners">Back to Partner Management</Link></div></header>
    <PartnerWebsiteManager />
  </div></main>;
}

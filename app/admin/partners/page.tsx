import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";

export default async function AdminPartnersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/admin/partners");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <main className="vt-info-page">
      <div className="vt-info-wrap" style={{ maxWidth: 1000 }}>
        <header className="vt-info-hero">
          <div className="vt-label">ADMIN · PARTNERS</div>
          <h1>Partner Management</h1>
          <p>Manage the brokers, prop firms, tools and referral offers that appear on the public VaultTrades Partners page.</p>
          <div className="vt-actions" style={{ justifyContent: "flex-start", marginTop: 20 }}>
            <a className="vt-primary" href="/admin/partners/add">Add Partner</a>
            <a className="vt-secondary" href="/partners">View Public Partner Page</a>
          </div>
        </header>

        <section className="vt-info-card" style={{ marginTop: 24 }}>
          <div className="vt-label">CURRENT SETUP</div>
          <h2 style={{ marginTop: 10 }}>Partner catalogue is ready for future entries.</h2>
          <p className="muted" style={{ lineHeight: 1.7 }}>
            Add approved broker, prop-firm, tool and product records later. Each record can
            contain its display name, category, description, referral code, referral URL,
            CTA text and active status.
          </p>
          <p className="muted" style={{ marginBottom: 0 }}>
            No referral URLs or codes have been invented or activated by this initial release.
          </p>
        </section>
      </div>
    </main>
  );
}

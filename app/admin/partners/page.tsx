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

  const now = new Date().toISOString();
  const [{ data: users = [], error: usersError }, { data: licenses = [], error: licensesError }, { data: features = [], error: featuresError }, { data: subscriptions = [], error: subscriptionsError }] = await Promise.all([
    admin.from("users").select("id,email,first_name,last_name,created_at,license_status,license_expires_at,is_active,role").neq("role", "admin").order("created_at", { ascending: false }),
    admin.from("product_licenses").select("user_id,email,purchased_product_code,status,start_at,end_at"),
    admin.from("user_feature_access").select("user_id,feature_code,status,start_at,end_at"),
    admin.from("subscriptions").select("user_id,status,start_at,end_at"),
  ]);

  const dataErrors = [usersError, licensesError, featuresError, subscriptionsError].filter(Boolean);
  const hasActiveWindow = (status: string | null | undefined, startAt?: string | null, endAt?: string | null) =>
    status?.toLowerCase() === "active" &&
    (!startAt || startAt <= now) &&
    (!endAt || endAt >= now);
  const activeIds = new Set<string>();
  for (const license of licenses ?? []) {
    if (license.user_id && hasActiveWindow(license.status, license.start_at, license.end_at)) activeIds.add(license.user_id);
  }
  for (const feature of features ?? []) {
    if (feature.user_id && hasActiveWindow(feature.status, feature.start_at, feature.end_at)) activeIds.add(feature.user_id);
  }
  for (const subscription of subscriptions ?? []) {
    if (subscription.user_id && hasActiveWindow(subscription.status, subscription.start_at, subscription.end_at)) activeIds.add(subscription.user_id);
  }
  for (const account of users ?? []) {
    if (account.id && account.license_status?.toLowerCase() === "active" &&
      (!account.license_expires_at || account.license_expires_at >= now) &&
      account.is_active !== false) activeIds.add(account.id);
  }
  const internalUsers = (users ?? []).map((account) => ({
    ...account,
    hasAccess: activeIds.has(account.id),
    activeProducts: [
      ...(licenses ?? []).filter((item) => item.user_id === account.id && hasActiveWindow(item.status, item.start_at, item.end_at)).map((item) => item.purchased_product_code || "VaultTrades product"),
      ...(features ?? []).filter((item) => item.user_id === account.id && hasActiveWindow(item.status, item.start_at, item.end_at)).map((item) => item.feature_code),
      ...(subscriptions ?? []).filter((item) => item.user_id === account.id && hasActiveWindow(item.status, item.start_at, item.end_at)).map(() => "Subscription"),
    ],
  }));
  const activeCount = internalUsers.filter((account) => account.hasAccess).length;
  const profileOnlyCount = internalUsers.length - activeCount;

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
          <div className="vt-label">INTERNAL PARTNERS</div>
          <h2 style={{ marginTop: 10 }}>VaultTrades registered members</h2>
          <p className="muted" style={{ lineHeight: 1.7 }}>
            Internal partners are people who signed up on the VaultTrades app. Access is counted from active, in-date product licences, feature access, subscriptions or an active account licence.
          </p>
          {dataErrors.length > 0 ? (
            <p role="alert" style={{ color: "#fca5a5" }}>Some member access records could not be loaded. Counts may be incomplete; check the database query permissions and schema.</p>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, margin: "18px 0 24px" }}>
                <div className="vt-info-card"><div className="vt-label">REGISTERED PROFILES</div><h2>{internalUsers.length}</h2></div>
                <div className="vt-info-card"><div className="vt-label">ACTIVE ACCESS</div><h2>{activeCount}</h2><p className="muted">At least one active product or entitlement</p></div>
                <div className="vt-info-card"><div className="vt-label">PROFILE ONLY</div><h2>{profileOnlyCount}</h2><p className="muted">No active product or entitlement</p></div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
                  <thead><tr style={{ textAlign: "left", borderBottom: "1px solid #303747" }}>
                    <th style={{ padding: "10px 8px" }}>Member</th><th style={{ padding: "10px 8px" }}>Joined</th><th style={{ padding: "10px 8px" }}>Access</th><th style={{ padding: "10px 8px" }}>Active products</th>
                  </tr></thead>
                  <tbody>
                    {internalUsers.map((account) => (
                      <tr key={account.id} style={{ borderBottom: "1px solid #252c39" }}>
                        <td style={{ padding: "12px 8px" }}><strong>{[account.first_name, account.last_name].filter(Boolean).join(" ") || "Member"}</strong><br /><span className="muted">{account.email}</span></td>
                        <td style={{ padding: "12px 8px" }}>{account.created_at ? new Date(account.created_at).toLocaleDateString("en-ZA") : "—"}</td>
                        <td style={{ padding: "12px 8px" }}><span style={{ color: account.hasAccess ? "#4ade80" : "#fbbf24", fontWeight: 700 }}>{account.hasAccess ? "Active access" : "Profile only"}</span></td>
                        <td style={{ padding: "12px 8px" }}>{account.activeProducts.length ? [...new Set(account.activeProducts)].join(", ") : "No active product"}</td>
                      </tr>
                    ))}
                    {internalUsers.length === 0 && <tr><td colSpan={4} style={{ padding: 16 }} className="muted">No registered member profiles found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

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

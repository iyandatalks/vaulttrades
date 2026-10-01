import { redirect } from "next/navigation";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

export default async function AddPartnerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/admin/partners/add");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") redirect("/dashboard");

  return (
    <main className="vt-info-page">
      <div className="vt-info-wrap" style={{ maxWidth: 820 }}>
        <header className="vt-info-hero">
          <div className="vt-label">ADMIN · ADD PARTNER</div>
          <h1>Add Partner</h1>
          <p>This admin-only entry point is reserved for the partner catalogue workflow.</p>
        </header>

        <section className="vt-info-card">
          <div className="vt-info-grid">
            {[
              ["Partner name", "e.g. Broker or Prop Firm"],
              ["Category", "Broker / Prop Firm / Tool / VaultTrades Product"],
              ["Referral code", "Optional partner code"],
              ["Referral URL", "Approved affiliate or referral URL"],
              ["CTA text", "e.g. Sign Up / Join Now / Get Tool"],
              ["Description", "Short public description"],
            ].map(([label, placeholder]) => (
              <label key={label} style={{ display: "block" }}>
                <span className="vt-label">{label.toUpperCase()}</span>
                <input
                  disabled
                  placeholder={placeholder}
                  style={{ width: "100%", marginTop: 8, padding: 12, borderRadius: 9, border: "1px solid rgba(255,255,255,.12)", background: "#050812", color: "#f4f6fb" }}
                />
              </label>
            ))}
          </div>
          <p className="muted" style={{ marginTop: 18, lineHeight: 1.6 }}>
            Partner storage and activation will be connected here later. This page is intentionally
            admin-only and currently does not publish or activate referral links.
          </p>
          <a className="vt-secondary" href="/admin/partners" style={{ display: "inline-block", marginTop: 8 }}>
            Back to Partner Management
          </a>
        </section>
      </div>
    </main>
  );
}

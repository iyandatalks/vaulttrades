import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/join?next=/profile");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name,last_name,email,phone,created_at")
    .eq("id", user.id)
    .maybeSingle();

  const { data: subscriptions } = await supabase
    .from("subscriptions")
    .select("provider,status,amount,currency,started_at,expires_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const active = subscriptions?.find((subscription) => subscription.status === "active");

  return (
    <main className="shell">
      <section className="card">
        <div className="section-label">PROFILE</div>
        <h1 className="title">Your VaultTrades Profile</h1>
        <p className="muted">Your account and subscription information are securely linked to your VaultTrades identity.</p>
        <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
          <div className="card" style={{ margin: 0 }}>
            <strong>{profile?.first_name} {profile?.last_name}</strong>
            <p className="muted" style={{ marginBottom: 4 }}>{profile?.email ?? user.email}</p>
            {profile?.phone ? <p className="muted">{profile.phone}</p> : null}
          </div>
          <div className="card" style={{ margin: 0 }}>
            <strong>Subscription</strong>
            <p className="muted">{active ? `ACTIVE · ${active.provider.toUpperCase()} · ${active.amount} ${active.currency} / month` : "No active subscription"}</p>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <strong>Access</strong>
            <p className="muted">Analyzer, Strategies, AI Coach and Journal are available to active subscribers. The internal Strategy Library remains developer-only.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

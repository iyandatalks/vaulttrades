"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function ProfilePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setLoading(false);
    });
  }, []);

  async function handleLogout() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="shell">
      <section className="card">
        <div className="section-label">PROFILE</div>
        <h1 className="title">Your VaultTrades Profile</h1>
        <p className="muted">Account, subscription and referral information will live here.</p>

        {!loading && email && (
          <div className="card" style={{ margin: "24px 0 0" }}>
            <strong>Signed in as</strong>
            <p className="muted">{email}</p>
            <button onClick={handleLogout} className="button" type="button">Log out</button>
          </div>
        )}

        {!loading && !email && (
          <div style={{ marginTop: 24 }}>
            <a className="button" href="/auth/login">Log in</a>
          </div>
        )}

        <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
          <div className="card" style={{ margin: 0 }}><strong>Referral Link</strong><p className="muted">Your unique referral link will appear here.</p></div>
          <div className="card" style={{ margin: 0 }}><strong>Successful Purchases</strong><p className="muted">Only successful purchases count toward referral credit.</p></div>
          <div className="card" style={{ margin: 0 }}><strong>Paid Out</strong><p className="muted">Your confirmed referral payouts will appear here.</p></div>
        </div>
      </section>
    </main>
  );
}

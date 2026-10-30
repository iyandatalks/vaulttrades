"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

type ReferralState = {
  enabled: boolean;
  code: string | null;
  url: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);\n  const [hasWhatsAppSupport, setHasWhatsAppSupport] = useState(false);
  const [referral, setReferral] = useState<ReferralState>({ enabled: false, code: null, url: null });

  useEffect(() => {
    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    sb.auth.getUser().then(async ({ data }) => {
      setEmail(data.user?.email ?? null);

      if (data.user) {
        const response = await fetch("/api/dashboard/access", { cache: "no-store" });
        const result = await response.json().catch(() => ({}));

        if (response.ok) {
          setReferral(result?.referral ?? { enabled: false, code: null, url: null });
          setIsAdmin(result?.admin === true);\n          setHasWhatsAppSupport(result?.supportWhatsApp === true);
        }
      }

      setLoading(false);
    });
  }, []);

  async function handleLogout() {
    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await sb.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="shell">
      <section className="card">
        <div className="section-label">PROFILE</div>
        <h1 className="title">Your VaultTrades Profile</h1>
        <p className="muted">Account information and the products and tools currently available to your account.</p>

        {!loading && email && (
          <div className="card" style={{ margin: "24px 0 0" }}>
            <strong>Signed in as</strong>
            <p className="muted">{email}</p>
            <button onClick={handleLogout} className="button" type="button">Log out</button>
          </div>
        )}

        {!loading && !email && (
          <div style={{ marginTop: 24 }}>
            <Link className="button" href="/auth/login">Log in</Link>
          </div>
        )}

        {!loading && email && (
          <>
            {isAdmin && (
              <section className="vt-info-card" style={{ marginTop: 24, textAlign: "left", border: "1px solid rgba(212,166,55,.35)" }}>
                <div className="vt-label">ADMIN</div>
                <h2 style={{ margin: "10px 0 8px", fontSize: 27 }}>Admin Controls</h2>
                <p className="muted" style={{ maxWidth: 760 }}>
                  Administrative links for account access, submitted content and partner management.
                </p>
                <div className="vt-info-grid" style={{ marginTop: 16 }}>
                  <article className="vt-info-card">
                    <h3>Grant Product Access</h3>
                    <p className="muted">Find a customer and grant or deactivate eligible product access.</p>
                    <Link className="vt-primary" href="/admin/product-access" style={{ display: "inline-block", marginTop: 8 }}>Open Access Control →</Link>
                  </article>
                  <article className="vt-info-card">
                    <h3>Review Community Posts</h3>
                    <p className="muted">Approve, keep pending, or reject customer testimonials before publication.</p>
                    <Link className="vt-primary" href="/admin/community-testimonials" style={{ display: "inline-block", marginTop: 8 }}>Review Submissions →</Link>
                  </article>
                  <article className="vt-info-card">
                    <h3>Manage Partners</h3>
                    <p className="muted">Manage the partner catalogue and public partner page.</p>
                    <Link className="vt-primary" href="/admin/partners" style={{ display: "inline-block", marginTop: 8 }}>Open Partner Management →</Link>
                  </article>
                </div>
              </section>
            )}

            <section className="vt-info-card" style={{ marginTop: 24, textAlign: "left" }}>
              <div className="vt-label">REFERRAL</div>
              <h2 style={{ margin: "10px 0 8px", fontSize: 27 }}>VaultTrades Referral</h2>
              {referral.enabled && referral.url ? (
                <>
                  <p style={{ maxWidth: 760 }}>
                    Your personal referral link is active because your account has an active VaultTrades product.
                    Share the full link below with people you refer to VaultTrades.
                  </p>
                  <div style={{ marginTop: 14, padding: "14px 16px", borderRadius: 10, background: "#050812", border: "1px solid rgba(212,166,55,.18)" }}>
                    <strong style={{ color: "#d4a637" }}>20% Commission</strong>
                    <p className="muted" style={{ margin: "6px 0 0" }}>
                      Earn 20% commission when a person you refer subscribes to an eligible VaultTrades product.
                      Commission is payable to your PayPal account once your available balance reaches the $50 minimum payment threshold.
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 14 }}>
                    <input
                      readOnly
                      value={referral.url}
                      aria-label="Your VaultTrades referral link"
                      style={{
                        flex: 1,
                        minWidth: 280,
                        padding: "12px 14px",
                        borderRadius: 9,
                        border: "1px solid rgba(255,255,255,.12)",
                        background: "#050812",
                        color: "#f4f6fb",
                      }}
                    />
                    <Link className="vt-primary" href="/referral-vault">
                      Open Referral Vault →
                    </Link>
                  </div>
                  {referral.code && (
                    <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                      Referral code: {referral.code}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p style={{ maxWidth: 760 }}>
                    Your personal referral link becomes active after you have signed up for at least one VaultTrades product.
                  </p>
                  <Link className="vt-primary" href="/referral-process" style={{ display: "inline-block", marginTop: 12 }}>
                    View VaultTrades Process →
                  </Link>
                </>
              )}
            </section>



          </>
        )}
      </section>
    </main>
  );
}

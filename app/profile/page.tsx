"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import RecommendedTradingPartners from "./RecommendedTradingPartners";

type AccessState = {
  analyzer?: boolean;
  copy?: boolean;
  founders_mentorship?: boolean;
  ai_coach?: boolean;
  journal?: boolean;
  funded_account_wealth_builder?: boolean;
};

const accessTools = [
  {
    key: "analyzer",
    title: "ANALYZER",
    description: "Analyze market context, structure, liquidity and strategy conditions.",
    href: "/analyzer",
    button: "Open Analyzer",
    group: "product",
  },
  {
    key: "founders_mentorship",
    title: "FOUNDERS MENTORSHIP",
    description: "Access the 7-day program and book your 1-hour one-on-one session.",
    href: "/founders-mentorship",
    button: "Open Founders Mentorship",
    group: "product",
  },
  {
    key: "copy",
    title: "COPY TRADING",
    description: "Connect and monitor your MT5 copy-trading account.",
    href: "/copy",
    button: "Open Copy Trading",
    group: "product",
  },
  {
    key: "ai_coach",
    title: "AI COACH",
    description: "Question analysis, strategy conditions and trading decisions.",
    href: "/ai-coach",
    button: "Open AI Coach",
    group: "shared",
  },
  {
    key: "journal",
    title: "JOURNAL",
    description: "Record trading decisions, outcomes and reviews in one place.",
    href: "/journal",
    button: "Open Journal",
    group: "shared",
  },
  {
    key: "funded_account_wealth_builder",
    title: "FUNDED ACCOUNT WEALTH BUILDER",
    description: "Plan capital growth, buffers, income goals and monthly assumptions.",
    href: "/funded-account-wealth-builder",
    button: "Open Wealth Builder",
    group: "shared",
  },
] as const;

export default function ProfilePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState(false);
  const [access, setAccess] = useState<AccessState>({});

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
          setAdmin(result?.admin === true);
          setAccess(result?.access ?? {});
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

  const availableTools = accessTools.filter((tool) => admin || access[tool.key as keyof AccessState] === true);
  const productTools = availableTools.filter((tool) => tool.group === "product");
  const sharedTools = availableTools.filter((tool) => tool.group === "shared");

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
          <section className="vt-info-card" style={{ marginTop: 24, textAlign: "left" }}>
            <div className="vt-label">YOUR ACCESS</div>
            <h2 style={{ margin: "10px 0 8px", fontSize: 27 }}>
              {admin ? "All VaultTrades tools are available" : availableTools.length + (availableTools.length === 1 ? " tool available" : " tools available")}
            </h2>
            <p style={{ maxWidth: 760 }}>
              This list is generated from your current active product entitlement. Only access that is currently available to your account is shown.
            </p>

            {productTools.length > 0 && (
              <>
                <div className="vt-label" style={{ marginTop: 22 }}>PRODUCT ACCESS</div>
                <div className="vt-info-grid" style={{ marginTop: 12 }}>
                  {productTools.map((tool) => (
                    <article className="vt-info-card" key={tool.key}>
                      <h2>{tool.title}</h2>
                      <p>{tool.description}</p>
                      <Link
                        className="vt-primary"
                        style={{ display: "inline-block", marginTop: 12 }}
                        href={tool.href}
                      >
                        {tool.button} →
                      </Link>
                    </article>
                  ))}
                </div>
              </>
            )}

            {sharedTools.length > 0 && (
              <>
                <div className="vt-label" style={{ marginTop: 28 }}>SHARED TOOLS</div>
                <p style={{ marginTop: 8 }}>
                  Included while you have an active VaultTrades product entitlement.
                </p>
                <div className="vt-info-grid" style={{ marginTop: 12 }}>
                  {sharedTools.map((tool) => (
                    <article className="vt-info-card" key={tool.key}>
                      <h2>{tool.title}</h2>
                      <p>{tool.description}</p>
                      <Link
                        className="vt-primary"
                        style={{ display: "inline-block", marginTop: 12 }}
                        href={tool.href}
                      >
                        {tool.button} →
                      </Link>
                    </article>
                  ))}
                </div>
              </>
            )}

            {availableTools.length === 0 && (
              <div style={{ marginTop: 18 }}>
                <p className="muted">No paid product access is currently active.</p>
                <Link className="vt-primary" href="/products">View Products →</Link>
              </div>
            )}
          </section>
        )}

        {!loading && email && <RecommendedTradingPartners />}
      </section>
    </main>
  );
}

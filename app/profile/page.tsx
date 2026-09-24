"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

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

const recommendedBrokers = [
  {
    name: "XM Broker",
    bestFor: [
      "Beginners to experienced traders",
      "Flexible account options",
      "Forex, Gold (XAUUSD) and multi-asset trading",
    ],
    why: "XM offers access to multiple financial markets and supports MT4 and MT5. XM also advertises negative balance protection on applicable accounts and different regulated entities depending on the client's jurisdiction. Always confirm the entity and current terms that apply to your account.",
    href: "https://www.xmza.com/referral?token=9TMOAfWroLZu69ys2-IUqg",
    cta: "Open XM Account",
  },
  {
    name: "Headway",
    bestFor: [
      "Traders who want flexibility",
      "Scalpers and strategy-based traders",
      "Multi-asset traders",
    ],
    why: "Headway provides access to MT4 and MT5 and offers a range of trading instruments and account options. Current conditions, leverage and regulatory coverage depend on the entity and account type available to you.",
    href: "https://headway.partners/user/signup?hwp=d93922",
    cta: "Open Headway Account",
  },
] as const;

const recommendedPropFirms = [
  {
    name: "Top One Trader",
    bestFor: [
      "Simple challenge structures",
      "Fast-track funding options",
      "Traders who want multiple account models",
    ],
    why: "Top One Trader currently offers several funding models, including one-step, two-step and instant-style options. Account rules vary by model, including payout timing, drawdown and news-trading conditions, so select the model that matches your strategy.",
    href: "https://toponetrader.com/?linkId=lp_148658&sourceId=sibongilesz2017gmailcom&tenantId=toponetrader",
    cta: "Start Top One Trader",
  },
  {
    name: "The 5%ers",
    bestFor: [
      "Long-term traders",
      "Low-risk, consistency-focused strategies",
      "Traders interested in account scaling",
    ],
    why: "The 5%ers currently offers structured funding programs with defined drawdown rules, scaling paths and scheduled payout cycles. Its High Stakes program allows overnight and weekend holding and supports MT5, while program rules differ by account type.",
    href: "https://the5ers.com/",
    cta: "Explore The 5%ers",
  },
  {
    name: "Blue Guardian",
    bestFor: [
      "Traders who want flexible funding models",
      "MT5 and algorithmic trading users",
      "Traders comparing scheduled and instant payout structures",
    ],
    why: "Blue Guardian currently offers multiple funding models, including instant and evaluation-based accounts. Its published rules include MT5 availability, EA support on eligible models, different drawdown structures and payout options. Specific rules vary by account type, so review the model before purchasing.",
    href: "https://blueguardian.com/?afmc=2dw1",
    cta: "Explore Blue Guardian",
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
          <>
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

            <section className="vt-info-card" style={{ marginTop: 24, textAlign: "left" }}>
              <div className="vt-label">PARTNER ACCESS</div>
              <h2 style={{ margin: "10px 0 8px", fontSize: 29 }}>
                Trade With the Right Partners — Brokers & Prop Firms I Personally Recommend
              </h2>
              <p style={{ maxWidth: 820 }}>
                Tested. Trusted. Built for serious traders.
              </p>
              <p className="muted" style={{ maxWidth: 820, marginTop: 8 }}>
                Need a broker or prop firm account? These are the platforms I currently recommend for traders who want an execution-focused workflow. Partner rules, leverage, fees, regulations and offers can change, so always review the current terms before opening an account.
              </p>

              <div className="vt-label" style={{ marginTop: 24 }}>RECOMMENDED BROKERS</div>
              <div className="vt-info-grid" style={{ marginTop: 12 }}>
                {recommendedBrokers.map((partner) => (
                  <article className="vt-info-card" key={partner.name}>
                    <h2>{partner.name}</h2>
                    <strong>Best For</strong>
                    <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                      {partner.bestFor.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                    <p style={{ marginTop: 14 }}>{partner.why}</p>
                    <a
                      className="vt-primary"
                      style={{ display: "inline-block", marginTop: 12 }}
                      href={partner.href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {partner.cta} →
                    </a>
                  </article>
                ))}
              </div>

              <div className="vt-label" style={{ marginTop: 28 }}>RECOMMENDED PROP FIRMS</div>
              <div className="vt-info-grid" style={{ marginTop: 12 }}>
                {recommendedPropFirms.map((partner) => (
                  <article className="vt-info-card" key={partner.name}>
                    <h2>{partner.name}</h2>
                    <strong>Best For</strong>
                    <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                      {partner.bestFor.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                    <p style={{ marginTop: 14 }}>{partner.why}</p>
                    <a
                      className="vt-primary"
                      style={{ display: "inline-block", marginTop: 12 }}
                      href={partner.href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {partner.cta} →
                    </a>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}

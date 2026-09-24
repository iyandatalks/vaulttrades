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
      "Forex, Gold (XAUUSD) and multi-asset trading",
      "MT4 and MT5 users",
    ],
    why: "XM offers access to multiple markets through MT4 and MT5 and publishes trading conditions that can suit both newer and experienced traders. XM operates through different regulated entities depending on jurisdiction, so confirm the entity and protections that apply to your account.",
    bonus: "Referral offer: 50% OFF all VaultTrades trading products when available through my partner link.",
    href: "https://www.xmza.com/referral?token=9TMOAfWroLZu69ys2-IUqg",
    cta: "Open XM Account",
  },
  {
    name: "Headway",
    bestFor: [
      "Flexible trading styles",
      "Scalpers and strategy-based traders",
      "Forex, crypto and index traders",
    ],
    why: "Headway supports MT4 and MT5 and offers a range of instruments and account types. Current spreads, leverage, execution conditions and regulatory coverage depend on the specific entity and account selected.",
    bonus: "Referral offer: 50% OFF all VaultTrades trading products when available through my partner link.",
    href: "https://headway.partners/user/signup?hwp=d93922",
    cta: "Open Headway Account",
  },
  {
    name: "JustMarkets",
    bestFor: [
      "MT4 and MT5 traders",
      "Gold, Forex, indices and multi-asset trading",
      "Traders comparing tight-spread account options",
    ],
    why: "JustMarkets currently publishes MT4/MT5 access, multi-asset trading and Raw Spread conditions starting from 0.0 pips. Its South African operation is listed by the FSCA, while other JustMarkets entities are regulated in other jurisdictions. Account conditions vary by entity and account type.",
    bonus: "Partner referral link — current promotional benefits are subject to the offer and partner terms.",
    href: "https://one.justmarkets.link/a/trea9c04a1",
    cta: "Open JustMarkets Account",
  },
] as const;

const recommendedPropFirms = [
  {
    name: "Top One Trader",
    bestFor: [
      "Simple challenge structures",
      "Fast-track funding options",
      "Traders comparing multiple evaluation models",
    ],
    why: "Top One Trader provides funding evaluations with different account models. The exact profit targets, drawdown rules, payout conditions and trading restrictions depend on the model selected.",
    bonus: "Referral offer: 50% OFF all VaultTrades trading products when available through my partner link.",
    href: "https://toponetrader.com/?linkId=lp_148658&sourceId=sibongilesz2017gmailcom&tenantId=toponetrader",
    cta: "Start Top One Trader",
  },
  {
    name: "Goat Funded Trader",
    bestFor: [
      "Traders comparing one-step and multi-step evaluations",
      "Traders looking at evaluation and instant-funding models",
      "MT5 and strategy-based traders",
    ],
    why: "Goat Funded Trader currently publishes 1-Step, 2-Step and 3-Step evaluation models plus instant-funding options. Rules differ by model; its current 2-Step Standard, for example, publishes 10% and 5% evaluation targets, 5% daily drawdown and 10% maximum overall loss, with payout and funded-stage conditions that should be checked before purchase.",
    bonus: "Partner referral link — promotional benefits depend on the current offer.",
    href: "https://app.goatfundedtrader.com/",
    cta: "Explore Goat Funded Trader",
  },
  {
    name: "Blue Guardian",
    bestFor: [
      "Traders comparing evaluation and instant funding",
      "MT5 and algorithmic-trading users",
      "Traders interested in scaling and different payout structures",
    ],
    why: "Blue Guardian currently offers multiple evaluation and instant-funding models and supports MT5. Its published rules include model-specific drawdown, payout and trading conditions, while its scaling system provides a path to larger funded allocations. Review the exact model rules before purchasing.",
    bonus: "Partner referral link — current promotional benefits are subject to the offer and partner terms.",
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
                Need a broker or prop firm account? These are the partner platforms I currently recommend for an execution-focused workflow. Use the CTA that matches your needs. Partner offers, fees, leverage, regulations and rules can change, so always review the current terms before opening an account.
              </p>
              <p style={{ maxWidth: 820, marginTop: 10 }}>
                Your VaultTrades workflow can then bring the pieces together: analyze the market, journal decisions, use AI Coach, prepare for prop-firm evaluations, build and protect a trading buffer, and review your progress. Use of these tools does not guarantee that an evaluation or funded account will be passed.
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
                    <p style={{ marginTop: 10, color: "#d4a637", fontWeight: 800 }}>{partner.bonus}</p>
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

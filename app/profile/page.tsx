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
      "Forex and Gold (XAUUSD)",
      "MT4 and MT5 users",
    ],
    why: "XM provides access to multiple markets through MT4 and MT5. XM also publishes execution information and trading conditions for its services. The exact entity, account type, leverage and protections available to you depend on your jurisdiction.",
    bonus: "Partner offer: 50% OFF VaultTrades trading products when available through my partner link.",
    href: "https://www.xmza.com/referral?token=9TMOAfWroLZu69ys2-IUqg",
    cta: "Open XM Account",
  },
  {
    name: "Headway",
    bestFor: [
      "Flexible trading styles",
      "Scalpers and strategy-based traders",
      "Forex, crypto and indices",
    ],
    why: "Headway currently advertises 500+ instruments, MT4/MT5 support and spreads from 0.0 pips on selected account types. Its South African operation is presented as FSCA-regulated under JAROCEL PTY LTD, license 52108. Account conditions and regulatory coverage vary by entity and account type.",
    bonus: "Partner offer: 50% OFF VaultTrades trading products when available through my partner link.",
    href: "https://headway.partners/user/signup?hwp=d93922",
    cta: "Open Headway Account",
  },
  {
    name: "JustMarkets",
    bestFor: [
      "Forex and Gold (XAUUSD) traders",
      "MT4 and MT5 users",
      "Traders looking for flexible account options",
    ],
    why: "JustMarkets offers MT4 and MT5 access across forex, metals, indices, stocks and digital assets. Its published account information currently lists Standard and Standard Cent accounts with spreads from 0.3 pips, Raw Spread accounts with spreads from 0 pips, and leverage up to 1:3000. JustMarkets also lists a South African entity, Just Global Markets (PTY) Ltd, as an FSCA-authorized Financial Service Provider (FSP 51114). Your available account conditions, leverage and regulatory protections depend on your jurisdiction and the entity serving your account.",
    bonus: "Partner link — current promotional terms may vary.",
    href: "https://one.justmarkets.link/a/trea9c04a1",
    cta: "Open JustMarkets Account",
  },
] as const;

const recommendedPropFirms = [
  {
    name: "Top One Trader",
    bestFor: [
      "Traders comparing simple evaluation models",
      "Challenge accounts with clear rule sets",
      "MT5 users on supported models",
    ],
    why: "Top One Trader currently offers multiple evaluation and funding models. Its published rules vary by program, including drawdown, news, EA and payout conditions, so the exact model should be checked before purchase.",
    bonus: "Partner offer: 50% OFF VaultTrades trading products when available through my partner link.",
    href: "https://toponetrader.com/?linkId=lp_148658&sourceId=sibongilesz2017gmailcom&tenantId=toponetrader",
    cta: "Start Top One Trader",
  },
  {
    name: "Goat Funded Trader",
    bestFor: [
      "Traders comparing 1-step, 2-step and instant funding models",
      "MT5 and multi-platform traders",
      "Traders looking for defined evaluation and reward structures",
    ],
    why: "Goat Funded Trader currently offers challenge and instant-funding models, supports MT5 for eligible clients, and advertises simulated funded capital up to $2M. Its current models have different drawdown, trading-day and reward rules, so the exact account model should be reviewed before purchase.",
    bonus: "Current offers and reward terms vary by model and promotion.",
    href: "https://www.goatfundedtrader.com/",
    cta: "Explore Goat Funded Trader",
  },
  {
    name: "Blue Guardian",
    bestFor: [
      "Traders comparing evaluation and instant-funding models",
      "MT5 and strategy-based traders",
      "Traders looking for defined payout and scaling structures",
    ],
    why: "Blue Guardian currently supports MT5 and publishes several funding models. Its current 2-Step Standard model lists an 8% Phase 1 target, 4% Phase 2 target, 4% maximum daily drawdown, 8% static maximum overall drawdown, 85% base profit split and payouts every 14 days, with model-specific rules and optional add-ons. Blue Guardian also publishes a scaling plan for growing allocations.",
    bonus: "Partner link — promotional benefits are subject to the current offer and partner terms.",
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
              <div className="vt-label">BROKERS & PROP FIRMS I PERSONALLY RECOMMEND</div>
              <h2 style={{ margin: "10px 0 8px", fontSize: 29 }}>
                Trade With the Right Partners — Brokers & Prop Firms I Personally Recommend
              </h2>
              <p style={{ maxWidth: 820 }}>
                Tested. Trusted. Built for serious traders.
              </p>
              <p className="muted" style={{ maxWidth: 820, marginTop: 8 }}>
                Need a broker or prop firm account? These are the partner platforms I personally recommend for an execution-focused workflow. If you already have a suitable account, continue using it. If you do not, use the CTA below to open an account. Partner offers, fees, leverage, regulations and rules can change, so always review the current terms before registering.
              </p>
              <p style={{ maxWidth: 820, marginTop: 10 }}>
                These partners are intended to support the workflow around VaultTrades: market analysis, execution, funded-account preparation, journaling and review. Partner links may provide a referral benefit to VaultTrades or the account holder, depending on the current offer. Trading and funding outcomes are not guaranteed.
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

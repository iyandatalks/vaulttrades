"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const PAYPAL_AUTOMATED_TRADER_URL =
  "https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-0YR675118F424491GNJ7LAEQ";

type LandingCard = {
  title: string;
  description: string;
  href: string;
  cta: string;
  external?: boolean;
};

const baseCards: LandingCard[] = [
  {
    title: "ANALYZER",
    description:
      "Analyze the market using structured strategies and understand why a trade is valid, developing, waiting, or should be avoided.",
    href: "/analyzer",
    cta: "Explore Analyzer",
  },
  {
    title: "AI COACH",
    description:
      "Ask questions and deepen your understanding of market structure, strategy conditions, analysis, and trading decisions.",
    href: "/ai-coach",
    cta: "Meet AI Coach",
  },
  {
    title: "JOURNAL",
    description:
      "Record and review your trading decisions, identify patterns in your execution, and build consistency over time.",
    href: "/journal",
    cta: "Open Journal",
  },
];

type AutomationStatus = { active: boolean };

export default function HomePage() {
  const [automationActive, setAutomationActive] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/automated-trader/status", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as AutomationStatus;
        if (!cancelled) setAutomationActive(Boolean(data.active));
      })
      .catch(() => {
        if (!cancelled) setAutomationActive(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const automationHref = automationActive
    ? "/automated-trader"
    : PAYPAL_AUTOMATED_TRADER_URL;
  const automationCta = automationActive
    ? "Open Automated Trader"
    : "Subscribe — $99.99/month";

  const cards: LandingCard[] = [
    baseCards[0],
    {
      title: "AUTOMATED TRADER",
      description: automationActive
        ? "Your Automated Trader access is active. Connect MT5, choose the instruments you allow, and manage your automated copy-trading setup."
        : "Automated copy trading for traders who want VaultTrades to monitor the market and execute according to their enabled settings.",
      href: automationHref,
      cta: automationCta,
      external: !automationActive,
    },
    baseCards[1],
    baseCards[2],
  ];

  return (
    <main style={{ minHeight: "calc(100vh - 61px)", background: "#050812", color: "#f4f6fb" }}>
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "64px 24px 76px", textAlign: "center" }}>
        <img src="/vaulttrades-logo.png" alt="VaultTrades" style={{ width: 180, maxWidth: "60vw", height: "auto", margin: "0 auto 18px" }} />
        <div style={{ color: "#d4a637", fontSize: 13, fontWeight: 800, letterSpacing: ".2em", marginBottom: 10 }}>Built by Traders.</div>
        <div style={{ color: "#aeb5c6", fontSize: 15, marginBottom: 30 }}>Focus, discipline, consistency.</div>
        <h1 style={{ maxWidth: 900, margin: "0 auto", fontSize: "clamp(40px, 6vw, 72px)", lineHeight: 1.04, letterSpacing: "-.045em" }}>Trade with a plan. Learn why the market says yes — or no.</h1>
        <p style={{ maxWidth: 720, margin: "24px auto 30px", color: "#aeb5c6", fontSize: 17, lineHeight: 1.7 }}>VaultTrades is a strategy-driven market analysis and trading education platform designed to help traders understand the conditions behind a trade — not blindly follow signals.</p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 64 }}>
          <Link href="/analyzer" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "14px 26px", borderRadius: 9, background: "#d4a637", color: "#050812", fontWeight: 800, textDecoration: "none" }}>Open Analyzer</Link>
          <a href={automationHref} target={!automationActive ? "_blank" : undefined} rel={!automationActive ? "noreferrer" : undefined} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "14px 26px", borderRadius: 9, border: "1px solid rgba(212,166,55,.45)", color: "#f4f6fb", fontWeight: 800, textDecoration: "none" }}>{automationActive ? "Open Automated Trading" : "Subscribe to Automated Trading"}</a>
        </div>

        <h2 style={{ margin: "0 0 22px", fontSize: 15, letterSpacing: ".14em", color: "#dfe3ec", fontWeight: 800 }}>EVERYTHING YOU NEED TO TRADE WITH UNDERSTANDING</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, textAlign: "left" }}>
          {cards.map((card) => (
            <article key={card.title} style={{ minHeight: 285, display: "flex", flexDirection: "column", padding: 24, borderRadius: 14, border: card.title === "AUTOMATED TRADER" ? "1px solid rgba(212,166,55,.32)" : "1px solid rgba(255,255,255,.09)", background: "linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.018))", boxShadow: "0 18px 50px rgba(0,0,0,.18)" }}>
              <div style={{ width: 34, height: 2, background: "#d4a637", marginBottom: 20 }} />
              <h3 style={{ margin: "0 0 14px", fontSize: 17, letterSpacing: ".08em" }}>{card.title}</h3>
              <p style={{ margin: 0, color: "#aeb5c6", fontSize: 14, lineHeight: 1.7 }}>{card.description}</p>
              <a href={card.href} target={card.external ? "_blank" : undefined} rel={card.external ? "noreferrer" : undefined} style={{ marginTop: "auto", paddingTop: 22, color: "#d4a637", fontSize: 13, fontWeight: 800, textDecoration: "none" }}>{card.cta} →</a>
            </article>
          ))}
        </div>

        <section style={{ marginTop: 60 }}>
          <h2 style={{ margin: "0 0 10px", fontSize: "clamp(24px, 4vw, 38px)", letterSpacing: "-.025em" }}>Built for traders who want to understand, not just follow.</h2>
          <p style={{ margin: "0 0 22px", color: "#aeb5c6" }}>Unlock the complete VaultTrades platform.</p>
          <Link href="/profile" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "14px 28px", borderRadius: 9, background: "#d4a637", color: "#050812", fontWeight: 800, textDecoration: "none" }}>Subscribe to VaultTrades</Link>
        </section>
      </section>

      <footer style={{ borderTop: "1px solid rgba(255,255,255,.08)", padding: "34px 24px 40px", color: "#7f8799", fontSize: 12, textAlign: "center" }}>
        <div style={{ color: "#f4f6fb", fontWeight: 800, letterSpacing: ".12em", marginBottom: 10 }}>VAULTTRADES</div>
        <div>Built by Traders. Focus, discipline, consistency.</div>
        <p style={{ maxWidth: 900, margin: "18px auto 10px", lineHeight: 1.7 }}><strong>Disclaimer:</strong> VaultTrades is an analytical tool designed to assist with market analysis and strategy evaluation. It does not provide financial advice, investment advice or a guarantee of trading results. Trading involves substantial risk and users remain solely responsible for their own trading decisions.</p>
        <div>© 2026 VaultTrades. All rights reserved.</div>
      </footer>
    </main>
  );
}

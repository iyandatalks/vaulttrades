"use client";

import { useState } from "react";
import Link from "next/link";

type DirectoryKey = "Broker" | "Prop Firm" | "Tool" | "VaultTrades Product";

type Partner = {
  name: string;
  category: DirectoryKey;
  description: string;
};

const partners: Partner[] = [
  {
    name: "Recommended MT5 Brokers",
    category: "Broker",
    description: "Compare recommended brokers and visit their official account-registration pages.",
  },
  {
    name: "Recommended Prop Firms",
    category: "Prop Firm",
    description: "Explore funded-account providers and review their current rules before signing up.",
  },
  {
    name: "Trading Tools",
    category: "Tool",
    description: "Explore tools that support planning, journaling and risk awareness.",
  },
  {
    name: "VaultTrades Products",
    category: "VaultTrades Product",
    description: "Browse VaultTrades trading products and mentorship services.",
  },
];

const brokers = [
  { name: "XM Broker", description: "MT4/MT5 trading accounts for forex, gold and other markets.", url: "https://www.xmza.com/referral?token=9TMOAfWroLZu69ys2-IUqg" },
  { name: "Headway", description: "MT4/MT5 broker; review the account entity and current terms for your location.", url: "https://headway.partners/user/signup?hwp=d93922" },
  { name: "JustMarkets", description: "MT4/MT5 trading accounts; available conditions depend on the account and jurisdiction.", url: "https://one.justmarkets.link/a/trea9c04a1" },
];

const propFirms = [
  { name: "Top One Trader", description: "Compare its current evaluation models and trading rules.", url: "https://toponetrader.com/?linkId=lp_148658&sourceId=sibongilesz2017gmailcom&tenantId=toponetrader" },
  { name: "Goat Funded Trader", description: "Review current challenge, funding and payout terms.", url: "https://www.goatfundedtrader.com/" },
  { name: "Blue Guardian", description: "Compare available funding models and their rules.", url: "https://blueguardian.com/?afmc=2dw1" },
];

const products = [
  { name: "Analyzer", description: "Market analysis and trade planning.", url: "/analyzer" },
  { name: "Copy Trading", description: "VaultTrades copy-trading service.", url: "/copy" },
  { name: "Mentorship", description: "One-on-one mentorship service.", url: "/founders-mentorship" },
];

const tools = [
  { name: "Trading Journal", description: "Review and record your trading activity.", url: "/journal" },
  { name: "Wealth Builder", description: "Organise your wealth-building progress.", url: "/funded-account-wealth-builder" },
  { name: "Risk Management", description: "Support more structured risk planning.", url: "/risk-manager" },
];

export default function PartnersClient() {
  const [copied, setCopied] = useState(false);
  const [activeSection, setActiveSection] = useState<DirectoryKey | null>(null);
  const shareUrl = typeof window !== "undefined" ? window.location.href : "https://vaulttradesve.com/partners";

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const share = async () => {
    if (navigator.share) {
      await navigator.share({
        title: "VaultTrades Partners",
        text: "Explore VaultTrades partners, products and tools.",
        url: shareUrl,
      });
    } else {
      await copyLink();
    }
  };

  const selectedItems =
    activeSection === "Broker" ? brokers :
    activeSection === "Prop Firm" ? propFirms :
    activeSection === "VaultTrades Product" ? products :
    activeSection === "Tool" ? tools : [];

  return (
    <main className="vt-info-page">
      <div className="vt-info-wrap" style={{ maxWidth: 1120 }}>
        <header className="vt-info-hero">
          <div className="vt-label">VAULTTRADES PARTNERS</div>
          <h1>Partners, Products & Tools</h1>
          <p>Choose a category to explore the resources you need.</p>
          <div className="vt-actions" style={{ justifyContent: "flex-start", marginTop: 20, flexWrap: "wrap" }}>
            <button className="vt-primary" onClick={() => void share()}>
              {copied ? "Link Copied" : "Share VaultTrades"}
            </button>
            <button className="vt-secondary" onClick={() => void copyLink()}>
              Copy Share Link
            </button>
          </div>
        </header>

        <section className="vt-info-card" style={{ marginTop: 24, border: "1px solid rgba(212,166,55,.35)" }}>
          <div className="vt-label">DIRECTORY</div>
          <h2 style={{ marginTop: 10 }}>Choose what you need</h2>
          <div className="vt-info-grid" style={{ marginTop: 18 }}>
            {partners.map((partner) => {
              const selected = activeSection === partner.category;
              return (
                <button
                  type="button"
                  key={partner.category}
                  className="vt-info-card"
                  onClick={() => setActiveSection(selected ? null : partner.category)}
                  aria-expanded={selected}
                  style={{
                    textAlign: "left",
                    color: "inherit",
                    cursor: "pointer",
                    border: selected ? "1px solid #d4a637" : undefined,
                    width: "100%",
                  }}
                >
                  <div className="vt-label">{partner.category.toUpperCase()}</div>
                  <h2 style={{ marginTop: 10 }}>{partner.name}</h2>
                  <p className="muted" style={{ lineHeight: 1.65 }}>{partner.description}</p>
                  <span className="vt-primary" style={{ display: "inline-block", marginTop: 8 }}>
                    {selected ? "Close ↑" : "Explore →"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {activeSection && (
          <section className="vt-info-card" style={{ marginTop: 18 }}>
            <div className="vt-label">{activeSection.toUpperCase()}</div>
            <h2 style={{ marginTop: 10 }}>
              {activeSection === "Broker" ? "Recommended MT5 Brokers" :
               activeSection === "Prop Firm" ? "Recommended Prop Firms" :
               activeSection === "VaultTrades Product" ? "VaultTrades Products" : "Trading Tools"}
            </h2>
            <div className="vt-info-grid" style={{ marginTop: 16 }}>
              {selectedItems.map((item) => (
                <article className="vt-info-card" key={item.name}>
                  <h2>{item.name}</h2>
                  <p className="muted" style={{ lineHeight: 1.65 }}>{item.description}</p>
                  {"url" in item && item.url ? (
                    <a className="vt-primary" href={item.url} style={{ display: "inline-block", marginTop: 10 }}
                      target={item.url.startsWith("http") ? "_blank" : undefined}
                      rel={item.url.startsWith("http") ? "noreferrer" : undefined}>
                      {activeSection === "VaultTrades Product" ? "View Product →" : "Visit Website →"}
                    </a>
                  ) : (
                    <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
                      Available from your VaultTrades dashboard.
                    </p>
                  )}
                </article>
              ))}
            </div>
            {(activeSection === "Broker" || activeSection === "Prop Firm") && (
              <p className="muted" style={{ marginTop: 14, marginBottom: 0 }}>
                Partner links may generate a referral benefit. Offers and account terms can change; review the provider's current terms before registering. Trading and funding outcomes are not guaranteed.
              </p>
            )}
          </section>
        )}

        <section className="vt-info-card" style={{ marginTop: 24 }}>
          <div className="vt-label">REFERRAL DISCLOSURE</div>
          <h2 style={{ marginTop: 10 }}>Partner links may contain referral tracking.</h2>
          <p className="muted" style={{ lineHeight: 1.7, marginBottom: 0 }}>
            VaultTrades may receive a referral or affiliate commission when a user signs up
            through an approved partner link. Any applicable referral code, offer or
            commercial relationship will be displayed with the relevant partner.
          </p>
        </section>
      </div>
    </main>
  );
}

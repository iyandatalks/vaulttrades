"use client";

import { useState } from "react";

type Partner = {
  name: string;
  category: "Broker" | "Prop Firm" | "Tool" | "VaultTrades Product";
  description: string;
  code?: string;
  url?: string;
};

const partners: Partner[] = [
  {
    name: "Recommended MT5 Brokers",
    category: "Broker",
    description: "Broker options selected by VaultTrades for users who need an MT5 trading account. Referral links and codes will be added by the VaultTrades team.",
  },
  {
    name: "Recommended Prop Firms",
    category: "Prop Firm",
    description: "Prop-firm options for traders evaluating funded-account programs. Referral links and codes will be added by the VaultTrades team.",
  },
  {
    name: "Trading Tools",
    category: "Tool",
    description: "Useful trading, analysis and productivity tools. Partner links will be added as they are approved.",
  },
  {
    name: "VaultTrades Products",
    category: "VaultTrades Product",
    description: "Explore VaultTrades products, services and member tools from one shareable page.",
    url: "/products",
  },
];

export default function PartnersClient() {
  const [copied, setCopied] = useState(false);
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
        text: "Explore VaultTrades recommended brokers, prop firms, trading tools and products.",
        url: shareUrl,
      });
    } else {
      await copyLink();
    }
  };

  return (
    <main className="vt-info-page">
      <div className="vt-info-wrap" style={{ maxWidth: 1120 }}>
        <header className="vt-info-hero">
          <div className="vt-label">VAULTTRADES PARTNERS</div>
          <h1>Brokers, Prop Firms, Tools & Products</h1>
          <p>
            A single shareable page for VaultTrades recommendations, partner offers,
            referral codes and useful trading resources.
          </p>
          <div className="vt-actions" style={{ justifyContent: "flex-start", marginTop: 20, flexWrap: "wrap" }}>
            <button className="vt-primary" onClick={() => void share()}>
              {copied ? "Link Copied" : "Share VaultTrades Partners"}
            </button>
            <button className="vt-secondary" onClick={() => void copyLink()}>
              Copy Share Link
            </button>
          </div>
        </header>

        <section className="vt-info-card" style={{ marginTop: 24, border: "1px solid rgba(212,166,55,.35)" }}>
          <div className="vt-label">PARTNER DIRECTORY</div>
          <h2 style={{ marginTop: 10 }}>Choose what you need</h2>
          <div className="vt-info-grid" style={{ marginTop: 18 }}>
            {partners.map((partner) => (
              <article className="vt-info-card" key={partner.category}>
                <div className="vt-label">{partner.category.toUpperCase()}</div>
                <h2 style={{ marginTop: 10 }}>{partner.name}</h2>
                <p className="muted" style={{ lineHeight: 1.65 }}>{partner.description}</p>
                {partner.url ? (
                  <a className="vt-primary" href={partner.url} style={{ display: "inline-block", marginTop: 8 }}>
                    Explore →
                  </a>
                ) : (
                  <span className="muted" style={{ display: "inline-block", marginTop: 8 }}>
                    Partner links coming soon
                  </span>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="vt-info-card" style={{ marginTop: 24 }}>
          <div className="vt-label">REFERRAL DISCLOSURE</div>
          <h2 style={{ marginTop: 10 }}>Partner links may contain referral tracking.</h2>
          <p className="muted" style={{ lineHeight: 1.7, marginBottom: 0 }}>
            VaultTrades may receive a referral or affiliate commission when a user signs up
            through an approved partner link. Any applicable referral code, offer or
            commercial relationship will be displayed with the relevant partner.
          </p>
        </section>

        <section className="vt-info-card" style={{ marginTop: 24 }}>
          <div className="vt-label">SHARE</div>
          <h2 style={{ marginTop: 10 }}>Send this page to another trader.</h2>
          <p className="muted">Share one VaultTrades link instead of sending separate broker, prop-firm and tool links.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <input
              readOnly
              value={shareUrl}
              style={{ flex: 1, minWidth: 260, padding: 13, borderRadius: 9, border: "1px solid rgba(255,255,255,.12)", background: "#050812", color: "#f4f6fb" }}
            />
            <button className="vt-primary" onClick={() => void copyLink()}>
              {copied ? "Copied" : "Copy Link"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

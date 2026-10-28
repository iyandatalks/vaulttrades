"use client";

import { useEffect, useRef, useState } from "react";

type DirectoryKey = "Broker" | "Prop Firm" | "Tool" | "VaultTrades Product";

type Partner = { name: string; category: DirectoryKey; description: string; };
type CatalogueRecord = { id: string; name: string; category: DirectoryKey; description: string; referral_url: string; referral_code: string | null; cta_text: string; };

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
  const [catalogue, setCatalogue] = useState<CatalogueRecord[]>([]);
  useEffect(() => {
    fetch("/api/partners", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load partners");
        const data = await r.json();
        setCatalogue(data.partners ?? []);
      })
      .catch(() => setCatalogue([]));
  }, []);
  const [activeSection, setActiveSection] = useState<DirectoryKey | null>(null);
  const resultsSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (activeSection) {
      resultsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [activeSection]);
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

  const selectedItems = activeSection === "Broker" || activeSection === "Prop Firm"
    ? catalogue
        .filter((item) => item.category === activeSection && Boolean(item.referral_url?.trim()))
        .map((item) => ({ ...item, url: item.referral_url }))
    : activeSection === "VaultTrades Product" ? products : activeSection === "Tool" ? tools : [];

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
          <section ref={resultsSectionRef} className="vt-info-card" style={{ marginTop: 18, scrollMarginTop: 24 }}>
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
                    <a
                      className="vt-primary"
                      href={item.url}
                      style={{ display: "inline-block", marginTop: 10 }}
                      target={item.url.startsWith("http") ? "_blank" : undefined}
                      rel={item.url.startsWith("http") ? "noopener noreferrer" : undefined}
                    >
                      {"cta_text" in item && typeof item.cta_text === "string" && item.cta_text.trim().length > 0
                        ? item.cta_text
                        : activeSection === "VaultTrades Product" ? "View Product →" : "Visit Website →"}
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

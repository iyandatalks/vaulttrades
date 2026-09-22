"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const tools = [
  ["ANALYZER", "Analyze → Confirm → Plan", "Analyze a market setup before execution.", "/analyzer", "Open Analyzer", "analyzer"],
  ["COPY", "Connect → Copy → Monitor", "Connect an MT5 account to the VaultTrades copy infrastructure and monitor its connection.", "/copy", "Open Copy", "copy"],
  ["AI COACH", "Ask → Understand → Improve", "Question the analysis, strategy conditions and trading decisions.", "/ai-coach", "Open AI Coach", "ai_coach"],
  ["JOURNAL", "Record → Review → Improve", "Keep your trading decisions and outcomes in one place.", "/journal", "Open Journal", "journal"],
  ["REFERRAL", "Share → Track → Earn", "Manage your VaultTrades referral activity.", "/referral-vault", "Open Referral", "referral"],
] as const;

type AccessResponse = { access?: Record<string, boolean>; admin?: boolean };

export default function DashboardPage() {
  const [access, setAccess] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard/access", { cache: "no-store" })
      .then(r => r.json())
      .then((data: AccessResponse) => setAccess(data.access || {}))
      .catch(() => setAccess({}))
      .finally(() => setLoaded(true));
  }, []);

  const availableTools = loaded ? tools.filter(tool => access[tool[5]] || (tool[5] === "copy" && access.automation)) : [];

  return (
    <main className="vt-info-page">
      <div className="vt-info-wrap">
        <header className="vt-info-hero">
          <div className="vt-label">VAULTTRADES WORKSPACE</div>
          <h1>Your trading process, in one place.</h1>
          <p>Analyzer remains the discretionary analysis workspace. Copy is the separate MT5 execution product.</p>
        </header>
        <section className="vt-start vt-info-card" style={{ textAlign: "left", marginBottom: 24 }}>
          <div className="vt-label">WORKSPACE ACCESS</div>
          <h2 style={{ margin: "10px 0 8px", fontSize: 27 }}>{loaded ? availableTools.length + " tools available" : "Loading your tools..."}</h2>
          <p style={{ maxWidth: 760 }}>Only products included in your VaultTrades entitlement are shown.</p>
          <div className="vt-actions" style={{ justifyContent: "flex-start" }}><Link className="vt-secondary" href="/how-it-works">How It Works</Link></div>
        </section>
        <section className="vt-info-grid">
          {availableTools.map(([title, flow, description, href, action]) => (
            <article className="vt-info-card" key={title}>
              <div className="vt-number">{flow}</div>
              <h2>{title}</h2>
              <p>{description}</p>
              <Link className="vt-text-link" style={{ display: "inline-block", marginTop: 18 }} href={href}>{action} →</Link>
            </article>
          ))}
          {loaded && availableTools.length === 0 && <article className="vt-info-card"><h2>No workspace tools yet</h2><p>Once access is granted, the relevant VaultTrades tools will appear here.</p></article>}
        </section>
      </div>
    </main>
  );
}
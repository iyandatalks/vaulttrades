"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type BrokerPartner = { id: string; name: string };

export default function CopyPage() {
  const [signedIn, setSignedIn] = useState(false);
  const [hasCopyAccess, setHasCopyAccess] = useState(false);
  const [connected, setConnected] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [brokerPartners, setBrokerPartners] = useState<BrokerPartner[]>([]);
  const [brokerPartnerId, setBrokerPartnerId] = useState("");
  const [brokerUserId, setBrokerUserId] = useState("");
  const [brokerReferralBusy, setBrokerReferralBusy] = useState(false);
  const [brokerReferralMessage, setBrokerReferralMessage] = useState("");

  useEffect(() => {
    fetch("/api/copy/status", { cache: "no-store" })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) return;
        setSignedIn(true);
        setHasCopyAccess(d.subscriptionActive === true);
        setConnected(Boolean(d.connected));
        setStatusText(d.accessUntil ? `Access until ${new Date(d.accessUntil).toLocaleDateString()}` : (d.subscriptionActive ? "Copy Trading access is active." : ""));
      })
      .catch(() => undefined);

    fetch("/api/copy/partner-referral", { cache: "no-store" })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) return;
        setSignedIn(true);
        setBrokerPartners(d.partners || []);
        if (d.referral) {
          setBrokerPartnerId(d.referral.broker_referral_partner_id || "");
          setBrokerUserId(d.referral.broker_referral_user_id || "");
          setBrokerReferralMessage("Your broker User ID is already submitted. You can update it below if needed.");
        }
      })
      .catch(() => undefined);
  }, []);

  async function submitBrokerReferral() {
    setBrokerReferralBusy(true);
    setBrokerReferralMessage("");
    try {
      const r = await fetch("/api/copy/partner-referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId: brokerPartnerId, brokerUserId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || d.error || "Could not submit broker ID.");
      setBrokerReferralMessage(d.message || "Broker ID submitted.");
    } catch (error) {
      setBrokerReferralMessage(error instanceof Error ? error.message : "Could not submit broker ID.");
    } finally {
      setBrokerReferralBusy(false);
    }
  }

  return (
    <main className="vt-info-page">
      <div className="vt-info-wrap">
        <header className="vt-info-hero">
          <div className="vt-label">VAULTTRADES COPY TRADING</div>
          <h1>VaultTrades Copy Trading</h1>
          <p>Explore the Copy Trading service and recommended brokers. MT5 connection tools and subscriber-only instructions remain locked until your Copy Trading access is activated by purchase or an administrator.</p>
          {!hasCopyAccess && <div className="vt-actions" style={{ justifyContent: "flex-start", marginTop: 20 }}>
            <Link className="vt-primary" href="/products?product=copy">View Copy Trading Subscription</Link>
            {!signedIn && <Link className="vt-secondary" href="/auth/login?next=/copy">Sign in / Create account</Link>}
          </div>}
        </header>

        <section className="vt-info-card" style={{ marginTop: 24, border: "1px solid rgba(212,166,55,.35)" }}>
          <div className="vt-label">RECOMMENDED BROKER REGISTRATION</div>
          <h2 style={{ marginTop: 10 }}>Submit your broker User ID</h2>
          <p>Already created a VaultTrades profile and registered with a recommended broker? Submit the User ID shown in your broker client portal or report. This is separate from your MT5 trading account number. You do not need an active Copy Trading subscription to submit it.</p>
          {signedIn ? <>
            <form onSubmit={(e) => { e.preventDefault(); void submitBrokerReferral(); }} style={{ display: "grid", gap: 12, marginTop: 14 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span>Recommended broker</span>
                <select required value={brokerPartnerId} onChange={e => setBrokerPartnerId(e.target.value)} style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid rgba(212,166,55,.35)", background: "#050812", color: "#f4f6fb" }}>
                  <option value="">Select broker</option>
                  {brokerPartners.map(partner => <option key={partner.id} value={partner.id}>{partner.name}</option>)}
                </select>
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span>Broker User ID (not your MT5 login)</span>
                <input required maxLength={120} value={brokerUserId} onChange={e => setBrokerUserId(e.target.value)} placeholder="Enter the User ID shown by your broker" style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid rgba(212,166,55,.35)", background: "#050812", color: "#f4f6fb" }} />
              </label>
              <div><button className="vt-primary" type="submit" disabled={brokerReferralBusy || !brokerPartnerId || !brokerUserId.trim()}>{brokerReferralBusy ? "Submitting…" : "Submit Broker User ID"}</button></div>
            </form>
            {brokerReferralMessage && <p role="status" style={{ marginBottom: 0, marginTop: 12 }}>{brokerReferralMessage}</p>}
            {brokerPartners.length === 0 && <p className="muted">No published broker partners are available yet. Please try again later.</p>}
          </> : <p style={{ marginTop: 14 }}><Link className="vt-primary" href="/auth/login?next=/copy">Sign in or create a profile to submit your Broker User ID</Link></p>}
        </section>

        {hasCopyAccess ? <>
          <section className="vt-info-card" style={{ marginTop: 24, border: "1px solid rgba(212,166,55,.35)" }}>
            <div className="vt-label">SUBSCRIBER ACCESS</div>
            <h2 style={{ marginTop: 10 }}>Your Copy Trading access is active.</h2>
            <p>{statusText || "Your Copy Trading entitlement is active."}</p>
            <p>Manage your MT5 connection and review connection status from the subscriber controls below.</p>
            <div className="vt-actions" style={{ justifyContent: "flex-start", marginTop: 14 }}>
              <Link className="vt-primary" href="/copy/connect">{connected ? "Manage MT5 Connection" : "Start MT5 Connection"}</Link>
              <Link className="vt-secondary" href="/how-it-works">How Copy Trading Works</Link>
            </div>
            <p style={{ marginTop: 12 }}><Link href="/copy/connect">View Connection Status →</Link></p>
          </section>
          <section className="vt-info-grid" style={{ marginTop: 24 }}>
            <article className="vt-info-card"><div className="vt-label">COPY TRADING FLOW</div><h2>VaultTrades master → Your MT5</h2><p>VaultTrades publishes eligible master-account executions. Your Copier EA receives the instructions and places corresponding trades on your connected MT5 account.</p></article>
            <article className="vt-info-card"><div className="vt-label">IMPORTANT</div><h2>Trading risk</h2><p>Copy Trading involves financial risk. Past trading results do not guarantee future results. Keep control of your broker account and risk exposure.</p></article>
          </section>
        </> : <section className="vt-info-card" style={{ marginTop: 24 }}>
          <div className="vt-label">SUBSCRIBER FEATURES LOCKED</div>
          <h2 style={{ marginTop: 10 }}>MT5 connection access is not active</h2>
          <p>Before purchasing a Copy Trading subscription or receiving an administrator grant, you can browse this page and submit your broker User ID only. MT5 connection management, connection status and subscriber instructions are unavailable.</p>
          <Link className="vt-primary" href="/products?product=copy">Purchase Copy Trading Access</Link>
        </section>}
      </div>
    </main>
  );
}

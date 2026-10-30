"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type BrokerPartner = { id: string; name: string };

export default function CopyPage() {
  const [signedIn, setSignedIn] = useState(false);
  const [hasCopyAccess, setHasCopyAccess] = useState(false);
  const [statusAccounts, setStatusAccounts] = useState<NonNullable<Status["accounts"]>>([]);
  const [statusMasters, setStatusMasters] = useState<NonNullable<Status["masters"]>>([]);
  const [statusLinks, setStatusLinks] = useState<NonNullable<Status["links"]>>([]);
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
        setStatusAccounts(d.accounts || (d.account ? [d.account] : []));
        setStatusMasters(d.masters || []);
        setStatusLinks(d.links || []);
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

        {hasCopyAccess ? (
          <section className="vt-copy-dashboard" style={{ marginTop: 26 }}>
            <header className="vt-copy-dashboard-head">
              <div><div className="vt-label">VAULTTRADES · LIVE COPY NETWORK</div><h2>Trade Copier</h2><p>Monitor the master publisher and MT5 accounts receiving copied trades.</p></div>
              <div className="vt-copy-access-pill"><span /> Copy access active</div>
            </header>
            <div className="vt-copy-summary">
              <div className="vt-copy-stat"><span>RECEIVING ACCOUNTS</span><strong>{statusAccounts.length}</strong><small>Registered to your profile</small></div>
              <div className="vt-copy-stat"><span>ACTIVE COPIERS</span><strong>{statusAccounts.filter(a => a.status === "online" && a.copy_enabled && a.license_status === "active").length}</strong><small>Online and enabled</small></div>
              <div className="vt-copy-stat"><span>ACCOUNT CONNECTIONS</span><strong>{statusAccounts.length} in use</strong><small>Based on your registered MT5 connections</small></div>
            </div>
            {statusMasters.length === 0 ? <div className="vt-copy-empty"><strong>Master publisher is not currently reporting.</strong><p>Your Copy Trading access is active. Publisher details will appear here when the master connection is available.</p></div> :
              statusMasters.map(master => {
                const linked = statusAccounts.filter(account => statusLinks.some(link => link.master_id === master.id && link.follower_id === account.id));
                const receivers = linked.length ? linked : (statusMasters.length === 1 ? statusAccounts : []);
                const masterOnline = master.status === "online";
                return <article className="vt-copy-master-card" key={master.id}>
                  <div className="vt-copy-master-top"><div><div className="vt-copy-kicker">COPY FROM</div><h3>{master.name || "VaultTrades Master Publisher"}{master.mt_login ? ` — ${master.mt_login}` : ""}</h3><p>{master.broker_server || "MetaTrader 5 Publisher"}{master.ea_version ? ` · Publisher ${master.ea_version}` : ""}</p></div><span className={`vt-copy-status ${masterOnline ? "is-online" : "is-offline"}`}><i />{masterOnline ? "Publisher online" : "Publisher offline"}</span></div>
                  <div className="vt-copy-receiver-count">{receivers.length} receiving {receivers.length === 1 ? "account" : "accounts"}</div>
                  {receivers.length === 0 ? <div className="vt-copy-no-receivers">No receiving MT5 account is linked to this publisher yet.</div> : receivers.map(account => {
                    const copying = account.status === "online" && account.copy_enabled === true && account.license_status === "active";
                    const paused = account.copy_enabled === false && account.license_status === "active";
                    const state = copying ? "Copying" : paused ? "Paused" : account.status === "online" ? (account.license_status || "Not active") : "Waiting for MT5";
                    const link = statusLinks.find(item => item.master_id === master.id && item.follower_id === account.id);
                    return <div className="vt-copy-follower" key={account.id}>
                      <div className="vt-copy-branch">↳</div><div className="vt-copy-follower-main">
                        <div className="vt-copy-follower-title">{account.broker_server || "MT5 receiving account"} — {account.mt_login}</div>
                        <div className="vt-copy-follower-meta">MetaTrader 5{link?.lot_mode ? ` · ${link.lot_mode}` : ""}{link?.lot_value ? ` · ${link.lot_value} lot` : ""}</div>
                        <div className="vt-copy-follower-actions"><Link href="/copy/connect" className="vt-copy-action">⚙ Settings</Link><span className="vt-copy-heartbeat">Last heartbeat: {account.last_heartbeat_at ? new Date(account.last_heartbeat_at).toLocaleString() : "Not received"}</span></div>
                      </div><span className={`vt-copy-status ${copying ? "is-online" : paused ? "is-paused" : "is-offline"}`}><i />{state}</span>
                    </div>;
                  })}
                </article>;
              })}
            <div className="vt-copy-dashboard-footer"><span>Copy execution is controlled by your MT5 Copier and VaultTrades license.</span><Link href="/copy/connect" className="vt-primary">Manage MT5 connection</Link></div>
            <div className="vt-info-grid" style={{ marginTop: 18 }}>
              <article className="vt-info-card"><div className="vt-label">COPY TRADING FLOW</div><h2>Master publisher → Receiving MT5 accounts</h2><p>VaultTrades publishes eligible master-account executions. Your Copier EA receives the instructions and places corresponding trades on your connected MT5 account.</p></article>
              <article className="vt-info-card"><div className="vt-label">IMPORTANT</div><h2>Trading risk</h2><p>Copy Trading involves financial risk. Past trading results do not guarantee future results. Keep control of your broker account and risk exposure.</p></article>
            </div>
          </section>
        ) : <section className="vt-info-card" style={{ marginTop: 24 }}>
          <div className="vt-label">SUBSCRIBER FEATURES LOCKED</div><h2 style={{ marginTop: 10 }}>MT5 connection access is not active</h2>
          <p>Before purchasing a Copy Trading subscription or receiving an administrator grant, you can browse this page and submit your broker User ID only. MT5 connection management, connection status and subscriber instructions are unavailable.</p>
          <Link className="vt-primary" href="/products?product=copy">Purchase Copy Trading Access</Link>
        </section>}
      </div>
    </main>
  );
}

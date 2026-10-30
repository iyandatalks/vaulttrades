"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type BrokerPartner = { id: string; name: string };
type FollowerAccount = {
  id: string; mt_login: string; broker_server?: string | null; status: string;
  copy_enabled: boolean; ea_version?: string | null; last_heartbeat_at?: string | null;
  license_status?: string | null; license_expires_at?: string | null;
  execution_summary?: { total: number; executed: number; failed: number; pending: number; last_error_code?: string | null; last_error_message?: string | null; last_updated_at?: string | null };
};

export default function CopyPage() {
  const [signedIn, setSignedIn] = useState(false);
  const [hasCopyAccess, setHasCopyAccess] = useState(false);
  const [statusAccounts, setStatusAccounts] = useState<FollowerAccount[]>([]);
  const [copyControlBusy, setCopyControlBusy] = useState("");
  const [copyControlMessage, setCopyControlMessage] = useState("");
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

  async function toggleCopying(account: FollowerAccount, enabled: boolean) {
    setCopyControlBusy(account.mt_login);
    setCopyControlMessage("");
    try {
      const response = await fetch("/api/copy/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mt5Login: account.mt_login, enabled }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || result.error || "Unable to update copy status.");
      setStatusAccounts(current => current.map(item =>
        item.mt_login === account.mt_login ? { ...item, copy_enabled: enabled } : item
      ));
      setCopyControlMessage(result.message || (enabled ? "Copying resumed." : "Copying stopped."));
    } catch (error) {
      setCopyControlMessage(error instanceof Error ? error.message : "Unable to update copy status.");
    } finally {
      setCopyControlBusy("");
    }
  }

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
              <div><div className="vt-label">VAULTTRADES · LIVE COPY NETWORK</div><h2>Trade Copier</h2><p>Live MT5 connection and execution status reported through the existing Copier communication.</p></div>
              <div className="vt-copy-access-pill"><span /> Copy access active</div>
            </header>
            <div className="vt-copy-summary">
              <div className="vt-copy-stat"><span>REGISTERED COPIERS</span><strong>{statusAccounts.length}</strong><small>MT5 accounts on this profile</small></div>
              <div className="vt-copy-stat"><span>COPYING ENABLED</span><strong>{statusAccounts.filter(a => a.copy_enabled && a.license_status === "active").length}</strong><small>License active and copying switched on</small></div>
              <div className="vt-copy-stat"><span>EXECUTIONS SUCCESSFUL</span><strong>{statusAccounts.reduce((n,a) => n + (a.execution_summary?.executed || 0),0)}</strong><small>{statusAccounts.reduce((n,a) => n + (a.execution_summary?.failed || 0),0)} failed in recorded history</small></div>
            </div>
            {copyControlMessage && <div role="status" className="vt-copy-control-message">{copyControlMessage}</div>}
            {statusAccounts.length === 0 ? <div className="vt-copy-empty"><strong>No activated MT5 Copier account found.</strong><p>Register and pair your MT5 account to display its live status here.</p><Link className="vt-primary" href="/copy/connect">Connect MT5 account</Link></div> :
              statusAccounts.map(account => {
                const connected = account.status === "online";
                const licenseActive = account.license_status === "active";
                const enabled = account.copy_enabled === true && licenseActive;
                const stats = account.execution_summary;
                const hasExecutionFailure = !!stats && stats.failed > 0 && stats.executed === 0;
                return <article className="vt-copy-master-card" key={account.id}>
                  <div className="vt-copy-master-top">
                    <div><div className="vt-copy-kicker">MT5 RECEIVING ACCOUNT</div><h3>{account.broker_server || "MetaTrader 5"} — {account.mt_login}</h3><p>MetaTrader 5{account.ea_version ? ` · Copier v${account.ea_version}` : ""}</p></div>
                    <span className={`vt-copy-status ${connected ? "is-online" : "is-offline"}`}><i />{connected ? "Heartbeat online" : "Connection offline"}</span>
                  </div>
                  <div className="vt-copy-follower" style={{ marginTop: 14 }}>
                    <div className="vt-copy-follower-main">
                      <div className="vt-copy-follower-title">Copy execution</div>
                      <div className="vt-copy-follower-meta">License: {account.license_status || "Unknown"} · Copy switch: {enabled ? "ON" : "OFF"}</div>
                      <div className="vt-copy-follower-actions">
                        <span className={`vt-copy-status ${hasExecutionFailure ? "is-offline" : enabled ? "is-online" : "is-paused"}`}><i />{hasExecutionFailure ? "Execution failures recorded" : enabled ? "Copying enabled" : "Copying stopped"}</span>
                        <span className="vt-copy-heartbeat">Last heartbeat: {account.last_heartbeat_at ? new Date(account.last_heartbeat_at).toLocaleString() : "Not received"}</span>
                      </div>
                      {stats && stats.total > 0 && <div className="vt-copy-execution-line">Executed: {stats.executed} · Failed: {stats.failed} · Pending: {stats.pending}</div>}
                      {hasExecutionFailure && <div className="vt-copy-execution-error"><strong>{stats?.last_error_code || "Execution error"}</strong>: {stats?.last_error_message || "The last recorded copy execution failed."}</div>}
                    </div>
                    <div className="vt-copy-control-actions">
                      <Link href="/copy/connect" className="vt-copy-action">⚙ Settings</Link>
                      <button type="button" className={enabled ? "vt-copy-stop-button" : "vt-copy-resume-button"} onClick={() => void toggleCopying(account, !enabled)} disabled={copyControlBusy === account.mt_login || (!enabled && !licenseActive)}>
                        {copyControlBusy === account.mt_login ? "Updating…" : enabled ? "■ Stop copying" : "▶ Resume copying"}
                      </button>
                    </div>
                  </div>
                </article>;
              })}
            <div className="vt-copy-dashboard-footer"><span>Stop copying prevents new trade commands from being delivered on the next MT5 poll. It does not close existing MT5 positions.</span><Link href="/copy/connect" className="vt-primary">Manage MT5 connection</Link></div>
            <div className="vt-info-grid" style={{ marginTop: 18 }}>
              <article className="vt-info-card"><div className="vt-label">CONNECTION VS EXECUTION</div><h2>Heartbeat is not trade confirmation</h2><p>An online heartbeat confirms that the Copier is communicating with VaultTrades. Successful execution is tracked separately from the trade acknowledgements sent by MT5.</p></article>
              <article className="vt-info-card"><div className="vt-label">IMPORTANT</div><h2>Trading risk</h2><p>Stopping copying prevents new copied commands; it does not automatically close trades already open in the receiving MT5 account.</p></article>
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

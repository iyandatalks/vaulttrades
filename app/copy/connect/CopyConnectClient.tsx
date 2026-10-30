"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Status = {
  connected?: boolean;
  subscriptionActive?: boolean;
  accessUntil?: string | null;
  account?: {
    mt_login?: string;
    broker_server?: string;
    status?: string;
    copy_enabled?: boolean;
    ea_version?: string | null;
    last_heartbeat_at?: string | null;
    license_status?: string;
    license_expires_at?: string | null;
    license_generation?: number;
  } | null;
  pairing?: { available?: boolean; reason?: string; expiresAt?: string | null; redeemed?: boolean };
  registeredMt5Accounts?: { mt5_login: string; email?: string; created_at?: string; updated_at?: string }[];
  error?: string;
};

export default function CopyConnectPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [pairingCode, setPairingCode] = useState("");
  const [pairingExpires, setPairingExpires] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedMt5, setSelectedMt5] = useState("");
  const [mt5LoginInput, setMt5LoginInput] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const [mt5Submitted, setMt5Submitted] = useState(false);

  const load = async () => {
    const r = await fetch("/api/copy/status", { cache: "no-store" });
    const d = await r.json();
    if (!r.ok || d.subscriptionActive !== true) {
      window.location.replace("/products?product=copy");
      return;
    }
    setStatus(d);
    if (!selectedMt5 && d.registeredMt5Accounts?.[0]?.mt5_login) {
      setSelectedMt5(d.registeredMt5Accounts[0].mt5_login);
    }
    if (!mt5LoginInput && d.registeredMt5Accounts?.[0]?.mt5_login) {
      setMt5LoginInput(d.registeredMt5Accounts[0].mt5_login);
    }
  };

  useEffect(() => { void load().catch(() => window.location.replace("/products?product=copy")); }, []);

  const submitMt5Account = async () => {
    const mt5Login = mt5LoginInput.trim();
    if (!/^\d{4,12}$/.test(mt5Login)) {
      setMessage("Enter a valid MT5 account number (4–12 digits).");
      return;
    }
    setAccountBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/copy/register-mt5", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mt5Login }),
      });
      const d = await r.json();
      if (!r.ok) {
        setMessage(d.message || d.error || "Unable to register this MT5 account.");
        return;
      }
      setSelectedMt5(mt5Login);
      setMt5Submitted(true);
      setMessage(d.message || "MT5 account registered.");
      await load();
    } catch {
      setMessage("Unable to register this MT5 account. Please try again.");
    } finally {
      setAccountBusy(false);
    }
  };

  const generate = async () => {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/copy/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mt5Login: selectedMt5 }),
      });
      const d = await r.json();
      if (!r.ok) {
        setMessage(d.message || d.error || "Unable to generate a pairing code.");
        return;
      }
      setPairingCode(d.pairingCode || "");
      setPairingExpires(d.expiresAt || "");
      await load();
    } catch {
      setMessage("Unable to generate a pairing code. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const account = status?.account;
  const registeredSelected = !!selectedMt5 && !!status?.registeredMt5Accounts?.some(item => item.mt5_login === selectedMt5);
  const showMt5Requirement = mt5Submitted || registeredSelected;

  return (
    <main className="vt-info-page">
      <div className="vt-info-wrap" style={{ maxWidth: 900 }}>
        <header className="vt-info-hero">
          <div className="vt-label">VAULTTRADES COPY · MT5</div>
          <h1>Connect your MT5 account.</h1>
          <p>One VaultTrades Copy subscription authorizes one active Copier connection.</p>
        </header>

        <section className="vt-info-card">
          <div className="vt-label">YOUR ACCESS</div>
          <div className="vt-info-grid" style={{ marginTop: 14 }}>
            <article className="vt-info-card"><strong>Subscription</strong><p>{status?.subscriptionActive ? "ACTIVE" : "INACTIVE"}</p></article>
            <article className="vt-info-card"><strong>Access Until</strong><p>{status?.accessUntil ? new Date(status.accessUntil).toLocaleString() : "—"}</p></article>
            <article className="vt-info-card"><strong>Copier License</strong><p>{account?.license_status || (status?.connected ? "ACTIVE" : "NOT ACTIVATED")}</p></article>
          </div>
        </section>

        <section className="vt-info-card" style={{ marginTop: 20 }}>
          <div className="vt-label">REGISTER MT5 ACCOUNT</div>
          <h2 style={{ marginTop: 10 }}>Submit the MT5 account covered by your access.</h2>
          <p>Enter the numeric MT5 login shown in your broker's MT5 terminal. This registration is available only while your Copy Trading access is active.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginTop: 12 }}>
            <input
              inputMode="numeric"
              autoComplete="off"
              value={mt5LoginInput}
              onChange={(e) => { setMt5LoginInput(e.target.value.replace(/\D/g, "").slice(0, 12)); setMt5Submitted(false); }}
              placeholder="MT5 account number"
              aria-label="MT5 account number"
              style={{ width: "100%", maxWidth: 300, padding: "12px 13px", borderRadius: 8, border: "1px solid rgba(212,166,55,.35)", background: "#050812", color: "#f4f6fb" }}
            />
            <button className="vt-primary" type="button" onClick={() => void submitMt5Account()} disabled={accountBusy || !/^\d{4,12}$/.test(mt5LoginInput.trim())}>
              {accountBusy ? "Submitting…" : "Submit MT5 Account"}
            </button>
          </div>
          <p className="muted" style={{ marginTop: 10 }}>Each subscription is bound to one registered MT5 account. A second account requires a separate subscription.</p>
          {(status?.registeredMt5Accounts?.length || 0) > 0 && (
            <div style={{ marginTop: 14 }}>
              <label htmlFor="copy-mt5-account">Registered account for pairing</label>
              <select id="copy-mt5-account" value={selectedMt5} onChange={(e) => { setSelectedMt5(e.target.value); setMt5Submitted(false); }} style={{ display: "block", width: "100%", maxWidth: 420, marginTop: 8, padding: "12px 13px", borderRadius: 8, border: "1px solid rgba(212,166,55,.35)", background: "#050812", color: "#f4f6fb" }}>
                <option value="">Select registered MT5 account</option>
                {(status?.registeredMt5Accounts || []).map(item => <option key={item.mt5_login} value={item.mt5_login}>{item.mt5_login}</option>)}
              </select>
            </div>
          )}
        </section>

        {showMt5Requirement && (
          <section className="vt-info-card" style={{ marginTop: 20 }}>
            <div className="vt-label">MT5 REQUIREMENT</div>
            <h2 style={{ marginTop: 10 }}>Windows MT5 desktop or Windows VPS</h2>
            <p>Install your broker's MT5 desktop terminal, keep it connected, enable Algo Trading, and attach the VaultTrades Copier EA to a chart.</p>
            {registeredSelected ? (
              <a className="vt-primary" href={`/api/copy/download?mt5Login=${encodeURIComponent(selectedMt5)}`} style={{ display: "inline-block", marginTop: 8 }}>
                Download VaultTrades Copier (.ex5)
              </a>
            ) : (
              <p className="muted" style={{ marginTop: 10 }}>Select the registered MT5 account to unlock the Copier download.</p>
            )}
            <p className="muted" style={{ marginTop: 10 }}>Copier v1.22</p>
          </section>
        )}

        <section className="vt-info-card" style={{ marginTop: 20 }}>
          <div className="vt-label">CONNECT</div>
          <h2 style={{ marginTop: 10 }}>Generate your one-time subscription pairing code.</h2>
          <p>The code is valid for up to <strong>24 hours</strong>, but never beyond your subscription expiry. Once activated, the Copier license remains valid only until your subscription expires.</p>
          <button className="vt-primary" onClick={() => void generate()} disabled={busy || !selectedMt5 || !registeredSelected || status?.pairing?.available === false} style={{ marginTop: 8 }}>
            {busy ? "Generating…" : "Generate Pairing Code"}
          </button>
          {pairingCode && (
            <div style={{ marginTop: 16, padding: 18, borderRadius: 12, background: "#050812", border: "1px solid rgba(212,166,55,.35)", textAlign: "center" }}>
              <div className="vt-label">ENTER IN MT5 · InpPairingCode</div>
              <div style={{ marginTop: 8, fontSize: 30, fontWeight: 900, letterSpacing: ".12em", color: "#d4a637" }}>{pairingCode}</div>
              <p className="muted">Expires {pairingExpires ? new Date(pairingExpires).toLocaleString() : "within 24 hours"}.</p>
            </div>
          )}
          {message && (
            <div style={{ marginTop: 14, color: "#ffcf8a" }}>
              {message}{" "}
              <Link className="vt-text-link" href="/copy/support">Open in-app support</Link>
            </div>
          )}
        </section>

        <section className="vt-info-card" style={{ marginTop: 20 }}>
          <div className="vt-label">CONNECTION STATUS</div>
          <h2 style={{ marginTop: 10 }}>{status?.connected ? "CONNECTED" : "NOT CONNECTED"}</h2>
          <p>MT5 Account: <strong>{account?.mt_login || "—"}</strong></p>
          <p>Broker Server: <strong>{account?.broker_server || "—"}</strong></p>
          <p>EA Version: <strong>{account?.ea_version || "—"}</strong></p>
          <p>License: <strong>{account?.license_status || "—"}</strong></p>
          <p>Copy Status: <strong>{account?.copy_enabled === true ? "ENABLED" : "DISABLED"}</strong></p>
          <p>Access Until: <strong>{account?.license_expires_at
            ? new Date(account.license_expires_at).toLocaleString()
            : status?.accessUntil
              ? new Date(status.accessUntil).toLocaleString()
              : account?.license_status === "active"
                ? "No expiry (admin access)"
                : "—"}</strong></p>
          <p>Last Heartbeat: <strong>{account?.last_heartbeat_at ? new Date(account.last_heartbeat_at).toLocaleString() : "—"}</strong></p>
          <p>Latest response: <strong>{status?.connected ? "CONNECTED / HEARTBEAT ONLINE" : "WAITING FOR MT5 COPIER"}</strong></p>
        </section>

        <section className="vt-info-card" style={{ marginTop: 20 }}>
          <div className="vt-label">BROKER COMPATIBILITY</div>
          <p>MT5 compatibility is verified against the specific broker server, account type and instrument symbol. An online heartbeat alone does not confirm successful trade execution.</p>
        </section>

        <p style={{ marginTop: 18 }}>
          <Link className="vt-text-link" href="/copy/support">Need an activation reset? Use in-app support →</Link>
        </p>
      </div>
    </main>
  );
}

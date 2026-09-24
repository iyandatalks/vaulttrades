"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Status = {
  connected?: boolean;
  subscriptionActive?: boolean;
  accessUntil?: string | null;
  account?: { login?: string; server?: string; status?: string; license_status?: string; license_expires_at?: string | null; license_generation?: number } | null;
  pairing?: { available?: boolean; reason?: string; expiresAt?: string | null; redeemed?: boolean };
  error?: string;
};

export default function CopyConnectPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [pairingCode, setPairingCode] = useState("");
  const [pairingExpires, setPairingExpires] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    const r = await fetch("/api/copy/status", { cache: "no-store" });
    const d = await r.json();
    if (!r.ok || d.subscriptionActive !== true) {
      window.location.replace("/products?product=copy");
      return;
    }
    setStatus(d);
  };

  useEffect(() => { void load().catch(() => window.location.replace("/products?product=copy")); }, []);

  const generate = async () => {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/copy/pair", { method: "POST" });
      const d = await r.json();
      if (!r.ok) {
        setMessage(d.message || d.error || "Unable to generate a pairing code.");
        return;
      }
      setPairingCode(d.pairingCode || "");
      setPairingExpires(d.expiresAt || "");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const account = status?.account;

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
          <div className="vt-label">MT5 REQUIREMENT</div>
          <h2 style={{ marginTop: 10 }}>Windows MT5 desktop or Windows VPS</h2>
          <p>Install your broker's MT5 desktop terminal, keep it connected, enable Algo Trading, and attach the VaultTrades Copier EA to a chart.</p>
          <a className="vt-primary" href="/downloads/VaultTrades_Copier.ex5" download="VaultTrades_Copier.ex5" style={{ display:"inline-block", marginTop: 8 }}>
            Download VaultTrades Copier (.ex5)
          </a>
          <p className="muted" style={{ marginTop: 10 }}>Copier v1.10</p>
        </section>

        <section className="vt-info-card" style={{ marginTop: 20 }}>
          <div className="vt-label">CONNECT</div>
          <h2 style={{ marginTop: 10 }}>Generate your one-time subscription pairing code.</h2>
          <p>The code is valid for up to <strong>24 hours</strong>, but never beyond your subscription expiry. Once activated, the Copier license remains valid only until your subscription expires.</p>
          <button className="vt-primary" onClick={() => void generate()} disabled={busy || status?.pairing?.available === false} style={{ marginTop: 8 }}>
            {busy ? "Generating…" : "Generate Pairing Code"}
          </button>
          {pairingCode && (
            <div style={{ marginTop:16, padding:18, borderRadius:12, background:"#050812", border:"1px solid rgba(212,166,55,.35)", textAlign:"center" }}>
              <div className="vt-label">ENTER IN MT5 · InpPairingCode</div>
              <div style={{ marginTop:8, fontSize:30, fontWeight:900, letterSpacing:".12em", color:"#d4a637" }}>{pairingCode}</div>
              <p className="muted">Expires {pairingExpires ? new Date(pairingExpires).toLocaleString() : "within 24 hours"}.</p>
            </div>
          )}
          {message && (
            <div style={{ marginTop:14, color:"#ffcf8a" }}>
              {message}{" "}
              <Link className="vt-text-link" href="/copy/support">Open in-app support</Link>
            </div>
          )}
        </section>

        <section className="vt-info-card" style={{ marginTop: 20 }}>
          <div className="vt-label">CONNECTION STATUS</div>
          <h2 style={{ marginTop: 10 }}>{status?.connected ? "CONNECTED" : "NOT CONNECTED"}</h2>
          <p>MT5 Account: <strong>{account?.login || "—"}</strong></p>
          <p>Broker Server: <strong>{account?.server || "—"}</strong></p>
          <p>License: <strong>{account?.license_status || "—"}</strong></p>
          <p>Access Until: <strong>{account?.license_expires_at ? new Date(account.license_expires_at).toLocaleString() : (status?.accessUntil ? new Date(status.accessUntil).toLocaleString() : "—")}</strong></p>
          <p>Latest response: <strong>{status?.connected ? "CONNECTED / HEARTBEAT ONLINE" : "WAITING FOR MT5 COPIER"}</strong></p>
        </section>

        <section className="vt-info-card" style={{ marginTop: 20 }}>
          <div className="vt-label">TESTED MT5 BROKERS</div>
          <p style={{ marginBottom: 8 }}>VaultTrades has tested the Copier in MT5 environments with:</p>
          <p><strong>XM · Headway · [third tested broker]</strong></p>
          <p className="muted">Other MT5 brokers may work, but have not necessarily been tested by VaultTrades.</p>
        </section>

        <p style={{ marginTop:18 }}>
          <Link className="vt-text-link" href="/copy/support">Need an activation reset? Use in-app support →</Link>
        </p>
      </div>
    </main>
  );
}

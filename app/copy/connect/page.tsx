"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Status = { connected?: boolean; account?: { login?: string; server?: string; status?: string } | null; error?: string };

export default function CopyConnectPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [pairingCode, setPairingCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/copy/status", { cache: "no-store" })
      .then(r => r.json())
      .then(setStatus)
      .catch(() => setStatus({ error: "Unable to load copy connection status." }));
  }, []);

  const generate = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/copy/pair", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Unable to create pairing code.");
      setPairingCode(d.pairingCode || "");
    } catch (e) {
      setStatus({ error: e instanceof Error ? e.message : "Unable to create pairing code." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="vt-info-page">
      <div className="vt-info-wrap">
        <header className="vt-info-hero">
          <div className="vt-label">VAULTTRADES COPY · MT5 CONNECTION</div>
          <h1>Connect your MT5 account.</h1>
          <p>
            Install the VaultTrades Copier EA in MT5, generate a pairing code here, and enter
            that code in the EA. The connection is designed around an outbound VaultTrades
            connection rather than TradingView webhooks.
          </p>
        </header>

        <section className="vt-info-card">
          <div className="vt-label">PAIRING</div>
          <h2 style={{ marginTop: 10 }}>Generate a pairing code</h2>
          <p>The code authorizes the Copier EA to receive copy instructions for your account. Never share your MT5 trading password with VaultTrades.</p>
          <button className="vt-primary" onClick={() => void generate()} disabled={busy} style={{ marginTop: 14 }}>
            {busy ? "Generating…" : "Generate Pairing Code"}
          </button>
          {pairingCode && (
            <div style={{ marginTop: 18, padding: 20, borderRadius: 12, background: "#050812", border: "1px solid rgba(212,166,55,.35)", textAlign: "center" }}>
              <div className="vt-label">PAIRING CODE</div>
              <div style={{ marginTop: 8, fontSize: 30, fontWeight: 900, letterSpacing: ".12em", color: "#d4a637" }}>{pairingCode}</div>
              <p className="muted" style={{ marginBottom: 0 }}>Enter this code in the VaultTrades Copier EA. Pairing codes should be treated as credentials.</p>
            </div>
          )}
          {status?.error && <div style={{ marginTop: 14, color: "#ffb5b5" }}>{status.error}</div>}
        </section>

        <section className="vt-info-grid" style={{ marginTop: 24 }}>
          <article className="vt-info-card"><div className="vt-number">01</div><h2>Install Copier EA</h2><p>Attach the VaultTrades Copier EA to your MT5 terminal.</p></article>
          <article className="vt-info-card"><div className="vt-number">02</div><h2>Pair the terminal</h2><p>Enter the pairing code generated above in the EA.</p></article>
          <article className="vt-info-card"><div className="vt-number">03</div><h2>Verify connection</h2><p>Return here to confirm the MT5 connection and copy status.</p></article>
        </section>

        <section className="vt-info-card" style={{ marginTop: 24 }}>
          <div className="vt-label">CONNECTION STATUS</div>
          <h2 style={{ marginTop: 10 }}>{status?.connected ? "CONNECTED" : "NOT CONNECTED"}</h2>
          {status?.account && <p>MT5 {status.account.login || "account"} · {status.account.server || "server"} · {status.account.status || "active"}</p>}
          <Link className="vt-text-link" href="/copy" style={{ display: "inline-block", marginTop: 12 }}>← Back to Copy</Link>
        </section>
      </div>
    </main>
  );
}

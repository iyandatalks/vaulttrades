"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Status = {
  connected?: boolean;
  account?: { login?: string; server?: string; status?: string } | null;
  error?: string;
};

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
          <div className="vt-label">VAULTTRADES COPY · CONNECT MT5</div>
          <h1>Connect your MT5 account.</h1>
          <p>
            This is the page where you link your MT5 account to VaultTrades Copy Trading.
            Follow the steps in order. You do not need to configure TradingView or a webhook.
          </p>
        </header>

        <section className="vt-info-card" style={{ border: "1px solid rgba(212,166,55,.35)" }}>
          <div className="vt-label">YOUR CONNECTION CHECKLIST</div>
          <h2 style={{ marginTop: 10 }}>Complete these steps in order</h2>
          <ol style={{ lineHeight: 1.8, paddingLeft: 22 }}>
            <li>Have the MT5 account you want to use open and logged in.</li>
            <li>Install and attach the VaultTrades Copier EA to that MT5 terminal.</li>
            <li>Generate a pairing code below.</li>
            <li>Enter the pairing code into the Copier EA.</li>
            <li>Keep the EA running and return here to verify the connection.</li>
          </ol>
        </section>

        <section className="vt-info-card" style={{ marginTop: 24 }}>
          <div className="vt-label">STEP 1 · CREATE CONNECTION CODE</div>
          <h2 style={{ marginTop: 10 }}>Generate your MT5 pairing code</h2>
          <p>
            This code links the MT5 terminal to your VaultTrades account. It is not your MT5
            password. Never give VaultTrades your MT5 trading password.
          </p>
          <button className="vt-primary" onClick={() => void generate()} disabled={busy} style={{ marginTop: 14 }}>
            {busy ? "Generating…" : "Generate Pairing Code"}
          </button>

          {pairingCode && (
            <div style={{ marginTop: 18, padding: 20, borderRadius: 12, background: "#050812", border: "1px solid rgba(212,166,55,.35)", textAlign: "center" }}>
              <div className="vt-label">ENTER THIS CODE IN THE COPIER EA</div>
              <div style={{ marginTop: 8, fontSize: 30, fontWeight: 900, letterSpacing: ".12em", color: "#d4a637" }}>{pairingCode}</div>
              <p className="muted" style={{ marginBottom: 0 }}>
                Treat the pairing code as a credential and do not share it.
              </p>
            </div>
          )}
          {status?.error && <div style={{ marginTop: 14, color: "#ffb5b5" }}>{status.error}</div>}
        </section>

        <section className="vt-info-grid" style={{ marginTop: 24 }}>
          <article className="vt-info-card">
            <div className="vt-number">01</div>
            <h2>MT5 is ready</h2>
            <p>Log in to the MT5 account you want to receive copied trades.</p>
          </article>
          <article className="vt-info-card">
            <div className="vt-number">02</div>
            <h2>Copier EA is running</h2>
            <p>Attach the VaultTrades Copier EA to MT5 before pairing.</p>
          </article>
          <article className="vt-info-card">
            <div className="vt-number">03</div>
            <h2>Pair this account</h2>
            <p>Enter the pairing code above into the EA. The EA completes the account link.</p>
          </article>
          <article className="vt-info-card">
            <div className="vt-number">04</div>
            <h2>Verify connection</h2>
            <p>Once connected, this page displays the linked MT5 account and its status.</p>
          </article>
        </section>

        <section className="vt-info-card" style={{ marginTop: 24 }}>
          <div className="vt-label">CONNECTION STATUS</div>
          <h2 style={{ marginTop: 10 }}>
            {status?.connected ? "CONNECTED — READY TO COPY" : "NOT CONNECTED"}
          </h2>
          {status?.account && (
            <p>
              MT5 account: <strong>{status.account.login || "—"}</strong>
              {" · "}Broker server: <strong>{status.account.server || "—"}</strong>
              {" · "}Status: <strong>{status.account.status || "—"}</strong>
            </p>
          )}
          {!status?.connected && (
            <p>After pairing, keep the Copier EA running. Then refresh this page to confirm the connection.</p>
          )}
          <Link className="vt-text-link" href="/copy" style={{ display: "inline-block", marginTop: 12 }}>
            ← Back to Copy Trading
          </Link>
        </section>
      </div>
    </main>
  );
}

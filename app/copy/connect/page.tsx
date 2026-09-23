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
          <div className="vt-label">VAULTTRADES COPY · MT5 CONNECTION</div>
          <h1>Connect your MT5 account.</h1>
          <p>
            This page explains exactly what you need, what you install, where you install it,
            and what information you enter. The only trading platform used for Copy Trading is
            MetaTrader 5 (MT5) desktop running on a Windows computer or a Windows VPS.
          </p>
        </header>

        <section className="vt-info-card" style={{ border: "1px solid rgba(212,166,55,.35)" }}>
          <div className="vt-label">BEFORE YOU START</div>
          <h2 style={{ marginTop: 10 }}>What you need</h2>
          <ol style={{ lineHeight: 1.8, paddingLeft: 22 }}>
            <li><strong>A VaultTrades customer account</strong> — this is the account you use on the VaultTrades website.</li>
            <li><strong>An MT5 trading account</strong> — the broker account where you want copied trades to be placed.</li>
            <li><strong>A Windows PC or Windows VPS</strong> — this runs the MT5 desktop terminal. The MT5 mobile app cannot run an Expert Advisor.</li>
            <li><strong>The VaultTrades Copier EA</strong> — this is the software that runs inside your MT5 desktop terminal and receives/carries out copy instructions.</li>
          </ol>
        </section>

        <section className="vt-info-card" style={{ marginTop: 24 }}>
          <div className="vt-label">WHAT IS THE COPIER EA?</div>
          <h2 style={{ marginTop: 10 }}>It is software installed inside MT5 — not on the VaultTrades website.</h2>
          <p>
            The VaultTrades Copier EA is an MT5 Expert Advisor (EA). You install the EA file
            into the <strong>MQL5 → Experts</strong> folder of the MT5 desktop terminal, then
            attach the EA to an MT5 chart. MetaTrader's official documentation confirms that
            Expert Advisors are run by attaching them to a chart from the Navigator. 
          </p>
          <p>
            You do <strong>not</strong> install the EA on your phone, inside your web browser,
            or inside the VaultTrades dashboard.
          </p>
        </section>

        <section className="vt-info-card" style={{ marginTop: 24 }}>
          <div className="vt-label">WHERE IT RUNS</div>
          <h2 style={{ marginTop: 10 }}>Your MT5 terminal is the execution environment.</h2>
          <div className="vt-info-grid" style={{ marginTop: 16 }}>
            <article className="vt-info-card">
              <div className="vt-number">A</div>
              <h2>Windows PC</h2>
              <p>Install your broker's MT5 desktop application on your Windows computer. The Copier EA runs inside that MT5 terminal.</p>
            </article>
            <article className="vt-info-card">
              <div className="vt-number">B</div>
              <h2>Windows VPS</h2>
              <p>For continuous operation, MT5 can run on a Windows VPS. The Copier EA remains attached to MT5 while the VPS is running.</p>
            </article>
          </div>
          <p style={{ marginTop: 16 }}>
            <strong>Important:</strong> the Copier EA must remain running and connected to MT5
            for copy instructions to be received and executed. MetaTrader documents that EAs
            operate from the terminal and are controlled by the terminal's automated-trading setting.
          </p>
        </section>

        <section className="vt-info-card" style={{ marginTop: 24, border: "1px solid rgba(212,166,55,.35)" }}>
          <div className="vt-label">STEP 1 · PREPARE MT5</div>
          <h2 style={{ marginTop: 10 }}>Open the MT5 desktop terminal and log in.</h2>
          <p>
            Log in to the <strong>MT5 trading account that you want to receive copied trades</strong>.
            This is the account held with your broker. The broker's MT5 server name and account
            login are read by the Copier EA from the terminal.
          </p>
          <p>
            You do not give VaultTrades your broker password. VaultTrades uses the secure pairing
            process to authorize the Copier EA.
          </p>
        </section>

        <section className="vt-info-card" style={{ marginTop: 24, border: "1px solid rgba(212,166,55,.35)" }}>
          <div className="vt-label">DOWNLOAD · VAULTTRADES COPIER</div>
          <h2 style={{ marginTop: 10 }}>Download the compiled MT5 Copier EA.</h2>
          <p>
            Download the compiled <strong>VaultTrades_Copier.ex5</strong> and place it in your MT5
            <strong> MQL5 → Experts </strong> folder. The download is the compiled EA customers run
            in MT5; you do not need the source code to operate it.
          </p>
          <a
            className="vt-primary"
            href="/downloads/VaultTrades_Copier.ex5"
            download="VaultTrades_Copier.ex5"
            style={{ display: "inline-block", marginTop: 10 }}
          >
            Download VaultTrades Copier EA (.ex5) ↓
          </a>
          <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
            Version 1.00 · Windows MT5 desktop/VPS
          </p>
        </section>

        <section className="vt-info-card" style={{ marginTop: 24 }}>
          <div className="vt-label">STEP 2 · INSTALL THE SOFTWARE</div>
          <h2 style={{ marginTop: 10 }}>Install the VaultTrades Copier EA into MT5.</h2>
          <ol style={{ lineHeight: 1.8, paddingLeft: 22 }}>
            <li>Open the <strong>MT5 desktop terminal</strong> on your Windows PC/VPS.</li>
            <li>In MT5, select <strong>File → Open Data Folder</strong>.</li>
            <li>Open <strong>MQL5 → Experts</strong>.</li>
            <li>Place the VaultTrades Copier EA file in that <strong>Experts</strong> folder.</li>
            <li>Return to MT5 and refresh the <strong>Navigator → Expert Advisors</strong> list, or restart MT5.</li>
            <li>Open a chart, then drag <strong>VaultTrades Copier</strong> from Expert Advisors onto the chart.</li>
          </ol>
          <p style={{ marginBottom: 0 }}>
            MetaTrader documents this installation/attachment model for Expert Advisors. 
          </p>
        </section>

        <section className="vt-info-card" style={{ marginTop: 24 }}>
          <div className="vt-label">STEP 3 · CREATE THE LINK</div>
          <h2 style={{ marginTop: 10 }}>Generate a VaultTrades pairing code.</h2>
          <p>
            The pairing code is a temporary authorization code generated by your VaultTrades
            account. It is <strong>not</strong> your MT5 account number, broker password, API key,
            or trading strategy setting.
          </p>
          <button className="vt-primary" onClick={() => void generate()} disabled={busy} style={{ marginTop: 14 }}>
            {busy ? "Generating…" : "Generate Pairing Code"}
          </button>

          {pairingCode && (
            <div style={{ marginTop: 18, padding: 20, borderRadius: 12, background: "#050812", border: "1px solid rgba(212,166,55,.35)", textAlign: "center" }}>
              <div className="vt-label">ENTER THIS CODE IN MT5</div>
              <div style={{ marginTop: 8, fontSize: 30, fontWeight: 900, letterSpacing: ".12em", color: "#d4a637" }}>{pairingCode}</div>
              <p className="muted" style={{ marginBottom: 0 }}>
                In the VaultTrades Copier EA settings window, enter this value in the
                <strong> InpPairingCode </strong> field. Treat it as a temporary credential.
              </p>
            </div>
          )}
          {status?.error && <div style={{ marginTop: 14, color: "#ffb5b5" }}>{status.error}</div>}
        </section>

        <section className="vt-info-card" style={{ marginTop: 24 }}>
          <div className="vt-label">STEP 4 · MT5 EA SETTINGS</div>
          <h2 style={{ marginTop: 10 }}>What do I enter into the Copier EA?</h2>
          <p>
            For the customer connection, the important field is the <strong>Pairing Code</strong>
            generated above. The production VaultTrades API address is already built into the
            Copier EA, so you should not need to invent or type a webhook URL.
          </p>
          <div className="vt-info-grid" style={{ marginTop: 16 }}>
            <article className="vt-info-card">
              <h2>Pairing Code</h2>
              <p><strong>Enter:</strong> the temporary code generated on this page.</p>
            </article>
            <article className="vt-info-card">
              <h2>API URL</h2>
              <p><strong>Leave the production default:</strong> the EA is configured for VaultTrades production.</p>
            </article>
            <article className="vt-info-card">
              <h2>Trading permission</h2>
              <p><strong>Enable:</strong> the EA must be allowed to trade, and MT5 Algo Trading must be enabled.</p>
            </article>
          </div>
          <p style={{ marginTop: 16, marginBottom: 0 }}>
            Do not enter the Master Publisher API key. That key belongs to VaultTrades' internal
            master account and is not a customer credential.
          </p>
        </section>

        <section className="vt-info-card" style={{ marginTop: 24 }}>
          <div className="vt-label">STEP 5 · ACTIVATE</div>
          <h2 style={{ marginTop: 10 }}>Allow MT5 to run the Copier EA.</h2>
          <ol style={{ lineHeight: 1.8, paddingLeft: 22 }}>
            <li>In the EA settings, allow live trading for the Copier EA.</li>
            <li>On the MT5 toolbar, turn on <strong>Algo Trading</strong>.</li>
            <li>Confirm the Copier EA is attached to the chart and running.</li>
            <li>Keep MT5 connected to the broker and keep the computer/VPS running.</li>
          </ol>
          <p style={{ marginBottom: 0 }}>
            MetaTrader states that platform-level AutoTrading/Algo Trading and the EA's own
            trading permission both affect whether an Expert Advisor can trade.
          </p>
        </section>

        <section className="vt-info-card" style={{ marginTop: 24 }}>
          <div className="vt-label">STEP 6 · VERIFY</div>
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
            <p>
              After pairing, keep the Copier EA running. Return here and refresh the page.
              A successful connection should identify the linked MT5 account.
            </p>
          )}
          <Link className="vt-text-link" href="/copy" style={{ display: "inline-block", marginTop: 12 }}>
            ← Back to Copy Trading
          </Link>
        </section>

        <section className="vt-info-card" style={{ marginTop: 24, border: "1px solid rgba(212,166,55,.28)" }}>
          <div className="vt-label">SECURITY</div>
          <p style={{ marginBottom: 0 }}>
            VaultTrades does not require your MT5 trading password for this connection. The pairing
            code authorizes the Copier EA to connect the MT5 terminal to your VaultTrades Copy account.
          </p>
        </section>
      </div>
    </main>
  );
}

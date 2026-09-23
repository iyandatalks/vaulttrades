"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Status = {
  connected?: boolean;
  subscriptionActive?: boolean;
  accessUntil?: string | null;
  account?: { login?: string; server?: string; status?: string } | null;
};

export default function CopyPage() {
  const [connected, setConnected] = useState(false);
  const [statusText, setStatusText] = useState("");

  useEffect(() => {
    fetch("/api/copy/status", { cache: "no-store" })
      .then(async r => {
        const d = await r.json();
        if (!r.ok || d.subscriptionActive !== true) {
          window.location.replace("/products?product=copy");
          return;
        }
        setConnected(Boolean(d.connected));
        setStatusText(d.accessUntil ? `Access until ${new Date(d.accessUntil).toLocaleDateString()}` : "Subscription active");
      })
      .catch(() => window.location.replace("/products?product=copy"));
  }, []);

  return (
    <main className="vt-info-page">
      <div className="vt-info-wrap">
        <header className="vt-info-hero">
          <div className="vt-label">VAULTTRADES COPY TRADING</div>
          <h1>Connect your MT5 account and activate Copy Trading.</h1>
          <p>
            This page is available while your Copy Trading subscription is active. VaultTrades Copy
            automatically sends eligible master trades to your connected MT5 account. You do not
            configure TradingView, webhooks or the underlying strategy.
          </p>
          <div className="vt-actions" style={{ justifyContent: "flex-start", marginTop: 20 }}>
            <Link className="vt-primary" href="/copy/connect">
              {connected ? "Manage MT5 Connection" : "Start MT5 Connection"}
            </Link>
            <Link className="vt-secondary" href="/how-it-works">How Copy Trading Works</Link>
          </div>
        </header>

        <section className="vt-info-card" style={{ marginTop: 24, border: "1px solid rgba(212,166,55,.35)" }}>
          <div className="vt-label">START HERE</div>
          <h2 style={{ marginTop: 10 }}>Follow these 4 steps</h2>
          <div className="vt-info-grid" style={{ marginTop: 18 }}>
            <article className="vt-info-card">
              <div className="vt-number">01</div>
              <h2>Create your VaultTrades account</h2>
              <p>Sign in or create your VaultTrades customer account. Copy Trading is managed from your account.</p>
            </article>
            <article className="vt-info-card">
              <div className="vt-number">02</div>
              <h2>Prepare your MT5 account</h2>
              <p>Use the MT5 trading account you want to receive copied trades. Keep your MT5 login and broker server available.</p>
            </article>
            <article className="vt-info-card">
              <div className="vt-number">03</div>
              <h2>Connect MT5</h2>
              <p>Open the connection page, generate your one-time pairing code and enter it into the VaultTrades Copier EA in MT5.</p>
            </article>
            <article className="vt-info-card">
              <div className="vt-number">04</div>
              <h2>Activate and verify</h2>
              <p>Leave the Copier EA running, return to this page and confirm that your MT5 account shows as connected before using Copy Trading.</p>
            </article>
          </div>
        </section>

        <section className="vt-info-card" style={{ marginTop: 24 }}>
          <div className="vt-label">YOUR NEXT ACTION</div>
          <h2 style={{ marginTop: 10 }}>
            {connected ? "Your MT5 account is connected." : "You have not connected an MT5 account yet."}
          </h2>
          <p>
            {connected
              ? "Open the connection page to review the linked account and connection status."
              : "Do not look for the connection inside the general dashboard. Start with the button below."}
          </p>
          <Link className="vt-primary" href="/copy/connect" style={{ display: "inline-block", marginTop: 8 }}>
            {connected ? "View Connection Status" : "Connect My MT5 Account"} →
          </Link>
        </section>

        <section className="vt-info-grid" style={{ marginTop: 24 }}>
          <article className="vt-info-card">
            <div className="vt-label">WHAT VAULTTRADES DOES</div>
            <h2>Master trades → Your MT5</h2>
            <p>VaultTrades publishes eligible master-account executions. Your Copier EA receives the instructions and places the corresponding trades on your connected MT5 account.</p>
          </article>
          <article className="vt-info-card">
            <div className="vt-label">WHAT YOU CONTROL</div>
            <h2>Your MT5 connection</h2>
            <p>You control the MT5 account, broker, Copier EA connection and whether trading is enabled. Strategy logic and the master account remain internal to VaultTrades.</p>
          </article>
        </section>

        <section className="vt-info-card" style={{ marginTop: 24, border: "1px solid rgba(212,166,55,.28)" }}>
          <div className="vt-label">IMPORTANT</div>
          <p style={{ marginBottom: 0 }}>
            Copy Trading involves financial risk. Past trading results do not guarantee future results.
          </p>
        </section>
      </div>
    </main>
  );
}

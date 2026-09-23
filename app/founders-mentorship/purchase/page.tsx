"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const PAYPAL_URL = "https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-7PG440523L908841RNJ2GXQQ";

export default function FoundersPurchasePage() {
  const [checking, setChecking] = useState(true);
  const [paid, setPaid] = useState(false);
  const [authenticated, setAuthenticated] = useState(true);

  useEffect(() => {
    let stopped = false;

    const check = async () => {
      try {
        const response = await fetch("/api/dashboard/access", { cache: "no-store" });
        const data = await response.json();
        if (stopped) return;

        if (response.status === 401) {
          setAuthenticated(false);
          setChecking(false);
          return;
        }

        const active = response.ok && data?.access?.founders_mentorship === true;
        setAuthenticated(true);
        setPaid(active);
        setChecking(false);

        if (active) window.location.href = "/founders-mentorship/booking?payment=success";
      } catch {
        if (!stopped) setChecking(false);
      }
    };

    void check();
    const interval = window.setInterval(() => void check(), 3000);

    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <main className="shell">
      <section className="card">
        <div className="section-label">FOUNDERS MENTORSHIP · $53 ONCE OFF</div>
        <h1 className="title">Secure your place</h1>
        <p className="muted">Complete the once-off PayPal payment for the 7-day Founders Mentorship Program. Your VaultTrades account must be signed in so the confirmed payment can be linked to your access.</p>

        {!authenticated ? (
          <div className="condition-box" style={{ marginTop: 22 }}>
            <strong>Sign in before payment</strong>
            <p className="muted">Use your VaultTrades account first, then return here to complete PayPal checkout.</p>
            <div className="vt-actions" style={{ marginTop: 14 }}>
              <Link className="primary" href="/auth/login?next=/founders-mentorship/purchase">Sign in to VaultTrades</Link>
            </div>
          </div>
        ) : (
          <>
            <div className="vt-actions" style={{ marginTop: 22 }}>
              <a className="primary" href={PAYPAL_URL} target="_blank" rel="noreferrer">Pay $53 with PayPal</a>
              <Link className="secondary" href="/products">Back to Products</Link>
            </div>
            <p className="muted" style={{ marginTop: 12 }}>Use the same email address as your VaultTrades account in PayPal so the payment confirmation can be matched automatically.</p>
          </>
        )}

        <div className="condition-box" style={{ marginTop: 18 }}>
          <strong>{paid ? "Payment confirmed" : checking ? "Checking payment status…" : authenticated ? "Waiting for payment confirmation" : "VaultTrades sign-in required"}</strong>
          <p className="muted">{paid ? "Opening your booking page." : authenticated ? "Keep this page open after completing PayPal. It will automatically redirect once VaultTrades receives the payment confirmation." : "After signing in, open this page again to start payment."}</p>
        </div>
      </section>
    </main>
  );
}

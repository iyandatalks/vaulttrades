"use client";

import Link from "next/link";
import { useState } from "react";

export default function AutomatedTraderSubscribePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const startPayPal = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/automated-trader/subscribe", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to start Automated Trader checkout.");
      window.location.href = data.approveUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to start Automated Trader checkout.");
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: "calc(100vh - 61px)", background: "#050812", color: "#f4f6fb", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ width: "100%", maxWidth: 620, border: "1px solid rgba(212,166,55,.25)", borderRadius: 14, padding: 32, background: "#0a0f1c", textAlign: "center" }}>
        <div style={{ color: "#d4a637", fontSize: 12, fontWeight: 800, letterSpacing: ".18em" }}>AUTOMATED TRADER</div>
        <h1 style={{ fontSize: 38, margin: "12px 0" }}>Start Automated Trading</h1>
        <p style={{ color: "#aeb5c6", lineHeight: 1.7, maxWidth: 500, margin: "0 auto" }}>
          Activate your Automated Trader service, then return to VaultTrades to connect MT5 and configure the instruments you want automation to trade.
        </p>

        <div style={{ marginTop: 26, padding: 24, borderRadius: 12, border: "1px solid rgba(212,166,55,.3)", background: "#050812" }}>
          <div style={{ color: "#aeb5c6", fontSize: 13, fontWeight: 700 }}>AUTOMATED TRADER</div>
          <div style={{ marginTop: 8, color: "#d4a637", fontSize: 40, fontWeight: 900 }}>
            $99.99 <span style={{ color: "#aeb5c6", fontSize: 14, fontWeight: 500 }}>/ month</span>
          </div>
          <div style={{ marginTop: 10, color: "#7f8799", fontSize: 12, lineHeight: 1.6 }}>
            Monthly automated copy-trading service. Payment is processed securely through PayPal and access is enabled only after server-side subscription verification.
          </div>
        </div>

        <button onClick={() => void startPayPal()} disabled={loading} style={{ width: "100%", border: 0, cursor: loading ? "wait" : "pointer", marginTop: 24, padding: "15px 18px", borderRadius: 9, background: "#d4a637", color: "#050812", fontWeight: 900 }}>
          {loading ? "Opening secure checkout..." : "Continue with PayPal"}
        </button>
        {error && <div style={{ marginTop: 16, padding: 14, borderRadius: 9, background: "rgba(220,70,70,.12)", color: "#ffb5b5", textAlign: "left" }}>{error}</div>}
        <p style={{ marginTop: 18, color: "#7f8799", fontSize: 12, lineHeight: 1.5 }}>
          Already subscribed? Return to Automated Trader to manage your MT5 connection and instruments.
        </p>
        <Link href="/automated-trader" style={{ display: "inline-block", marginTop: 4, color: "#d4a637", fontWeight: 800, textDecoration: "none" }}>
          Back to Automated Trader
        </Link>
      </section>
    </main>
  );
}

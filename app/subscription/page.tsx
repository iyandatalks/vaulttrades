"use client";

import { useState } from "react";

export default function SubscriptionPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const startPayPal = async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/paypal/create-order", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to start PayPal checkout.");
      window.location.href = data.approveUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to start PayPal checkout.");
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: "calc(100vh - 61px)", background: "#050812", color: "#f4f6fb", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ width: "100%", maxWidth: 620, border: "1px solid rgba(212,166,55,.25)", borderRadius: 14, padding: 32, background: "#0a0f1c" }}>
        <div style={{ color: "#d4a637", fontSize: 12, fontWeight: 800, letterSpacing: ".18em" }}>VAULTTRADES</div>
        <h1 style={{ fontSize: 38, margin: "12px 0" }}>Monthly Subscription</h1>
        <p style={{ color: "#aeb5c6", lineHeight: 1.7 }}>Your VaultTrades subscription gives you access to the paid application, including Analyzer, Strategies, AI Coach, Journal and Profile.</p>
        <div style={{ marginTop: 24, padding: 22, borderRadius: 12, border: "1px solid rgba(212,166,55,.3)", background: "#050812" }}>
          <div style={{ color: "#aeb5c6", fontSize: 13 }}>VaultTrades Monthly</div>
          <div style={{ marginTop: 8, color: "#d4a637", fontSize: 34, fontWeight: 800 }}>$73.99 <span style={{ color: "#aeb5c6", fontSize: 14, fontWeight: 500 }}>/ month</span></div>
          <div style={{ marginTop: 10, color: "#7f8799", fontSize: 12 }}>Sandbox testing uses the configured test amount and never changes the production price.</div>
        </div>
        <button onClick={() => void startPayPal()} disabled={loading} style={{ width: "100%", border: 0, cursor: loading ? "wait" : "pointer", marginTop: 24, padding: "15px 18px", borderRadius: 9, background: "#d4a637", color: "#050812", fontWeight: 800 }}>{loading ? "Opening PayPal..." : "Continue with PayPal"}</button>
        {error && <div style={{ marginTop: 16, padding: 14, borderRadius: 9, background: "rgba(220,70,70,.12)", color: "#ffb5b5" }}>{error}</div>}
        <p style={{ marginTop: 18, color: "#7f8799", fontSize: 12, lineHeight: 1.5 }}>Access is never granted by clicking the payment button. VaultTrades activates membership only after server-side PayPal verification.</p>
      </section>
    </main>
  );
}

"use client";

import { useState } from "react";

export default function PayPalButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startSubscription() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/paypal/create-subscription", { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.approvalUrl) throw new Error(data.error ?? "Unable to start PayPal subscription");
      window.location.assign(data.approvalUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start PayPal subscription");
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={startSubscription} disabled={loading} style={{ width: "100%", padding: "15px 18px", border: 0, borderRadius: 9, background: "#d4a637", color: "#050812", fontWeight: 800, cursor: loading ? "wait" : "pointer" }}>
        {loading ? "Connecting to PayPal…" : "Pay with PayPal"}
      </button>
      {error ? <p style={{ marginTop: 10, color: "#d77", fontSize: 13 }}>{error}</p> : null}
    </div>
  );
}

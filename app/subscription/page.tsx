"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

const PRODUCTS = [
  { code: "analyzer_monthly", name: "Analyzer", price: "73.99", description: "Structured chart analysis, strategy conditions and trade planning." },
  { code: "scanner_monthly", name: "Scanner Automation / Signals", price: "9.99", description: "Automated monitoring and confirmed VaultTrades signal delivery." },
  { code: "automated_trader_monthly", name: "Automated Trader", price: "99.99", description: "VaultTrades copy-trading service with connected MT5 execution." },
] as const;

function SubscriptionContent() {
  const params = useSearchParams();
  const requested = params.get("product") || "analyzer_monthly";
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");

  const startPayPal = async (productCode: string) => {
    setLoading(productCode);
    setError("");
    try {
      const response = await fetch("/api/paypal/create-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productCode }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to start PayPal checkout.");
      if (!data.approveUrl) throw new Error("PayPal did not return an approval URL.");
      window.location.href = data.approveUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to start PayPal checkout.");
      setLoading("");
    }
  };

  return (
    <main style={{ minHeight: "calc(100vh - 61px)", background: "#050812", color: "#f4f6fb", padding: "48px 20px" }}>
      <section style={{ width: "100%", maxWidth: 1050, margin: "0 auto" }}>
        <div style={{ color: "#d4a637", fontSize: 12, fontWeight: 800, letterSpacing: ".18em" }}>VAULTTRADES PRODUCTS</div>
        <h1 style={{ fontSize: 40, margin: "12px 0" }}>Choose your VaultTrades service</h1>
        <p style={{ color: "#aeb5c6", lineHeight: 1.7, maxWidth: 720 }}>Each service has its own PayPal subscription plan. All three subscriptions are verified through the same VaultTrades PayPal webhook before access is granted.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 18, marginTop: 28 }}>
          {PRODUCTS.map(product => (
            <article key={product.code} style={{ padding: 24, borderRadius: 14, background: "#0a0f1c", border: product.code === requested ? "1px solid rgba(212,166,55,.65)" : "1px solid rgba(212,166,55,.22)" }}>
              <div style={{ color: "#d4a637", fontSize: 11, fontWeight: 800, letterSpacing: ".14em" }}>{product.code === requested ? "SELECTED" : "VAULTTRADES SERVICE"}</div>
              <h2 style={{ fontSize: 24, margin: "12px 0 8px" }}>{product.name}</h2>
              <div style={{ color: "#d4a637", fontSize: 32, fontWeight: 900 }}>${product.price}<span style={{ color: "#aeb5c6", fontSize: 13, fontWeight: 500 }}>/month</span></div>
              <p style={{ color: "#aeb5c6", lineHeight: 1.6, minHeight: 52 }}>{product.description}</p>
              <button onClick={() => void startPayPal(product.code)} disabled={Boolean(loading)} style={{ width: "100%", marginTop: 16, padding: "13px 16px", border: 0, borderRadius: 8, background: "#d4a637", color: "#050812", fontWeight: 900, cursor: loading ? "wait" : "pointer" }}>{loading === product.code ? "Opening PayPal..." : "Subscribe with PayPal"}</button>
            </article>
          ))}
        </div>
        {error && <div style={{ marginTop: 20, padding: 14, borderRadius: 9, background: "rgba(220,70,70,.12)", color: "#ffb5b5" }}>{error}</div>}
        <p style={{ marginTop: 22, color: "#7f8799", fontSize: 12, lineHeight: 1.6 }}>VaultTrades does not activate paid access from the browser alone. PayPal sends the subscription event to the verified webhook, and the matching product entitlement is then activated in Supabase.</p>
      </section>
    </main>
  );
}

export default function SubscriptionPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: "calc(100vh - 61px)", background: "#050812", color: "#f4f6fb", padding: "48px 20px" }}>Loading VaultTrades subscription...</main>}>
      <SubscriptionContent />
    </Suspense>
  );
}

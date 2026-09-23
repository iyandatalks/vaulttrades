"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

const PRODUCTS = [
  { code: "analyzer_monthly", name: "Analyzer", price: "73.99", suffix: "/month", description: "Structured chart analysis, strategy conditions and trade planning.", type: "checkout" },
  { code: "founders_mentorship_once", name: "Founders Mentorship", price: "53", suffix: " once off", description: "A focused mentorship program with a 1-hour one-on-one session." },
  { code: "automated_trader_monthly", name: "Copy Trading", price: "99.99", suffix: "/month", description: "VaultTrades copy trading with connected MT5 execution.", type: "checkout" },
] as const;

function SubscriptionContent() {
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get("product") || "analyzer_monthly";
  const autoStart = params.get("start") === "1";
  const startedRef = useRef(false);
  const selected = PRODUCTS.some((product) => product.code === requested) ? requested : "analyzer_monthly";
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");

  const startPayPal = async (productCode: string) => {
    setLoading(productCode);
    setError("");
    try {
      const sb = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data } = await sb.auth.getUser();

      if (!data.user) {
        const next = "/subscription?product=" + encodeURIComponent(productCode) + "&start=1";
        router.replace("/auth/register?next=" + encodeURIComponent(next));
        return;
      }

      const response = await fetch("/api/paypal/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productCode }),
      });
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
        <p style={{ color: "#aeb5c6", lineHeight: 1.7, maxWidth: 720 }}>Analyzer and Copy Trading use their monthly PayPal subscriptions. Founders Mentorship is a separate once-off PayPal purchase.</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 18, marginTop: 28 }}>
          {PRODUCTS.map(product => (
            <article key={product.code} style={{ padding: 24, borderRadius: 14, background: "#0a0f1c", border: product.code === requested ? "1px solid rgba(212,166,55,.65)" : "1px solid rgba(212,166,55,.22)" }}>
              <div style={{ color: "#d4a637", fontSize: 11, fontWeight: 800, letterSpacing: ".14em" }}>{product.code === requested ? "SELECTED" : "VAULTTRADES SERVICE"}</div>
              <h2 style={{ fontSize: 24, margin: "12px 0 8px" }}>{product.name}</h2>
              <div style={{ color: "#d4a637", fontSize: 32, fontWeight: 900 }}>${product.price}<span style={{ color: "#aeb5c6", fontSize: 13, fontWeight: 500 }}>{product.suffix}</span></div>
              <p style={{ color: "#aeb5c6", lineHeight: 1.6, minHeight: 52 }}>{product.description}</p>

              <button onClick={() => void startPayPal(product.code)} disabled={Boolean(loading)} style={{ width: "100%", marginTop: 16, padding: "13px 16px", border: 0, borderRadius: 8, background: "#d4a637", color: "#050812", fontWeight: 900, cursor: loading ? "wait" : "pointer" }}>
                  {loading === product.code ? "Opening PayPal..." : "Continue to PayPal"}
                </button>
            </article>
          ))}
        </div>

        {error && <div style={{ marginTop: 20, padding: 14, borderRadius: 9, background: "rgba(220,70,70,.12)", color: "#ffb5b5" }}>{error}</div>}
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

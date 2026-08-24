"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function PayPalSuccessPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Verifying PayPal payment...");
  const [error, setError] = useState("");

  useEffect(() => {
    const orderId = new URLSearchParams(window.location.search).get("token");
    if (!orderId) { setError("PayPal did not return an order reference."); return; }
    void (async () => {
      try {
        const response = await fetch("/api/paypal/capture-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId }) });
        const data = await response.json();
        if (!response.ok || !data.membershipActive) throw new Error(data.error || "Payment could not be verified.");
        setMessage("Payment verified. Your VaultTrades membership is now active.");
        setTimeout(() => router.push("/analyzer"), 1200);
      } catch (e) { setError(e instanceof Error ? e.message : "Payment verification failed."); }
    })();
  }, [router]);

  return <main style={{ minHeight: "100vh", background: "#050812", color: "#f4f6fb", display: "grid", placeItems: "center", padding: 24 }}><section style={{ maxWidth: 620, width: "100%", padding: 32, borderRadius: 14, background: "#0a0f1c", border: "1px solid rgba(212,166,55,.25)" }}><div style={{ color: "#d4a637", fontWeight: 800, letterSpacing: ".16em", fontSize: 12 }}>VAULTTRADES</div><h1 style={{ margin: "12px 0" }}>Payment verification</h1><p style={{ color: error ? "#ffb5b5" : "#aeb5c6", lineHeight: 1.7 }}>{error || message}</p>{error && <button onClick={() => router.push("/subscription")} style={{ marginTop: 16, padding: "12px 16px", border: 0, borderRadius: 8, fontWeight: 700 }}>Return to Subscription</button>}</section></main>;
}

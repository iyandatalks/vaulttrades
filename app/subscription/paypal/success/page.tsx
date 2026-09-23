"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

const DESTINATIONS: Record<string, { accessKey: string; path: string; label: string }> = {
  analyzer_monthly: {
    accessKey: "analyzer",
    path: "/analyzer",
    label: "Analyzer",
  },
  automated_trader_monthly: {
    accessKey: "copy",
    path: "/copy",
    label: "Copy Trading",
  },
  founders_mentorship_once: {
    accessKey: "founders_mentorship",
    path: "/founders-mentorship/booking?payment=success",
    label: "Founders Mentorship",
  },
};

export default function PayPalSuccessPage() {
  const router = useRouter();
  const params = useSearchParams();
  const product = params.get("product") || "analyzer_monthly";
  const destination = DESTINATIONS[product] || DESTINATIONS.analyzer_monthly;
  const [message, setMessage] = useState("Waiting for VaultTrades payment confirmation…");
  const [error, setError] = useState("");

  useEffect(() => {
    let stopped = false;
    let attempts = 0;

    const verifyAccess = async () => {
      attempts += 1;

      try {
        const sb = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data: auth } = await sb.auth.getUser();

        if (!auth.user) {
          setError("Your VaultTrades session is no longer active. Please sign in again.");
          return;
        }

        const response = await fetch("/api/dashboard/access", { cache: "no-store" });
        const data = await response.json().catch(() => ({}));

        if (response.ok && data?.access?.[destination.accessKey] === true) {
          if (!stopped) {
            setMessage("Payment confirmed. Opening " + destination.label + "…");
            window.setTimeout(() => router.replace(destination.path), 700);
          }
          return;
        }

        if (!stopped && attempts < 45) {
          setMessage("Payment received. Waiting for VaultTrades to confirm your access…");
          window.setTimeout(() => void verifyAccess(), 2000);
        } else if (!stopped) {
          setError("Payment confirmation is taking longer than expected. Your access will appear once the PayPal webhook confirmation is processed.");
        }
      } catch (e) {
        if (!stopped && attempts < 45) {
          window.setTimeout(() => void verifyAccess(), 2000);
        } else if (!stopped) {
          setError(e instanceof Error ? e.message : "Payment confirmation could not be checked.");
        }
      }
    };

    void verifyAccess();

    return () => {
      stopped = true;
    };
  }, [destination.accessKey, destination.label, destination.path, router]);

  return (
    <main style={{ minHeight: "100vh", background: "#050812", color: "#f4f6fb", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ maxWidth: 620, width: "100%", padding: 32, borderRadius: 14, background: "#0a0f1c", border: "1px solid rgba(212,166,55,.25)" }}>
        <div style={{ color: "#d4a637", fontWeight: 800, letterSpacing: ".16em", fontSize: 12 }}>VAULTTRADES</div>
        <h1 style={{ margin: "12px 0" }}>Payment confirmation</h1>
        <p style={{ color: error ? "#ffb5b5" : "#aeb5c6", lineHeight: 1.7 }}>{error || message}</p>
        {error && (
          <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => router.push("/products")} style={{ padding: "12px 16px", border: 0, borderRadius: 8, fontWeight: 700 }}>
              Return to Products
            </button>
            <button onClick={() => window.location.reload()} style={{ padding: "12px 16px", border: 0, borderRadius: 8, fontWeight: 700 }}>
              Check Again
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

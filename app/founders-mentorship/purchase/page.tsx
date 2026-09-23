"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

const RETURN_PATH = "/subscription?product=founders_mentorship_once&start=1";
const PRODUCT_CODE = "founders_mentorship_once";

export default function FoundersPurchasePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let stopped = false;

    const startCheckout = async () => {
      try {
        const sb = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data } = await sb.auth.getUser();

        if (!data.user) {
          router.replace("/auth/login?next=" + encodeURIComponent(RETURN_PATH));
          return;
        }

        const accessResponse = await fetch("/api/dashboard/access", { cache: "no-store" });
        const access = await accessResponse.json().catch(() => ({}));

        if (accessResponse.ok && access?.access?.founders_mentorship === true) {
          router.replace("/founders-mentorship/booking?payment=success");
          return;
        }

        if (stopped) return;

        setChecking(false);
        setStarting(true);
        setError("");

        const response = await fetch("/api/paypal/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productCode: PRODUCT_CODE }),
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok || !result?.approveUrl) {
          throw new Error(result?.error || "Unable to start PayPal checkout.");
        }

        window.location.href = result.approveUrl;
      } catch (e) {
        if (!stopped) {
          setChecking(false);
          setStarting(false);
          setError(e instanceof Error ? e.message : "Unable to start PayPal checkout.");
        }
      }
    };

    void startCheckout();
    return () => {
      stopped = true;
    };
  }, [router]);

  return (
    <main className="shell">
      <section className="card">
        <div className="section-label">FOUNDERS MENTORSHIP · ONCE OFF</div>
        <h1 className="title">Secure your place</h1>
        {checking && (
          <p className="muted">Checking your VaultTrades account before opening secure PayPal checkout…</p>
        )}

        {!checking && starting && (
          <p className="muted">Opening secure PayPal checkout…</p>
        )}

        {error && (
          <>
            <div className="condition-box" style={{ marginTop: 18 }}>
              <strong>PayPal checkout could not be opened automatically.</strong>
              <p className="muted">{error}</p>
            </div>
            <div className="vt-actions" style={{ marginTop: 18 }}>
              <Link className="primary" href={RETURN_PATH}>Try checkout again</Link>
              <Link className="secondary" href="/products">Back to Products</Link>
            </div>
            <p className="muted" style={{ marginTop: 12 }}>
              Use the same email address as your VaultTrades account in PayPal.
            </p>
          </>
        )}

        {!checking && !starting && !error && (
          <p className="muted">Preparing your secure PayPal checkout…</p>
        )}
      </section>
    </main>
  );
}

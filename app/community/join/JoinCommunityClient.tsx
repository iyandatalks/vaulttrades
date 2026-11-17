"use client";

import { useState } from "react";
import Link from "next/link";

export default function JoinCommunityClient() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loginHref, setLoginHref] = useState("/auth/login?next=%2Fcommunity%2Fjoin");
  const [registerHref, setRegisterHref] = useState("/auth/register?next=%2Fcommunity%2Fjoin");

  async function continueToPayment() {
    setBusy(true);
    setError("");
    try {
      const referralCode = new URLSearchParams(window.location.search).get("ref") || "";
      const returnPath = window.location.pathname + window.location.search;
      setLoginHref(`/auth/login?next=${encodeURIComponent(returnPath)}`);
      setRegisterHref(`/auth/register?ref=${encodeURIComponent(referralCode)}&next=${encodeURIComponent(returnPath)}`);
      const response = await fetch("/api/community/join-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referralCode }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Sign in to continue.");
      window.location.assign(result.paymentUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to prepare payment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "calc(100vh - 64px)", background: "#050812", color: "#f4f6fb", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ width: "100%", maxWidth: 620, padding: 32, borderRadius: 16, border: "1px solid rgba(212,166,55,.3)", background: "#0a0f1c" }}>
        <div style={{ color: "#d4a637", fontSize: 11, fontWeight: 900, letterSpacing: ".16em" }}>VAULTTRADES COMMUNITY</div>
        <h1 style={{ margin: "12px 0", fontSize: 36 }}>Join the Community.</h1>
        <p style={{ color: "#d3d9e5", lineHeight: 1.75 }}>A once-off joining payment of <strong style={{ color: "#f0cf75" }}>$10 USD</strong> gives you eligibility for Community membership. Your payment is verified by PayPal and your access request is then reviewed by a VaultTrades administrator.</p>
        <ul style={{ color: "#c4ccda", lineHeight: 1.9, paddingLeft: 20 }}>
          <li>Community Feed</li>
          <li>Read-only Member Discussions</li>
          <li>Community Leaderboard</li>
        </ul>
        <p style={{ color: "#aeb8c9", fontSize: 13, lineHeight: 1.7 }}>Payment does not automatically unlock partner-only sessions, the Members directory, Knowledge Base or administration. Those areas require their own approved access. Your once-off Community membership does not expire because a separate subscription is cancelled.</p>
        <button onClick={() => void continueToPayment()} disabled={busy} style={{ width: "100%", marginTop: 14, padding: "15px 18px", border: 0, borderRadius: 9, background: "#d4a637", color: "#080d18", fontWeight: 900, cursor: busy ? "wait" : "pointer" }}>
          {busy ? "Preparing secure payment…" : "Pay $10 once-off with PayPal"}
        </button>
        {error && <div role="alert" style={{ marginTop: 14, padding: 12, borderRadius: 8, background: "#24151a", color: "#ffd2d2", lineHeight: 1.6 }}>{error} <Link href={loginHref} style={{ color: "#f0cf75", textDecoration: "underline" }}>Sign in</Link> or <Link href={registerHref} style={{ color: "#f0cf75", textDecoration: "underline" }}>create an account</Link>.</div>}
        <p style={{ color: "#9aa6b8", fontSize: 12, marginTop: 18 }}>After payment, return to VaultTrades and submit your preferred Community display name. An administrator will review your payment and approve access.</p>
      </section>
    </main>
  );
}

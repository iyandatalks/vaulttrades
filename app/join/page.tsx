import Link from "next/link";

export default function JoinPage() {
  return (
    <main style={{ minHeight: "calc(100vh - 61px)", background: "#050812", color: "#f4f6fb", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ width: "100%", maxWidth: 560, border: "1px solid rgba(212,166,55,.25)", borderRadius: 14, padding: 32, background: "#0a0f1c" }}>
        <div style={{ color: "#d4a637", fontSize: 12, fontWeight: 800, letterSpacing: ".18em" }}>VAULTTRADES</div>
        <h1 style={{ fontSize: 38, margin: "12px 0" }}>Get Access</h1>
        <p style={{ color: "#aeb5c6", lineHeight: 1.7 }}>Enter your email to continue to the VaultTrades monthly subscription.</p>
        <form style={{ display: "grid", gap: 12, marginTop: 24 }} action="/subscription" method="get">
          <label htmlFor="email" style={{ color: "#d7dbe7", fontSize: 13, fontWeight: 700 }}>Email address</label>
          <input id="email" name="email" type="email" required placeholder="you@example.com" autoComplete="email" style={{ padding: "13px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,.12)", background: "#050812", color: "#f4f6fb" }} />
          <button type="submit" style={{ marginTop: 8, padding: "14px 18px", border: 0, borderRadius: 9, background: "#d4a637", color: "#050812", fontWeight: 800, cursor: "pointer" }}>Continue to Subscription</button>
        </form>
        <Link href="/landing" style={{ display: "block", marginTop: 18, textAlign: "center", color: "#aeb5c6", textDecoration: "none" }}>Back to Landing Page</Link>
      </section>
    </main>
  );
}

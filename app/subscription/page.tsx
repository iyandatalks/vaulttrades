import Link from "next/link";

const PAYPAL_PAYMENT_URL = "https://www.paypal.com/ncp/payment/LQX2GNXN6AWFY";

export default async function SubscriptionPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const params = await searchParams;
  const email = params.email ?? "";

  return (
    <main style={{ minHeight: "calc(100vh - 61px)", background: "#050812", color: "#f4f6fb", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ width: "100%", maxWidth: 620, border: "1px solid rgba(212,166,55,.25)", borderRadius: 14, padding: 32, background: "#0a0f1c" }}>
        <div style={{ color: "#d4a637", fontSize: 12, fontWeight: 800, letterSpacing: ".18em" }}>VAULTTRADES</div>
        <h1 style={{ fontSize: 38, margin: "12px 0" }}>Monthly Subscription</h1>
        <p style={{ color: "#aeb5c6", lineHeight: 1.7 }}>Your VaultTrades subscription gives you access to the paid application, including Analyzer, Strategies, AI Coach, Journal and Profile.</p>
        <div style={{ marginTop: 24, padding: 22, borderRadius: 12, border: "1px solid rgba(212,166,55,.3)", background: "#050812" }}>
          <div style={{ color: "#aeb5c6", fontSize: 13 }}>VaultTrades Monthly</div>
          <div style={{ marginTop: 8, color: "#d4a637", fontSize: 34, fontWeight: 800 }}>$73.99 <span style={{ color: "#aeb5c6", fontSize: 14, fontWeight: 500 }}>/ month</span></div>
          {email ? <div style={{ marginTop: 12, color: "#aeb5c6", fontSize: 13 }}>Account email: <strong style={{ color: "#f4f6fb" }}>{email}</strong></div> : null}
        </div>
        <a href={PAYPAL_PAYMENT_URL} style={{ display: "block", marginTop: 24, padding: "15px 18px", borderRadius: 9, background: "#d4a637", color: "#050812", fontWeight: 800, textAlign: "center", textDecoration: "none" }}>Subscribe with PayPal</a>
        <p style={{ marginTop: 18, color: "#7f8799", fontSize: 12, lineHeight: 1.5 }}>Access is not granted merely by clicking the payment button. VaultTrades will grant paid access only after the successful recurring payment is verified.</p>
        <Link href="/join" style={{ display: "block", marginTop: 18, textAlign: "center", color: "#aeb5c6", textDecoration: "none" }}>Back</Link>
      </section>
    </main>
  );
}

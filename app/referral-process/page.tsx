import Link from "next/link";

export default function ReferralProcessPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#050812", color: "#f4f6fb", padding: "42px 24px 80px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ color: "#d4a637", fontSize: 12, fontWeight: 800, letterSpacing: ".2em" }}>VAULTTRADES • REFERRAL</div>
        <h1 style={{ fontSize: "clamp(36px,6vw,60px)", lineHeight: 1.05, margin: "14px 0" }}>How the VaultTrades Referral Process Works</h1>
        <p style={{ color: "#aeb5c6", maxWidth: 760, lineHeight: 1.7 }}>
          Your personal referral link is available after you have signed up for at least one VaultTrades product.
        </p>

        <section style={card}>
          <h2>20% Commission Structure</h2>
          <p style={copy}>
            Earn <strong>20% commission</strong> when a person you refer subscribes to an eligible VaultTrades product through your referral link.
          </p>
          <p style={copy}>
            The commission is based on the qualifying subscription. A click or registration by itself does not create a commission.
          </p>
        </section>

        <section style={card}>
          <h2>How It Works</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {[
              ["01", "Share your referral link", "Copy and share your full personal VaultTrades referral URL with the person you want to refer."],
              ["02", "They register through your link", "Your referral code is carried into the registration process so the referral can be attributed to you."],
              ["03", "They subscribe", "The referred person must subscribe to an eligible VaultTrades product."],
              ["04", "You earn 20%", "Once the qualifying subscription is processed, the referral commission is calculated and recorded for you."],
              ["05", "PayPal payment", "Commission is payable to your PayPal account once your available commission balance reaches the $50 minimum payment threshold."]
            ].map(([number, title, description]) => (
              <article key={number} style={{ padding: 18, borderRadius: 12, background: "#050812", border: "1px solid rgba(255,255,255,.08)" }}>
                <div style={{ color: "#d4a637", fontWeight: 900 }}>{number}</div>
                <h3 style={{ margin: "6px 0" }}>{title}</h3>
                <p style={{ color: "#aeb5c6", lineHeight: 1.6, margin: 0 }}>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section style={card}>
          <h2>Important</h2>
          <ul style={{ color: "#aeb5c6", lineHeight: 1.8, paddingLeft: 22 }}>
            <li>Your referral link becomes active after you have signed up for at least one VaultTrades product.</li>
            <li>A referral click alone does not generate commission.</li>
            <li>A registration alone does not generate commission.</li>
            <li>The referred person must subscribe to an eligible VaultTrades product.</li>
            <li>Commission is calculated in USD.</li>
            <li>Commission may be reversed where an eligible transaction is reversed or refunded.</li>
            <li>PayPal is the payout account and the minimum payment threshold is $50.</li>
          </ul>
        </section>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 22 }}>
          <Link href="/profile" style={button}>Back to Profile →</Link>
          <Link href="/referral-vault" style={secondary}>Open Referral Vault →</Link>
        </div>
      </div>
    </main>
  );
}

const card = { marginTop: 18, padding: 24, borderRadius: 14, background: "#0a0f1c", border: "1px solid rgba(212,166,55,.18)" };
const copy = { color: "#aeb5c6", lineHeight: 1.7 };
const button = { display: "inline-block", padding: "13px 18px", borderRadius: 9, background: "#d4a637", color: "#050812", fontWeight: 800, textDecoration: "none" };
const secondary = { display: "inline-block", padding: "13px 18px", borderRadius: 9, border: "1px solid rgba(212,166,55,.35)", background: "transparent", color: "#d7dbe7", fontWeight: 800, textDecoration: "none" };

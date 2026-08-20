import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";

const PAYPAL_PAYMENT_URL = process.env.PAYPAL_SUBSCRIPTION_URL ?? "";

export default async function SubscriptionPage({ searchParams }: { searchParams: Promise<{ required?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/join?next=/subscription");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name,last_name,email")
    .eq("id", user.id)
    .maybeSingle();

  const { data: activeSubscription } = await supabase
    .from("subscriptions")
    .select("provider,status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (activeSubscription) redirect("/analyzer");

  return (
    <main style={{ minHeight: "calc(100vh - 61px)", background: "#050812", color: "#f4f6fb", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ width: "100%", maxWidth: 660, border: "1px solid rgba(212,166,55,.25)", borderRadius: 14, padding: 32, background: "#0a0f1c" }}>
        <div style={{ color: "#d4a637", fontSize: 12, fontWeight: 800, letterSpacing: ".18em" }}>VAULTTRADES</div>
        <h1 style={{ fontSize: 38, margin: "12px 0" }}>Monthly Subscription</h1>
        <p style={{ color: "#aeb5c6", lineHeight: 1.7 }}>Choose your payment method to activate your VaultTrades membership. Access is granted only after the payment provider confirms the subscription and VaultTrades verifies its webhook.</p>

        <div style={{ marginTop: 24, padding: 22, borderRadius: 12, border: "1px solid rgba(212,166,55,.3)", background: "#050812" }}>
          <div style={{ color: "#aeb5c6", fontSize: 13 }}>VaultTrades Monthly</div>
          <div style={{ marginTop: 8, color: "#d4a637", fontSize: 34, fontWeight: 800 }}>$73.99 <span style={{ color: "#aeb5c6", fontSize: 14, fontWeight: 500 }}>/ month</span></div>
          <div style={{ marginTop: 12, color: "#aeb5c6", fontSize: 13 }}>Account: <strong style={{ color: "#f4f6fb" }}>{profile?.first_name} {profile?.last_name}</strong> · {profile?.email ?? user.email}</div>
        </div>

        {params.required ? <p style={{ marginTop: 18, color: "#d4a637", fontWeight: 700 }}>An active subscription is required to access the application.</p> : null}

        {PAYPAL_PAYMENT_URL ? (
          <a href={PAYPAL_PAYMENT_URL} style={buttonStyle}>Pay with PayPal</a>
        ) : (
          <div style={{ ...buttonStyle, opacity: 0.55, textAlign: "center" }}>PayPal setup pending</div>
        )}

        <div style={{ ...buttonStyle, marginTop: 12, opacity: 0.55, textAlign: "center", background: "transparent", color: "#d4a637", border: "1px solid rgba(212,166,55,.35)" }}>
          Pay with Yoco
          <div style={{ fontSize: 11, fontWeight: 500, marginTop: 4, color: "#7f8799" }}>Payment integration is being connected</div>
        </div>

        <p style={{ marginTop: 18, color: "#7f8799", fontSize: 12, lineHeight: 1.5 }}>Clicking a payment option never grants access by itself. The verified provider webhook must activate the VaultTrades subscription linked to this account.</p>
        <Link href="/profile" style={{ display: "block", marginTop: 18, textAlign: "center", color: "#aeb5c6", textDecoration: "none" }}>View Profile</Link>
      </section>
    </main>
  );
}

const buttonStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 24,
  padding: "15px 18px",
  borderRadius: 9,
  background: "#d4a637",
  color: "#050812",
  fontWeight: 800,
  textAlign: "center",
  textDecoration: "none",
  boxSizing: "border-box",
};

"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

type Product = { code: string; name: string; price: string; suffix: string; description: string };
const MEMBER_PRODUCTS: Product[] = [
  { code: "journal_tools_monthly", name: "Journal + Core Tools", price: "10.00", suffix: "/month", description: "Trading Journal, AI Coaching, Risk Manager and Funded Account Wealth Builder." },
  { code: "analyzer_reseller_monthly", name: "Analyzer Access", price: "20.00", suffix: "/month", description: "Separate monthly Analyzer access reserved for MRR members." },
];
const EXTERNAL_PRODUCTS: Product[] = [
  { code: "analyzer_monthly", name: "Analyzer", price: "73.99", suffix: "/month", description: "Structured chart analysis, strategy conditions and trade planning." },
  { code: "founders_mentorship_once", name: "Founders Mentorship", price: "88.88", suffix: " once off", description: "A focused mentorship program with a 1-hour one-on-one session." },
  { code: "automated_trader_monthly", name: "Copy Trading", price: "99.99", suffix: "/month", description: "VaultTrades copy trading with connected MT5 execution." },
];

function SubscriptionContent() {
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get("product") || "analyzer_monthly";
  const autoStart = params.get("start") === "1";
  const startedRef = useRef(false);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [mt5Login, setMt5Login] = useState("");
  const [isMrrMember, setIsMrrMember] = useState(false);
  const [eligibilityLoaded, setEligibilityLoaded] = useState(false);
  const selected = [...MEMBER_PRODUCTS, ...EXTERNAL_PRODUCTS].some(p => p.code === requested) ? requested : "analyzer_monthly";

  useEffect(() => {
    let alive = true;
    fetch("/api/subscription/eligibility", { cache: "no-store" })
      .then(r => r.json())
      .then(data => { if (alive) setIsMrrMember(Boolean(data.isMrrMember)); })
      .catch(() => { if (alive) setIsMrrMember(false); })
      .finally(() => { if (alive) setEligibilityLoaded(true); });
    return () => { alive = false; };
  }, []);

  const startPayPal = async (productCode: string) => {
    if (MEMBER_PRODUCTS.some(p => p.code === productCode) && !isMrrMember) {
      setError("This service is reserved for verified VaultTrades MRR members.");
      return;
    }
    setLoading(productCode);
    setError("");
    try {
      const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const { data: authData } = await sb.auth.getUser();
      if (!authData.user) {
        const next = "/subscription?product=" + encodeURIComponent(productCode) + "&start=1";
        router.replace("/auth/register?next=" + encodeURIComponent(next));
        return;
      }
      if (productCode === "automated_trader_monthly") {
        const cleanMt5 = mt5Login.trim();
        if (!/^\d{4,12}$/.test(cleanMt5)) throw new Error("Enter your MT5 account ID before continuing to Copy Trading.");
        const registration = await fetch("/api/copy/customer", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mt5Login: cleanMt5 }),
        });
        const registrationData = await registration.json();
        if (!registration.ok) throw new Error(registrationData.message || registrationData.error || "Unable to save your MT5 account.");
      }
      const response = await fetch("/api/paypal/subscribe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productCode, mt5Login: productCode === "automated_trader_monthly" ? mt5Login.trim() : undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || "Unable to start PayPal checkout.");
      if (!data.approveUrl) throw new Error("PayPal did not return an approval URL.");
      window.location.href = data.approveUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to start PayPal checkout.");
      setLoading("");
    }
  };

  useEffect(() => {
    if (!autoStart || startedRef.current || !eligibilityLoaded) return;
    startedRef.current = true;
    if (selected === "automated_trader_monthly" || (MEMBER_PRODUCTS.some(p => p.code === selected) && !isMrrMember)) return;
    void startPayPal(selected);
  }, [autoStart, selected, eligibilityLoaded, isMrrMember]);

  const renderCard = (product: Product, memberOnly = false) => {
    const isCopy = product.code === "automated_trader_monthly";
    const locked = memberOnly && !isMrrMember;
    return (
      <article key={product.code} style={{ padding: 24, borderRadius: 14, background: "#0a0f1c", border: product.code === selected ? "1px solid rgba(212,166,55,.65)" : "1px solid rgba(212,166,55,.22)", opacity: locked ? .78 : 1 }}>
        <div style={{ color: "#d4a637", fontSize: 11, fontWeight: 800, letterSpacing: ".14em" }}>{locked ? "MRR MEMBERS ONLY" : product.code === selected ? "SELECTED" : "VAULTTRADES SERVICE"}</div>
        <h3 style={{ fontSize: 24, margin: "12px 0 8px" }}>{product.name}</h3>
        <div style={{ color: "#d4a637", fontSize: 32, fontWeight: 900 }}>${product.price}<span style={{ color: "#aeb5c6", fontSize: 13, fontWeight: 500 }}>{product.suffix}</span></div>
        <p style={{ color: "#aeb5c6", lineHeight: 1.6, minHeight: 52 }}>{product.description}</p>
        {isCopy && <div style={{ marginTop: 16 }}>
          <label style={{ display: "block", color: "#f4f6fb", fontSize: 13, fontWeight: 800, marginBottom: 7 }}>MT5 Account ID</label>
          <input value={mt5Login} onChange={e => setMt5Login(e.target.value.replace(/\D/g, "").slice(0, 12))} inputMode="numeric" placeholder="e.g. 335412575" style={{ width: "100%", padding: "12px 13px", borderRadius: 8, border: "1px solid rgba(212,166,55,.35)", background: "#050812", color: "#f4f6fb", outline: "none" }} />
          <p style={{ color: "#7f8799", fontSize: 12, lineHeight: 1.5, marginTop: 7 }}>Your VaultTrades account email and MT5 ID are saved for your Copy Trading license record.</p>
        </div>}
        <button onClick={() => void startPayPal(product.code)} disabled={Boolean(loading) || !eligibilityLoaded || locked} style={{ width: "100%", marginTop: 16, padding: "13px 16px", border: 0, borderRadius: 8, background: locked ? "#343947" : "#d4a637", color: locked ? "#c5cad4" : "#050812", fontWeight: 900, cursor: loading ? "wait" : locked ? "not-allowed" : "pointer" }}>
          {loading === product.code ? "Opening PayPal..." : locked ? "Available to MRR Members" : "Continue to PayPal"}
        </button>
      </article>
    );
  };

  return (
    <main style={{ minHeight: "calc(100vh - 61px)", background: "#050812", color: "#f4f6fb", padding: "48px 20px" }}>
      <section style={{ width: "100%", maxWidth: 1050, margin: "0 auto" }}>
        <div style={{ color: "#d4a637", fontSize: 12, fontWeight: 800, letterSpacing: ".18em" }}>VAULTTRADES PRODUCTS</div>
        <h1 style={{ fontSize: 40, margin: "12px 0" }}>Choose your VaultTrades service</h1>
        <p style={{ color: "#aeb5c6", lineHeight: 1.7, maxWidth: 760 }}>MRR member services and products for external subscribers are shown separately. All listed prices are standard prices; referral discounts are no longer offered. Qualifying referrals earn a standard 20% commission across eligible products.</p>
        <section style={{ marginTop: 30 }}>
          <div style={{ color: "#d4a637", fontSize: 12, fontWeight: 900, letterSpacing: ".16em" }}>MRR MEMBERS ONLY</div>
          <h2 style={{ fontSize: 27, margin: "8px 0 16px" }}>Member service subscriptions</h2>
          {!eligibilityLoaded && <p style={{ color: "#aeb5c6" }}>Checking membership access…</p>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 18 }}>{MEMBER_PRODUCTS.map(p => renderCard(p, true))}</div>
          {!isMrrMember && eligibilityLoaded && <p style={{ color: "#aeb5c6", fontSize: 13, marginTop: 12 }}>These two subscriptions are available only to verified VaultTrades MRR partners. Ordinary subscriber accounts cannot purchase them.</p>}
        </section>
        <section style={{ marginTop: 38 }}>
          <div style={{ color: "#d4a637", fontSize: 12, fontWeight: 900, letterSpacing: ".16em" }}>EXTERNAL SUBSCRIBERS</div>
          <h2 style={{ fontSize: 27, margin: "8px 0 16px" }}>Products available separately</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 18 }}>{EXTERNAL_PRODUCTS.map(p => renderCard(p))}</div>
        </section>
        {selected === "automated_trader_monthly" && <section style={{ marginTop: 22, padding: 20, borderRadius: 12, background: "#0a0f1c", border: "1px solid rgba(212,166,55,.22)" }}>
          <div style={{ color: "#d4a637", fontSize: 11, fontWeight: 800, letterSpacing: ".14em" }}>COPY TRADING LICENSE</div>
          <p style={{ color: "#c6ccda", lineHeight: 1.7, margin: "10px 0 0" }}>Your 30-day license starts from the exact date and time the Copy Trading subscription is issued. A pairing code is valid for up to 24 hours when unused, but never beyond the subscription expiry. Generating or activating a pairing code does not restart or extend the 30-day license.</p>
        </section>}
        {error && <div style={{ marginTop: 20, padding: 14, borderRadius: 9, background: "rgba(220,70,70,.12)", color: "#ffb5b5" }}>{error}</div>}
      </section>
    </main>
  );
}

export default function SubscriptionPage() {
  return <Suspense fallback={<main style={{ minHeight: "calc(100vh - 61px)", background: "#050812", color: "#f4f6fb", padding: "48px 20px" }}>Loading VaultTrades subscription...</main>}><SubscriptionContent /></Suspense>;
}

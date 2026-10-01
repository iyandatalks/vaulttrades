"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

const PRODUCTS = [
  { code: "analyzer_monthly", name: "Analyzer", price: "73.99", suffix: "/month", description: "Structured chart analysis, strategy conditions and trade planning." },
  { code: "founders_mentorship_once", name: "Founders Mentorship", price: "88.88", suffix: " once off", description: "A focused mentorship program with a 1-hour one-on-one session." },
  { code: "automated_trader_monthly", name: "Copy Trading", price: "99.99", suffix: "/month", description: "VaultTrades copy trading with connected MT5 execution." },
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
  const [mt5Login, setMt5Login] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [discount, setDiscount] = useState<any>(null);
  const [discountError, setDiscountError] = useState("");
  const [applyingDiscount, setApplyingDiscount] = useState(false);

  const applyReferralCode = async (productCode: string) => {
    setApplyingDiscount(true);
    setDiscountError("");
    setDiscount(null);
    try {
      const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const { data: authData } = await sb.auth.getUser();
      if (!authData.user) {
        const next = "/subscription?product=" + encodeURIComponent(productCode);
        router.replace("/auth/register?next=" + encodeURIComponent(next));
        return;
      }
      const response = await fetch("/api/referrals/validate-discount", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ productCode, code: referralCode }) });
      const data = await response.json();
      if (!response.ok || !data.valid) throw new Error(data.error || "Invalid referral code.");
      setDiscount(data.discount);
    } catch (e) {
      setDiscountError(e instanceof Error ? e.message : "Unable to validate the referral code.");
    } finally { setApplyingDiscount(false); }
  };

  const startPayPal = async (productCode: string) => {
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
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mt5Login: cleanMt5 }),
        });
        const registrationData = await registration.json();
        if (!registration.ok) throw new Error(registrationData.message || registrationData.error || "Unable to save your MT5 account.");
      }

      if (referralCode.trim() && discount && discount.productCode === productCode) {
        const response = await fetch("/api/referrals/prepare-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productCode, code: referralCode.trim().toUpperCase() }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.valid || !data.paymentUrl) {
          throw new Error(data.error || "Unable to prepare the discounted PayPal payment.");
        }
        window.location.href = data.paymentUrl;
        return;
      }

      const response = await fetch("/api/paypal/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productCode,
          mt5Login: productCode === "automated_trader_monthly" ? mt5Login.trim() : undefined,
        }),
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
    if (!autoStart || startedRef.current) return;
    startedRef.current = true;
    if (selected === "automated_trader_monthly") return;
    void startPayPal(selected);
  }, [autoStart, selected]);

  return (
    <main style={{ minHeight: "calc(100vh - 61px)", background: "#050812", color: "#f4f6fb", padding: "48px 20px" }}>
      <section style={{ width: "100%", maxWidth: 1050, margin: "0 auto" }}>
        <div style={{ color: "#d4a637", fontSize: 12, fontWeight: 800, letterSpacing: ".18em" }}>VAULTTRADES PRODUCTS</div>
        <h1 style={{ fontSize: 40, margin: "12px 0" }}>Choose your VaultTrades service</h1>
        <p style={{ color: "#aeb5c6", lineHeight: 1.7, maxWidth: 760 }}>
          Analyzer and Copy Trading use monthly PayPal subscriptions. Founders Mentorship is a separate once-off purchase.
          Copy Trading requires your MT5 account ID before checkout.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 18, marginTop: 28 }}>
          {PRODUCTS.map(product => {
            const isCopy = product.code === "automated_trader_monthly";
            return (
              <article key={product.code} style={{ padding: 24, borderRadius: 14, background: "#0a0f1c", border: product.code === requested ? "1px solid rgba(212,166,55,.65)" : "1px solid rgba(212,166,55,.22)" }}>
                <div style={{ color: "#d4a637", fontSize: 11, fontWeight: 800, letterSpacing: ".14em" }}>{product.code === requested ? "SELECTED" : "VAULTTRADES SERVICE"}</div>
                <h2 style={{ fontSize: 24, margin: "12px 0 8px" }}>{product.name}</h2>
                <div style={{ color: "#d4a637", fontSize: 32, fontWeight: 900 }}>
                  {"$"}{product.price}
                  <span style={{ color: "#aeb5c6", fontSize: 13, fontWeight: 500 }}>{product.suffix}</span>
                </div>
                <p style={{ color: "#aeb5c6", lineHeight: 1.6, minHeight: 52 }}>{product.description}</p>

                {isCopy && (
                  <div style={{ marginTop: 16 }}>
                    <label style={{ display: "block", color: "#f4f6fb", fontSize: 13, fontWeight: 800, marginBottom: 7 }}>MT5 Account ID</label>
                    <input
                      value={mt5Login}
                      onChange={(e) => setMt5Login(e.target.value.replace(/\D/g, "").slice(0, 12))}
                      inputMode="numeric"
                      placeholder="e.g. 335412575"
                      style={{ width: "100%", padding: "12px 13px", borderRadius: 8, border: "1px solid rgba(212,166,55,.35)", background: "#050812", color: "#f4f6fb", outline: "none" }}
                    />
                    <p style={{ color: "#7f8799", fontSize: 12, lineHeight: 1.5, marginTop: 7 }}>
                      Your VaultTrades account email and MT5 ID are saved for your Copy Trading license record.
                    </p>
                  </div>
                )}

                <div style={{ marginTop: 16, padding: 14, borderRadius: 10, background: "rgba(220,38,38,.08)", border: "1px solid rgba(220,38,38,.35)" }}>
                  <div style={{ color: "#ff4d4d", fontWeight: 950, fontSize: 14 }}>50% DISCOUNT — CODE VAULT50</div>
                  <div style={{ color: "#aeb5c6", fontSize: 12, marginTop: 5 }}>Valid for the first 6 monthly billing cycles when you qualify through a VaultTrades referral.</div>
                  <div style={{ display:"flex", gap:8, marginTop:10 }}>
                    <input value={referralCode} onChange={e=>setReferralCode(e.target.value.toUpperCase())} placeholder="Enter VAULT50" style={{ flex:1, padding:"11px 12px", borderRadius:8, border:"1px solid rgba(220,38,38,.4)", background:"#050812", color:"#f4f6fb", outline:"none" }} />
                    <button onClick={()=>void applyReferralCode(product.code)} disabled={applyingDiscount || !referralCode.trim()} style={{ padding:"11px 14px", border:0, borderRadius:8, background:"#dc2626", color:"white", fontWeight:900, cursor:applyingDiscount?"wait":"pointer" }}>{applyingDiscount?"Checking…":"Apply"}</button>
                  </div>
                  {discountError && <div style={{ color:"#ffb5b5", fontSize:12, marginTop:8 }}>{discountError}</div>}
                  {discount && discount.productCode === product.code && <div style={{ marginTop:10, color:"#e7eaf0", fontSize:13, lineHeight:1.7 }}>
                    <div>Original: <s>${discount.originalPrice.toFixed(2)}/month</s></div>
                    <div style={{ color:"#ff6b6b", fontWeight:800 }}>VAULT50 discount: -${discount.discountAmount.toFixed(2)} ({discount.discountPercent}%)</div>
                    <div style={{ fontSize:18, fontWeight:950 }}>You pay: ${discount.discountedPrice.toFixed(2)}/month for {discount.discountCycles} months</div>
                    <div style={{ color:"#aeb5c6", fontSize:12 }}>After month {discount.discountCycles}: ${discount.originalPrice.toFixed(2)}/month.</div>
                  </div>}
                </div>

                {discount && discount.productCode === product.code ? (
                  <button onClick={() => void startPayPal(product.code)} disabled={Boolean(loading)} style={{ width: "100%", marginTop: 16, padding: "13px 16px", border: 0, borderRadius: 8, background: "#dc2626", color: "#fff", fontWeight: 900, cursor: loading ? "wait" : "pointer" }}>
                    {loading === product.code ? "Opening discounted PayPal..." : `Pay ${discount.discountedPrice.toFixed(2)}/month with VAULT50`}
                  </button>
                ) : (
                  <button onClick={() => void startPayPal(product.code)} disabled={Boolean(loading)} style={{ width: "100%", marginTop: 16, padding: "13px 16px", border: 0, borderRadius: 8, background: "#d4a637", color: "#050812", fontWeight: 900, cursor: loading ? "wait" : "pointer" }}>
                    {loading === product.code ? "Opening PayPal..." : "Continue to PayPal"}
                  </button>
                )}
              </article>
            );
          })}
        </div>

        {selected === "automated_trader_monthly" && (
          <section style={{ marginTop: 22, padding: 20, borderRadius: 12, background: "#0a0f1c", border: "1px solid rgba(212,166,55,.22)" }}>
            <div style={{ color: "#d4a637", fontSize: 11, fontWeight: 800, letterSpacing: ".14em" }}>COPY TRADING LICENSE</div>
            <p style={{ color: "#c6ccda", lineHeight: 1.7, margin: "10px 0 0" }}>
              Your 30-day license starts from the exact date and time the Copy Trading subscription is issued.
              A pairing code is valid for up to 24 hours when unused, but never beyond the subscription expiry.
              Generating or activating a pairing code does not restart or extend the 30-day license.
            </p>
            <p style={{ color: "#c6ccda", lineHeight: 1.7, margin: "8px 0 0" }}>
              Example: if the license is issued on 1 September at 14:30, it expires on 1 October at 14:30.
              If the pairing code is generated on 29 September at 10:00, its unused 24-hour window ends on 30 September at 10:00.
              The code cannot survive beyond the subscription expiry.
            </p>
          </section>
        )}

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

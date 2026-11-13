"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";

type PlanCode = "nexus" | "nexus_plus" | "vortex";
type Plan = { name: string; price: number; description: string };
const MRR: Record<PlanCode, number> = { nexus: 120, nexus_plus: 200, vortex: 440 };
const EA: Record<PlanCode, number> = { nexus: 30, nexus_plus: 50, vortex: 110 };

export default function MembershipCheckoutClient({
  planCode, plan, email, resellerCode, declarationId, paypalToken, paymentStatus,
}: {
  planCode: PlanCode; plan: Plan; email: string; resellerCode: string;
  declarationId: string; paypalToken: string; paymentStatus: string;
}) {
  const [resellerWebsite, setResellerWebsite] = useState("");
  const [amount, setAmount] = useState(String(MRR[planCode]));
  const [transactionReference, setTransactionReference] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentTime, setPaymentTime] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [captured, setCaptured] = useState(false);

  const vaultTradesTotal = 39 + EA[planCode];

  useEffect(() => {
    if (!paypalToken || captured) return;
    let active = true;
    setBusy(true);
    setNotice("Confirming your VaultTrades payment with PayPal…");
    fetch("/api/paypal/capture-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: paypalToken }),
    }).then(async response => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to verify the VaultTrades payment.");
      if (!active) return;
      setCaptured(true);
      setNotice("Your VaultTrades website and EA setup payment has been verified. Your membership remains pending until your reseller confirms receipt of the separate MRR payment.");
    }).catch(err => {
      if (active) setError(err instanceof Error ? err.message : "Unable to verify payment.");
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [paypalToken, captured]);

  async function submitCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      if (!resellerCode) throw new Error("The reseller reference is missing. Return using the link supplied by your reseller.");
      const declarationResponse = await fetch("/api/reseller/purchase-declarations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planCode, resellerCode, resellerWebsite, amount: Number(amount),
          transactionReference, paymentDate, paymentTime, termsAccepted,
        }),
      });
      const declarationData = await declarationResponse.json().catch(() => ({}));
      if (!declarationResponse.ok) throw new Error(declarationData.error || "Unable to save your reseller payment declaration.");

      const orderResponse = await fetch("/api/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderType: "reseller_setup", declarationId: declarationData.declaration.id }),
      });
      const orderData = await orderResponse.json().catch(() => ({}));
      if (!orderResponse.ok || !orderData.approveUrl) throw new Error(orderData.error || "Unable to start VaultTrades PayPal checkout.");
      window.location.assign(orderData.approveUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to continue to checkout.");
      setBusy(false);
    }
  }

  return (
    <main className="vt-checkout-shell">
      <section className="vt-checkout-card">
        <div className="vt-checkout-kicker">VAULTTRADES CUSTOMER CHECKOUT</div>
        <h1>Complete your purchase</h1>
        <p className="vt-checkout-intro">Your reseller payment and your VaultTrades setup payment are separate transactions. Your VaultTrades profile is linked to the selected product, and access is activated only after both payments have been verified.</p>
        <div className="vt-checkout-plan">
          <div><span>SELECTED MEMBERSHIP</span><h2>{plan.name}</h2><p>{plan.description}</p></div>
          <strong>${plan.price.toFixed(2)} <small>USD package price</small></strong>
        </div>
        <div className="vt-checkout-addon">
          <span><strong>MRR payment made to your reseller</strong><small>Declare the amount you paid using your reseller's PayPal link. This payment is checked by the reseller, not by VaultTrades.</small></span>
          <b>${MRR[planCode].toFixed(2)}</b>
        </div>
        <div className="vt-checkout-addon">
          <span><strong>EA automation setup · once-off</strong><small>Payable to VaultTrades. EA operation requires an approved broker and compulsory VPS.</small></span>
          <b>${EA[planCode].toFixed(2)}</b>
        </div>
        <div className="vt-checkout-addon">
          <span><strong>Required reseller website setup</strong><small>Payable to VaultTrades. Activates your four-page reseller website.</small></span>
          <b>$39.00</b>
        </div>
        <div className="vt-checkout-total"><span>Payable to VaultTrades now</span><strong>${vaultTradesTotal.toFixed(2)} USD</strong></div>
        <div className="vt-checkout-account">VaultTrades profile: {email}</div>

        {paypalToken ? (
          <div className="vt-checkout-pending">
            <strong>{captured ? "VaultTrades payment verified" : "Verifying VaultTrades payment"}</strong>
            <span>{notice || "Please wait while the payment is checked."}</span>
          </div>
        ) : paymentStatus === "cancelled" ? (
          <div className="vt-checkout-pending"><strong>Payment was not completed</strong><span>You can review the declaration and continue to VaultTrades PayPal checkout when ready.</span></div>
        ) : (
          <form className="vt-checkout-form" onSubmit={submitCheckout}>
            <h2>Confirm your reseller purchase</h2>
            <p>Enter the details of the payment you already made to the reseller. No receipt, screenshot or payment proof upload is required.</p>
            <label>Reseller website<input required value={resellerWebsite} onChange={e => setResellerWebsite(e.target.value)} placeholder="e.g. sibongilegigitalonline.com" /></label>
            <label>Amount paid to reseller (USD)<input required type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></label>
            <label>PayPal transaction or invoice number<input required minLength={5} maxLength={120} value={transactionReference} onChange={e => setTransactionReference(e.target.value)} placeholder="Enter the PayPal reference" /></label>
            <div className="vt-checkout-date-row">
              <label>Payment date<input required type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} /></label>
              <label>Payment time (if known)<input type="time" value={paymentTime} onChange={e => setPaymentTime(e.target.value)} /></label>
            </div>
            <label className="vt-checkout-terms"><input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} /><span>I confirm that the reseller payment details I have entered are accurate. I understand that my reseller must independently verify receipt of their payment before my membership access can be activated, and that my VaultTrades payment covers only the website and EA setup fees.</span></label>
            {error && <p className="vt-checkout-error" role="alert">{error}</p>}
            <button className="vt-checkout-pay" type="submit" disabled={busy || !termsAccepted}>{busy ? "Preparing secure checkout…" : `Continue to PayPal · $${vaultTradesTotal.toFixed(2)} USD`}</button>
          </form>
        )}
        {notice && !paypalToken && <p className="vt-checkout-notice" role="status">{notice}</p>}
        <div className="vt-checkout-actions"><Link href="/plans" className="vt-checkout-secondary">Change plan</Link><Link href="/profile" className="vt-checkout-secondary">Open profile</Link></div>
      </section>
    </main>
  );
}

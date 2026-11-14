"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";

type PlanCode = "nexus" | "nexus_plus" | "vortex";
type Plan = { name: string; automationName: string; price: number; description: string };
const MRR: Record<PlanCode, number> = { nexus: 120, nexus_plus: 200, vortex: 440 };
const EA: Record<PlanCode, number> = { nexus: 30, nexus_plus: 50, vortex: 110 };
const EA_PAYPAL: Record<PlanCode, string> = {
  nexus: "https://www.paypal.com/ncp/payment/KCLJNRHL8ES2A",
  nexus_plus: "https://www.paypal.com/ncp/payment/XZUE222GL354L",
  vortex: "https://www.paypal.com/ncp/payment/BKSANDDAJT7M6",
};
const WEBSITE_PAYPAL = "https://www.paypal.com/ncp/payment/L4Q3HEC5VYKPQ";

type PaymentStatus = {
  declaration?: { id: string; plan_code: string; reseller_payment_status: string; vaulttrades_payment_status: string };
  payments?: { eaSetupPaid: boolean; websiteSetupPaid: boolean; vaultTradesSetupComplete: boolean };
};

export default function MembershipCheckoutClient({
  planCode, plan, email, resellerCode, declarationId,
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
  const [activeDeclarationId, setActiveDeclarationId] = useState(declarationId || "");
  const [paymentStatusData, setPaymentStatusData] = useState<PaymentStatus | null>(null);

  useEffect(() => {
    if (!activeDeclarationId) return;
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/reseller/purchase-declarations?declarationId=${encodeURIComponent(activeDeclarationId)}`, { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (response.ok && active) setPaymentStatusData(data);
      } catch { /* The webhook status can be refreshed when the customer returns to this page. */ }
    };
    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, 10000);
    return () => { active = false; window.clearInterval(interval); };
  }, [activeDeclarationId]);

  async function submitCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      if (!resellerCode) throw new Error("The reseller reference is missing. Return using the link supplied by your reseller.");
      const response = await fetch("/api/reseller/purchase-declarations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planCode, resellerCode, resellerWebsite, amount: Number(amount),
          transactionReference, paymentDate, paymentTime, termsAccepted,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to save your reseller payment declaration.");
      const id = String(data.declaration?.id || "");
      if (!id) throw new Error("The purchase declaration was saved without an order reference. Contact VaultTrades support.");
      setActiveDeclarationId(id);
      setNotice("Your reseller payment declaration has been recorded. Complete both separate VaultTrades PayPal payments below. The VaultTrades webhook will update their verification status.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to continue to checkout.");
    } finally { setBusy(false); }
  }

  const statuses = paymentStatusData?.payments;
  const resellerConfirmed = paymentStatusData?.declaration?.reseller_payment_status === "confirmed_by_reseller";

  return (
    <main className="vt-checkout-shell">
      <section className="vt-checkout-card">
        <div className="vt-checkout-kicker">VAULTTRADES CUSTOMER CHECKOUT</div>
        <h1>Complete your purchase</h1>
        <p className="vt-checkout-intro">Your reseller MRR payment is made directly to your reseller. Your EA setup and website setup payments are separate VaultTrades payments, verified by the VaultTrades PayPal webhook.</p>
        <div className="vt-checkout-plan">
          <div><span>SELECTED MEMBERSHIP</span><h2>{plan.name}</h2><p>{plan.description}</p><p className="vt-checkout-automation-name"><strong>EA PRODUCT:</strong> {plan.automationName}</p></div>
          <strong>${plan.price.toFixed(2)} <small>USD package allocation</small></strong>
        </div>
        <div className="vt-checkout-addon">
          <span><strong>Eligible MRR component · paid directly to your reseller</strong><small>Your reseller independently verifies this payment in their own PayPal account.</small></span>
          <b>${MRR[planCode].toFixed(2)}</b>
        </div>
        <div className="vt-checkout-addon">
          <span><strong>EA setup · paid to VaultTrades</strong><small>Separate once-off EA setup payment. Confirmed through the VaultTrades PayPal webhook.</small></span>
          <b>${EA[planCode].toFixed(2)}</b>
        </div>
        <div className="vt-checkout-addon">
          <span><strong>Website setup · paid to VaultTrades</strong><small>Separate once-off reseller website setup payment. Confirmed through the VaultTrades PayPal webhook.</small></span>
          <b>$39.00</b>
        </div>
        <div className="vt-checkout-account">VaultTrades profile: {email}</div>

        {!activeDeclarationId ? (
          <form className="vt-checkout-form" onSubmit={submitCheckout}>
            <h2>Declare your reseller payment</h2>
            <p>Pay the eligible MRR amount directly to your reseller first. Then enter the payment details so the reseller can verify receipt. Your VaultTrades payments are made separately below.</p>
            <label>Reseller website<input required value={resellerWebsite} onChange={e => setResellerWebsite(e.target.value)} placeholder="e.g. yourname.vaulttradesve.com" /></label>
            <label>Amount paid to reseller (USD)<input required type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></label>
            <label>PayPal transaction or invoice number<input required minLength={5} maxLength={120} value={transactionReference} onChange={e => setTransactionReference(e.target.value)} placeholder="Enter the reseller PayPal reference" /></label>
            <div className="vt-checkout-date-row">
              <label>Payment date<input required type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} /></label>
              <label>Payment time (if known)<input type="time" value={paymentTime} onChange={e => setPaymentTime(e.target.value)} /></label>
            </div>
            <label className="vt-checkout-terms"><input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} /><span>I confirm that I have paid the reseller directly and that the details entered are accurate. I understand that the reseller must independently verify receipt before membership access can be activated.</span></label>
            {error && <p className="vt-checkout-error" role="alert">{error}</p>}
            <button className="vt-checkout-pay" type="submit" disabled={busy || !termsAccepted}>{busy ? "Recording declaration…" : "Continue to VaultTrades payments"}</button>
          </form>
        ) : (
          <div className="vt-checkout-form">
            <h2>Complete your VaultTrades payments</h2>
            <p>Your reseller declaration is saved. Pay each VaultTrades charge separately using the official PayPal links below. Return to this page after payment; webhook status refreshes automatically.</p>
            <div className="vt-checkout-addon">
              <span><strong>EA setup payment</strong><small>{statuses?.eaSetupPaid ? "PayPal webhook verified this payment." : "Awaiting PayPal webhook confirmation."}</small></span>
              <b>{statuses?.eaSetupPaid ? "Verified" : `$${EA[planCode].toFixed(2)}`}</b>
            </div>
            <a className="vt-checkout-pay" href={EA_PAYPAL[planCode]} target="_blank" rel="noreferrer">Pay EA setup · ${EA[planCode].toFixed(2)} USD</a>
            <div className="vt-checkout-addon">
              <span><strong>Website setup payment</strong><small>{statuses?.websiteSetupPaid ? "PayPal webhook verified this payment." : "Awaiting PayPal webhook confirmation."}</small></span>
              <b>{statuses?.websiteSetupPaid ? "Verified" : "$39.00"}</b>
            </div>
            <a className="vt-checkout-pay" href={WEBSITE_PAYPAL} target="_blank" rel="noreferrer">Pay website setup · $39.00 USD</a>
            <div className="vt-checkout-pending">
              <strong>{statuses?.vaultTradesSetupComplete ? "VaultTrades payments verified" : "Awaiting VaultTrades payment verification"}</strong>
              <span>{resellerConfirmed ? "Your reseller has confirmed the MRR payment." : "Your reseller must still independently confirm the MRR payment."} Membership access is activated only after both VaultTrades payments and the reseller payment have been verified.</span>
            </div>
            <button type="button" className="vt-checkout-secondary" onClick={() => window.location.reload()}>Refresh payment status</button>
          </div>
        )}
        {notice && <p className="vt-checkout-notice" role="status">{notice}</p>}
        <div className="vt-checkout-actions"><Link href="/plans" className="vt-checkout-secondary">Change plan</Link><Link href="/profile" className="vt-checkout-secondary">Open profile</Link></div>
      </section>
    </main>
  );
}

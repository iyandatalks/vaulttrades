"use client";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";

type PlanCode = "nexus" | "nexus_plus" | "vortex";
type Plan = { name: string; eaName: string; price: number; description: string };
const MRR: Record<PlanCode, number> = { nexus: 120, nexus_plus: 200, vortex: 440 };
const EA: Record<PlanCode, number> = { nexus: 30, nexus_plus: 50, vortex: 110 };
const EA_PAYPAL: Record<PlanCode, string> = {
  nexus: "https://www.paypal.com/ncp/payment/KCLJNRHL8ES2A",
  nexus_plus: "https://www.paypal.com/ncp/payment/XZUE222GL354L",
  vortex: "https://www.paypal.com/ncp/payment/BKSANDDAJT7M6",
};
const WEBSITE_PAYPAL = "https://www.paypal.com/ncp/payment/L4Q3HEC5VYKPQ";
const RESELLER_PAYPAL: Record<string, Partial<Record<PlanCode, string>>> = {
  "VT-C4D867E2": {
    nexus: "https://www.paypal.com/ncp/payment/NPHGR52G8QXUS",
    nexus_plus: "https://www.paypal.com/ncp/payment/FYDV4X5ELLUCS",
    vortex: "https://www.paypal.com/ncp/payment/UEF2B7PU3FJRU",
  },
};

type PaymentStatus = {
  declaration?: { id: string; plan_code: string; reseller_payment_status: string; vaulttrades_payment_status: string; declared_mrr_amount?: number };
  payments?: { eaSetupPaid: boolean; websiteSetupPaid: boolean; vaultTradesSetupComplete: boolean };
};

function Step({ number, complete, title, detail }: { number: number; complete: boolean; title: string; detail: string }) {
  return <div className={"vt-checkout-step " + (complete ? "is-complete" : "")}>
    <span className="vt-checkout-step-mark" aria-label={complete ? "Completed" : "Not completed"}>{complete ? "✓" : number}</span>
    <div><strong>{title}</strong><p>{detail}</p></div>
  </div>;
}

export default function MembershipCheckoutClient({ planCode, plan, email, resellerCode, declarationId, isAuthenticated, registrationHref }: {
  planCode: PlanCode; plan: Plan; email: string; resellerCode: string; declarationId: string; isAuthenticated: boolean; registrationHref: string;
}) {
  const [amount, setAmount] = useState(String(MRR[planCode]));
  const [transactionReference, setTransactionReference] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activeDeclarationId, setActiveDeclarationId] = useState(declarationId || "");
  const [paymentStatusData, setPaymentStatusData] = useState<PaymentStatus | null>(null);

  useEffect(() => {
    if (!activeDeclarationId || !isAuthenticated) return;
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/reseller/purchase-declarations?declarationId=" + encodeURIComponent(activeDeclarationId), { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (response.ok && active) setPaymentStatusData(data);
      } catch { /* Customer can retry the status refresh. */ }
    };
    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, 10000);
    return () => { active = false; window.clearInterval(interval); };
  }, [activeDeclarationId, isAuthenticated]);

  async function submitCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const paidAmount = Number(amount);
      if (!resellerCode) throw new Error("This purchase link is missing its partner reference. Please reopen the link you received.");
      if (!Number.isFinite(paidAmount) || paidAmount <= 0) throw new Error("Enter the amount you actually paid.");
      const response = await fetch("/api/reseller/purchase-declarations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode, resellerCode, amount: paidAmount, transactionReference, invoiceNumber }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "We could not record your payment details. Please try again.");
      const id = String(data.declaration?.id || "");
      if (!id) throw new Error("Your payment details were not assigned an order reference. Please contact VaultTrades support.");
      setActiveDeclarationId(id);
      const next = new URL("/membership/checkout", window.location.origin);
      next.searchParams.set("plan", planCode);
      next.searchParams.set("ref", resellerCode);
      next.searchParams.set("declaration", id);
      window.location.assign(next.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to continue.");
      setBusy(false);
    }
  }

  const statuses = paymentStatusData?.payments;
  const resellerConfirmed = paymentStatusData?.declaration?.reseller_payment_status === "confirmed_by_reseller";
  const declarationSubmitted = Boolean(activeDeclarationId || paymentStatusData?.declaration?.id);
  const setupComplete = statuses?.vaultTradesSetupComplete === true;
  const loginNext = "/membership/checkout?plan=" + encodeURIComponent(planCode) + "&ref=" + encodeURIComponent(resellerCode) + (activeDeclarationId ? "&declaration=" + encodeURIComponent(activeDeclarationId) : "");

  return <main className="vt-checkout-shell"><section className="vt-checkout-card">
    <div className="vt-checkout-kicker">YOUR MEMBERSHIP CHECKOUT</div>
    <h1>Complete your {plan.name} order</h1>
    <p className="vt-checkout-intro">Your partner membership payment and VaultTrades setup payments are separate. Follow the steps below. Your selected plan and partner reference stay attached while you create and verify your VaultTrades profile.</p>

    <div className="vt-checkout-plan"><div><span>YOUR SELECTED MEMBERSHIP</span><h2>{plan.name}</h2><p>{plan.description}</p><p className="vt-checkout-automation-name"><strong>INCLUDED PRODUCT:</strong> {plan.eaName}</p></div><strong>{plan.name}</strong></div>

    <section className="vt-checkout-progress" aria-label="Checkout steps">
      <h2>Your checkout steps</h2>
      <Step number={1} complete={declarationSubmitted} title="Complete your partner membership payment" detail={declarationSubmitted ? "Your payment declaration has been submitted. Your partner must still verify receipt." : "Pay your selected membership amount to the partner who referred you."} />
      <Step number={2} complete={isAuthenticated} title="Create and verify your VaultTrades profile" detail={isAuthenticated ? "Profile verified and signed in as " + email + "." : "Create your VaultTrades profile and verify your email address. You will return to this same checkout afterwards."} />
      <Step number={3} complete={setupComplete} title="Complete your VaultTrades setup payments" detail={setupComplete ? "Both VaultTrades setup payments have been verified." : "Pay the separate EA setup fee and website setup fee. These are paid to VaultTrades, not your partner."} />
      <Step number={4} complete={resellerConfirmed} title="Partner confirms the membership payment" detail={resellerConfirmed ? "Your partner has confirmed receipt of the membership payment." : "Your partner checks their own PayPal account and confirms the membership payment in VaultTrades."} />
    </section>

    <section className="vt-checkout-section">
      <div className="vt-checkout-section-heading"><span className="vt-checkout-section-number">1</span><div><h2>Pay your partner</h2><p>Complete the membership payment using your partner's secure PayPal link.</p></div></div>
      {RESELLER_PAYPAL[resellerCode]?.[planCode]
        ? <a className="vt-checkout-pay" href={RESELLER_PAYPAL[resellerCode][planCode]} target="_blank" rel="noreferrer">{"Pay partner · $" + MRR[planCode].toFixed(2) + " USD"}</a>
        : <div className="vt-checkout-pending"><strong>Partner payment link unavailable</strong><span>Please reopen this checkout using the purchase link supplied by your partner.</span></div>}
      <p className="vt-checkout-note">This payment goes directly to your partner. VaultTrades does not collect this membership amount and will not ask you to pay it again.</p>
    </section>

    <section className="vt-checkout-section">
      <div className="vt-checkout-section-heading"><span className="vt-checkout-section-number">2</span><div><h2>Create your VaultTrades profile</h2><p>A verified VaultTrades profile is required for your Knowledge Base, community access, setup requests and member support.</p></div></div>
      {isAuthenticated
        ? <div className="vt-checkout-success"><strong>✓ Your VaultTrades profile is verified</strong><span>Signed in as {email}. Continue below to finish your checkout.</span></div>
        : <>
            <div className="vt-checkout-pending"><strong>You must create and verify your profile before continuing.</strong><span>After registration, check your email and follow the verification link. VaultTrades will then bring you back to this same membership checkout with your selected plan and partner reference preserved.</span></div>
            <Link className="vt-checkout-pay vt-checkout-link-button" href={registrationHref}>Create your VaultTrades profile</Link>
            <p className="vt-checkout-note">Already have a VaultTrades account? <Link href={"/auth/login?next=" + encodeURIComponent(loginNext)}>Log in here</Link>.</p>
          </>}
    </section>

    {declarationSubmitted && <section className="vt-checkout-section">
      <div className="vt-checkout-section-heading"><span className="vt-checkout-section-number">3</span><div><h2>VaultTrades setup payments</h2><p>These are one-time payments to VaultTrades. They are separate from the membership payment made to your partner.</p></div></div>
      <p className="vt-checkout-note"><strong>Important:</strong> Use the same PayPal email address as your VaultTrades profile so PayPal can match your setup payment to this order.</p>
      <div className="vt-checkout-addon"><span><strong>{plan.eaName} · EA setup</strong><small>{statuses?.eaSetupPaid ? "Payment verified by VaultTrades." : "Awaiting PayPal verification."}</small></span><b>{statuses?.eaSetupPaid ? "Verified ✓" : "$" + EA[planCode].toFixed(2) + " USD"}</b></div>
      {!statuses?.eaSetupPaid && <a className="vt-checkout-pay" href={EA_PAYPAL[planCode]} target="_blank" rel="noreferrer">{"Pay EA setup · $" + EA[planCode].toFixed(2) + " USD"}</a>}
      <div className="vt-checkout-addon"><span><strong>VaultTrades website setup</strong><small>{statuses?.websiteSetupPaid ? "Payment verified by VaultTrades." : "Awaiting PayPal verification."}</small></span><b>{statuses?.websiteSetupPaid ? "Verified ✓" : "$39.00 USD"}</b></div>
      {!statuses?.websiteSetupPaid && <a className="vt-checkout-pay" href={WEBSITE_PAYPAL} target="_blank" rel="noreferrer">Pay website setup · $39.00 USD</a>}
      <button type="button" className="vt-checkout-secondary-button" onClick={() => window.location.reload()}>Refresh VaultTrades payment status</button>
    </section>}

    <section className="vt-checkout-section vt-checkout-declaration">
      <div className="vt-checkout-section-heading"><span className="vt-checkout-section-number">4</span><div><h2>Confirm your partner payment</h2><p>Complete this declaration after you have paid your partner. Your partner will independently check PayPal and confirm receipt.</p></div></div>
      {declarationSubmitted
        ? <div className="vt-checkout-pending"><strong>{resellerConfirmed ? "Partner payment confirmed" : "Partner payment declaration received"}</strong><span>{resellerConfirmed ? "Your partner has confirmed receipt." : "Your declaration is recorded. Your partner still needs to confirm that the membership payment was received. This does not require another payment from you."}</span></div>
        : isAuthenticated
          ? <form className="vt-checkout-form" onSubmit={submitCheckout}>
              <label>Actual amount paid (USD)<input required type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></label>
              <label>PayPal transaction reference (optional)<input maxLength={120} value={transactionReference} onChange={e => setTransactionReference(e.target.value)} placeholder="Enter it if available" /></label>
              <label>Invoice number (optional)<input maxLength={120} value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Enter it if available" /></label>
              <p className="vt-checkout-note">Your payment date and partner website are recorded automatically. By submitting, you confirm that these details accurately describe the payment you made to your partner.</p>
              {error && <p className="vt-checkout-error" role="alert">{error}</p>}
              <button className="vt-checkout-pay" type="submit" disabled={busy || !RESELLER_PAYPAL[resellerCode]?.[planCode]}>{busy ? "Submitting declaration…" : "Submit partner payment declaration"}</button>
            </form>
          : <div className="vt-checkout-pending"><strong>Create and verify your VaultTrades profile first.</strong><span>Once you return from email verification, this declaration form will be available here. Your selected plan and partner details will remain saved.</span><Link className="vt-checkout-secondary-button vt-checkout-link-button" href={registrationHref}>Create your VaultTrades profile</Link></div>}
    </section>

    {declarationSubmitted && <div className="vt-checkout-final-status">
      <strong>{setupComplete ? "VaultTrades setup is active" : "Your order is being processed"}</strong>
      <p>{setupComplete
        ? resellerConfirmed
          ? "Your VaultTrades setup payments and partner membership payment are confirmed. Open your profile to access the Knowledge Base and community."
          : "Your VaultTrades setup payments are verified. You can access your profile and Knowledge Base while your partner completes the separate membership payment confirmation."
        : "Complete both VaultTrades setup payments. Once verified, your profile and Knowledge Base will show your setup status. Your partner confirms the membership payment separately."}</p>
      <div className="vt-checkout-actions"><Link href="/profile" className="vt-checkout-secondary-button">Open VaultTrades profile</Link>{setupComplete && <Link href="/member-portal" className="vt-checkout-secondary-button">Open Knowledge Base</Link>}</div>
    </div>}

    <div className="vt-checkout-actions"><Link href="/plans" className="vt-checkout-secondary-button">View plans</Link>{isAuthenticated && <Link href="/profile" className="vt-checkout-secondary-button">Open VaultTrades profile</Link>}</div>
  </section></main>;
}

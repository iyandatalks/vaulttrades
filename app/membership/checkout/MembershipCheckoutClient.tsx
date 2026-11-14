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
  declaration?: {
    id: string;
    plan_code: string;
    reseller_payment_status: string;
    vaulttrades_payment_status: string;
    declared_mrr_amount?: number;
  };
  payments?: {
    eaSetupPaid: boolean;
    websiteSetupPaid: boolean;
    vaultTradesSetupComplete: boolean;
  };
};

export default function MembershipCheckoutClient({
  planCode, plan, email, resellerCode, declarationId,
}: {
  planCode: PlanCode;
  plan: Plan;
  email: string;
  resellerCode: string;
  declarationId: string;
  paypalToken: string;
  paymentStatus: string;
}) {
  const [amount, setAmount] = useState(String(MRR[planCode]));
  const [transactionReference, setTransactionReference] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activeDeclarationId, setActiveDeclarationId] = useState(declarationId || "");
  const [paymentStatusData, setPaymentStatusData] = useState<PaymentStatus | null>(null);

  useEffect(() => {
    if (!activeDeclarationId) return;
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(
          `/api/reseller/purchase-declarations?declarationId=${encodeURIComponent(activeDeclarationId)}`,
          { cache: "no-store" },
        );
        const data = await response.json().catch(() => ({}));
        if (response.ok && active) setPaymentStatusData(data);
      } catch {
        // The customer can retry the status refresh from this page.
      }
    };
    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, 10000);
    return () => { active = false; window.clearInterval(interval); };
  }, [activeDeclarationId]);

  async function submitCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!resellerCode) throw new Error("This purchase link is missing its partner reference. Please reopen the link you received.");
      const paidAmount = Number(amount);
      if (!Number.isFinite(paidAmount) || paidAmount <= 0) throw new Error("Enter the amount you actually paid.");

      const response = await fetch("/api/reseller/purchase-declarations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planCode,
          resellerCode,
          amount: paidAmount,
          transactionReference,
          invoiceNumber,
        }),
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
      next.searchParams.set("stage", "fulfilment");
      window.location.assign(next.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to continue.");
      setBusy(false);
    }
  }

  const statuses = paymentStatusData?.payments;
  const resellerConfirmed = paymentStatusData?.declaration?.reseller_payment_status === "confirmed_by_reseller";

  return (
    <main className="vt-checkout-shell">
      <section className="vt-checkout-card">
        <div className="vt-checkout-kicker">YOUR MEMBERSHIP CHECKOUT</div>
        <h1>{activeDeclarationId ? "Complete your VaultTrades setup" : "Complete your membership purchase"}</h1>
        <p className="vt-checkout-intro">
          {activeDeclarationId
            ? "Your partner payment details have been submitted. Complete the two separate setup payments below to activate your VaultTrades website and selected product."
            : "You are purchasing through the partner who introduced you to this opportunity. Your membership selection is supplied by VaultTrades; your partner payment and VaultTrades setup are handled separately."}
        </p>

        <div className="vt-checkout-plan">
          <div>
            <span>YOUR SELECTED MEMBERSHIP</span>
            <h2>{plan.name}</h2>
            <p>{plan.description}</p>
            <p className="vt-checkout-automation-name"><strong>INCLUDED PRODUCT:</strong> {plan.eaName}</p>
          </div>
          <strong>{plan.name}</strong>
        </div>

        {!activeDeclarationId ? (
          <div className="vt-checkout-form">
            <h2>1. Partner membership payment</h2>
            <p className="vt-checkout-intro">
              Pay the membership amount to the partner using the secure payment link. Then enter the amount paid below. You can provide a transaction reference or invoice number if you have one.
            </p>
            {RESELLER_PAYPAL[resellerCode]?.[planCode] ? (
              <a
                className="vt-checkout-pay"
                href={RESELLER_PAYPAL[resellerCode][planCode]}
                target="_blank"
                rel="noreferrer"
              >
                Pay partner · ${MRR[planCode].toFixed(2)} USD
              </a>
            ) : (
              <div className="vt-checkout-pending">
                <strong>Partner payment link unavailable</strong>
                <span>Please reopen this checkout using the purchase link supplied by your partner.</span>
              </div>
            )}

            <form className="vt-checkout-form" onSubmit={submitCheckout}>
              <h2>2. Confirm your partner payment</h2>
              <label>
                Amount paid (USD)
                <input required type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
              </label>
              <label>
                PayPal transaction reference (optional)
                <input maxLength={120} value={transactionReference} onChange={e => setTransactionReference(e.target.value)} placeholder="Enter it if available" />
              </label>
              <label>
                Invoice number (optional)
                <input maxLength={120} value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Enter it if available" />
              </label>
              <p className="vt-member-note">
                Your payment date and partner website are recorded automatically. Your partner will verify the membership payment separately.
              </p>
              {error && <p className="vt-checkout-error" role="alert">{error}</p>}
              <button className="vt-checkout-pay" type="submit" disabled={busy || !RESELLER_PAYPAL[resellerCode]?.[planCode]}>
                {busy ? "Submitting…" : "Continue to VaultTrades setup"}
              </button>
            </form>
          </div>
        ) : (
          <div className="vt-checkout-form">
            <div className="vt-checkout-account">VaultTrades profile: {email}</div>
            <h2>VaultTrades setup payments</h2>
            <p>
              Your partner payment declaration has been received. Now complete the separate VaultTrades payments below. These are one-time setup charges and are not paid to your partner.
            </p>

            <div className="vt-checkout-addon">
              <span>
                <strong>EA setup · paid to VaultTrades</strong>
                <small>{statuses?.eaSetupPaid ? "Payment verified." : "Awaiting PayPal verification."}</small>
              </span>
              <b>{statuses?.eaSetupPaid ? "Verified" : `$${EA[planCode].toFixed(2)}`}</b>
            </div>
            <a className="vt-checkout-pay" href={EA_PAYPAL[planCode]} target="_blank" rel="noreferrer">
              Pay EA setup · ${EA[planCode].toFixed(2)} USD
            </a>

            <div className="vt-checkout-addon">
              <span>
                <strong>Website setup · paid to VaultTrades</strong>
                <small>{statuses?.websiteSetupPaid ? "Payment verified." : "Awaiting PayPal verification."}</small>
              </span>
              <b>{statuses?.websiteSetupPaid ? "Verified" : "$39.00"}</b>
            </div>
            <a className="vt-checkout-pay" href={WEBSITE_PAYPAL} target="_blank" rel="noreferrer">
              Pay website setup · $39.00 USD
            </a>

            <div className="vt-checkout-pending">
              <strong>{statuses?.vaultTradesSetupComplete ? "VaultTrades setup payments verified" : "Awaiting VaultTrades payment verification"}</strong>
              <span>
                {resellerConfirmed
                  ? "Your partner has also confirmed the membership payment."
                  : "Your partner still needs to confirm the membership payment."}
                {" "}Website activation and membership access follow once the required payments are verified.
              </span>
            </div>
            <button type="button" className="vt-checkout-secondary" onClick={() => window.location.reload()}>
              Refresh payment status
            </button>
          </div>
        )}

        <div className="vt-checkout-actions">
          <Link href="/plans" className="vt-checkout-secondary">View plans</Link>
          <Link href="/profile" className="vt-checkout-secondary">Open VaultTrades profile</Link>
        </div>
      </section>
    </main>
  );
}

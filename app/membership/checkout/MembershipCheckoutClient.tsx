"use client";

import Link from "next/link";

type PlanCode = "nexus" | "nexus_plus" | "vortex";
type Plan = { name: string; price: number; description: string };

export default function MembershipCheckoutClient({ planCode, plan, email }: { planCode: PlanCode; plan: Plan; email: string }) {
  const websiteSetupFee = 39;
  const eaSetupFee = Number((plan.price * 0.2).toFixed(2));
  const mrrComponent = Number((plan.price - eaSetupFee).toFixed(2));
  const total = plan.price + websiteSetupFee;

  return (
    <main className="vt-checkout-shell">
      <section className="vt-checkout-card">
        <div className="vt-checkout-kicker">MEMBERSHIP SELECTION</div>
        <h1>Your selected plan</h1>
        <p className="vt-checkout-intro">Review your selected membership and the required personal website setup. The website is part of the reseller onboarding process.</p>
        <div className="vt-checkout-plan">
          <div><span>SELECTED MEMBERSHIP</span><h2>{plan.name}</h2><p>{plan.description}</p></div>
          <strong>${plan.price.toFixed(2)} <small>USD package total</small></strong>
        </div>
        <div className="vt-checkout-addon">
          <span><strong>Eligible MRR component · 100% reseller commission</strong><small>This is the amount paid through your reseller's PayPal link.</small></span>
          <b>${mrrComponent.toFixed(2)}</b>
        </div>
        <div className="vt-checkout-addon">
          <span><strong>EA automation setup · once-off</strong><small>20% of the package price, payable to VaultTrades. EA operation requires an approved broker and compulsory VPS.</small></span>
          <b>${eaSetupFee.toFixed(2)}</b>
        </div>
        <div className="vt-checkout-addon">
          <span><strong>Required reseller website setup</strong><small>$39 USD once-off. Activates your four-page reseller website.</small></span>
          <b>$39</b>
        </div>
        <div className="vt-checkout-pending">
          <strong>Personalised domain — optional</strong>
          <span>You can use the standard VaultTrades website address or request a connection to a domain you own. If you choose your own domain, submit its details after purchase. Any domain purchase or connection fee will be confirmed separately before work begins.</span>
        </div>
        <div className="vt-checkout-total"><span>Package total + website setup</span><strong>${total.toFixed(2)} USD</strong></div>
        <div className="vt-checkout-account">Profile: {email}</div>
        <div className="vt-checkout-pending"><strong>Payment verification is required.</strong><span>The reseller PayPal link must collect the MRR component shown above. The EA setup and website setup charges are payable to VaultTrades. No access is activated until the relevant payments have been verified.</span></div>
        <div className="vt-checkout-actions"><Link href="/plans" className="vt-checkout-secondary">Change plan</Link><Link href="/profile" className="vt-checkout-secondary">Open profile</Link></div>
      </section>
    </main>
  );
}

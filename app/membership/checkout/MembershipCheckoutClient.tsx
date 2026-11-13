"use client";

import Link from "next/link";

type PlanCode = "nexus" | "nexus_plus" | "vortex";
type Plan = { name: string; price: number; description: string };

export default function MembershipCheckoutClient({ planCode, plan, email }: { planCode: PlanCode; plan: Plan; email: string }) {
  const websiteSetupFee = 39;
  const total = plan.price + websiteSetupFee;

  return (
    <main className="vt-checkout-shell">
      <section className="vt-checkout-card">
        <div className="vt-checkout-kicker">MEMBERSHIP SELECTION</div>
        <h1>Your selected plan</h1>
        <p className="vt-checkout-intro">Review your selected membership and the required personal website setup. The website is part of the reseller onboarding process.</p>
        <div className="vt-checkout-plan">
          <div><span>SELECTED MEMBERSHIP</span><h2>{plan.name}</h2><p>{plan.description}</p></div>
          <strong>${plan.price.toFixed(2)} <small>USD</small></strong>
        </div>
        <div className="vt-checkout-addon">
          <span><strong>Required personal website setup</strong><small>$39 USD once-off. This setup is mandatory for the reseller programme and is added to your membership fee.</small></span>
          <b>$39</b>
        </div>
        <div className="vt-checkout-pending">
          <strong>Personalised domain — optional</strong>
          <span>You can use the standard VaultTrades website address or request a connection to a domain you own. If you choose your own domain, submit its details after purchase. Any domain purchase or connection fee will be confirmed separately before work begins.</span>
        </div>
        <div className="vt-checkout-total"><span>Membership + required website setup</span><strong>${total.toFixed(2)} USD</strong></div>
        <div className="vt-checkout-account">Profile: {email}</div>
        <div className="vt-checkout-pending"><strong>Payment checkout is being connected.</strong><span>Your selected plan and required website setup are displayed here. Payment is not connected yet. No payment has been taken and no membership has been activated.</span></div>
        <div className="vt-checkout-actions"><Link href="/plans" className="vt-checkout-secondary">Change plan</Link><Link href="/profile" className="vt-checkout-secondary">Open profile</Link></div>
      </section>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";

type PlanCode = "nexus" | "nexus_plus" | "vortex";
type Plan = { name: string; price: number; description: string };

export default function MembershipCheckoutClient({ planCode, plan, email }: { planCode: PlanCode; plan: Plan; email: string }) {
  const [website, setWebsite] = useState(false);
  const total = plan.price + (website ? 39 : 0);

  return (
    <main className="vt-checkout-shell">
      <section className="vt-checkout-card">
        <div className="vt-checkout-kicker">MEMBERSHIP SELECTION</div>
        <h1>Your selected plan</h1>
        <p className="vt-checkout-intro">Your VaultTrades profile is ready. Review your selected membership and optional website setup below.</p>
        <div className="vt-checkout-plan">
          <div><span>SELECTED MEMBERSHIP</span><h2>{plan.name}</h2><p>{plan.description}</p></div>
          <strong>${plan.price.toFixed(2)} <small>USD</small></strong>
        </div>
        <label className="vt-checkout-addon">
          <input type="checkbox" checked={website} onChange={event => setWebsite(event.target.checked)} />
          <span><strong>Add optional personal website setup</strong><small>$39 USD once-off. Hosting, maintenance and domain charges, if applicable, are separate and will be confirmed before purchase.</small></span>
          <b>$39</b>
        </label>
        <div className="vt-checkout-total"><span>Selection total before any separately confirmed recurring charges</span><strong>${total.toFixed(2)} USD</strong></div>
        <div className="vt-checkout-account">Profile: {email}</div>
        <div className="vt-checkout-pending"><strong>Payment checkout is being connected.</strong><span>Your plan and optional website selection are displayed here. Payment will only be enabled after the VaultTrades master reseller checkout and payment-confirmation workflow is connected. No payment has been taken.</span></div>
        <div className="vt-checkout-actions"><Link href="/plans" className="vt-checkout-secondary">Change plan</Link><Link href="/profile" className="vt-checkout-secondary">Open profile</Link></div>
      </section>
    </main>
  );
}

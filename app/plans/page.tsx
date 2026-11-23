import Link from "next/link";
import "./plans.css";
import VaultTradesFaq from "../VaultTradesFaq";

const plans = [
  {
    number: "PLAN 01",
    code: "nexus",
    name: "Nexus",
    totalPrice: 189,
    partnerPayment: 120,
    digitalSetup: 30,
    intro: "The essential starter package for launching your reselling journey.",
    features: [
      "Nexus growth package",
      "Onboarding and training",
      "Free mentor, coaching and community access",
      "Basic assistant and housing insights",
      "Access to the marketplace and resale opportunity",
    ],
  },
  {
    number: "PLAN 02",
    code: "nexus_plus",
    name: "Nexus Plus",
    totalPrice: 289,
    partnerPayment: 200,
    digitalSetup: 50,
    intro: "Everything in Nexus, with priority support and a dedicated success manager.",
    featured: true,
    features: [
      "Nexus Plus package",
      "Nexus Plus environment",
      "Advanced coaching and mentor access",
      "Insights and market intelligence",
      "Priority support and dedicated success manager",
    ],
  },
  {
    number: "PLAN 03",
    code: "vortex",
    name: "Vortex",
    totalPrice: 589,
    partnerPayment: 440,
    digitalSetup: 110,
    intro: "The full premium package for serious resellers building a business.",
    features: [
      "VaultTrades Vortex package",
      "Vortex environment",
      "Full AI-powered analytics and market intelligence",
      "Advanced coaching and business strategy sessions",
      "Direct affiliate and business-building resources",
    ],
  },
];

const money = (amount: number) => "$" + amount.toLocaleString("en-US", { maximumFractionDigits: 0 });

export default function PlansPage() {
  return (
    <main className="vt-plans">
      <header className="vt-plans-header">
        <div className="vt-plans-kicker">VAULTTRADES BUSINESS PACKAGES</div>
        <h1>Explore our <span>plans.</span></h1>
        <p>Discover the package, support and business resources included at each level.</p>
        <Link href="/opportunity" className="vt-plans-back">← BACK TO THE OPPORTUNITY</Link>
      </header>
      <section className="vt-plans-grid" aria-label="Available business packages">
        {plans.map((plan) => (
          <article className={plan.featured ? "vt-plan-card vt-plan-featured" : "vt-plan-card"} key={plan.number}>
            <div className="vt-plan-number">{plan.number}</div>
            <h2>{plan.name}</h2>
            <div className="vt-plan-price">{money(plan.totalPrice)}<small> USD</small></div>
            <div className="vt-plan-once">TOTAL ONCE-OFF PACKAGE · WEBSITE SETUP INCLUDED</div>
            <p className="vt-plan-intro">{plan.intro}</p>
            <ul>{plan.features.map((feature) => <li key={feature}><span aria-hidden="true">✓</span>{feature}</li>)}</ul>
            <div className="vt-plan-breakdown">
              <div><span>Partner payment</span><strong>{money(plan.partnerPayment)} <small>USD</small></strong></div>
              <div><span>Digital product setup · once-off</span><strong>{money(plan.digitalSetup)} <small>USD</small></strong></div>
              <div><span>Website setup · once-off</span><strong>$39 <small>USD</small></strong></div>
              <p>Personal website setup is included in the total. A personalised domain is optional.</p>
            </div>
            <Link className="vt-plan-select" href={`/membership/checkout?plan=${plan.code}`}>Explore this plan <span>→</span></Link>
          </article>
        ))}
      </section>
      <section className="vt-plan-notes">
        <h2>Before you get started</h2>
        <p>All package and setup payments are once-off. Personal website setup is $39; choosing or connecting a personalised domain is optional.</p>
      </section>
      <VaultTradesFaq />
    </main>
  );
}

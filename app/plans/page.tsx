import Link from "next/link";
import "./plans.css";

const plans = [
  {
    number: "PLAN 1", code: "nexus",
    name: "VaultTrades Nexus", price: "$150",
    intro: "Launch your trading and digital-business journey with the core VaultTrades experience.",
    features: [
      "VaultTrades Nexus automated trading system",
      "Nexus trading guidance and learning resources",
      "Access to the free member community",
      "Business-launch and monthly-income education",
      "Access to the membership reseller opportunity",
      "Access to the central reseller Knowledge Base and Basics of Trading lessons",
    ],
  },
  {
    number: "PLAN 2", code: "nexus_plus",
    name: "VaultTrades Nexus Plus", price: "$250",
    intro: "Everything in Nexus, with additional tools and resources to develop your trading capability.",
    featured: true,
    features: [
      "Everything included in Plan 1",
      "VaultTrades Nexus Plus automated trading system",
      "Optional Analyzer subscription available separately at $20/month", 
      "Journal and core tools available separately through the required $10/month package", 
      "Additional trading indicators and tools",
      "Trading development and scaling resources",
      "Membership reseller opportunity",
    ],
  },
  {
    number: "PLAN 3", code: "vortex",
    name: "VaultTrades Vortex", price: "$550",
    intro: "The complete package, with advanced trading resources, risk management and individual mentorship.",
    features: [
      "Everything included in Plans 1 and 2",
      "All three VaultTrades EA products, including Vortex",
      "Full risk-management resources",
      "Both included trading indicators",
      "Advanced trading and business-scaling resources",
      "Expanded affiliate-development guidance",
      "One-on-one mentorship",
    ],
  },
];

export default function PlansPage() {
  return (
    <main className="vt-plans">
      <header className="vt-plans-header">
        <div className="vt-plans-kicker">VAULTTRADES MEMBERSHIP</div>
        <h1>Choose your <span>pathway.</span></h1>
        <p>Three membership levels. A clear view of what is included at each stage.</p>
        <Link href="/opportunity" className="vt-plans-back">← BACK TO THE OPPORTUNITY</Link>
      </header>
      <section className="vt-plans-grid" aria-label="Membership plans">
        {plans.map((plan) => (
          <article className={plan.featured ? "vt-plan-card vt-plan-featured" : "vt-plan-card"} key={plan.number}>
            <div className="vt-plan-number">{plan.number}</div>
            <h2>{plan.name}</h2>
            <div className="vt-plan-price">{plan.price}<small> USD</small></div>
            <div className="vt-plan-once">ONE-TIME MEMBERSHIP FEE</div>
            <p className="vt-plan-intro">{plan.intro}</p>
            <ul>{plan.features.map((feature) => <li key={feature}><span aria-hidden="true">✓</span>{feature}</li>)}</ul>
            <div className="vt-plan-addon">
              <span>Required personal website setup</span>
              <strong>$39 <small>USD · once-off</small></strong>
              <p>Required for the reseller programme and charged in addition to membership. A personalised domain is optional; domain purchase, connection and any applicable fees are handled separately.</p>
            </div>
            <Link className="vt-plan-select" href={`/membership/checkout?plan=${plan.code}`}>Select this plan <span>→</span></Link>
          </article>
        ))}
      </section>
      <section className="vt-plan-notes">
        <h2>Important details</h2>
        <p>Membership fees are once-off. Trading capital is separate and must be funded with your chosen broker. Trading involves risk and losses are possible; trading results and business commissions are not guaranteed.</p>
        <p>Resellers receive 100% commission on the eligible MRR membership component of qualifying sales they personally refer, subject to verification, refunds and the reseller agreement. Separately priced VaultTrades services are excluded from that MRR commission. This is a membership-sale commission, not a guarantee of trading profit.</p>
        <p>Personal website setup is required for the reseller programme and costs $39 once-off, in addition to the selected membership fee. Using your own personalised domain is optional. If you choose that route, provide the domain details after purchase so VaultTrades can assess and configure the connection. Any domain purchase or connection fee will be disclosed separately before you proceed.</p>
      </section>
    </main>
  );
}

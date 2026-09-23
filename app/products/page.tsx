"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const products = [
  ["01", "ANALYZER", "$73.99 / month", "Discretionary market analysis, strategy conditions and trade planning. Analyzer helps traders understand a setup before they decide what to do.", "https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-7SU27254MK962725RNGROPDQ", "Subscribe to Analyzer", "/analyzer", "analyzer"],
  ["02", "FOUNDERS MENTORSHIP", "$53 once off", "A focused mentorship program with a 1-hour one-on-one session. Payment is once-off. After payment is confirmed, VaultTrades directs you to book your session.", "/founders-mentorship/purchase", "Join Founders Mentorship", "/founders-mentorship", "founders_mentorship"],
  ["03", "COPY TRADING", "$99.99 / month", "Connect your MT5 account to the VaultTrades copy infrastructure. No TradingView webhook setup is required for the customer.", "https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-0YR675118F424491GNJ7LAEQ", "Subscribe to Copy Trading", "/copy", "copy"],
] as const;

type AccessResponse = { access?: Record<string, boolean>; admin?: boolean };

export default function ProductsPage() {
  const [access, setAccess] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard/access", { cache: "no-store" })
      .then(r => r.json())
      .then((data: AccessResponse) => setAccess(data.access || {}))
      .catch(() => setAccess({}))
      .finally(() => setLoaded(true));
  }, []);

  const hasAccess = (feature: string) =>
    feature === "copy"
      ? access.copy === true
      : access[feature] === true;

  return (
    <main className="vt-info-page">
      <div className="vt-info-wrap">
        <header className="vt-info-hero">
          <div className="vt-label">VAULTTRADES PRODUCTS</div>
          <h1>Three services. One connected workspace.</h1>
          <p>Analyzer is for discretionary analysis. Founders Mentorship is a once-off program. Copy Trading is the MT5 execution product. Any active product subscription also unlocks Journal, AI Coach and the Funded Account Wealth Builder.</p>
        </header>
        <section className="vt-info-grid">
          {products.map(([number, title, price, description, checkout, checkoutLabel, productHref, feature]) => (
            <article className="vt-info-card" key={title}>
              <div className="vt-number">{number}</div>
              <h2>{title}</h2>
              <p style={{ color: "#d4a637", fontWeight: 900, fontSize: 24, margin: "12px 0" }}>{price}</p>
              <p>{description}</p>
              <div className="vt-actions" style={{ marginTop: 18 }}>
                {loaded && hasAccess(feature) ? (
                  <Link className="vt-primary" href={productHref}>
                    Open {title}
                  </Link>
                ) : (
                  <a className="vt-primary" href={checkout}>
                    {checkoutLabel}
                  </a>
                )}
              </div>
            </article>
          ))}
        </section>
        <section className="vt-info-card" style={{ marginTop: 18 }}>
          <div className="vt-label">INCLUDED WITH ANY ACTIVE PRODUCT</div>
          <h2>Journal · AI Coach · Funded Account Wealth Builder</h2>
          <p>Subscribe to any current VaultTrades product and these three supporting tools become available in your Dashboard for the duration of your active entitlement.</p>
        </section>
      </div>
    </main>
  );
}

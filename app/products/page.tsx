"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const products = [
  ["01", "ANALYZER", "$73.99 / month", "Discretionary market analysis, strategy conditions and trade planning. Analyzer helps traders understand a setup before they decide what to do.", "https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-7SU27254MK962725RNGROPDQ", "Subscribe to Analyzer", "/analyzer", "analyzer"],
  ["03", "SCANNER SIGNALS", "$9.99 / month", "VaultTrades monitoring and confirmed signal delivery.", "https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-6V815454631119629NHESLKI", "Subscribe to Scanner", "/scanner-automation", "scanner"],
  ["02", "COPY TRADING", "$99.99 / month", "Connect your MT5 account to the VaultTrades copy infrastructure. No TradingView webhook setup is required for the customer.", "https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-0YR675118F424491GNJ7LAEQ", "Get Access to Copy Trading", "/copy", "copy"],
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

  return (
    <main className="vt-info-page">
      <div className="vt-info-wrap">
        <header className="vt-info-hero">
          <div className="vt-label">VAULTTRADES PRODUCTS</div>
          <h1>Three services. Three defined jobs.</h1>
          <p>Analyzer is for discretionary analysis. Scanner monitors defined conditions. Copy is the execution product for customers who want VaultTrades trades copied to MT5.</p>
        </header>
        <section className="vt-info-grid">
          {products.map(([number, title, price, text, checkout, checkoutLabel, productHref, feature]) => (
            <article className="vt-info-card" key={title}>
              <div className="vt-number">{number}</div>
              <h2>{title}</h2>
              <p style={{ color: "#d4a637", fontWeight: 900, fontSize: 24, margin: "12px 0" }}>{price}</p>
              <p>{text}</p>
              <div className="vt-actions" style={{ marginTop: 18 }}>
                {feature === "copy" && loaded && (access[feature] === true || access.automation === true) ? (
                  <Link className="vt-primary" href={productHref}>View Copy Trading</Link>
                ) : (
                  <a className="vt-primary" href={checkout}>{checkoutLabel}</a>
                )}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
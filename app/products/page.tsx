"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const products = [
  ["01", "ANALYZER", "$73.99 / month", "VaultTrades structured chart analysis, strategy conditions and trade planning.", "https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-7SU27254MK962725RNGROPDQ", "Subscribe to Analyzer", "/analyzer", "analyzer"],
  ["02", "AUTOMATION", "$99.99 / month", "VaultTrades TradingView signal automation and trade execution.", "https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-0YR675118F424491GNJ7LAEQ", "Get Access to Automation", "/automation", "automation"],
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
          <p>Choose the VaultTrades service you need.</p>
        </header>
        <section className="vt-info-grid">
          {products.map(([number, title, price, text, checkout, checkoutLabel, productHref, feature]) => (
            <article className="vt-info-card" key={title}>
              <div className="vt-number">{number}</div>
              <h2>{title}</h2>
              <p style={{ color: "#d4a637", fontWeight: 900, fontSize: 24, margin: "12px 0" }}>{price}</p>
              <p>{text}</p>
              <div className="vt-actions" style={{ marginTop: 18 }}>
                <a className="vt-primary" href={checkout}>{checkoutLabel}</a>
                {loaded && access[feature] === true && (
                  <Link className="vt-secondary" href={productHref}>View product</Link>
                )}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

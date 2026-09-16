import Link from "next/link";

const products = [
  ["01", "ANALYZER", "$73.99 / month", "Structured chart analysis, strategy conditions and trade planning.", "/subscription?product=analyzer_monthly", "Subscribe to Analyzer", "/analyzer"],
  ["02", "SCANNER AUTOMATION / SIGNALS", "$9.99 / month", "Automated monitoring and confirmed VaultTrades signal delivery.", "/subscription?product=scanner_monthly", "Subscribe to Scanner", "/scanner-automation"],
  ["03", "AUTOMATED TRADER", "$99.99 / month", "VaultTrades copy-trading service with a connected MT5 execution account.", "/automated-trader/subscribe", "Subscribe to Automated Trader", "/automated-trader"],
] as const;

export default function ProductsPage() {
  return (
    <main className="vt-info-page">
      <div className="vt-info-wrap">
        <header className="vt-info-hero">
          <div className="vt-label">VAULTTRADES PRODUCTS</div>
          <h1>Three services. Three defined jobs.</h1>
          <p>Choose the VaultTrades service you need. Each product has its own PayPal subscription plan while all payments are processed through the same verified VaultTrades webhook.</p>
        </header>
        <section className="vt-info-grid">
          {products.map(([number, title, price, text, checkout, checkoutLabel, productHref]) => (
            <article className="vt-info-card" key={title}>
              <div className="vt-number">{number}</div>
              <h2>{title}</h2>
              <p style={{ color: "#d4a637", fontWeight: 900, fontSize: 24, margin: "12px 0" }}>{price}</p>
              <p>{text}</p>
              <div className="vt-actions" style={{ marginTop: 18 }}>
                <Link className="vt-primary" href={checkout}>{checkoutLabel}</Link>
                <Link className="vt-secondary" href={productHref}>View product</Link>
              </div>
            </article>
          ))}
        </section>
        <section className="vt-section" style={{ paddingLeft: 0, paddingRight: 0, borderTop: 0 }}>
          <div className="vt-start vt-info-card">
            <div className="vt-label">PAYMENT ARCHITECTURE</div>
            <h2>Separate plans. One webhook.</h2>
            <p>Analyzer, Scanner Automation / Signals and Automated Trader use separate PayPal subscription Plan IDs. VaultTrades receives all subscription events through one verified PayPal webhook and activates only the matching product entitlement.</p>
          </div>
        </section>
      </div>
    </main>
  );
}

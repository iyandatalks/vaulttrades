const productNames = [
  "VaultTrades Winning Strategy",
  "VaultTrades Analyzer",
  "Founders Mentorship Programme",
  "VaultTrades Copy Trading",
  "AI Coach",
  "Trading Journal",
  "Risk Manager",
  "Funded Account Wealth Builder",
  "VaultTrades Community",
];

export const metadata = {
  title: "VaultTrades Products",
  description: "VaultTrades product catalogue.",
};

export default function ProductsPage() {
  return (
    <main className="vt-info-page">
      <div className="vt-info-wrap">
        <header className="vt-info-hero">
          <div className="vt-label">VAULTTRADES CATALOGUE</div>
          <h1>Our Products</h1>
          <p>This catalogue shows the names of VaultTrades products. Product descriptions, eligibility, pricing and purchasing information are available only through the appropriate signed-in customer process.</p>
        </header>
        <section className="vt-info-grid" aria-label="VaultTrades product names">
          {productNames.map((name, index) => (
            <article className="vt-info-card" key={name}>
              <div className="vt-number">{String(index + 1).padStart(2, "0")}</div>
              <h2>{name}</h2>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

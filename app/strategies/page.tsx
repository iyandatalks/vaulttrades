export default function StrategiesPage() {
  return (
    <main className="shell">
      <section className="card">
        <div className="section-label">STRATEGIES</div>
        <h1 className="title">VaultTrades Strategies</h1>
        <p className="muted">View the strategies currently available to your subscription and the rules the Analyzer applies.</p>
        <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
          {[
            ["Killer Zone", "London liquidity sweep → MSS → FVG → entry"],
            ["EMA", "EMA20 pullback → rejection → break → confirmation"],
            ["Continuation", "Expansion → correction → structure → continuation"],
            ["Supply & Demand", "Zones → retest → reaction → confirmed entry"],
          ].map(([name, description]) => (
            <div className="card" key={name} style={{ margin: 0 }}>
              <h2 className="title">{name}</h2>
              <p className="muted">{description}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

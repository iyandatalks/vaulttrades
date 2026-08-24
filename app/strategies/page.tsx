import { ANALYZER_STRATEGIES } from "../../lib/strategies/analyzerProfiles";

export default function StrategiesPage() {
  return (
    <main className="shell">
      <section className="card">
        <div className="section-label">STRATEGY LIBRARY</div>
        <h1 className="title">VaultTrades Strategies</h1>
        <p className="muted">
          Each customer-facing strategy is backed by a proprietary internal source-of-truth engine. The Analyzer uses that engine to evaluate the selected framework without exposing the underlying implementation.
        </p>
      </section>

      <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
        {ANALYZER_STRATEGIES.map((strategy) => (
          <section className="card" key={strategy.id}>
            <div className="section-label">{strategy.category}</div>
            <h2 className="title">{strategy.name}</h2>
            <p className="muted">{strategy.focus.join(" · ")}</p>
            <div className="condition-box" style={{ marginTop: 16 }}>
              <strong>Analyzer framework</strong>
              <p className="muted">
                This strategy is evaluated from VaultTrades' internal strategy source and market evidence. Proprietary implementation details are intentionally not displayed.
              </p>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

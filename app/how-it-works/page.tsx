import Link from "next/link";

const steps = [
  ["01", "ANALYZE", "Open Analyzer and identify the market context, structure, liquidity and strategy conditions. The objective is to understand where a setup may exist."],
  ["02", "CONFIRM", "A potential area is not automatically an entry. Wait for the confirmation defined by the strategy before treating the setup as actionable."],
  ["03", "EXECUTE", "Once the setup is confirmed, execute manually or use Automated Trader when your service is active and your trading account is connected."],
  ["04", "MONITOR", "Follow the active trade and account state. Keep risk controls and the defined trade plan in view rather than improvising after entry."],
  ["05", "REVIEW", "Record the decision in Journal and use AI Coach when you want to question or understand the analysis and execution."],
] as const;

export default function HowItWorksPage() {
  return (
    <main className="vt-info-page">
      <div className="vt-info-wrap">
        <header className="vt-info-hero">
          <div className="vt-label">HOW VAULTTRADES WORKS</div>
          <h1>The platform follows a trading process — not a collection of random tools.</h1>
          <p>VaultTrades is designed so a trader can understand what to do next without needing a video walkthrough. Start with the market, move through confirmation and execution, then review the result.</p>
        </header>

        <section className="vt-info-grid">
          {steps.map(([number, title, text]) => (
            <article className="vt-info-card" key={number}>
              <div className="vt-number">{number}</div>
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </section>

        <section className="vt-connection">
          <article className="vt-status-card">
            <div className="vt-label">AUTOMATED TRADER FLOW</div>
            <h2 style={{ margin: "10px 0 4px", fontSize: 25 }}>SIGNAL → BROKER → TRADING ACCOUNT</h2>
            <div className="vt-status-row"><span className="vt-status-name">VaultTrades signal</span><span className="vt-status-pill">SIGNAL</span></div>
            <div className="vt-status-row"><span className="vt-status-name">Broker connection</span><span className="vt-status-pill">ACCOUNT</span></div>
            <div className="vt-status-row"><span className="vt-status-name">VaultTrades authorization</span><span className="vt-status-pill">SECURE</span></div>
            <div className="vt-status-row"><span className="vt-status-name">Trading account</span><span className="vt-status-pill">EXECUTE</span></div>
          </article>
          <article className="vt-technical">
            <div className="vt-label">AUTOMATED TRADER</div>
            <h2 style={{ margin: "10px 0 8px", fontSize: 22 }}>Connect and trade.</h2>
            <p>Automated Trader is a separate service. It does not provide analysis or ask you to follow signals manually. Activate the service, connect your trading account and let the configured automation handle qualifying trades.</p>
            <p style={{ marginTop: 12 }}>Connection and execution controls are kept inside the member setup area. Internal infrastructure and execution parameters are not part of the public product explanation.</p>
          </article>
        </section>

        <section className="vt-section" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <div className="vt-start">
            <div className="vt-label">READY TO START?</div>
            <h2>Choose the service that matches your workflow.</h2>
            <p>Analyzer supports analysis, Scanner Signals provides confirmed signal delivery, and Automated Trader connects your trading account for automated execution.</p>
            <div className="vt-actions"><Link className="vt-primary" href="/products">View Products</Link><Link className="vt-secondary" href="/automated-trader">Automated Trader</Link></div>
          </div>
        </section>
      </div>
    </main>
  );
}

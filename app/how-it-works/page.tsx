import Link from "next/link";

const steps = [
  ["01", "ANALYZE", "Open Analyzer and identify the market context, structure, liquidity and strategy conditions. The objective is to understand where a setup may exist."],
  ["02", "MENTOR", "Use Founders Mentorship when you want the 7-day program and a 1-hour one-on-one session booked through the VaultTrades booking flow."],
  ["03", "COPY", "For Copy Trading, activate the monthly service and connect your MT5 account to the VaultTrades copy infrastructure."],
  ["04", "BUILD", "Use the Funded Account Wealth Builder to model capital, income goals, buffers and monthly return assumptions."],
  ["05", "REVIEW", "Use Journal and AI Coach to record decisions, review outcomes and understand the analysis behind a setup."],
] as const;

export default function HowItWorksPage() {
  return (
    <main className="vt-info-page">
      <div className="vt-info-wrap">
        <header className="vt-info-hero">
          <div className="vt-label">HOW VAULTTRADES WORKS</div>
          <h1>The platform follows a trading process — not a collection of random tools.</h1>
          <p>VaultTrades is designed so a trader can understand what to do next without needing a video walkthrough. Start with the market, use the service that matches your objective, then review the result.</p>
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
            <div className="vt-label">COPY TRADING FLOW</div>
            <h2 style={{ margin: "10px 0 4px", fontSize: 25 }}>VAULTTRADES MASTER → COPY INFRASTRUCTURE → MT5</h2>
            <div className="vt-status-row"><span className="vt-status-name">VaultTrades master trade</span><span className="vt-status-pill">SIGNAL</span></div>
            <div className="vt-status-row"><span className="vt-status-name">Customer MT5 copier</span><span className="vt-status-pill">CONNECTED</span></div>
            <div className="vt-status-row"><span className="vt-status-name">VaultTrades authorization</span><span className="vt-status-pill">SECURE</span></div>
            <div className="vt-status-row"><span className="vt-status-name">Customer trading account</span><span className="vt-status-pill">COPY</span></div>
          </article>
          <article className="vt-technical">
            <div className="vt-label">SHARED CUSTOMER TOOLS</div>
            <h2 style={{ margin: "10px 0 8px", fontSize: 22 }}>Journal · AI Coach · Wealth Builder</h2>
            <p>These supporting tools are available when a customer has any active paid VaultTrades product. They remain separate from the primary product service.</p>
          </article>
        </section>

        <section className="vt-section" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <div className="vt-start">
            <div className="vt-label">READY TO START?</div>
            <h2>Choose the service that matches your workflow.</h2>
            <p>Analyzer and Copy Trading are monthly services. Founders Mentorship is a once-off purchase with a 7-day one-on-one window. Any active product also unlocks Journal, AI Coach and the Funded Account Wealth Builder to members trading the prop firms.</p>
            <div className="vt-actions"><Link className="vt-primary" href="/products">View Products</Link><Link className="vt-secondary" href="/founders-mentorship/purchase">Founders Mentorship</Link></div>
          </div>
        </section>
      </div>
    </main>
  );
}

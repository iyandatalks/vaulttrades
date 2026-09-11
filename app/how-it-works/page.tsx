import Link from "next/link";

const steps = [
  ["01", "ANALYZE", "Open Analyzer and identify the market context, structure, liquidity and strategy conditions. The objective is to understand where a setup may exist."],
  ["02", "CONFIRM", "A potential area is not automatically an entry. Wait for the confirmation defined by the strategy before treating the setup as actionable."],
  ["03", "EXECUTE", "Once the setup is confirmed, execute manually or use the Automated Trader workflow where your account and automation access are configured."],
  ["04", "MONITOR", "Follow the active trade and execution state. Keep risk controls and the defined trade plan in view rather than improvising after entry."],
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
            <h2 style={{ margin: "10px 0 4px", fontSize: 25 }}>TradingView → Broker → MT5</h2>
            <div className="vt-status-row"><span className="vt-status-name">TradingView strategy</span><span className="vt-status-pill">SIGNAL SOURCE</span></div>
            <div className="vt-status-row"><span className="vt-status-name">Broker connection</span><span className="vt-status-pill">ACCOUNT</span></div>
            <div className="vt-status-row"><span className="vt-status-name">VaultTrades Access Key</span><span className="vt-status-pill">AUTHENTICATION</span></div>
            <div className="vt-status-row"><span className="vt-status-name">MT5 Execution EA</span><span className="vt-status-pill">EXECUTION</span></div>
          </article>
          <article className="vt-technical">
            <div className="vt-label">MT5 EA SETTINGS</div>
            <h2 style={{ margin: "10px 0 8px", fontSize: 22 }}>Technical settings stay technical.</h2>
            <p>The EA configuration remains available for the MT5 setup, while the VaultTrades dashboard explains the purpose of each connection in plain language.</p>
            <ul>
              <li><code>InpVaultTradesBaseUrl</code> — VaultTrades endpoint</li>
              <li><code>InpAccessKey</code> — secure EA authentication</li>
              <li><code>InpWorkerId</code> — identifies the MT5 worker</li>
              <li><code>InpPollSeconds</code> — execution polling interval</li>
              <li><code>InpExecutionMode</code> — observe/execution mode</li>
              <li><code>InpEnableLiveExecution</code> — live execution control</li>
              <li><code>InpVolume</code> / <code>InpDeviationPoints</code> — execution parameters</li>
            </ul>
          </article>
        </section>

        <section className="vt-section" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <div className="vt-start">
            <div className="vt-label">READY TO START?</div>
            <h2>Begin with understanding.</h2>
            <p>Analyzer is the starting point. The rest of VaultTrades supports the process as you move from analysis to execution and review.</p>
            <div className="vt-actions"><Link className="vt-primary" href="/analyzer">Open Analyzer</Link><Link className="vt-secondary" href="/products">View Products</Link></div>
          </div>
        </section>
      </div>
    </main>
  );
}

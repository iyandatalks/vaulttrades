import Link from "next/link";

const tools = [
  ["ANALYZER", "Analyze → Confirm → Plan", "Start here when you want to understand a market setup before execution.", "/analyzer", "Open Analyzer"],
  ["SCANNER", "Monitor → Detect → Review", "Monitor defined conditions and bring qualifying setups into your workflow.", "/scanner-automation", "Open Scanner"],
  ["AUTOMATED TRADER", "Signal → Validate → Execute", "Connect TradingView, your broker and the MT5 execution worker.", "/automated-trader", "Open Automated Trader"],
  ["AI COACH", "Ask → Understand → Improve", "Question the analysis, strategy conditions and trading decisions.", "/ai-coach", "Open AI Coach"],
  ["JOURNAL", "Record → Review → Improve", "Keep your trading decisions and outcomes in one place.", "/journal", "Open Journal"],
] as const;

export default function DashboardPage() {
  return (
    <main className="vt-info-page">
      <div className="vt-info-wrap">
        <header className="vt-info-hero">
          <div className="vt-label">VAULTTRADES WORKSPACE</div>
          <h1>Your trading process, in one place.</h1>
          <p>The dashboard tells you what each tool does and where it fits. Start with analysis, move through confirmation and execution, then review the decision.</p>
        </header>

        <section className="vt-start vt-info-card" style={{ textAlign: "left", marginBottom: 24 }}>
          <div className="vt-label">RECOMMENDED START</div>
          <h2 style={{ margin: "10px 0 8px", fontSize: 27 }}>Start with Analyzer.</h2>
          <p style={{ maxWidth: 760 }}>Analyzer is the foundation of the VaultTrades workflow. Once you understand the setup, the other tools support monitoring, execution, coaching and review.</p>
          <div className="vt-actions" style={{ justifyContent: "flex-start" }}><Link className="vt-primary" href="/analyzer">Open Analyzer</Link><Link className="vt-secondary" href="/how-it-works">How It Works</Link></div>
        </section>

        <section className="vt-info-grid">
          {tools.map(([title, flow, description, href, action]) => (
            <article className="vt-info-card" key={title}>
              <div className="vt-number">{flow}</div>
              <h2>{title}</h2>
              <p>{description}</p>
              <Link className="vt-text-link" style={{ display: "inline-block", marginTop: 18 }} href={href}>{action} →</Link>
            </article>
          ))}
        </section>

        <section className="vt-connection" style={{ marginTop: 24 }}>
          <article className="vt-status-card">
            <div className="vt-label">AUTOMATED TRADER</div>
            <h2 style={{ margin: "10px 0 4px", fontSize: 24 }}>Connection path</h2>
            <div className="vt-status-row"><span className="vt-status-name">TradingView</span><span className="vt-status-pill">SIGNAL</span></div>
            <div className="vt-status-row"><span className="vt-status-name">Broker</span><span className="vt-status-pill">ACCOUNT</span></div>
            <div className="vt-status-row"><span className="vt-status-name">VaultTrades Access Key</span><span className="vt-status-pill">AUTH</span></div>
            <div className="vt-status-row"><span className="vt-status-name">MT5 Execution EA</span><span className="vt-status-pill">WORKER</span></div>
          </article>
          <article className="vt-technical">
            <div className="vt-label">DISCIPLINED WORKFLOW</div>
            <h2 style={{ margin: "10px 0 8px", fontSize: 24 }}>Analyze. Confirm. Execute. Review.</h2>
            <p>VaultTrades is designed around a process. A potential area is not automatically an entry; confirmation remains part of the trading decision.</p>
            <Link className="vt-text-link" href="/how-it-works">Read the complete workflow →</Link>
          </article>
        </section>
      </div>
    </main>
  );
}

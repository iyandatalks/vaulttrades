import Link from "next/link";

const products = [
  ["01", "ANALYZER", "Understand the market before taking action.", "Structured chart analysis identifies market structure, liquidity, strategy conditions and potential trade plans.", "/analyzer", "Open Analyzer"],
  ["02", "SCANNER AUTOMATION", "Monitor without staring at every candle.", "Scanner Automation watches defined conditions and surfaces qualifying setups for review and confirmation.", "/scanner-automation", "Open Scanner"],
  ["03", "AUTOMATED TRADER", "Connect analysis to controlled execution.", "The Automated Trader area brings together the TradingView strategy, broker connection and MT5 execution workflow.", "/automated-trader", "Open Automated Trader"],
  ["04", "AI COACH", "Ask questions. Understand the decision.", "Use AI Coach to work through market structure, strategy conditions, analysis and trading decisions.", "/ai-coach", "Open AI Coach"],
  ["05", "JOURNAL", "Turn your trading history into data.", "Record decisions and outcomes so you can review execution patterns and build consistency.", "/journal", "Open Journal"],
  ["06", "REFERRAL", "Manage your VaultTrades referral activity.", "Access your referral area and keep the commercial side of your VaultTrades account in one place.", "/referral-vault", "Open Referral"],
] as const;

export default function ProductsPage() {
  return (
    <main className="vt-info-page">
      <div className="vt-info-wrap">
        <header className="vt-info-hero">
          <div className="vt-label">VAULTTRADES PRODUCTS</div>
          <h1>Tools with a defined job in your trading process.</h1>
          <p>You do not need to watch a long video to understand VaultTrades. Each product explains what it does, where it fits and what happens next.</p>
        </header>
        <section className="vt-info-grid">
          {products.map(([number, title, lead, text, href, action]) => (
            <article className="vt-info-card" key={title}>
              <div className="vt-number">{number}</div>
              <h2>{title}</h2>
              <p style={{ color: "#f4f6fb", fontWeight: 800, marginBottom: 10 }}>{lead}</p>
              <p>{text}</p>
              <Link className="vt-text-link" style={{ display: "inline-block", marginTop: 18 }} href={href}>{action} →</Link>
            </article>
          ))}
        </section>
        <section className="vt-section" style={{ paddingLeft: 0, paddingRight: 0, borderTop: 0 }}>
          <div className="vt-start vt-info-card">
            <div className="vt-label">RECOMMENDED START</div>
            <h2>Start with Analyzer.</h2>
            <p>Understand the setup first. Add Scanner Automation, Automated Trader, AI Coach and Journal as your workflow requires them.</p>
            <div className="vt-actions"><Link className="vt-primary" href="/analyzer">Start with Analyzer</Link><Link className="vt-secondary" href="/how-it-works">How It Works</Link></div>
          </div>
        </section>
      </div>
    </main>
  );
}

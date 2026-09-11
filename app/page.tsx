"use client";

import Link from "next/link";

const products = [
  { title: "ANALYZER", text: "Structured market analysis that shows the conditions behind a potential setup — not a blind signal.", href: "/analyzer", action: "Open Analyzer" },
  { title: "SCANNER AUTOMATION", text: "Monitor defined market conditions and identify qualifying setups without watching every candle.", href: "/scanner-automation", action: "Open Scanner" },
  { title: "AUTOMATED TRADER", text: "Connect your TradingView strategy, broker and MT5 execution workflow from one controlled workspace.", href: "/automated-trader", action: "Connect Trading" },
  { title: "AI COACH", text: "Ask questions about market structure, strategy conditions, analysis and trading decisions.", href: "/ai-coach", action: "Open AI Coach" },
  { title: "JOURNAL", text: "Record trades, review decisions and turn your execution history into useful trading data.", href: "/journal", action: "Open Journal" },
  { title: "REFERRAL", text: "Access your VaultTrades referral area and manage your referral activity from one place.", href: "/referral-vault", action: "Open Referral" },
];

const workflow = [
  ["01", "ANALYZE", "Use Analyzer to understand structure, liquidity and the conditions behind a potential setup."],
  ["02", "CONFIRM", "Wait for the confirmation required by the strategy instead of chasing the first indication."],
  ["03", "EXECUTE", "Take the trade yourself or use the Automated Trader workflow where enabled."],
  ["04", "MONITOR", "Track the active trade, execution state and important levels."],
  ["05", "REVIEW", "Use Journal and AI Coach to review decisions and improve consistency."],
] as const;

export default function HomePage() {
  return (
    <main className="vt-home">
      <section className="vt-hero">
        <div className="vt-eyebrow">BUILT BY TRADERS.</div>
        <h1>One workspace for a more disciplined trading process.</h1>
        <p>VaultTrades brings analysis, confirmation, execution, monitoring and review into one trading workspace. Understand the setup before you act.</p>
        <div className="vt-actions">
          <Link className="vt-primary" href="/analyzer">Open Analyzer</Link>
          <Link className="vt-secondary" href="/how-it-works">See How It Works</Link>
        </div>
        <div className="vt-hero-note">Focus. Discipline. Consistency.</div>
      </section>

      <section className="vt-section">
        <div className="vt-section-head">
          <div>
            <div className="vt-label">YOUR TRADING WORKFLOW</div>
            <h2>From analysis to review</h2>
          </div>
          <Link className="vt-text-link" href="/how-it-works">View the full process →</Link>
        </div>
        <div className="vt-workflow">
          {workflow.map(([number, title, text]) => (
            <article className="vt-workflow-card" key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="vt-section">
        <div className="vt-label">VAULTTRADES PRODUCTS</div>
        <h2>Tools that support the process</h2>
        <p className="vt-section-intro">Each product has a defined role. You can start with Analyzer and add the tools you need as your workflow develops.</p>
        <div className="vt-products">
          {products.map((product) => (
            <article className="vt-product-card" key={product.title}>
              <div className="vt-product-mark" />
              <div className="vt-product-title">{product.title}</div>
              <p>{product.text}</p>
              <Link href={product.href}>{product.action} →</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="vt-section vt-start">
        <div className="vt-label">GET STARTED</div>
        <h2>Start with the tool that explains the trade.</h2>
        <p>Analyzer is the natural starting point. Build your understanding first, then connect the rest of the VaultTrades workflow when you are ready.</p>
        <div className="vt-actions">
          <Link className="vt-primary" href="/analyzer">Start with Analyzer</Link>
          <Link className="vt-secondary" href="/profile">View Access</Link>
        </div>
      </section>

      <footer className="vt-footer">
        <div className="vt-footer-brand">VAULTTRADES</div>
        <div>Built by Traders. Focus, discipline, consistency.</div>
        <p><strong>Disclaimer:</strong> VaultTrades is an analytical and trading-support platform. It does not provide financial advice, investment advice or a guarantee of trading results. Trading involves substantial risk and users remain solely responsible for their own trading decisions.</p>
        <div>© 2026 VaultTrades. All rights reserved.</div>
      </footer>
    </main>
  );
}

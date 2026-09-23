"use client";

import Link from "next/link";

const products = [
  { title: "ANALYZER", text: "Discretionary market analysis that explains structure, strategy conditions and potential trade planning. You decide whether and how to trade.", href: "/analyzer", action: "Open Analyzer" },
  { title: "FOUNDERS MENTORSHIP", text: "A $53 once-off mentorship program with a 7-day one-on-one window and a 1-hour session booking.", href: "/founders-mentorship/purchase", action: "Join Founders Mentorship" },
  { title: "COPY TRADING", text: "Connect an MT5 account to the VaultTrades copy infrastructure. The underlying trading engine stays behind the product.", href: "/copy", action: "Open Copy" },
  { title: "AI COACH", text: "Available to customers with any active VaultTrades product. Ask questions about market structure, strategy conditions, analysis and trading decisions.", href: "/ai-coach", action: "Open AI Coach" },
  { title: "JOURNAL", text: "Available to customers with any active VaultTrades product. Record trades, review decisions and turn your execution history into useful trading data.", href: "/journal", action: "Open Journal" },
  { title: "FUNDED ACCOUNT WEALTH BUILDER", text: "Available to customers with any active VaultTrades product. Model capital, income goals, buffers and monthly return assumptions.", href: "/funded-account-wealth-builder", action: "Open Wealth Builder" },
];

const workflow = [
  ["01", "ANALYZE", "Use Analyzer to understand structure, liquidity and the conditions behind a potential setup."],
  ["02", "MENTOR", "Use Founders Mentorship to work through the 7-day program and book the 1-hour one-on-one session."],
  ["03", "COPY", "If you use VaultTrades Copy, connect your MT5 account to the copy infrastructure."],
  ["04", "BUILD", "Use the Funded Account Wealth Builder to model your account plan and targets."],
  ["05", "REVIEW", "Use Journal and AI Coach to review decisions and improve consistency."],
] as const;

export default function HomePage() {
  return (
    <main className="vt-home">
      <section className="vt-hero">
        <div className="vt-eyebrow">BUILT BY TRADERS.</div>
        <h1>One workspace for a more disciplined trading process.</h1>
        <p>VaultTrades brings together market analysis, mentorship and MT5 copy trading, with Journal, AI Coach and the Funded Account Wealth Builder available to customers with any active product.</p>
        <div className="vt-actions">
          <Link className="vt-primary" href="/products">View Products</Link>
          <Link className="vt-secondary" href="/analyzer">Open Analyzer</Link>
        </div>
        <div className="vt-hero-note">Focus. Discipline. Consistency.</div>
      </section>

      <section className="vt-section">
        <div className="vt-section-head">
          <div>
            <div className="vt-label">YOUR VAULTTRADES WORKFLOW</div>
            <h2>Products and supporting tools with defined roles</h2>
          </div>
          <Link className="vt-text-link" href="/how-it-works">View the full process →</Link>
        </div>
        <div className="vt-workflow">{workflow.map(([number, title, text]) => <article className="vt-workflow-card" key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <section className="vt-section">
        <div className="vt-label">VAULTTRADES PRODUCTS & TOOLS</div>
        <h2>Choose a product. Build from there.</h2>
        <p className="vt-section-intro">The paid product you choose determines your primary service. Any active product also unlocks the shared customer tools: Journal, AI Coach and Funded Account Wealth Builder.</p>
        <div className="vt-products">{products.map(product => <article className="vt-product-card" key={product.title}><div className="vt-product-mark" /><div className="vt-product-title">{product.title}</div><p>{product.text}</p><Link href={product.href}>{product.action} →</Link></article>)}</div>
      </section>

      <section className="vt-section vt-start">
        <div className="vt-label">GET STARTED</div>
        <h2>Choose your VaultTrades service.</h2>
        <p>Analyzer and Copy Trading are monthly services. Founders Mentorship is a once-off $53 purchase. Customers with any active product receive access to the shared Journal, AI Coach and Funded Account Wealth Builder tools. Admin access is permanent.</p>
        <div className="vt-actions"><Link className="vt-primary" href="/products">View Products</Link><Link className="vt-secondary" href="/how-it-works">How It Works</Link></div>
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

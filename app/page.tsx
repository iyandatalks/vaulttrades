"use client";

import Link from "next/link";

const products = [
  { title: "ANALYZER", text: "Discretionary market analysis that explains structure, strategy conditions and potential trade planning. You decide whether and how to trade.", href: "/analyzer", action: "Open Analyzer" },
  { title: "FOUNDERS MENTORSHIP", text: "A $53 once-off mentorship program with a 7-day one-on-one window and a 1-hour session booking.", href: "/founders-mentorship/purchase", action: "Join Founders Mentorship" },
  { title: "COPY TRADING", text: "Connect an MT5 account to the VaultTrades copy infrastructure. The underlying trading engine stays behind the product.", href: "/copy", action: "Open Copy" },
  { title: "AI COACH", text: "Available to customers with any active VaultTrades product. Ask questions about market structure, strategy conditions, analysis and trading decisions.", href: "/ai-coach", action: "Open AI Coach" },
  { title: "JOURNAL", text: "Available to customers with any active VaultTrades product. Record trades, review decisions and turn your execution history into useful trading data.", href: "/journal", action: "Open Journal" },
  { title: "FUNDED ACCOUNT WEALTH BUILDER", text: "Available to customers with any active VaultTrades product. Model capital, income goals, buffers and monthly return assumptions.", href: "/funded-account-wealth-builder", action: "Open Wealth Builder" },
  { title: "VAULTTRADES COMMUNITY", text: "Join the VaultTrades online trading community. Learn market structure, strengthen trading discipline and connect with fellow traders.", href: "/vaulttrades-community", action: "Open Community" },
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
          <a
            className="vt-secondary vt-whatsapp-contact"
            href="https://wa.me/27746653633?text=Hello%20VaultTrades%20Admin%2C%20I%20would%20like%20assistance%20with%20joining."
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Contact VaultTrades Admin on WhatsApp"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path fill="currentColor" d="M20.52 3.48A11.8 11.8 0 0 0 12.13 0C5.6 0 .28 5.31.28 11.84c0 2.09.55 4.13 1.6 5.93L.18 24l6.38-1.67a11.9 11.9 0 0 0 5.57 1.42h.01c6.53 0 11.85-5.31 11.86-11.84a11.78 11.78 0 0 0-3.48-8.43ZM12.14 21.7h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.79.99 1.01-3.69-.23-.38a9.86 9.86 0 0 1-1.51-5.19c0-5.46 4.45-9.9 9.92-9.9a9.84 9.84 0 0 1 7.01 2.91 9.83 9.83 0 0 1 2.9 7.01c0 5.46-4.45 9.9-9.9 9.9Zm5.43-7.41c-.3-.15-1.77-.87-2.05-.97-.28-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.47-.89-.79-1.49-1.77-1.67-2.07-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.5 1.69.64.71.23 1.36.2 1.87.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35Z"/>
            </svg>
            Contact Admin
          </a>
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


    </main>
  );
}

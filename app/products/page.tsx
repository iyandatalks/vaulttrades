import Link from "next/link";

const offers = [
  { category: "MARKET ANALYSIS", title: "VaultTrades Analyzer", description: "A structured chart-analysis environment combining market context, strategy conditions and trade planning.", detail: "Monthly access · account registration required at checkout", href: "/subscription?product=analyzer_monthly", action: "Explore Analyzer" },
  { category: "EXECUTION TECHNOLOGY", title: "VaultTrades Copy Trading", description: "A subscription-based copy-trading service for supported MetaTrader 5 accounts, with broker and account onboarding.", detail: "Monthly access · MT5 account ID required", href: "/subscription?product=automated_trader_monthly", action: "Explore Copy Trading" },
  { category: "EDUCATION", title: "Founders Mentorship Programme", description: "A structured educational programme focused on trading foundations, risk awareness, execution discipline and development.", detail: "Once-off programme purchase", href: "/subscription?product=founders_mentorship_once", action: "Explore Mentorship" },
  { category: "TRADING RESOURCES", title: "AI Coach, Journal & Risk Tools", description: "Practical resources for reviewing trade ideas, recording decisions and planning position risk as part of a disciplined process.", detail: "Access depends on the qualifying product or membership entitlement", href: "https://wa.me/27746653633?text=Hello%20VaultTrades%2C%20please%20share%20the%20current%20access%20options%20for%20the%20trading%20tools.", action: "Ask about access", external: true },
  { category: "STRATEGY FRAMEWORK", title: "VaultTrades Winning Strategy", description: "A defined framework built around market structure, historical institutional footprints and planned price levels.", detail: "Strategy materials are available to eligible members", href: "/start", action: "Explore VaultTrades pathways" },
  { category: "BUSINESS OPPORTUNITY", title: "Digital Programme Reseller Opportunity", description: "An optional business pathway for eligible participants interested in marketing selected in-house digital programmes and partner products.", detail: "Reseller eligibility, commission rules and onboarding are explained before joining", href: "/start", action: "View the opportunity" },
];

export const metadata = {
  title: "VaultTrades Products & Resources",
  description: "Explore VaultTrades trading technology, educational programmes, tools and business opportunities.",
};

export default function ProductsPage() {
  return (
    <main className="vt-products-page">
      <style>{`
        .vt-products-page{min-height:100vh;background:#080b12;color:#f6f4ef;padding:68px 20px 90px}
        .vt-products-wrap{max-width:1160px;margin:0 auto}
        .vt-products-kicker{color:#d7b45a;font-size:11px;font-weight:800;letter-spacing:.2em}
        .vt-products-page h1{font-size:clamp(38px,5vw,62px);letter-spacing:-.05em;margin:14px 0}
        .vt-products-intro{max-width:760px;color:#aeb7c5;font-size:16px;line-height:1.8;margin-bottom:38px}
        .vt-products-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
        .vt-products-card{min-height:270px;padding:26px;border:1px solid #30323a;border-radius:8px;background:linear-gradient(145deg,#141b28,#0b0f17);display:flex;flex-direction:column}
        .vt-products-card small{color:#d7b45a;font-size:10px;letter-spacing:.16em;font-weight:800}
        .vt-products-card h2{font-size:23px;line-height:1.2;margin:20px 0 12px}
        .vt-products-card p{color:#aeb7c5;font-size:13px;line-height:1.75;margin:0 0 12px}
        .vt-products-card .detail{color:#798493;font-size:11px;margin-top:auto;padding-top:12px}
        .vt-products-card a{color:#e5c779;font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;margin-top:17px}
        .vt-products-note{margin-top:32px;padding:22px 25px;border:1px solid #383326;background:#10151e;border-radius:7px;color:#9ea8b6;font-size:12px;line-height:1.7}
        @media(max-width:900px){.vt-products-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:600px){.vt-products-grid{grid-template-columns:1fr}.vt-products-page{padding:48px 15px}}
      `}</style>
      <div className="vt-products-wrap">
        <header>
          <div className="vt-products-kicker">VAULTTRADES · PRODUCTS & RESOURCES</div>
          <h1>Tools for a more structured trading process.</h1>
          <p className="vt-products-intro">Explore the trading technology, educational programmes and resources offered by VaultTrades. Public product information is available here; the actual member workspaces, strategy materials and community resources remain protected by their individual access entitlements.</p>
        </header>
        <section className="vt-products-grid" aria-label="VaultTrades products and resources">
          {offers.map((offer) => (
            <article className="vt-products-card" key={offer.title}>
              <small>{offer.category}</small>
              <h2>{offer.title}</h2>
              <p>{offer.description}</p>
              <p className="detail">{offer.detail}</p>
              {offer.external
                ? <a href={offer.href} target="_blank" rel="noopener noreferrer">{offer.action} ↗</a>
                : <Link href={offer.href}>{offer.action} →</Link>}
            </article>
          ))}
        </section>
        <div className="vt-products-note">Access is granted only after the relevant payment or entitlement has been verified. Creating an account or visiting a payment-return page does not by itself activate a paid product. Trading involves risk; no trading outcome or business income is guaranteed.</div>
      </div>
    </main>
  );
}

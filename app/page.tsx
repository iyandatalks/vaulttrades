"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const products = [
  { number: "01", name: "VaultTrades Analyzer", type: "MARKET ANALYSIS", description: "A structured analysis environment built around market context, strategy conditions and disciplined trade planning.", detail: "For traders who want a defined process before considering execution.", href: "/subscription?product=analyzer_monthly", action: "Explore Analyzer access", visual: "analyzer" },
  { number: "02", name: "Trading Tools & Resources", type: "TRADER WORKSPACE", description: "Practical resources for risk planning, trade journaling, trading psychology and decision-making.", detail: "Tools designed to support a process—not replace your judgement.", href: "/subscription", action: "Explore access options", visual: "tools" },
  { number: "03", name: "VaultTrades Winning Strategy", type: "STRATEGY FRAMEWORK", description: "A structured approach combining market structure, institutional footprints and defined price levels.", detail: "A framework for evaluation, not a promise of winning trades.", href: "/plans", action: "Explore VaultTrades pathways", visual: "strategy" },
  { number: "04", name: "Copy Trading", type: "MT5 EXECUTION TECHNOLOGY", description: "A subscription-based copy-trading service designed for supported MetaTrader 5 accounts.", detail: "Broker compatibility and account requirements are checked during onboarding.", href: "/subscription?product=automated_trader_monthly", action: "Explore Copy Trading", visual: "copy" },
  { number: "05", name: "Founders Mentorship", type: "EDUCATION & DEVELOPMENT", description: "A guided learning programme focused on trading structure, risk awareness and disciplined development.", detail: "A separate educational purchase with its own access entitlement.", href: "/subscription?product=founders_mentorship_once", action: "Explore mentorship", visual: "education" },
  { number: "06", name: "VaultTrades Community", type: "ONLINE COMMUNITY", description: "An online environment for structured learning, accountability and responsible trading development.", detail: "Community materials and member spaces remain private to eligible members.", href: "/subscription?product=founders_mentorship_once", action: "Explore membership", visual: "community" },
];

export default function HomePage() {
  const [sales, setSales] = useState(10);
  const [averageSale, setAverageSale] = useState(100);
  const estimate = useMemo(() => {
    const gross = Math.max(0, sales) * Math.max(0, averageSale);
    return { gross, reseller: gross, platform: 0 };
  }, [sales, averageSale]);

  return (
    <main className="vt-sales">
      <style jsx global>{`
        .vt-sales{background:#070a11;color:#f6f4ef;overflow:hidden}.vt-sales *{box-sizing:border-box}.vt-sales a{color:inherit;text-decoration:none}
        .vt-sales-wrap{width:min(1180px,calc(100% - 40px));margin:auto}.vt-sales-kicker{color:#d7b45a;font-size:11px;font-weight:800;letter-spacing:.2em}
        .vt-sales-hero{position:relative;min-height:610px;display:flex;align-items:center;border-bottom:1px solid #25221a;background:radial-gradient(ellipse at 80% 42%,rgba(201,157,61,.2),transparent 32%),radial-gradient(ellipse at 10% 90%,rgba(33,72,91,.22),transparent 35%),linear-gradient(120deg,#080b13 0%,#101522 58%,#090c12 100%)}
        .vt-sales-hero:after{content:"";position:absolute;right:-9%;top:8%;width:52vw;height:52vw;max-width:690px;max-height:690px;border:1px solid rgba(215,180,90,.18);border-radius:50%;box-shadow:0 0 0 48px rgba(215,180,90,.025),0 0 0 100px rgba(215,180,90,.02);pointer-events:none}
        .vt-sales-hero-inner{position:relative;z-index:1;max-width:790px;padding:100px 0 90px}.vt-sales-hero h1{font-size:clamp(42px,6vw,76px);line-height:1.02;letter-spacing:-.055em;margin:22px 0 20px;font-weight:850}.vt-sales-hero h1 span{color:#d7b45a}.vt-sales-hero p{font-size:17px;line-height:1.8;color:#b9c0cd;max-width:650px}
        .vt-sales-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:30px}.vt-sales-btn{display:inline-flex;align-items:center;justify-content:center;gap:12px;padding:15px 20px;border-radius:4px;font-weight:800;font-size:12px;letter-spacing:.07em;text-transform:uppercase}.vt-sales-btn.gold{background:#d7b45a;color:#090b10}.vt-sales-btn.outline{border:1px solid rgba(215,180,90,.55);color:#f4e8c9}
        .vt-sales-hero-note{margin-top:38px;color:#7e8796;font-size:11px;letter-spacing:.18em}.vt-sales-section{padding:92px 0}.vt-sales-section.alt{background:#0c111b;border-top:1px solid #202634;border-bottom:1px solid #202634}
        .vt-sales-heading{max-width:700px;margin-bottom:36px}.vt-sales-heading h2{font-size:clamp(30px,4vw,48px);letter-spacing:-.04em;line-height:1.08;margin:12px 0}.vt-sales-heading p{color:#aab3c2;line-height:1.75;font-size:15px}
        .vt-opportunity-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:30px;align-items:stretch}.vt-opportunity-copy,.vt-calculator{border:1px solid #343022;background:linear-gradient(145deg,#111722,#0a0e16);padding:34px;border-radius:8px}.vt-opportunity-copy h3{font-size:27px;line-height:1.15;margin:15px 0}.vt-opportunity-copy p{color:#aeb7c5;line-height:1.8}.vt-split{display:flex;gap:12px;flex-wrap:wrap;margin:26px 0}.vt-split span{padding:10px 13px;background:#171b22;border:1px solid #343022;border-radius:4px;color:#d9c58f;font-size:12px;font-weight:800;letter-spacing:.05em}
        .vt-calculator{border-color:rgba(215,180,90,.45)}.vt-calculator h3{font-size:22px;margin:8px 0}.vt-calculator p{color:#8e98a8;font-size:12px;line-height:1.6}.vt-calc-field{display:grid;gap:8px;margin:18px 0}.vt-calc-field label{color:#b7bfcb;font-size:12px;font-weight:700}.vt-calc-field input{width:100%;padding:12px 13px;background:#070b12;border:1px solid #3a3d42;border-radius:4px;color:#fff}.vt-calc-results{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:22px}.vt-calc-result{padding:14px 10px;background:#090d14;border:1px solid #292e37;border-radius:4px}.vt-calc-result small{display:block;color:#8993a2;font-size:9px;letter-spacing:.1em}.vt-calc-result strong{display:block;color:#e1c477;font-size:clamp(16px,2vw,22px);margin-top:8px;overflow-wrap:anywhere}
        .vt-product-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.vt-product-card{position:relative;min-height:285px;overflow:hidden;padding:25px;border:1px solid #282e39;border-radius:7px;background:linear-gradient(145deg,#121a27,#090d15)}.vt-product-card:before{content:"";position:absolute;right:-45px;top:-65px;width:170px;height:170px;border:1px solid rgba(215,180,90,.17);border-radius:50%;box-shadow:0 0 0 22px rgba(215,180,90,.025),0 0 0 46px rgba(215,180,90,.02)}.vt-product-card>*{position:relative}.vt-product-number{color:#d7b45a;font-size:11px;letter-spacing:.15em}.vt-product-card h3{font-size:23px;line-height:1.15;margin:22px 0 12px}.vt-product-card p{color:#aab3c2;font-size:13px;line-height:1.7}.vt-product-card small{display:block;color:#d7b45a;font-size:9px;letter-spacing:.14em;font-weight:800}.vt-product-link{display:inline-block;margin-top:16px;color:#e2c77e!important;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}.vt-business-strip{display:flex;justify-content:space-between;align-items:center;gap:25px;padding:34px;border:1px solid #343022;background:linear-gradient(105deg,#161a21,#11141c);border-radius:7px}.vt-business-strip h3{font-size:24px;margin:0 0 8px}.vt-business-strip p{color:#aab3c2;line-height:1.65;margin:0;max-width:650px}
        .vt-sales-footer{padding:54px 0;border-top:1px solid #252a33;background:#06080d}.vt-sales-footer-inner{display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap}.vt-sales-footer strong{color:#d7b45a;letter-spacing:.12em}.vt-sales-disclaimer{color:#737d8c;font-size:11px;line-height:1.7;max-width:850px;margin-top:22px}
        @media(max-width:900px){.vt-product-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.vt-opportunity-grid{grid-template-columns:1fr}.vt-sales-hero{min-height:560px}}
        @media(max-width:600px){.vt-sales-wrap{width:min(100% - 30px,1180px)}.vt-sales-hero-inner{padding:78px 0}.vt-product-grid{grid-template-columns:1fr}.vt-sales-section{padding:66px 0}.vt-opportunity-copy,.vt-calculator{padding:24px}.vt-calc-results{grid-template-columns:1fr}.vt-business-strip{align-items:flex-start;flex-direction:column;padding:25px}.vt-sales-btn{width:100%}}
      `}</style>

      <section className="vt-sales-hero">
        <div className="vt-sales-wrap">
          <div className="vt-sales-hero-inner">
            <div className="vt-sales-kicker">BUILT BY TRADERS. BUILT FOR STRUCTURE.</div>
            <h1>Trade with structure.<br /><span>Build with opportunity.</span></h1>
            <p>VaultTrades brings together in-house trading technology, practical digital resources and education—alongside an optional business opportunity for people interested in representing selected digital programmes.</p>
            <div className="vt-sales-actions">
              <a className="vt-sales-btn gold" href="#products">Explore our products <b>↘</b></a>
              <Link className="vt-sales-btn outline" href="/start">Explore the business opportunity <b>→</b></Link>
            </div>
            <div className="vt-sales-hero-note">FOCUS · DISCIPLINE · CONSISTENCY</div>
          </div>
        </div>
      </section>

      <section className="vt-sales-section">
        <div className="vt-sales-wrap">
          <div className="vt-sales-heading">
            <div className="vt-sales-kicker">THE VAULTTRADES ECOSYSTEM</div>
            <h2>Technology, tools and learning—brought together.</h2>
            <p>We develop and curate digital programmes designed to support traders at different stages. Choose the product or resource that fits what you are looking for; access to each paid service is activated separately.</p>
          </div>
          <div className="vt-product-grid" id="products">
            {products.map(product => (
              <article className="vt-product-card" key={product.number}>
                <div className="vt-product-number">{product.number} / {product.type}</div>
                <h3>{product.name}</h3>
                <p>{product.description}</p>
                <p>{product.detail}</p>
                <Link className="vt-product-link" href={product.href}>{product.action} ↗</Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="vt-sales-section alt">
        <div className="vt-sales-wrap">
          <div className="vt-sales-heading">
            <div className="vt-sales-kicker">A SEPARATE BUSINESS OPPORTUNITY</div>
            <h2>Interested in representing digital programmes?</h2>
            <p>VaultTrades also offers a business opportunity built around selected in-house digital programmes and partner products. Approved participants can market qualifying products and earn a share of eligible sales under the applicable reseller terms.</p>
          </div>
          <div className="vt-opportunity-grid">
            <div className="vt-opportunity-copy">
              <div className="vt-sales-kicker">RESELLER PARTICIPATION</div>
              <h3>A digital-programme business opportunity, with the platform infrastructure managed by VaultTrades.</h3>
              <p>The opportunity is separate from purchasing trading tools. It is designed for people interested in building a customer network around selected digital products, with the programme terms, eligibility and onboarding explained before joining.</p>
              <div className="vt-split"><span>100% ELIGIBLE MRR COMMISSION</span><span>SEPARATE VAULTTRADES SERVICES</span></div>
              <p>Illustrative headline split only. Actual eligibility, qualifying products, transaction treatment, refunds and payout terms are governed by the reseller agreement.</p>
              <Link className="vt-sales-btn outline" href="/start">View the opportunity <b>→</b></Link>
            </div>
            <div className="vt-calculator">
              <div className="vt-sales-kicker">SALES POTENTIAL CALCULATOR</div>
              <h3>Model an example sales scenario.</h3>
              <p>Enter an illustrative number of qualifying product sales and an average sale value. This illustrates the reseller's 100% commission on the eligible MRR component only. EA setup, annual licensing, website setup and separate subscriptions are excluded; it is not an earnings forecast or promise.</p>
              <div className="vt-calc-field"><label htmlFor="vt-sales-count">Number of qualifying sales</label><input id="vt-sales-count" type="number" min="0" max="100000" step="1" value={sales} onChange={e => setSales(Math.max(0,Math.min(100000,Number(e.target.value)||0)))} /></div>
              <div className="vt-calc-field"><label htmlFor="vt-average-sale">Illustrative eligible MRR component per sale (USD)</label><input id="vt-average-sale" type="number" min="0" max="1000000" step="0.01" value={averageSale} onChange={e => setAverageSale(Math.max(0,Math.min(1000000,Number(e.target.value)||0)))} /></div>
              <div className="vt-calc-results">
                <div className="vt-calc-result"><small>ILLUSTRATIVE SALES COUNT</small><strong>{sales.toLocaleString("en-US")}</strong></div>
                <div className="vt-calc-result vt-calc-result-primary"><small>ESTIMATED RESELLER SHARE</small><strong>${estimate.reseller.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></div>
                <div className="vt-calc-result"><small>INDICATIVE SHARE RATE</small><strong>100%</strong></div>
              </div>
              <div className="vt-calc-visual" role="img" aria-label="Illustrative allocation: 100 percent reseller commission on eligible MRR; separate VaultTrades services are excluded">
                <div className="vt-calc-visual-head"><span>ILLUSTRATIVE ALLOCATION</span><strong>80 / 20</strong></div>
                <div className="vt-calc-bar"><span className="vt-calc-bar-reseller" /><span className="vt-calc-bar-platform" /></div>
                <div className="vt-calc-legend"><span><i className="vt-calc-dot reseller" /> 100% eligible MRR commission</span><span><i className="vt-calc-dot platform" /> Separate VaultTrades services (not part of MRR commission)</span></div>
                <p className="vt-calc-footnote">A hypothetical example only. No live sales, customer activity, company revenue or actual commission data is displayed.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="vt-sales-section">
        <div className="vt-sales-wrap">
          <div className="vt-business-strip">
            <div><div className="vt-sales-kicker">LEARN BEFORE YOU DECIDE</div><h3>Want to understand how the opportunity works?</h3><p>Start with a short enquiry. You can review the opportunity information and applicable plans before deciding whether to proceed. Submitting an enquiry does not commit you to a purchase.</p></div>
            <Link className="vt-sales-btn gold" href="/start">Get the overview <b>→</b></Link>
          </div>
        </div>
      </section>

      
    </main>
  );
}

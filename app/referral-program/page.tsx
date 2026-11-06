"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ReferralInfo = { enabled?: boolean; code?: string | null; url?: string | null };
type DashboardInfo = { authenticated?: boolean; referral?: ReferralInfo };

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);

export default function ReferralProgramPage() {
  const [referral, setReferral] = useState<ReferralInfo | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [referrals, setReferrals] = useState(10);
  const [purchaseValue, setPurchaseValue] = useState(73.99);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard/access", { cache: "no-store" })
      .then(async response => {
        const data = await response.json().catch(() => ({})) as DashboardInfo;
        setAuthenticated(data.authenticated === true);
        setReferral(data.referral ?? null);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const estimate = useMemo(() => referrals * purchaseValue * 0.20, [referrals, purchaseValue]);

  async function copyLink() {
    if (!referral?.url) return;
    await navigator.clipboard.writeText(referral.url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  const memberLinkActive = referral?.enabled === true && Boolean(referral.url);

  return (
    <main className="vt-referral-page">
      <section className="vt-referral-hero">
        <nav className="vt-referral-nav"><Link href="/" className="vt-referral-brand">Vault<span>Trades</span></Link><span>THE VAULTTRADES REFERRAL PROGRAMME</span><Link href="/profile" className="vt-referral-nav-link">My Profile</Link></nav>
        <div className="vt-referral-hero-grid">
          <div className="vt-referral-hero-copy">
            <div className="vt-referral-kicker"><i /> SHARE THE VALUE. GROW YOUR NETWORK.</div>
            <h1>Your network.<br /><em>Your opportunity.</em><br />Your growth.</h1>
            <p>Introduce traders to a structured trading ecosystem. When someone joins through your referral link and completes an eligible purchase, you may qualify for a referral commission under the programme rules.</p>
            <div className="vt-referral-hero-actions">
              {memberLinkActive ? <button className="vt-referral-primary" onClick={copyLink}>{copied ? "LINK COPIED" : "COPY YOUR REFERRAL LINK"} <b>↗</b></button> : <Link className="vt-referral-primary" href={authenticated ? "/referral-vault" : "/auth/register?next=%2Fprofile"}>{authenticated ? "OPEN REFERRAL VAULT" : "CREATE YOUR VAULTTRADES ACCOUNT"} <b>↗</b></Link>}
              <a className="vt-referral-text-link" href="#how-it-works">See how it works ↓</a>
            </div>
            <div className="vt-referral-hero-note">No commission is earned for recruitment alone. A qualifying product purchase is required.</div>
          </div>
          <div className="vt-referral-visual" aria-label="Illustrative referral growth calculator preview">
            <div className="vt-referral-orbit vt-orbit-one" /><div className="vt-referral-orbit vt-orbit-two" />
            <div className="vt-referral-visual-card"><div className="vt-referral-visual-label">POTENTIAL EARNINGS</div><div className="vt-referral-visual-amount">{money(estimate)}</div><div className="vt-referral-visual-caption">Estimated commission scenario</div><div className="vt-referral-bars"><i /><i /><i /><i /><i /><i /><i /><i /></div><div className="vt-referral-visual-foot"><span>{referrals} qualifying purchases assumed</span><span>20% example rate</span></div></div>
            <div className="vt-referral-floating">YOUR NETWORK CAN GROW</div>
          </div>
        </div>
      </section>

      <section className="vt-referral-section vt-referral-calculator" id="calculator">
        <div className="vt-referral-section-heading"><div className="vt-referral-kicker">POTENTIAL EARNINGS CALCULATOR</div><h2>See what a qualifying referral network could generate.</h2><p>Adjust the assumptions to explore a scenario. This is an illustration—not an earnings promise, balance, forecast or guarantee.</p></div>
        <div className="vt-referral-calculator-grid">
          <div className="vt-referral-controls">
            <label htmlFor="referral-count">Number of people who complete an eligible purchase <strong>{referrals}</strong></label>
            <input id="referral-count" type="range" min="1" max="100" value={referrals} onChange={event => setReferrals(Number(event.target.value))} />
            <div className="vt-referral-range-labels"><span>1 purchase</span><span>100 purchases</span></div>
            <label htmlFor="purchase-value">Assumed eligible purchase value (USD)</label>
            <div className="vt-referral-money-input"><span>$</span><input id="purchase-value" type="number" min="0" max="10000" step="0.01" value={purchaseValue} onChange={event => setPurchaseValue(Math.max(0, Math.min(10000, Number(event.target.value) || 0)))} /></div>
            <p className="vt-referral-assumption">Example commission rate: 20% per qualifying purchase, matching the rate currently displayed in the member Referral Vault. Final eligibility and commission are governed by the programme terms.</p>
          </div>
          <div className="vt-referral-result"><div className="vt-referral-result-label">ILLUSTRATIVE COMMISSION</div><div className="vt-referral-result-value" key={estimate}>{money(estimate)}</div><div className="vt-referral-result-detail">{referrals} × {money(purchaseValue)} × 20%</div><div className="vt-referral-result-divider" /><div className="vt-referral-result-row"><span>Example commission per purchase</span><strong>{money(purchaseValue * 0.2)}</strong></div><div className="vt-referral-result-row"><span>Purchase value assumed</span><strong>{money(referrals * purchaseValue)}</strong></div><small>Assumes every listed person completes one qualifying purchase at the selected value. Excludes refunds, reversals, fees, tax and any programme adjustments. Not actual earnings.</small></div>
        </div>
      </section>

      <section className="vt-referral-section" id="how-it-works">
        <div className="vt-referral-section-heading"><div className="vt-referral-kicker">SIMPLE BY DESIGN</div><h2>How the referral programme works.</h2></div>
        <div className="vt-referral-steps">
          {[["01","GET YOUR LINK","Eligible members access their personal referral link through the Referral Vault in their profile."],["02","SHARE THE VALUE","Introduce people to VaultTrades products and explain what may suit their trading process."],["03","THEY JOIN & PURCHASE","The person registers through your link and completes an eligible paid product purchase."],["04","COMMISSION IS REVIEWED","Eligible commission is calculated and recorded under the programme rules. Refunds or reversals may affect it."]].map(([number,title,description]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>)}
        </div>
      </section>

      <section className="vt-referral-products">
        <div className="vt-referral-section vt-referral-products-inner"><div className="vt-referral-section-heading"><div className="vt-referral-kicker">WHAT YOU CAN INTRODUCE</div><h2>Useful tools. A clearer trading process.</h2><p>Share products based on their actual purpose. VaultTrades does not promise trading profits or guaranteed outcomes.</p></div>
          <div className="vt-referral-product-grid">
            <article><span>01 / STRATEGY</span><h3>VaultTrades Winning Strategy</h3><p>Order-flow context, institutional order blocks, Fibonacci price levels, stop-loss structure and targeted take-profit planning. Available at no charge to registered Community members.</p><Link href="/winning-strategy">Explore the strategy →</Link></article>
            <article><span>02 / MARKET ANALYSIS</span><h3>VaultTrades Analyzer</h3><p>Structured analysis of market conditions, liquidity, order blocks and strategy confirmations to support independent trade decisions.</p><Link href="/products#analyzer">View Analyzer pricing →</Link></article>
            <article><span>03 / EXECUTION</span><h3>MT5 Copy Trading</h3><p>Copy-trading infrastructure for eligible customers who want to connect a supported MetaTrader 5 account.</p><Link href="/copy">Explore Copy Trading →</Link></article>
          </div>
        </div>
      </section>

      <section className="vt-referral-section vt-referral-faq">
        <div className="vt-referral-section-heading"><div className="vt-referral-kicker">GOOD TO KNOW</div><h2>Referral programme questions.</h2></div>
        <div className="vt-referral-faq-list">
          <details><summary>Who can access a personal referral link?</summary><p>The existing Referral Vault makes personal links available to eligible members with an active paid VaultTrades product, and to administrators. Sign in and open Referral Vault to check your account.</p></details>
          <details><summary>Does a registration or link click earn commission?</summary><p>No. A click or registration alone does not create commission. The referred person must complete an eligible paid product purchase and meet the programme requirements.</p></details>
          <details><summary>How is the calculator amount determined?</summary><p>The calculator uses the assumptions you enter and an illustrative 20% rate currently displayed in the member Referral Vault. It is not a statement of actual earnings or a guarantee that every purchase will qualify.</p></details>
          <details><summary>Can commissions be reversed?</summary><p>Yes. The existing referral information states that commissions may be reversed when an eligible transaction is refunded or reversed. Final treatment follows the applicable programme rules.</p></details>
          <details><summary>Does the programme pay for recruiting people?</summary><p>No. The referral programme is presented around qualifying purchases of VaultTrades products and services, not recruitment by itself.</p></details>
          <details><summary>Where do I see my actual referrals and commission status?</summary><p>Sign in, open your Profile and select Referral Vault. The member dashboard is the source for your personal link and recorded referral information.</p></details>
        </div>
      </section>

      <section className="vt-referral-final-cta"><div className="vt-referral-kicker">START WITH YOUR NETWORK</div><h2>Share a product you believe in.</h2><p>Join VaultTrades, explore the programme and use your personal referral tools when your account is eligible.</p>{memberLinkActive ? <div className="vt-referral-final-actions"><button className="vt-referral-primary" onClick={copyLink}>{copied ? "LINK COPIED" : "COPY YOUR REFERRAL LINK"} ↗</button><Link className="vt-referral-secondary" href="/referral-vault">Open Referral Vault</Link></div> : <div className="vt-referral-final-actions"><Link className="vt-referral-primary" href={authenticated ? "/referral-vault" : "/auth/register?next=%2Fprofile"}>{authenticated ? "CHECK REFERRAL ELIGIBILITY" : "CREATE YOUR ACCOUNT"} ↗</Link><Link className="vt-referral-secondary" href="/products">Explore Products</Link></div>}</section>
      <div className="vt-referral-disclaimer">Referral commissions are conditional on eligible product purchases and programme rules. Illustrative calculator figures are not guaranteed income, actual earnings, financial advice or a promise of future results. Trading involves risk, and no VaultTrades product guarantees profits.</div>
    </main>
  );
}

"use client";

import { useMemo, useState } from "react";

const channels = [
  {
    number: "01",
    title: "MASTER FACILITATOR WEBSITE SALES",
    tag: "80% RESELLER SHARE",
    description: "Operate your own branded VaultTrades reseller website. When a qualifying membership sale is completed through your website, the agreed split is 80% to you and 20% to VaultTrades.",
    detail: "Your website and lead flow are assigned to you after the opportunity purchase is verified. The platform and service providers remain centrally managed.",
  },
  {
    number: "02",
    title: "ANALYZER RESELLING",
    tag: "50% COMMISSION",
    description: "Introduce eligible customers to the VaultTrades Analyzer and earn the stated 50% reseller commission on qualifying sales.",
    detail: "Analyzer access is a separate paid product. The final commission calculation base and qualifying-sale rules must be confirmed in the reseller terms.",
  },
  {
    number: "03",
    title: "DIGITAL PRODUCT REFERRALS",
    tag: "PRODUCT-BASED TERMS",
    description: "Refer customers to eligible VaultTrades digital tools and products that meet their needs.",
    detail: "Each product has its own access, checkout and referral conditions. A referral does not automatically include free access to the product.",
  },
  {
    number: "04",
    title: "MENTORSHIP PROGRAMME REFERRALS",
    tag: "SEPARATE PROGRAMME",
    description: "Where you hold the required sales authorisation, introduce suitable participants to the separate mentorship programme.",
    detail: "The mentorship programme is distinct from the Master Facilitator opportunity. Commission eligibility and rates follow its own approved terms.",
  },
  {
    number: "05",
    title: "EXTERNAL PARTNER REFERRALS",
    tag: "PARTNER TERMS APPLY",
    description: "Explore approved third-party partner opportunities and refer people who may benefit from their services.",
    detail: "Partners are independent businesses. Any referral payment, qualification, tracking and customer terms are set by the relevant partner.",
  },
];

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

export default function OpportunityIncomeSection() {
  const [sales, setSales] = useState("0");
  const [averageSale, setAverageSale] = useState("0");
  const calculation = useMemo(() => {
    const count = Math.max(0, Number(sales) || 0);
    const value = Math.max(0, Number(averageSale) || 0);
    const gross = count * value;
    return { gross, reseller: gross * 0.8, platform: gross * 0.2 };
  }, [sales, averageSale]);

  return (
    <section className="vto-income-section" id="income-streams">
      <div className="vto-container">
        <div className="vto-income-heading">
          <div className="vto-kicker">THE BUSINESS OPPORTUNITY</div>
          <h2>Build across <span>five potential income channels.</span></h2>
          <p>VaultTrades brings together a reseller platform, digital products and approved referral pathways. Each channel has its own qualifying activity, costs and terms—so you can understand how it works before deciding whether to participate.</p>
        </div>

        <div className="vto-income-grid">
          {channels.map((channel) => (
            <article className="vto-income-card" key={channel.number}>
              <div className="vto-income-card-top">
                <span>{channel.number}</span>
                <b>{channel.tag}</b>
              </div>
              <h3>{channel.title}</h3>
              <p>{channel.description}</p>
              <div className="vto-income-detail">{channel.detail}</div>
            </article>
          ))}
        </div>

        <div className="vto-income-flow">
          <div className="vto-income-flow-copy">
            <div className="vto-kicker">ONE ECOSYSTEM. DIFFERENT CHANNELS.</div>
            <h3>How the opportunity connects.</h3>
            <p>Your reseller website is the central sales channel. Product referrals, authorised programme referrals and approved external partners can provide additional routes to participate. They are separate activities, not automatic or guaranteed income.</p>
          </div>
          <div className="vto-flow-diagram" aria-label="VaultTrades opportunity income flow">
            <div className="vto-flow-core"><strong>VAULTTRADES</strong><span>OPPORTUNITY PLATFORM</span></div>
            <div className="vto-flow-lines" aria-hidden="true"><i /><i /><i /><i /><i /></div>
            <div className="vto-flow-nodes">
              <div><b>01</b><span>RESELLER<br />WEBSITE</span></div>
              <div><b>02</b><span>ANALYZER<br />RESELLING</span></div>
              <div><b>03</b><span>DIGITAL<br />PRODUCTS</span></div>
              <div><b>04</b><span>MENTORSHIP<br />REFERRALS</span></div>
              <div><b>05</b><span>PARTNER<br />REFERRALS</span></div>
            </div>
          </div>
        </div>

        <div className="vto-revenue-calculator" id="opportunity-calculator">
          <div className="vto-calculator-copy">
            <div className="vto-kicker">ILLUSTRATIVE RESELLER SCENARIO</div>
            <h3>Explore the numbers behind your website sales.</h3>
            <p>Adjust the number of qualifying sales and the average sale value to see how the agreed 80/20 website-sales split would work. This calculator covers website sales only; it does not add unconfirmed commissions from other channels.</p>
            <div className="vto-calculator-inputs">
              <label>
                <span>QUALIFYING SALES PER MONTH</span>
                <input type="number" min="0" step="1" inputMode="numeric" value={sales} onChange={(event) => setSales(event.target.value)} />
              </label>
              <label>
                <span>AVERAGE VALUE PER SALE (USD)</span>
                <input type="number" min="0" step="0.01" inputMode="decimal" value={averageSale} onChange={(event) => setAverageSale(event.target.value)} />
              </label>
            </div>
            <small>Use your own assumptions. Actual results depend on completed qualifying sales, refunds, eligibility and the reseller agreement.</small>
          </div>
          <div className="vto-calculator-results">
            <div className="vto-calculator-result-main"><span>ESTIMATED GROSS SALES</span><strong>{money(calculation.gross)}</strong></div>
            <div className="vto-calculator-split">
              <div><span>YOUR 80% SHARE</span><strong>{money(calculation.reseller)}</strong><i><b style={{ width: "80%" }} /></i></div>
              <div><span>VAULTTRADES 20% SHARE</span><strong>{money(calculation.platform)}</strong><i><b style={{ width: "20%" }} /></i></div>
            </div>
            <div className="vto-calculator-foot">Illustrative estimate only · Not a promise or guarantee of sales or income</div>
          </div>
        </div>

        <div className="vto-operating-costs">
          <div>
            <div className="vto-kicker">KNOW YOUR OPERATING COSTS</div>
            <h3>Product access is separate from the reseller opportunity.</h3>
            <p>Resellers who choose to use the tools pay separately for access. The reseller rate is $20/month for Analyzer and $10/month for the bundle of other digital tools. The opportunity purchase does not include free tool subscriptions.</p>
          </div>
          <div className="vto-cost-pills"><span><b>$20</b><small>MONTHLY ANALYZER ACCESS</small></span><span><b>$10</b><small>MONTHLY OTHER-TOOLS BUNDLE</small></span></div>
        </div>

        <div className="vto-income-disclaimer">
          Trading involves risk and losses are possible. Income from reseller sales, product referrals, mentorship and external partners is not guaranteed. Commission rates, eligibility and payment conditions apply only where confirmed in the relevant written agreement. VaultTrades does not promise a particular number of sales, earnings or timeframe.
        </div>
        <div className="vto-income-actions">
          <a className="vto-button vto-button-gold" href="/start">EXPLORE HOW TO JOIN <span aria-hidden="true">→</span></a>
          <a className="vto-button vto-button-outline" href="/plans">VIEW MEMBERSHIP OPTIONS</a>
        </div>
      </div>
    </section>
  );
}

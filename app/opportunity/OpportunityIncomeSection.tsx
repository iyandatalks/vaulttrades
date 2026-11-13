"use client";

import { useMemo, useState } from "react";

const channels = [
  {
    number: "01",
    title: "RESELLER'S ECOSYSTEM RIGHTS",
    tag: "80% PARTICIPANT SHARE",
    description: "Participate in the VaultTrades membership ecosystem with your assigned reseller rights and branded digital presence. When a qualifying membership enrolment is attributed to your channel, the agreed allocation is 80% to you and 20% to VaultTrades.",
    detail: "Your assigned presence and lead flow are activated after the opportunity purchase is verified. The platform, infrastructure and service providers remain centrally managed.",
  },
  {
    number: "02",
    title: "DIGITAL PRODUCT PORTFOLIO",
    tag: "50% ANALYZER RATE*",
    description: "Introduce people to eligible VaultTrades digital products, including Analyzer and the wider collection of trading tools and resources. Analyzer carries a stated 50% reseller commission on qualifying activity.",
    detail: "*The 50% rate applies to Analyzer only. Other digital products have their own access, attribution and referral conditions. Product access is separate and is not automatically included with a referral.",
  },
  {
    number: "03",
    title: "MENTORSHIP & AFFILIATE PARTNERSHIPS",
    tag: "PROGRAMME-SPECIFIC TERMS",
    description: "Connect suitable participants with the separate mentorship programme where you hold the required authorisation, and explore approved external affiliate partnerships.",
    detail: "Mentorship and external partners are distinct programmes. Authorisation, eligibility, referral tracking and any applicable commission are governed by each programme's own approved terms.",
  },
];

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

export default function OpportunityIncomeSection() {
  const [memberships, setMemberships] = useState("0");
  const [averageValue, setAverageValue] = useState("0");
  const calculation = useMemo(() => {
    const count = Math.max(0, Number(memberships) || 0);
    const value = Math.max(0, Number(averageValue) || 0);
    const total = count * value;
    return { total, participant: total * 0.8, vaulttrades: total * 0.2 };
  }, [memberships, averageValue]);

  return (
    <section className="vto-income-section" id="income-streams">
      <div className="vto-container">
        <div className="vto-income-heading">
          <div className="vto-kicker">THE ECOSYSTEM BUSINESS OPPORTUNITY</div>
          <h2>One ecosystem.<br /><span>Three connected business pathways.</span></h2>
          <p>Reseller ecosystem rights, a portfolio of digital products, and authorised mentorship and affiliate relationships create different ways to participate. Each pathway has its own qualifying activity and terms, which should be understood before joining.</p>
        </div>

        <div className="vto-income-grid vto-income-grid-three">
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
            <div className="vto-kicker">ONE ECOSYSTEM. FIVE PARTICIPATION CHANNELS.</div>
            <h3>How the opportunity connects.</h3>
            <p>The ecosystem brings together reseller rights, Analyzer, other digital products, authorised mentorship referrals and approved partner referrals. These are distinct participation channels with their own requirements—not automatic or guaranteed income.</p>
          </div>
          <div className="vto-flow-diagram" aria-label="Five VaultTrades ecosystem participation channels">
            <div className="vto-flow-core"><strong>VAULTTRADES</strong><span>ECOSYSTEM BUSINESS OPPORTUNITY</span></div>
            <div className="vto-flow-lines" aria-hidden="true"><i /><i /><i /><i /><i /></div>
            <div className="vto-flow-nodes">
              <div><b>01</b><span>RESELLER<br />ECOSYSTEM RIGHTS</span></div>
              <div><b>02</b><span>ANALYZER<br />REFERRALS</span></div>
              <div><b>03</b><span>DIGITAL<br />PRODUCTS</span></div>
              <div><b>04</b><span>MENTORSHIP<br />REFERRALS</span></div>
              <div><b>05</b><span>PARTNER<br />REFERRALS</span></div>
            </div>
          </div>
        </div>

        <div className="vto-revenue-calculator" id="opportunity-calculator">
          <div className="vto-calculator-copy">
            <div className="vto-kicker">ILLUSTRATIVE MEMBERSHIP SCENARIO</div>
            <h3>Explore how the qualifying membership allocation works.</h3>
            <p>Adjust the number of qualifying membership enrolments attributed to your channel and the average membership value. The illustration applies the stated 80/20 allocation and does not include commissions from other pathways.</p>
            <div className="vto-calculator-inputs">
              <label>
                <span>QUALIFYING MEMBERSHIPS PER MONTH</span>
                <input type="number" min="0" step="1" inputMode="numeric" value={memberships} onChange={(event) => setMemberships(event.target.value)} />
              </label>
              <label>
                <span>AVERAGE MEMBERSHIP VALUE (USD)</span>
                <input type="number" min="0" step="0.01" inputMode="decimal" value={averageValue} onChange={(event) => setAverageValue(event.target.value)} />
              </label>
            </div>
            <small>Illustrative assumptions only. Actual allocation depends on verified qualifying enrolments, eligibility, refunds and the reseller agreement.</small>
          </div>
          <div className="vto-calculator-results">
            <div className="vto-calculator-result-main"><span>ILLUSTRATIVE MEMBERSHIP VALUE</span><strong>{money(calculation.total)}</strong></div>
            <div className="vto-calculator-split">
              <div><span>YOUR 80% ALLOCATION</span><strong>{money(calculation.participant)}</strong><i><b style={{ width: "80%" }} /></i></div>
              <div><span>VAULTTRADES 20% ALLOCATION</span><strong>{money(calculation.vaulttrades)}</strong><i><b style={{ width: "20%" }} /></i></div>
            </div>
            <div className="vto-calculator-foot">Illustrative calculation only · Not a promise or guarantee of income</div>
          </div>
        </div>

        <div className="vto-operating-costs">
          <div>
            <div className="vto-kicker">KNOW YOUR OPERATING COSTS</div>
            <h3>Digital product access is separate from ecosystem rights.</h3>
            <p>Members who choose to use the tools pay separately for access. The reseller rate is $20/month for Analyzer and $10/month for the bundle of other digital tools. The opportunity purchase does not include free tool subscriptions.</p>
          </div>
          <div className="vto-cost-pills"><span><b>$20</b><small>MONTHLY ANALYZER ACCESS</small></span><span><b>$10</b><small>MONTHLY OTHER-TOOLS BUNDLE</small></span></div>
        </div>

        <div className="vto-income-disclaimer">
          Trading involves risk and losses are possible. Income from reseller participation, digital product referrals, mentorship and external partners is not guaranteed. Commission rates, eligibility and payment conditions apply only where confirmed in the relevant written agreement. VaultTrades does not promise a particular level of earnings or timeframe.
        </div>
        <div className="vto-income-actions">
          <a className="vto-button vto-button-gold" href="/start">EXPLORE HOW TO JOIN <span aria-hidden="true">→</span></a>
          <a className="vto-button vto-button-outline" href="/plans">VIEW MEMBERSHIP OPTIONS</a>
        </div>
      </div>
    </section>
  );
}

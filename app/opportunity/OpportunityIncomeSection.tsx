"use client";

import { useMemo, useState } from "react";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);
const n = (value: string) => Math.max(0, Number(value) || 0);

function Field({ label, value, setValue, step = "1" }: { label: string; value: string; setValue: (value: string) => void; step?: string }) {
  return <label className="vto-projection-field"><span>{label}</span><input type="number" min="0" step={step} inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} /></label>;
}

export default function OpportunityIncomeSection() {
  const [nexus, setNexus] = useState("0"), [plus, setPlus] = useState("0"), [vortex, setVortex] = useState("0");
  const [analyzer, setAnalyzer] = useState("0"), [productReferrals, setProductReferrals] = useState("0"), [productCommission, setProductCommission] = useState("0");
  const [affiliatePartners, setAffiliatePartners] = useState("0"), [affiliateRevenue, setAffiliateRevenue] = useState("0");
  const [monthlyCosts, setMonthlyCosts] = useState("0"), [websiteCost, setWebsiteCost] = useState("39");
  const [accountSize, setAccountSize] = useState("1000"), [lotSize, setLotSize] = useState("0.01");
  const [winPips, setWinPips] = useState("30"), [lossPips, setLossPips] = useState("30"), [pipValue, setPipValue] = useState("0");
  const [activeView, setActiveView] = useState<"business" | "trading">("business");

  const business = useMemo(() => {
    const rows = [
      { name: "VaultTrades Nexus", price: 150, mrr: 120, ea: 30, count: n(nexus) },
      { name: "VaultTrades Nexus Plus", price: 250, mrr: 200, ea: 50, count: n(plus) },
      { name: "VaultTrades Vortex", price: 550, mrr: 440, ea: 110, count: n(vortex) },
    ];
    const plan = rows.reduce((sum, row) => sum + row.count * row.mrr, 0);
    const analyzerIncome = n(analyzer) * 10;
    const productIncome = n(productReferrals) * n(productCommission);
    const affiliateIncome = n(affiliatePartners) * n(affiliateRevenue) * 0.20;
    const gross = plan + analyzerIncome + productIncome + affiliateIncome;
    return { rows, plan, analyzerIncome, productIncome, affiliateIncome, gross, costs: n(monthlyCosts), net: gross - n(monthlyCosts), website: n(websiteCost), affiliatePartners: n(affiliatePartners) };
  }, [nexus, plus, vortex, analyzer, productReferrals, productCommission, affiliatePartners, affiliateRevenue, monthlyCosts, websiteCost]);

  const trading = useMemo(() => {
    const account = n(accountSize), lots = n(lotSize), win = n(winPips), loss = n(lossPips);
    const pipMoney = n(pipValue) * (lots / 0.01);
    const scenarios = [
      { wins: 3, label: "Conservative week", tone: "caution" },
      { wins: 4, label: "Stronger week", tone: "positive" },
      { wins: 5, label: "All-win week", tone: "gold" },
    ].map((s) => {
      const losses = 5 - s.wins, grossWins = s.wins * win * pipMoney, grossLosses = losses * loss * pipMoney;
      const net = grossWins - grossLosses;
      return { ...s, losses, grossWins, grossLosses, net, monthly: net * 4.33, sixMonths: net * 26, returnPct: account > 0 ? net / account * 100 : 0 };
    });
    return { account, lots, pipMoney, scenarios };
  }, [accountSize, lotSize, winPips, lossPips, pipValue]);

  const combinedMonthly = business.net + (trading.scenarios[1]?.monthly ?? 0);

  return (
    <section className="vto-income-section" id="income-streams">
      <div className="vto-container">
        <div className="vto-income-heading">
          <div className="vto-kicker">THE VAULTTRADES DIGITAL BUSINESS ECOSYSTEM</div>
          <h2>Technology creates possibility.<br /><span>People create direction.</span></h2>
          <p>VaultTrades brings together an existing digital product ecosystem, AI-supported ways of working, trading technology and selected business pathways. You do not have to invent a product or build a platform from scratch. Your role is to understand the value, use good judgement, develop relationships and decide how you want to participate.</p>
        </div>

        <div className="vto-income-grid vto-income-grid-three">
          <article className="vto-income-card"><div className="vto-income-card-top"><span>01</span><b>HUMAN + AI</b></div><h3>AI AS A DAILY WORKING COMPANION</h3><p>A proposed learning pathway can show members how to give AI useful context, clear direction and feedback for research, planning, writing, organisation and repetitive tasks.</p><div className="vto-income-detail">AI assists; it does not replace human judgement, experience, accountability or decision-making.</div></article>
          <article className="vto-income-card"><div className="vto-income-card-top"><span>02</span><b>EXISTING PRODUCTS</b></div><h3>DIGITAL TOOLS & MEMBERSHIP</h3><p>Explore the VaultTrades membership ecosystem, Analyzer and other digital tools. The products and infrastructure are already assembled.</p><div className="vto-income-detail">Access, eligibility, prices and referral conditions depend on the selected product and membership.</div></article>
          <article className="vto-income-card"><div className="vto-income-card-top"><span>03</span><b>ADDITIONAL PATHWAYS</b></div><h3>PARTNERSHIPS & REFERRALS</h3><p>Develop a network and explore approved contractor, mentorship and external affiliate opportunities where you meet the relevant requirements.</p><div className="vto-income-detail">External programmes are independent. Work, acceptance and commissions are subject to their own terms and are not guaranteed.</div></article>
        </div>

        <div className="vto-income-flow vto-ai-story">
          <div className="vto-income-flow-copy"><div className="vto-kicker">A NEW DIGITAL WORKING RELATIONSHIP</div><h3>AI can be a capable companion. You remain the strategist.</h3>
            <p>My own experience has shown me that useful AI collaboration is built over time. I explain the business, provide context, share what I know, set the direction, review the output and correct it when it misses the mark. The more clearly I communicate the task and standards, the more useful the assistance becomes.</p>
            <p>That is the relationship we want people to learn: give context, set a clear task, check the work, give feedback and keep human judgement in control. AI can help reduce repetitive effort, but it does not create a successful business on its own.</p>
          </div>
          <div className="vto-ai-loop" aria-label="A practical human and AI working cycle">
            <div><b>01</b><strong>GIVE CONTEXT</strong><span>Explain your goal and situation</span></div><div><b>02</b><strong>DIRECT</strong><span>Set the task and standards</span></div><div><b>03</b><strong>REVIEW</strong><span>Check accuracy and usefulness</span></div><div><b>04</b><strong>REFINE</strong><span>Correct, improve and apply</span></div>
          </div>
        </div>

        <div className="vto-income-heading vto-projection-heading"><div className="vto-kicker">INTERACTIVE PRESENTATION</div><h2>Explore the <span>potential.</span></h2><p>Change the assumptions while presenting. The figures recalculate immediately. These are scenarios for discussion—not forecasts, probabilities of success or guaranteed earnings.</p></div>
        <div className="vto-projection-tabs" role="tablist" aria-label="Projection type">
          <button type="button" className={activeView === "business" ? "active" : ""} onClick={() => setActiveView("business")}>BUSINESS & PRODUCT COMMISSIONS</button>
          <button type="button" className={activeView === "trading" ? "active" : ""} onClick={() => setActiveView("trading")}>TRADING SCENARIOS</button>
        </div>

        {activeView === "business" ? (
          <div className="vto-projection-panel">
            <div className="vto-projection-panel-heading"><div><div className="vto-kicker">01 · MEMBERSHIP & DIGITAL REFERRALS</div><h3>Build a scenario from actual plan values.</h3><p>Enter the number of qualifying referrals in a month. Commission is calculated from the eligible MRR component—not the full package price.</p><p className="vto-projection-note">The three membership options are not mutually exclusive: a participant may choose one, combine two or opt into all three, according to the applicable plan terms. The referral counts below are separate from a participant's own plan purchases.</p></div><div className="vto-projection-stamp">USD · MONTHLY</div></div>
            <div className="vto-plan-table-wrap"><table className="vto-plan-table"><thead><tr><th>MEMBERSHIP</th><th>PACKAGE PRICE</th><th>ELIGIBLE MRR</th><th>EA SETUP</th><th>QUALIFYING REFERRALS</th><th>ILLUSTRATIVE COMMISSION</th></tr></thead><tbody>
              {business.rows.map((row, index) => <tr key={row.name}><td><strong>{row.name}</strong></td><td>{money(row.price)}</td><td className="vto-table-gold">{money(row.mrr)}</td><td>{money(row.ea)}</td><td><input aria-label={row.name + " qualifying referrals"} type="number" min="0" step="1" value={[nexus, plus, vortex][index]} onChange={(event) => [setNexus, setPlus, setVortex][index](event.target.value)} /></td><td className="vto-table-result">{money(row.count * row.mrr)}</td></tr>)}
            </tbody></table></div>
            <div className="vto-projection-input-grid">
              <Field label="QUALIFYING ANALYZER MONTHLY REFERRALS" value={analyzer} setValue={setAnalyzer} />
              <Field label="OTHER VAULTTRADES PRODUCT REFERRALS" value={productReferrals} setValue={setProductReferrals} />
              <Field label="APPROVED COMMISSION PER PRODUCT REFERRAL (USD)" value={productCommission} setValue={setProductCommission} step="0.01" />
              <Field label="AFFILIATE PARTNERS REFERRED" value={affiliatePartners} setValue={setAffiliatePartners} />
              <Field label="AVERAGE QUALIFYING COMMISSION BASE PER AFFILIATE PARTNER (USD)" value={affiliateRevenue} setValue={setAffiliateRevenue} step="0.01" />
              <Field label="MONTHLY OPERATING COSTS (USD)" value={monthlyCosts} setValue={setMonthlyCosts} step="0.01" />
              <Field label="ONE-OFF WEBSITE SETUP COST (USD)" value={websiteCost} setValue={setWebsiteCost} step="0.01" />
            </div>
            <div className="vto-projection-note">Analyzer illustration uses $10 per qualifying monthly referral (50% of the $20 monthly access price). Other VaultTrades product commissions are editable because product-specific rates must match the applicable referral terms. Affiliate-partner referrals are modelled at your stated 20%: number of qualifying referred partners × average eligible commission base per partner × 20%. Enter the actual qualifying base for each partner; do not use total company revenue unless the affiliate agreement explicitly defines it that way. Website setup is shown separately as a one-off cost and is not deducted from the recurring monthly total.</div>
            <div className="vto-projection-summary-grid">
              <div><span>MEMBERSHIP COMMISSIONS</span><strong>{money(business.plan)}</strong></div><div><span>ANALYZER ILLUSTRATION</span><strong>{money(business.analyzerIncome)}</strong></div><div><span>OTHER PRODUCT COMMISSIONS</span><strong>{money(business.productIncome)}</strong></div><div><span>20% AFFILIATE-PARTNER COMMISSION ({business.affiliatePartners} PARTNERS)</span><strong>{money(business.affiliateIncome)}</strong></div>
              <div className="vto-summary-total"><span>ILLUSTRATIVE MONTHLY GROSS</span><strong>{money(business.gross)}</strong></div><div><span>MONTHLY OPERATING COSTS</span><strong className="vto-negative">−{money(business.costs)}</strong></div><div className="vto-summary-net"><span>ILLUSTRATIVE MONTHLY NET</span><strong>{money(business.net)}</strong></div>
            </div>
            <div className="vto-projection-note">A person's own membership purchase is not counted as a commission. Partner-plan referrals, VaultTrades product referrals and external affiliate-partner referrals are separate income categories. The 20% affiliate calculation applies only to the qualifying commission base defined by each affiliate agreement, subject to attribution, validation, refunds and payment rules. The one-off website setup cost currently entered is {money(business.website)} and is displayed separately.</div>
          </div>
        ) : (
          <div className="vto-projection-panel">
            <div className="vto-projection-panel-heading"><div><div className="vto-kicker">02 · FIVE TRADING DAYS / FIVE TRADE OUTCOMES</div><h3>Adjust account size, lot size and pip assumptions.</h3><p>Compare a weaker, stronger and all-win week. The model uses one trade per trading day and five trades per week.</p></div><div className="vto-projection-stamp">USD · SCENARIO</div></div>
            <div className="vto-projection-input-grid vto-trading-inputs">
              <Field label="ACCOUNT SIZE (USD)" value={accountSize} setValue={setAccountSize} step="0.01" /><Field label="LOT SIZE" value={lotSize} setValue={setLotSize} step="0.01" />
              <Field label="PIPS CAPTURED PER WINNING TRADE" value={winPips} setValue={setWinPips} step="0.1" /><Field label="PIPS LOST PER LOSING TRADE" value={lossPips} setValue={setLossPips} step="0.1" />
              <Field label="USD VALUE PER PIP AT 0.01 LOT" value={pipValue} setValue={setPipValue} step="0.001" />
            </div>
            <div className="vto-projection-note">Pip value varies by instrument, quote currency, broker contract specification and account currency. Enter the correct USD-per-pip value for the instrument being demonstrated. The calculator does not assume that every pip in a day's market movement is captured. A zero pip value leaves the trading illustration at zero until you enter the correct instrument value.</div>
            <div className="vto-trading-assumption"><span>ACTIVE ASSUMPTIONS</span><strong>{money(trading.account)} account</strong><strong>{trading.lots.toFixed(2)} lot</strong><strong>{money(trading.pipMoney)} per pip at this lot size</strong><strong>5 trades per week</strong></div>
            <div className="vto-trading-scenarios">{trading.scenarios.map((s) => <article className={"vto-trading-scenario " + s.tone} key={s.wins}>
              <div className="vto-scenario-top"><span>{s.label}</span><b>{s.wins}/5 WINS</b></div><strong className="vto-scenario-net">{money(s.net)}</strong><small>Illustrative weekly net before other fees</small>
              <div className="vto-scenario-breakdown"><span>{s.wins} wins · {s.losses} losses</span><span>Winning trades: {money(s.grossWins)}</span><span>Losing trades: −{money(s.grossLosses)}</span></div>
              <div className="vto-scenario-projections"><div><span>4.33-WEEK MONTH</span><b>{money(s.monthly)}</b></div><div><span>26-WEEK PERIOD</span><b>{money(s.sixMonths)}</b></div></div><div className="vto-scenario-return">Weekly result as a share of account: {s.returnPct.toFixed(2)}%</div>
            </article>)}</div>
            <div className="vto-projection-note">The 3/5, 4/5 and 5/5 rows are illustrative outcome scenarios, not measured win probabilities. The calculation assumes the same average captured pips on each winning trade and the same average loss pips on each losing trade. It excludes spreads, commissions, swaps, slippage, taxes and changing market conditions. A 0.10 lot size is not suitable for every account; users must determine position size from their own risk limits.</div>
          </div>
        )}

        <div className="vto-projection-combined"><div><div className="vto-kicker">KEEP THE INCOME TYPES SEPARATE</div><h3>Business commissions and trading results are not the same thing.</h3><p>Business commissions depend on qualifying sales and programme terms. Trading results depend on market outcomes and can be negative. This combined example uses the 4-win scenario only to demonstrate how separate figures can be viewed side by side.</p></div><div className="vto-combined-number"><span>ILLUSTRATIVE MONTHLY VIEW</span><strong>{money(combinedMonthly)}</strong><small>Business net + 4-win trading scenario · before trading fees and tax</small></div></div>
        <div className="vto-income-disclaimer">All figures are editable illustrations, not earnings promises or a forecast of likely success. No number of referrals, contractor placements, affiliate commissions or trading wins is guaranteed. Third-party opportunities are independent and subject to their own acceptance criteria and terms. Trading involves substantial risk and you can lose money.</div>
        <div className="vto-income-actions"><a className="vto-button vto-button-gold" href="/start">EXPLORE HOW TO JOIN <span aria-hidden="true">→</span></a><a className="vto-button vto-button-outline" href="/plans">VIEW MEMBERSHIP OPTIONS</a></div>
      </div>
    </section>
  );
}

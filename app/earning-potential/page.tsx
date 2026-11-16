"use client";

import { useMemo, useState } from "react";

type Inputs = {
  nexus: number; nexusPlus: number; vortex: number;
  analyzerReferrals: number; otherProductReferrals: number; otherProductCommission: number;
  affiliatePartners: number; affiliateBase: number;
  monthlyCosts: number; setupCost: number;
  accountSize: number; lotSize: number; winningPips: number; losingPips: number; pipValueAt001: number;
  selectedWins: number;
};

type NumericInputKey = Exclude<keyof Inputs, "selectedWins">;

const defaults: Inputs = {
  nexus: 0, nexusPlus: 0, vortex: 0,
  analyzerReferrals: 0, otherProductReferrals: 0, otherProductCommission: 0,
  affiliatePartners: 0, affiliateBase: 0,
  monthlyCosts: 0, setupCost: 39,
  accountSize: 1000, lotSize: 0.1, winningPips: 30, losingPips: 30, pipValueAt001: 0,
  selectedWins: 4,
};

const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number.isFinite(n) ? n : 0);
const num = (n: number, digits = 2) => new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(Number.isFinite(n) ? n : 0);
const clamp = (n: number) => Math.max(0, Number.isFinite(n) ? n : 0);

export default function EarningPotentialPage() {
  const [v, setV] = useState<Inputs>(defaults);
  const [drafts, setDrafts] = useState<Partial<Record<keyof Inputs, string>>>({});
  const update = (key: NumericInputKey) => ({ value: drafts[key] ?? String(v[key]), onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setDrafts(old => ({ ...old, [key]: raw }));
      setV(old => ({ ...old, [key]: raw === "" ? 0 : clamp(Number(raw)) }));
    } });

  const result = useMemo(() => {
    const plans = v.nexus * 120 + v.nexusPlus * 200 + v.vortex * 440;
    const analyzer = v.analyzerReferrals * 10;
    const products = v.otherProductReferrals * v.otherProductCommission;
    const affiliates = v.affiliatePartners * v.affiliateBase * 0.2;
    const grossBusiness = plans + analyzer + products + affiliates;
    const netBusiness = grossBusiness - v.monthlyCosts;
    const pipValue = v.pipValueAt001 * (v.lotSize / 0.01);
    const scenarios = [3, 4, 5].map(wins => {
      const losses = 5 - wins;
      const grossWins = wins * v.winningPips * pipValue;
      const grossLosses = losses * v.losingPips * pipValue;
      const weekly = grossWins - grossLosses;
      return { wins, losses, grossWins, grossLosses, weekly, monthly: weekly * 4.33, sixMonths: weekly * 26, accountPct: v.accountSize > 0 ? weekly / v.accountSize * 100 : 0 };
    });
    const selectedTrading = scenarios.find(s => s.wins === v.selectedWins) ?? scenarios[1];
    return { plans, analyzer, products, affiliates, grossBusiness, netBusiness, scenarios, selectedTrading, combined: netBusiness + selectedTrading.monthly };
  }, [v]);

  const field = (label: string, key: NumericInputKey, suffix?: string, step = "1", help?: string) => (
    <label className="ep-field">
      <span>{label}</span>
      <div className="ep-input-wrap"><input type="number" min="0" step={step} {...update(key as NumericInputKey)} /><small>{suffix}</small></div>
      {help && <em>{help}</em>}
    </label>
  );

  return (
    <main className="ep-page">
      <style jsx global>{`
        .ep-page{--gold:#d4af37;--panel:#0d1420;--line:#253246;min-height:100vh;background:radial-gradient(ellipse at 85% 0%,rgba(212,175,55,.11),transparent 34%),#070b12;color:#f7f8fb;padding:42px 22px 72px;font-family:Arial,Helvetica,sans-serif}
        .ep-wrap{max-width:1240px;margin:0 auto}.ep-top{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:34px}.ep-brand{color:var(--gold);font-size:12px;font-weight:900;letter-spacing:.2em}.ep-top a{color:#aeb8c8;text-decoration:none;font-size:12px;border:1px solid var(--line);border-radius:8px;padding:10px 13px}
        .ep-hero{max-width:850px;margin-bottom:28px}.ep-kicker{color:var(--gold);font-size:10px;font-weight:900;letter-spacing:.19em}.ep-hero h1{font-size:clamp(38px,6vw,66px);line-height:1.02;letter-spacing:-.045em;margin:13px 0}.ep-hero h1 span{color:var(--gold)}.ep-hero p{max-width:760px;color:#aeb8c8;line-height:1.75;font-size:15px;margin:0}
        .ep-streams{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:28px 0}.ep-stream{background:linear-gradient(145deg,#111b2a,#0b111b);border:1px solid var(--line);border-radius:13px;padding:16px}.ep-stream b{display:block;color:var(--gold);font-size:10px;letter-spacing:.12em}.ep-stream strong{display:block;margin-top:10px;font-size:14px}.ep-stream small{display:block;color:#8995a8;line-height:1.5;margin-top:6px;font-size:11px}
        .ep-layout{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(300px,.65fr);gap:16px;align-items:start}.ep-main{display:grid;gap:14px}.ep-card{background:var(--panel);border:1px solid var(--line);border-radius:15px;padding:20px}.ep-card-head{display:flex;justify-content:space-between;gap:15px;align-items:start;margin-bottom:17px}.ep-card h2{font-size:17px;margin:6px 0 5px}.ep-card-head p{font-size:12px;color:#8f9bad;line-height:1.55;margin:0;max-width:700px}.ep-index{color:var(--gold);font-size:10px;font-weight:900;letter-spacing:.15em;white-space:nowrap}.ep-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.ep-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}.ep-field{display:block;min-width:0}.ep-field>span{display:block;color:#aeb8c8;font-size:10px;font-weight:800;letter-spacing:.06em;margin-bottom:7px}.ep-input-wrap{display:flex;align-items:center;gap:8px;background:#080e17;border:1px solid #344258;border-radius:9px;padding:0 11px}.ep-input-wrap:focus-within{border-color:var(--gold)}.ep-input-wrap input{width:100%;min-width:0;background:transparent;color:#fff;border:0;outline:0;padding:12px 0;font-size:15px;font-weight:700}.ep-input-wrap small{color:#8793a6;font-size:10px;white-space:nowrap}.ep-field em{display:block;color:#718096;font-size:10px;font-style:normal;line-height:1.4;margin-top:5px}
        .ep-plan-row{display:grid;grid-template-columns:1fr 110px 105px;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.06)}.ep-plan-row:last-child{border:0}.ep-plan-row strong{font-size:13px}.ep-plan-row small{display:block;color:#8793a6;font-size:10px;margin-top:3px}.ep-plan-commission{text-align:right;color:var(--gold);font-size:13px;font-weight:800}
        .ep-aside{position:sticky;top:18px;display:grid;gap:14px}.ep-total{background:linear-gradient(145deg,#1c1b15,#101722);border:1px solid rgba(212,175,55,.48);border-radius:16px;padding:22px}.ep-total .ep-kicker{font-size:10px}.ep-total h2{font-size:12px;color:#c4cad4;margin:13px 0 5px;font-weight:700}.ep-total-value{font-size:clamp(30px,4vw,44px);font-weight:900;letter-spacing:-.04em;color:#fff}.ep-total-note{color:#8995a8;font-size:10px;line-height:1.5;margin-top:8px}.ep-metric{display:flex;justify-content:space-between;gap:10px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.07);font-size:12px}.ep-metric:last-child{border:0}.ep-metric span{color:#9ba6b7}.ep-metric strong{color:#fff;text-align:right}.ep-metric.highlight strong{color:var(--gold)}.ep-scenario{border:1px solid var(--line);border-radius:11px;padding:13px;background:#090f19}.ep-scenario.active{border-color:var(--gold);background:rgba(212,175,55,.055)}.ep-scenarios{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.ep-scenario b{font-size:11px;color:var(--gold)}.ep-scenario strong{display:block;font-size:18px;margin:7px 0}.ep-scenario small{color:#8d99aa;font-size:10px;line-height:1.5}.ep-select{background:#080e17;border:1px solid #344258;color:#fff;border-radius:9px;padding:11px;width:100%;margin-top:8px}
        .ep-note{padding:14px 16px;border:1px solid rgba(212,175,55,.22);border-radius:11px;color:#9ca7b8;background:rgba(212,175,55,.04);font-size:11px;line-height:1.65}.ep-reset{border:1px solid #354257;background:#0a111b;color:#dce2eb;border-radius:9px;padding:10px 13px;cursor:pointer;font-size:11px;font-weight:800}.ep-bottom{margin-top:20px;color:#718096;font-size:10px;line-height:1.7;text-align:center}
        @media(max-width:900px){.ep-layout{grid-template-columns:1fr}.ep-aside{position:static;grid-template-columns:1fr 1fr}.ep-total{grid-column:1/-1}.ep-streams{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:600px){.ep-page{padding:25px 14px 50px}.ep-top{align-items:flex-start}.ep-hero h1{font-size:40px}.ep-grid,.ep-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}.ep-plan-row{grid-template-columns:1fr 85px}.ep-plan-commission{grid-column:2;text-align:left}.ep-scenarios{grid-template-columns:1fr}.ep-aside{grid-template-columns:1fr}.ep-streams{gap:8px}.ep-stream{padding:13px}.ep-card{padding:16px}}
      `}</style>

      <div className="ep-wrap">
        <div className="ep-top"><div className="ep-brand">VAULTTRADES · LIVE PROJECTION</div><a href="/opportunity">← Back to opportunity</a></div>
        <header className="ep-hero">
          <div className="ep-kicker">INTERACTIVE EARNING POTENTIAL EXPLORER</div>
          <h1>Explore the <span>possibilities.</span></h1>
          <p>Change the numbers, combine the income streams and see how different participation levels could affect an illustrative monthly projection. This is a live presentation tool—not a forecast or income promise.</p>
        </header>

        <div className="ep-streams">
          <div className="ep-stream"><b>01 · PARTNER PLANS</b><strong>Membership referrals</strong><small>Nexus, Nexus Plus and Vortex. You can model one plan or all three.</small></div>
          <div className="ep-stream"><b>02 · TRADING</b><strong>One trade per day</strong><small>Editable lot size, captured pips and weekly outcome scenarios.</small></div>
          <div className="ep-stream"><b>03 · PRODUCTS</b><strong>Digital product referrals</strong><small>Analyzer and other approved VaultTrades product referrals.</small></div>
          <div className="ep-stream"><b>04 · AFFILIATES</b><strong>External partner referrals</strong><small>Model partner count and qualifying sales base at 20%.</small></div>
        </div>

        <div className="ep-layout">
          <div className="ep-main">
            <section className="ep-card">
              <div className="ep-card-head"><div><div className="ep-index">INCOME STREAM 01</div><h2>Partner-plan referrals</h2><p>Enter the number of qualifying referrals for each plan. The illustration uses the eligible MRR commission component verified in the current plan structure—not the full package price.</p></div></div>
              <div className="ep-plan-row"><div><strong>VaultTrades Nexus</strong><small>$150 package · $120 eligible MRR commission per qualifying referral</small></div><div>{field("REFERRALS", "nexus", "people")}</div><div className="ep-plan-commission">{usd(v.nexus * 120)}<small>monthly</small></div></div>
              <div className="ep-plan-row"><div><strong>VaultTrades Nexus Plus</strong><small>$250 package · $200 eligible MRR commission per qualifying referral</small></div><div>{field("REFERRALS", "nexusPlus", "people")}</div><div className="ep-plan-commission">{usd(v.nexusPlus * 200)}<small>monthly</small></div></div>
              <div className="ep-plan-row"><div><strong>VaultTrades Vortex</strong><small>$550 package · $440 eligible MRR commission per qualifying referral</small></div><div>{field("REFERRALS", "vortex", "people")}</div><div className="ep-plan-commission">{usd(v.vortex * 440)}<small>monthly</small></div></div>
              <div className="ep-note">Plan referrals are modelled independently, so a participant can explore one, two or all three plans. This assumes qualifying, attributed and commissionable referrals under the applicable reseller terms. A participant's own plan purchase is not counted as referral income.</div>
            </section>

            <section className="ep-card">
              <div className="ep-card-head"><div><div className="ep-index">INCOME STREAM 02</div><h2>Trading scenarios</h2><p>Model five trades per week—one per trading day. Adjust account size, lot size and the average pips actually captured or lost per trade.</p></div></div>
              <div className="ep-grid">
                {field("TRADING ACCOUNT SIZE", "accountSize", "USD", "1")}
                {field("LOT SIZE", "lotSize", "lots", "0.01", "0.10 lot is an example, not a recommendation for every account.")}
                {field("USD VALUE PER PIP AT 0.01 LOT", "pipValueAt001", "USD / pip", "0.01", "Enter the instrument- and broker-specific pip value. Zero is used until you enter a verified value.")}
                {field("AVERAGE PIPS CAPTURED PER WIN", "winningPips", "pips", "1")}
                {field("AVERAGE PIPS LOST PER LOSS", "losingPips", "pips", "1")}
              </div>
              <div style={{marginTop:18}}><div className="ep-index" style={{marginBottom:10}}>WEEKLY OUTCOME SCENARIOS · FIVE TRADES</div><div className="ep-scenarios">{result.scenarios.map(s=><div className={"ep-scenario "+(v.selectedWins===s.wins?"active":"")} key={s.wins}><b>{s.wins} WINS / {s.losses} LOSSES</b><strong>{usd(s.weekly)}</strong><small>Weekly illustration<br/>Monthly: {usd(s.monthly)}<br/>6 months: {usd(s.sixMonths)}</small></div>)}</div></div>
              <label className="ep-field" style={{display:"block",marginTop:14}}><span>SELECT THE TRADING SCENARIO TO INCLUDE IN THE COMBINED VIEW</span><select className="ep-select" value={v.selectedWins} onChange={e=>setV(old=>({...old,selectedWins:Math.min(5,Math.max(0,Number(e.target.value)||0))}))}><option value="3">3 wins / 2 losses</option><option value="4">4 wins / 1 loss</option><option value="5">5 wins / 0 losses</option></select></label>
              <div className="ep-note" style={{marginTop:13}}>These are outcome examples, not measured win probabilities. Market movement is not the same as pips captured. Actual pip value depends on the instrument, broker contract, account currency and lot size. Results exclude spread, commission, swaps, slippage and tax. Trading can result in losses.</div>
            </section>

            <section className="ep-card">
              <div className="ep-card-head"><div><div className="ep-index">INCOME STREAM 03</div><h2>VaultTrades product referrals</h2><p>Analyzer is modelled at the stated 50% of its $20 monthly access price. Other product commissions remain editable because rates differ by product.</p></div></div>
              <div className="ep-grid">
                {field("QUALIFYING ANALYZER REFERRALS", "analyzerReferrals", "people")}
                {field("OTHER PRODUCT REFERRALS", "otherProductReferrals", "people")}
                {field("APPROVED COMMISSION PER OTHER PRODUCT REFERRAL", "otherProductCommission", "USD", "0.01", "Enter the confirmed amount for the relevant product or product mix.")}
              </div>
              <div className="ep-note" style={{marginTop:13}}>Analyzer illustration: $20 monthly access × 50% = $10 per qualifying monthly referral. Recurring eligibility, attribution and payment conditions must be confirmed under the applicable agreement.</div>
            </section>

            <section className="ep-card">
              <div className="ep-card-head"><div><div className="ep-index">INCOME STREAM 04</div><h2>External affiliate partnerships</h2><p>Explore the potential of referring people to approved affiliate partners using the 20% commission rate you specified.</p></div></div>
              <div className="ep-grid two">
                {field("NUMBER OF QUALIFYING AFFILIATE PARTNERS", "affiliatePartners", "partners")}
                {field("AVERAGE ELIGIBLE SALES / COMMISSION BASE PER PARTNER", "affiliateBase", "USD", "1", "Use the approved commissionable sales base—not total business turnover unless the agreement says so.")}
              </div>
              <div className="ep-note" style={{marginTop:13}}>Illustration: number of qualifying partner referrals × eligible commission base per partner × 20%. Each external programme may define its own attribution, qualifying activity, reversals and payout rules.</div>
            </section>

            <section className="ep-card">
              <div className="ep-card-head"><div><div className="ep-index">COST ASSUMPTIONS</div><h2>Include operating costs</h2><p>Enter monthly costs to see an estimated business-commission net. The website setup is a separate once-off amount.</p></div></div>
              <div className="ep-grid two">
                {field("MONTHLY OPERATING COSTS", "monthlyCosts", "USD", "0.01")}
                {field("WEBSITE SETUP · ONCE-OFF", "setupCost", "USD", "0.01")}
              </div>
            </section>
          </div>

          <aside className="ep-aside">
            <div className="ep-total">
              <div className="ep-kicker">LIVE MONTHLY PROJECTION</div>
              <h2>Illustrative combined monthly potential</h2>
              <div className="ep-total-value">{usd(result.combined)}</div>
              <div className="ep-total-note">Business commission net + selected trading scenario monthly result. This combined illustration is not guaranteed income.</div>
              <div style={{marginTop:16,borderTop:"1px solid rgba(255,255,255,.1)"}}>
                <div className="ep-metric"><span>Business commissions · gross</span><strong>{usd(result.grossBusiness)}</strong></div>
                <div className="ep-metric"><span>Monthly operating costs</span><strong>− {usd(v.monthlyCosts)}</strong></div>
                <div className="ep-metric highlight"><span>Business commissions · estimated net</span><strong>{usd(result.netBusiness)}</strong></div>
                <div className="ep-metric"><span>Trading · selected monthly scenario</span><strong>{usd(result.selectedTrading.monthly)}</strong></div>
              </div>
            </div>
            <div className="ep-card">
              <div className="ep-index">BUSINESS COMMISSION BREAKDOWN</div>
              <div className="ep-metric"><span>Partner plans</span><strong>{usd(result.plans)}</strong></div>
              <div className="ep-metric"><span>Analyzer referrals</span><strong>{usd(result.analyzer)}</strong></div>
              <div className="ep-metric"><span>Other product referrals</span><strong>{usd(result.products)}</strong></div>
              <div className="ep-metric"><span>Affiliate partnerships · 20%</span><strong>{usd(result.affiliates)}</strong></div>
              <div className="ep-metric highlight"><span>Total gross business commissions</span><strong>{usd(result.grossBusiness)}</strong></div>
            </div>
            <div className="ep-card">
              <div className="ep-index">PRESENTATION CONTROLS</div>
              <div className="ep-metric"><span>Trading outcome selected</span><strong>{v.selectedWins} / 5 wins</strong></div>
              <div className="ep-metric"><span>Weekly trading illustration</span><strong>{usd(result.selectedTrading.weekly)}</strong></div>
              <div className="ep-metric"><span>Six-month trading illustration</span><strong>{usd(result.selectedTrading.sixMonths)}</strong></div>
              <div className="ep-metric"><span>Trading result vs account size</span><strong>{num(result.selectedTrading.accountPct,2)}%</strong></div>
              <button className="ep-reset" style={{width:"100%",marginTop:14}} onClick={()=>{setV(defaults);setDrafts({});}}>RESET ALL ASSUMPTIONS</button>
            </div>
            <div className="ep-note">The combined figure adds two different types of illustrative results. Trading is not a business commission. No projection should be presented as a promise, expected return or guarantee.</div>
          </aside>
        </div>
        <footer className="ep-bottom">VAULTTRADES · TRADE WITH STRUCTURE. BUILD WITH PURPOSE.<br/>Illustrative calculations only. Actual income depends on individual activity, eligibility, programme terms, trading outcomes and costs. Nothing here is financial advice or a guarantee of results.</footer>
      </div>
    </main>
  );
}

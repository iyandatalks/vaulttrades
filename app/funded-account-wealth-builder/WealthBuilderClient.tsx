"use client";

import { useMemo, useState } from "react";

const money = (value: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
const number = (value: string, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="condition-box" style={{ minWidth: 0 }}>
    <div style={{ color: "#aeb9ca", fontSize: 12 }}>{label}</div>
    <div style={{ color: "#f6f7fb", fontSize: 24, fontWeight: 750, marginTop: 7, overflowWrap: "anywhere" }}>{value}</div>
    {note && <div style={{ color: "#aeb9ca", fontSize: 11, marginTop: 5 }}>{note}</div>}
  </div>;
}

function Field({ label, value, onChange, prefix, min = 0, step = 1 }: {
  label: string; value: string; onChange: (value: string) => void; prefix?: string; min?: number; step?: number;
}) {
  return <label style={{ display: "grid", gap: 7, color: "#dce2ec", fontSize: 13, fontWeight: 600 }}>
    {label}
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#080e1b", border: "1px solid rgba(255,255,255,.14)", borderRadius: 10, padding: "0 12px" }}>
      {prefix && <span style={{ color: "#d4a637" }}>{prefix}</span>}
      <input type="number" min={min} step={step} value={value} onChange={e => onChange(e.target.value)}
        style={{ width: "100%", minWidth: 0, padding: "12px 0", color: "#fff", background: "transparent", border: 0, outline: 0 }} />
    </div>
  </label>;
}

function BarChart({ values, labels, currency = "USD" }: { values: number[]; labels: string[]; currency?: string }) {
  const max = Math.max(1, ...values);
  return <div style={{ display: "grid", gridTemplateColumns: `repeat(${values.length},minmax(0,1fr))`, gap: 9, alignItems: "end", height: 190, padding: "14px 4px 0" }}>
    {values.map((v, i) => <div key={labels[i]} style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "end", alignItems: "center", gap: 7, minWidth: 0 }}>
      <div title={money(v, currency)} style={{ color: "#e5c36b", fontSize: 10, whiteSpace: "nowrap" }}>{money(v, currency)}</div>
      <div style={{ width: "min(100%,42px)", height: `${Math.max(3, (v / max) * 112)}px`, background: "linear-gradient(180deg,#e3bd5d,#8d6820)", borderRadius: "7px 7px 2px 2px" }} />
      <div style={{ color: "#aeb9ca", fontSize: 11 }}>{labels[i]}</div>
    </div>)}
  </div>;
}

export default function WealthBuilderClient() {
  const [weeklyIntroductions, setWeeklyIntroductions] = useState("3");
  const [conversionRate, setConversionRate] = useState("33.33");
  const [partnerReceipt, setPartnerReceipt] = useState("120");
  const [resellerAllocation, setResellerAllocation] = useState("50");
  const [affiliateMonthly, setAffiliateMonthly] = useState("300");
  const [affiliateAllocation, setAffiliateAllocation] = useState("50");
  const [personalCapital, setPersonalCapital] = useState("5000");
  const [personalRate, setPersonalRate] = useState("3");
  const [fundedSize, setFundedSize] = useState("50000");
  const [dailyProfit, setDailyProfit] = useState("200");
  const [daysPerWeek, setDaysPerWeek] = useState("5");
  const [weeksPerMonth, setWeeksPerMonth] = useState("4");
  const [bufferMonths, setBufferMonths] = useState("6");
  const [monthlyWithdrawal, setMonthlyWithdrawal] = useState("1000");
  const [profitSplit, setProfitSplit] = useState("80");
  const [bufferAllocation, setBufferAllocation] = useState("100");

  const reseller = useMemo(() => {
    const signups = Math.max(0, number(weeklyIntroductions) * number(conversionRate) / 100 * 4);
    const gross = signups * number(partnerReceipt);
    return { signups, gross, allocated: gross * number(resellerAllocation) / 100 };
  }, [weeklyIntroductions, conversionRate, partnerReceipt, resellerAllocation]);

  const affiliate = useMemo(() => {
    const gross = number(affiliateMonthly);
    return { gross, allocated: gross * number(affiliateAllocation) / 100 };
  }, [affiliateMonthly, affiliateAllocation]);

  const personal = useMemo(() => {
    const start = number(personalCapital);
    const rate = number(personalRate) / 100;
    const rows = Array.from({ length: 6 }, (_, i) => start * Math.pow(1 + rate, i + 1));
    return { rows, end: rows[5] ?? start, change: (rows[5] ?? start) - start };
  }, [personalCapital, personalRate]);

  const funded = useMemo(() => {
    const daily = number(dailyProfit);
    const days = number(daysPerWeek);
    const weeks = number(weeksPerMonth);
    const months = number(bufferMonths);
    const grossMonth = daily * days * weeks;
    const grossBuffer = grossMonth * months;
    const share = number(profitSplit) / 100;
    const retained = grossBuffer * number(bufferAllocation) / 100;
    const traderShare = grossBuffer * share;
    const monthlyNeed = number(monthlyWithdrawal);
    return {
      grossMonth, grossBuffer, retained, traderShare,
      targetPct: number(fundedSize) > 0 ? daily / number(fundedSize) * 100 : 0,
      runway: monthlyNeed > 0 ? retained * share / monthlyNeed : 0,
      monthlyPayoutEquivalent: grossMonth * share,
      monthlyNeed,
      months
    };
  }, [dailyProfit, daysPerWeek, weeksPerMonth, bufferMonths, monthlyWithdrawal, profitSplit, bufferAllocation, fundedSize]);

  const [active, setActive] = useState("reseller");
  const tabs = [
    ["reseller", "01 · Reseller to Trader"],
    ["affiliate", "02 · Affiliate & IB"],
    ["funded", "03 · Funded Account Buffer"]
  ];

  return <main className="shell" style={{ maxWidth: 1180 }}>
    <section className="card" style={{ border: "1px solid rgba(212,166,55,.35)", background: "linear-gradient(145deg,#101a2b,#080e19)" }}>
      <div className="section-label">VORTEX · WEALTH BUILDER</div>
      <h1 className="title">Build a business. Build capital. Build options.</h1>
      <p className="muted" style={{ maxWidth: 850, lineHeight: 1.75 }}>
        A practical learning model showing how Vortex partners may combine Master Reseller activity, eligible affiliate earnings,
        disciplined trading and longer-term capital allocation. Choose a pathway to explore its steps and model your own assumptions.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginTop: 22 }}>
        <div className="condition-box"><strong style={{ color: "#d4a637" }}>01 · Create business proceeds</strong><p className="muted">Build a customer network and track qualifying sales and partner commissions.</p></div>
        <div className="condition-box"><strong style={{ color: "#d4a637" }}>02 · Grow capital deliberately</strong><p className="muted">Allocate eligible proceeds to personal trading or a suitable funded-account route.</p></div>
        <div className="condition-box"><strong style={{ color: "#d4a637" }}>03 · Protect and diversify</strong><p className="muted">Understand buffers, payout conditions, reserves and longer-term investment choices.</p></div>
      </div>
    </section>

    <section className="card" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {tabs.map(([id, label]) => <button key={id} type="button" onClick={() => setActive(id)}
          aria-pressed={active === id}
          style={{ border: active === id ? "1px solid #d4a637" : "1px solid rgba(255,255,255,.14)", borderRadius: 999, padding: "10px 15px", background: active === id ? "rgba(212,166,55,.14)" : "#080e1b", color: active === id ? "#f2d37e" : "#dce2ec", cursor: "pointer", fontWeight: 700 }}>{label}</button>)}
      </div>

      {active === "reseller" && <div style={{ marginTop: 22 }}>
        <div className="section-label">PATHWAY 01</div>
        <h2 style={{ margin: "8px 0" }}>Reseller-to-Trader: turn sales activity into starting capital</h2>
        <p className="muted">The first wealth-building route begins with introducing the Master Reseller opportunity. A member chooses an activity target, tracks actual conversions and decides how to allocate commissions received.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginTop: 18 }}>
          <Field label="People introduced each week" value={weeklyIntroductions} onChange={setWeeklyIntroductions} />
          <Field label="Illustrative conversion rate (%)" value={conversionRate} onChange={setConversionRate} step={0.1} />
          <Field label="Average partner receipt per signup" value={partnerReceipt} onChange={setPartnerReceipt} prefix="$" />
          <Field label="Allocation to trading / funded capital (%)" value={resellerAllocation} onChange={setResellerAllocation} step={1} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginTop: 18 }}>
          <Metric label="Illustrative monthly signups" value={reseller.signups.toFixed(1)} note="Based on four weeks of activity" />
          <Metric label="Illustrative monthly proceeds" value={money(reseller.gross)} note="Before costs, reversals and tax" />
          <Metric label="Chosen capital allocation" value={money(reseller.allocated)} note="Your selected allocation percentage" />
        </div>
        <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12 }}>
          <div className="condition-box"><strong>Route A · Personal trading</strong><p className="muted">Allocate an amount to a personal broker account. Use Analyzer to assess a setup, Risk Manager to size risk and Journal to record every trade.</p></div>
          <div className="condition-box"><strong>Route B · Funded account</strong><p className="muted">Build a separate reserve for a suitable prop-firm programme, after comparing its fees, drawdown, payout and account rules.</p></div>
        </div>
        <div className="condition-box" style={{ marginTop: 14 }}>
          <strong>Repeatable weekly routine</strong>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginTop: 12 }}>
            {["Introduce 3 suitable people", "Follow up and explain the offer", "Record verified signups and receipts", "Allocate proceeds by a written plan"].map((v, i) => <div key={v} style={{ color: "#dce2ec", fontSize: 13 }}><span style={{ color: "#d4a637", fontWeight: 800 }}>0{i + 1}</span><br />{v}</div>)}
          </div>
        </div>
      </div>}

      {active === "affiliate" && <div style={{ marginTop: 22 }}>
        <div className="section-label">PATHWAY 02</div>
        <h2 style={{ margin: "8px 0" }}>Affiliate and IB growth: build a separate capital stream</h2>
        <p className="muted">Vortex partners who use third-party services may introduce suitable traders to recommended brokers and prop firms where referral arrangements are available. Any commission depends on the provider's programme and terms.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12, marginTop: 18 }}>
          <Field label="Eligible affiliate / IB earnings per month" value={affiliateMonthly} onChange={setAffiliateMonthly} prefix="$" />
          <Field label="Allocation to personal capital (%)" value={affiliateAllocation} onChange={setAffiliateAllocation} step={1} />
          <Field label="Illustrative starting personal capital" value={personalCapital} onChange={setPersonalCapital} prefix="$" />
          <Field label="Monthly growth scenario (%)" value={personalRate} onChange={setPersonalRate} step={0.1} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginTop: 18 }}>
          <Metric label="Monthly affiliate proceeds" value={money(affiliate.gross)} note="User-entered illustration" />
          <Metric label="Allocated to personal capital" value={money(affiliate.allocated)} note="Before taxes and costs" />
          <Metric label="6-month modeled capital" value={money(personal.end)} note={`Starting from ${money(number(personalCapital))}`} />
        </div>
        <div className="condition-box" style={{ marginTop: 16 }}>
          <strong>Personal-capital scenario · 3% per month</strong>
          <p className="muted">The 3% setting is an editable scenario assumption, not a target VaultTrades expects members to achieve. A month can be negative or flat. Do not increase risk or force trades to meet a percentage.</p>
          <BarChart values={[number(personalCapital), ...personal.rows]} labels={["Start", "M1", "M2", "M3", "M4", "M5", "M6"]} />
          <div style={{ color: "#aeb9ca", fontSize: 11 }}>Illustrative compounding only. Excludes deposits, withdrawals, fees, slippage and tax; actual returns can be negative.</div>
        </div>
        <div className="condition-box" style={{ marginTop: 14 }}>
          <strong>Keep the money streams separate</strong>
          <p className="muted">Record the source, date, provider, gross commission, deductions and net amount received. Decide how much is reserved for tax, business costs, personal needs and capital allocation before transferring funds.</p>
        </div>
      </div>}

      {active === "funded" && <div style={{ marginTop: 22 }}>
        <div className="section-label">PATHWAY 03</div>
        <h2 style={{ margin: "8px 0" }}>Funded-account buffering and wealth expansion</h2>
        <p className="muted">A buffer is a planning reserve. It may help a trader avoid depending on one month's result for living expenses, but the balance, payout eligibility and ability to retain profits depend entirely on the specific provider and account product.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginTop: 18 }}>
          <Field label="Nominal funded account size" value={fundedSize} onChange={setFundedSize} prefix="$" />
          <Field label="Illustrative gross profit per trading day" value={dailyProfit} onChange={setDailyProfit} prefix="$" />
          <Field label="Trading days per week" value={daysPerWeek} onChange={setDaysPerWeek} />
          <Field label="Weeks used per month" value={weeksPerMonth} onChange={setWeeksPerMonth} step={0.1} />
          <Field label="Buffer-building period (months)" value={bufferMonths} onChange={setBufferMonths} />
          <Field label="Desired monthly living withdrawal" value={monthlyWithdrawal} onChange={setMonthlyWithdrawal} prefix="$" />
          <Field label="Illustrative trader profit share (%)" value={profitSplit} onChange={setProfitSplit} step={1} />
          <Field label="Share of gross profit retained in model (%)" value={bufferAllocation} onChange={setBufferAllocation} step={1} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginTop: 18 }}>
          <Metric label="Daily target vs nominal size" value={funded.targetPct.toFixed(2) + "%"} note="Illustrative daily profit as % of account size" />
          <Metric label="Modeled gross profit / month" value={money(funded.grossMonth)} note="Before provider split and deductions" />
          <Metric label={`Gross profit over ${funded.months} months`} value={money(funded.grossBuffer)} note="Assumes the same result every modeled period" />
          <Metric label="Modeled retained amount" value={money(funded.retained)} note="Not necessarily withdrawable cash" />
          <Metric label="Trader share of retained amount" value={money(funded.retained * number(profitSplit) / 100)} note={`At ${number(profitSplit)}% illustrative split`} />
          <Metric label="Illustrative withdrawal runway" value={funded.runway.toFixed(1) + " months"} note="Only if this amount is actually paid and available" />
        </div>
        <div className="condition-box" style={{ marginTop: 18 }}>
          <strong>Six-month buffer illustration · $200 per day</strong>
          <p className="muted">With $200 gross profit on each of five trading days, the arithmetic is $1,000 per five-day week. Using four weeks per month gives $4,000 gross per month and $24,000 gross over six months. This is a scenario, not a forecast or guaranteed payout.</p>
          <BarChart values={Array.from({ length: Math.max(1, Math.min(12, number(bufferMonths, 6))) }, (_, i) => funded.grossMonth * (i + 1))} labels={Array.from({ length: Math.max(1, Math.min(12, number(bufferMonths, 6))) }, (_, i) => `M${i + 1}`)} />
          <div style={{ color: "#aeb9ca", fontSize: 11 }}>The graph shows cumulative modeled gross trading profit, not account equity, withdrawable profit or cash received.</div>
        </div>
        <div className="condition-box" style={{ marginTop: 14 }}>
          <strong>How to plan a buffer responsibly</strong>
          <ol style={{ color: "#dce2ec", lineHeight: 1.8, paddingLeft: 20 }}>
            <li>Read the exact account agreement before choosing a payout schedule.</li>
            <li>Check whether profits can remain in the account, whether a minimum buffer is required and whether a payout changes drawdown limits.</li>
            <li>Check whether the account resets, continues, scales or closes after a payout. Never assume a full withdrawal freezes every prop-firm account.</li>
            <li>Plan living withdrawals only from rewards actually approved and received, not from simulated account equity.</li>
            <li>Maintain an independent personal reserve. Consider more than one provider account only after assessing the extra fees, rule complexity and risk.</li>
          </ol>
        </div>
        <div className="condition-box" style={{ marginTop: 14 }}>
          <strong>After a payout: allocate, then diversify</strong>
          <p className="muted">Once a reward has cleared, allocate it deliberately: tax and obligations first, personal emergency reserve next, then any amount chosen for a personal trading account, business, property or diversified investment. Crypto is only a transfer route where lawful and permitted by both providers; it is not itself a wealth strategy.</p>
        </div>
      </div>}
    </section>

    <section className="card" style={{ marginTop: 16, border: "1px solid rgba(235,85,95,.5)", background: "linear-gradient(145deg,rgba(85,27,34,.28),#0b1220)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div aria-hidden="true" style={{ width: 46, height: 46, flex: "0 0 46px", display: "grid", placeItems: "center", borderRadius: "50%", border: "2px solid #f07c7c", color: "#ff9292", fontSize: 25, fontWeight: 900 }}>!</div>
        <div>
          <div style={{ color: "#ffaaaa", fontWeight: 850, letterSpacing: ".08em", fontSize: 12 }}>IMPORTANT · NOT FINANCIAL ADVICE</div>
          <h2 style={{ margin: "4px 0", fontSize: 21 }}>A community model — not a financial advisory service</h2>
        </div>
      </div>
      <p style={{ color: "#e4e8ef", lineHeight: 1.8, marginTop: 12 }}>
        VaultTrades is a community of traders, tool users and Master Reseller partners who share an interest in learning, disciplined processes and building their own opportunities. We are not financial advisers, wealth managers or a licensed investment advisory service through this model. This framework is educational and illustrative, not a recommendation, instruction or promise. Participation in any pathway is optional. Every member is responsible for their own business, trading, provider and investment decisions and should seek appropriately qualified independent advice where needed.
      </p>
      <p style={{ color: "#ffb2b2", lineHeight: 1.7, fontSize: 13, fontWeight: 650 }}>
        Trading and investing involve risk. You may lose capital, fail to receive a payout or lose access to a funded account. Past results and modeled figures do not predict future outcomes.
      </p>
    </section>
  </main>;
}

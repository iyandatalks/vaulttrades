"use client";

import { useMemo, useState } from "react";

export default function WealthBuilderClient() {
  const [capital, setCapital] = useState("75000");
  const [incomeGoal, setIncomeGoal] = useState("500");
  const [buffer, setBuffer] = useState("5000");
  const [months, setMonths] = useState("6");
  const [returns, setReturns] = useState("3,4,0.5,2,-1,3");

  const plan = useMemo(() => {
    const start = Number(capital);
    const goal = Number(incomeGoal);
    const reserve = Number(buffer);
    const monthCount = Math.max(1, Math.floor(Number(months)));
    const monthlyReturns = returns
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value));

    if (!Number.isFinite(start) || start <= 0 || !Number.isFinite(goal) || goal < 0 || !Number.isFinite(reserve) || reserve < 0) {
      return null;
    }

    let balance = start;
    const rows = Array.from({ length: monthCount }, (_, index) => {
      const rate = monthlyReturns[index] ?? monthlyReturns[monthlyReturns.length - 1] ?? 0;
      const growth = balance * (rate / 100);
      balance += growth;
      return { month: index + 1, rate, growth, balance };
    });

    const averageReturn = monthlyReturns.length ? monthlyReturns.reduce((sum, value) => sum + value, 0) / monthlyReturns.length : 0;
    return {
      rows,
      averageReturn,
      finalBalance: balance,
      requiredBuffer: reserve,
      incomeGoal: goal,
      bufferReached: balance - start >= reserve,
    };
  }, [capital, incomeGoal, buffer, months, returns]);

  return (
    <main className="shell">
      <section className="card">
        <div className="section-label">FUNDED ACCOUNT WEALTH BUILDER</div>
        <h1 className="title">Build a disciplined funded-account plan</h1>
        <p className="muted">Model capital, income goals, buffer targets and monthly return assumptions. This is a planning calculator; projections are not guarantees of trading results.</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginTop: 22 }}>
          <label className="muted">Starting capital<input className="coach-question" value={capital} onChange={e => setCapital(e.target.value)} /></label>
          <label className="muted">Monthly income goal<input className="coach-question" value={incomeGoal} onChange={e => setIncomeGoal(e.target.value)} /></label>
          <label className="muted">Buffer target<input className="coach-question" value={buffer} onChange={e => setBuffer(e.target.value)} /></label>
          <label className="muted">Months<input className="coach-question" value={months} onChange={e => setMonths(e.target.value)} /></label>
        </div>

        <label className="muted" style={{ display: "block", marginTop: 12 }}>
          Monthly return assumptions (%)
          <input className="coach-question" value={returns} onChange={e => setReturns(e.target.value)} placeholder="3,4,0.5,2,-1,3" />
        </label>
      </section>

      {plan && (
        <>
          <section className="card" style={{ marginTop: 16 }}>
            <div className="section-label">PLAN SUMMARY</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginTop: 16 }}>
              <div className="condition-box"><strong>Final modeled balance</strong><div>{plan.finalBalance.toFixed(2)}</div></div>
              <div className="condition-box"><strong>Average assumed return</strong><div>{plan.averageReturn.toFixed(2)}%</div></div>
              <div className="condition-box"><strong>Buffer target</strong><div>{plan.requiredBuffer.toFixed(2)}</div></div>
              <div className="condition-box"><strong>Buffer status</strong><div>{plan.bufferReached ? "Modeled target reached" : "Continue building buffer"}</div></div>
            </div>
          </section>

          <section className="card" style={{ marginTop: 16 }}>
            <div className="section-label">MONTH-BY-MONTH MODEL</div>
            <div style={{ overflowX: "auto", marginTop: 14 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={{ textAlign:"left", padding:8 }}>Month</th><th style={{ textAlign:"left", padding:8 }}>Assumed return</th><th style={{ textAlign:"left", padding:8 }}>Modeled change</th><th style={{ textAlign:"left", padding:8 }}>Modeled balance</th></tr></thead>
                <tbody>
                  {plan.rows.map(row => (
                    <tr key={row.month}>
                      <td style={{ padding:8 }}>{row.month}</td>
                      <td style={{ padding:8 }}>{row.rate.toFixed(2)}%</td>
                      <td style={{ padding:8 }}>{row.growth.toFixed(2)}</td>
                      <td style={{ padding:8 }}>{row.balance.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

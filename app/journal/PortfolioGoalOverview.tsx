"use client";

import { useEffect, useMemo, useState } from "react";

type PortfolioAccount = {
  id: string;
  firm_name: string;
  starting_capital: number;
  payout_target: number;
  currency: string;
  color: string;
  program_name?: string;
  account_stage?: string;
  platform?: string;
  phase?: string;
};
type PortfolioEntry = {
  funded_account_id: string | null;
  pnl: number;
  result: string;
};
type Props = { accounts: PortfolioAccount[]; entries: PortfolioEntry[] };
type Rates = Partial<Record<string, number>>;

const symbol = (currency: string) =>
  currency === "ZAR" ? "R" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";
const money = (value: number, currency: string) =>
  symbol(currency) + Math.abs(value).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const converted = (value: number, currency: string, rates: Rates) =>
  currency === "ZAR" ? value : rates[currency] ? value * rates[currency]! : null;

export default function PortfolioGoalOverview({ accounts, entries }: Props) {
  const [rates, setRates] = useState<Rates>({ ZAR: 1 });
  const [ratesReady, setRatesReady] = useState(false);

  useEffect(() => {
    let active = true;
    const currencies = Array.from(new Set(accounts.map((a) => a.currency).filter((c) => c && c !== "ZAR")));
    void Promise.all(currencies.map(async (currency) => {
      try {
        const response = await fetch("https://api.frankfurter.app/latest?from=" + encodeURIComponent(currency) + "&to=ZAR");
        if (!response.ok) return [currency, null] as const;
        const payload = await response.json();
        const rate = Number(payload?.rates?.ZAR);
        return [currency, Number.isFinite(rate) && rate > 0 ? rate : null] as const;
      } catch {
        return [currency, null] as const;
      }
    })).then((results) => {
      if (!active) return;
      const next: Rates = { ZAR: 1 };
      for (const [currency, rate] of results) if (rate) next[currency] = rate;
      setRates(next);
      setRatesReady(true);
    });
    return () => { active = false; };
  }, [accounts]);

  const rows = useMemo(() => accounts.map((account) => {
    const trades = entries.filter((entry) =>
      entry.funded_account_id === account.id && entry.result !== "OPEN"
    );
    const pnl = trades.reduce((sum, entry) => sum + (Number(entry.pnl) || 0), 0);
    const target = Math.max(0, Number(account.payout_target) || 0);
    const remaining = Math.max(0, target - pnl);
    const progress = target > 0 ? Math.max(0, Math.min(100, pnl / target * 100)) : 0;
    return { account, trades: trades.length, pnl, target, remaining, progress };
  }), [accounts, entries]);

  const totals = useMemo(() => {
    const capitalZar = rows.reduce((sum, row) => sum + (converted(Number(row.account.starting_capital) || 0, row.account.currency, rates) ?? 0), 0);
    const pnlZar = rows.reduce((sum, row) => sum + (converted(row.pnl, row.account.currency, rates) ?? 0), 0);
    const targetZar = rows.reduce((sum, row) => sum + (converted(row.target, row.account.currency, rates) ?? 0), 0);
    const remainingZar = Math.max(0, targetZar - pnlZar);
    const convertedRows = rows.every((row) => row.account.currency === "ZAR" || rates[row.account.currency]);
    const progress = targetZar > 0 ? Math.max(0, Math.min(100, pnlZar / targetZar * 100)) : 0;
    return { capitalZar, pnlZar, targetZar, remainingZar, progress, convertedRows };
  }, [rows, rates]);

  if (!accounts.length) return null;

  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const achievedArc = circumference * totals.progress / 100;

  return (
    <section className="card" style={{ marginBottom: 16, overflow: "hidden", border: "1px solid rgba(212,175,55,.42)", background: "linear-gradient(135deg,rgba(212,175,55,.10),rgba(20,20,20,.12) 48%,rgba(212,175,55,.04))" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="section-label">YOUR TRADING JOURNEY · COMBINED PORTFOLIO</div>
          <h2 style={{ margin: "5px 0 0" }}>One portfolio. Multiple funded projects.</h2>
          <p className="muted" style={{ margin: "6px 0 0" }}>A live view of combined funded capital, realised trading profit and each account’s remaining goal.</p>
        </div>
        <div style={{ border: "1px solid rgba(212,175,55,.35)", borderRadius: 999, padding: "7px 12px", fontSize: 12, color: "#D4AF37" }}>{accounts.length} active {accounts.length === 1 ? "account" : "accounts"}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 14, alignItems: "center", marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, minHeight: 170 }}>
          <div style={{ position: "relative", width: 156, height: 156, flex: "0 0 156px" }}>
            <svg viewBox="0 0 140 140" width="156" height="156" role="img" aria-label={"Combined portfolio goal progress " + totals.progress.toFixed(1) + " percent"}>
              <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(150,150,150,.22)" strokeWidth="13" />
              <circle cx="70" cy="70" r={radius} fill="none" stroke="#D4AF37" strokeWidth="13" strokeLinecap="round" strokeDasharray={achievedArc + " " + circumference} transform="rotate(-90 70 70)" />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
              <strong style={{ fontSize: 27, lineHeight: 1.1 }}>{totals.progress.toFixed(1)}%</strong>
              <span className="muted" style={{ fontSize: 11, marginTop: 4 }}>GOAL ACHIEVED</span>
            </div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="muted" style={{ fontSize: 12 }}>Portfolio profit target</div>
            <div style={{ fontSize: 21, fontWeight: 750, marginTop: 3 }}>{totals.convertedRows ? money(totals.targetZar, "ZAR") : "FX unavailable"}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Profit achieved</div>
            <div style={{ color: totals.pnlZar >= 0 ? "#36c98f" : "#ef7777", fontSize: 18, fontWeight: 700 }}>{totals.convertedRows ? (totals.pnlZar < 0 ? "−" : "") + money(totals.pnlZar, "ZAR") : "—"}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Still outstanding</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{totals.convertedRows ? money(totals.remainingZar, "ZAR") : "—"}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}>
          <div className="condition-box">
            <div className="muted" style={{ fontSize: 12 }}>Combined funded capital</div>
            <div style={{ fontSize: 20, fontWeight: 750, marginTop: 5 }}>{totals.convertedRows ? money(totals.capitalZar, "ZAR") : "—"}</div>
            <div className="muted" style={{ fontSize: 11 }}>ZAR equivalent</div>
          </div>
          <div className="condition-box">
            <div className="muted" style={{ fontSize: 12 }}>Accounts in portfolio</div>
            <div style={{ fontSize: 20, fontWeight: 750, marginTop: 5 }}>{accounts.length}</div>
            <div className="muted" style={{ fontSize: 11 }}>Separate account goals</div>
          </div>
          <div className="condition-box">
            <div className="muted" style={{ fontSize: 12 }}>Total realised P&amp;L</div>
            <div style={{ fontSize: 18, fontWeight: 750, marginTop: 5 }}>{totals.convertedRows ? (totals.pnlZar < 0 ? "−" : "") + money(totals.pnlZar, "ZAR") : "—"}</div>
            <div className="muted" style={{ fontSize: 11 }}>Closed journal trades only</div>
          </div>
          <div className="condition-box">
            <div className="muted" style={{ fontSize: 12 }}>Remaining portfolio goal</div>
            <div style={{ fontSize: 18, fontWeight: 750, marginTop: 5 }}>{totals.convertedRows ? money(totals.remainingZar, "ZAR") : "—"}</div>
            <div className="muted" style={{ fontSize: 11 }}>Across all account targets</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <div className="section-label">ACCOUNT-BY-ACCOUNT PROJECT GOALS</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 10, marginTop: 10 }}>
          {rows.map(({ account, trades, pnl, target, remaining, progress }) => {
            const zarPnl = converted(pnl, account.currency, rates);
            const zarTarget = converted(target, account.currency, rates);
            const zarRemaining = converted(remaining, account.currency, rates);
            return (
              <div key={account.id} className="condition-box" style={{ borderTop: "3px solid " + (account.color || "#D4AF37") }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div>
                    <strong>{account.firm_name}</strong>
                    <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{account.program_name || "Custom"} · {account.account_stage || "Funded"}{account.phase ? " · " + account.phase : ""}</div>
                  </div>
                  <span style={{ fontSize: 12, color: "#D4AF37", whiteSpace: "nowrap" }}>{progress.toFixed(1)}%</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 13, fontSize: 12 }}>
                  <span className="muted">Profit achieved</span><strong>{pnl < 0 ? "−" : ""}{money(pnl, account.currency)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 6, fontSize: 12 }}>
                  <span className="muted">Profit target</span><strong>{money(target, account.currency)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 6, fontSize: 12 }}>
                  <span className="muted">Still to go</span><strong>{money(remaining, account.currency)}</strong>
                </div>
                <div style={{ height: 7, background: "rgba(127,127,127,.22)", borderRadius: 99, overflow: "hidden", marginTop: 10 }}>
                  <div style={{ height: "100%", width: progress + "%", background: account.color || "#D4AF37", borderRadius: 99 }} />
                </div>
                <div className="muted" style={{ fontSize: 11, marginTop: 9 }}>
                  {zarPnl != null && zarTarget != null && zarRemaining != null
                    ? "ZAR: " + (zarPnl < 0 ? "−" : "") + money(zarPnl, "ZAR") + " achieved · " + money(zarRemaining, "ZAR") + " outstanding"
                    : "ZAR conversion unavailable"}
                </div>
                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{trades} closed journal {trades === 1 ? "trade" : "trades"} · {money(Number(account.starting_capital) || 0, account.currency)} starting capital</div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="muted" style={{ fontSize: 11, marginTop: 12 }}>
        Progress uses each saved account’s own profit target and realised P&amp;L from closed Journal trades. FX conversions show the latest available reference rate; if a rate cannot be retrieved, the ZAR equivalent is left blank rather than estimated.
        {ratesReady ? " Currency conversion loaded." : " Loading currency conversion…"}
      </div>
    </section>
  );
}

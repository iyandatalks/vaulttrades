"use client";

import { useMemo } from "react";

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

const currencyLabel = (currency: string) => {
  const symbols: Record<string, string> = { ZAR: "R", USD: "$", EUR: "€", GBP: "£" };
  return symbols[currency] ?? currency + " ";
};
const money = (value: number, currency: string) => {
  const amount = Math.abs(value).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (value < 0 ? "−" : "") + currencyLabel(currency) + amount;
};

export default function PortfolioGoalOverview({ accounts, entries }: Props) {
  const rows = useMemo(() => accounts.map((account) => {
    const trades = entries.filter((entry) =>
      entry.funded_account_id === account.id && entry.result.toUpperCase() !== "OPEN"
    );
    const pnl = trades.reduce((sum, entry) => sum + (Number(entry.pnl) || 0), 0);
    const target = Math.max(0, Number(account.payout_target) || 0);
    const remaining = Math.max(0, target - pnl);
    const progress = target > 0 ? Math.max(0, Math.min(100, pnl / target * 100)) : 0;
    const startingCapital = Number(account.starting_capital) || 0;
    return { account, trades: trades.length, pnl, target, remaining, progress, startingCapital, currentValue: startingCapital + pnl };
  }), [accounts, entries]);

  const currencyGroups = useMemo(() => {
    const grouped = new Map<string, {
      currency: string; capital: number; pnl: number; target: number;
      remaining: number; currentValue: number; accounts: number;
    }>();
    for (const row of rows) {
      const currency = row.account.currency || "USD";
      const group = grouped.get(currency) ?? {
        currency, capital: 0, pnl: 0, target: 0, remaining: 0, currentValue: 0, accounts: 0,
      };
      group.capital += row.startingCapital;
      group.pnl += row.pnl;
      group.target += row.target;
      group.remaining += row.remaining;
      group.currentValue += row.currentValue;
      group.accounts += 1;
      grouped.set(currency, group);
    }
    return Array.from(grouped.values()).sort((a, b) => a.currency.localeCompare(b.currency));
  }, [rows]);

  const averageProgress = rows.length
    ? rows.reduce((sum, row) => sum + row.progress, 0) / rows.length
    : 0;

  if (!accounts.length) return null;

  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const achievedArc = circumference * averageProgress / 100;

  return (
    <section className="card" style={{ marginBottom: 16, overflow: "hidden", border: "1px solid rgba(212,175,55,.42)", background: "linear-gradient(135deg,rgba(212,175,55,.10),rgba(20,20,20,.12) 48%,rgba(212,175,55,.04))" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="section-label">YOUR TRADING JOURNEY · FUNDED PORTFOLIO</div>
          <h2 style={{ margin: "5px 0 0" }}>One portfolio. Multiple funded projects.</h2>
          <p className="muted" style={{ margin: "6px 0 0" }}>Track every funded account in its own currency, with no exchange-rate conversion.</p>
        </div>
        <div style={{ border: "1px solid rgba(212,175,55,.35)", borderRadius: 999, padding: "7px 12px", fontSize: 12, color: "#D4AF37" }}>{accounts.length} active {accounts.length === 1 ? "account" : "accounts"}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 14, alignItems: "center", marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, minHeight: 170 }}>
          <div style={{ position: "relative", width: 156, height: 156, flex: "0 0 156px" }}>
            <svg viewBox="0 0 140 140" width="156" height="156" role="img" aria-label={"Average account goal progress " + averageProgress.toFixed(1) + " percent"}>
              <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(150,150,150,.22)" strokeWidth="13" />
              <circle cx="70" cy="70" r={radius} fill="none" stroke="#D4AF37" strokeWidth="13" strokeLinecap="round" strokeDasharray={achievedArc + " " + circumference} transform="rotate(-90 70 70)" />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
              <strong style={{ fontSize: 27, lineHeight: 1.1 }}>{averageProgress.toFixed(1)}%</strong>
              <span className="muted" style={{ fontSize: 11, marginTop: 4 }}>AVG. GOAL PROGRESS</span>
            </div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="muted" style={{ fontSize: 12 }}>Accounts being tracked</div>
            <div style={{ fontSize: 24, fontWeight: 750, marginTop: 3 }}>{accounts.length}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Closed journal trades</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{rows.reduce((sum, row) => sum + row.trades, 0)}</div>
            <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>Average of each account’s individual goal progress</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 }}>
          {currencyGroups.map((group) => (
            <div className="condition-box" key={group.currency}>
              <strong>{group.currency} portfolio totals</strong>
              <div className="muted" style={{ fontSize: 12, marginTop: 9 }}>Starting capital</div>
              <div style={{ fontSize: 18, fontWeight: 750, marginTop: 3 }}>{money(group.capital, group.currency)}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Current account value</div>
              <div style={{ fontSize: 18, fontWeight: 750, marginTop: 3 }}>{money(group.currentValue, group.currency)}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Realised profit / loss</div>
              <div style={{ color: group.pnl >= 0 ? "#36c98f" : "#ef7777", fontSize: 17, fontWeight: 700 }}>{money(group.pnl, group.currency)}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Profit target · outstanding</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 3 }}>{money(group.target, group.currency)} · {money(group.remaining, group.currency)}</div>
              <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>{group.accounts} {group.accounts === 1 ? "account" : "accounts"}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <div className="section-label">ACCOUNT-BY-ACCOUNT PROJECT GOALS</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 10, marginTop: 10 }}>
          {rows.map(({ account, trades, pnl, target, remaining, progress, startingCapital, currentValue }) => (
            <div key={account.id} className="condition-box" style={{ borderTop: "3px solid " + (account.color || "#D4AF37") }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div>
                  <strong>{account.firm_name}</strong>
                  <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{account.program_name || "Custom"} · {account.account_stage || "Funded"}{account.phase ? " · " + account.phase : ""}</div>
                </div>
                <span style={{ fontSize: 12, color: "#D4AF37", whiteSpace: "nowrap" }}>{progress.toFixed(1)}%</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 13, fontSize: 12 }}>
                <span className="muted">Profit achieved</span><strong>{money(pnl, account.currency)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 6, fontSize: 12 }}>
                <span className="muted">Profit target</span><strong>{money(target, account.currency)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 6, fontSize: 12 }}>
                <span className="muted">Still to go</span><strong>{money(remaining, account.currency)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 6, fontSize: 12 }}>
                <span className="muted">Current account value</span><strong>{money(currentValue, account.currency)}</strong>
              </div>
              <div style={{ height: 7, background: "rgba(127,127,127,.22)", borderRadius: 99, overflow: "hidden", marginTop: 10 }}>
                <div style={{ height: "100%", width: progress + "%", background: account.color || "#D4AF37", borderRadius: 99 }} />
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 9 }}>{trades} closed journal {trades === 1 ? "trade" : "trades"} · {money(startingCapital, account.currency)} starting capital</div>
            </div>
          ))}
        </div>
      </div>
      <div className="muted" style={{ fontSize: 11, marginTop: 12 }}>
        Portfolio totals are grouped by currency. Figures in different currencies are never added together. Goal progress is the simple average of the individual account progress percentages. Only closed Journal trades contribute to realised P&amp;L.
      </div>
    </section>
  );
}

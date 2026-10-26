"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Account = "Personal" | "Funded";
type Currency = "ZAR" | "USD" | "EUR" | "GBP";
type Session = "Asia" | "London" | "New York" | "—";
type Result = "WIN" | "LOSS" | "BREAK EVEN";

type FundedJournalAccount = { id: string; firm_name: string; starting_capital: number; payout_target: number; currency: string; color: string };

type Entry = {
  id: string;
  funded_account_id: string | null;
  trade_date: string;
  account_type: Account;
  currency: Currency;
  session: Session;
  symbol: string;
  strategy: string;
  result: Result;
  pnl: number;
  emotion: string;
  created_at: string;
};

const supabase = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

const todaySast = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const startOfWeek = (dateString: string) => {
  const d = new Date(dateString + "T12:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
};

const currencySymbol = (currency: Currency) => currency === "ZAR" ? "R" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";

export default function JournalClient() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [fundedAccounts, setFundedAccounts] = useState<FundedJournalAccount[]>([]);
  const [firmName, setFirmName] = useState("");
  const [firmCapital, setFirmCapital] = useState("100000");
  const [firmTarget, setFirmTarget] = useState("5000");
  const [firmCurrency, setFirmCurrency] = useState("USD");
  const [firmColor, setFirmColor] = useState("#D4AF37");
  const [selectedFirmId, setSelectedFirmId] = useState("");
  const [accountError, setAccountError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [form, setForm] = useState({
    tradeDate: todaySast(),
    account: "Personal" as Account,
    currency: "ZAR" as Currency,
    session: "Asia" as Session,
    symbol: "XAUUSD",
    strategy: "EMA20",
    result: "WIN" as Result,
    pnl: "",
    emotion: "",
    fundedAccountId: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [statsAccount, setStatsAccount] = useState("Funded · USD");
  const [statsMonth, setStatsMonth] = useState(todaySast().slice(0, 7));
  const [statsYear, setStatsYear] = useState(todaySast().slice(0, 4));

  const load = async () => {
    const sb = supabase();
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) return;
    setUserId(auth.user.id);

    const { data: u } = await sb
      .from("users")
      .select("id")
      .eq("auth_user_id", auth.user.id)
      .single();
    if (!u?.id) return;

    const { data: firmRows } = await sb.from("funded_journal_accounts").select("id, firm_name, starting_capital, payout_target, currency, color").eq("user_id", u.id).order("created_at", { ascending: true });
    const firms = (firmRows ?? []) as FundedJournalAccount[];
    setFundedAccounts(firms);
    setSelectedFirmId((current) => current && firms.some((a) => a.id === current) ? current : (firms[0]?.id ?? ""));

    const { data } = await sb
      .from("journal_entries")
      .select(
        "id, trade_date, account_type, currency, funded_account_id, session, symbol, strategy, result, pnl, emotion, note, created_at"
      )
      .eq("user_id", u.id)
      .order("trade_date", { ascending: false })
      .order("created_at", { ascending: false });

    setEntries(
      (data ?? []).map((x: any) => ({
        id: x.id,
        funded_account_id: x.funded_account_id ?? null,
        trade_date: x.trade_date ?? x.created_at?.slice(0, 10),
        account_type: x.account_type ?? "Personal",
        currency: x.currency ?? "ZAR",
        session: x.session ?? "—",
        symbol: x.symbol ?? "—",
        strategy: x.strategy ?? x.type ?? "Other",
        result: x.result ?? "BREAK EVEN",
        pnl: Number(x.pnl ?? 0),
        emotion: x.emotion ?? x.note ?? "",
        created_at: x.created_at,
      })) as Entry[]
    );
  };

  useEffect(() => {
    void load();
  }, []);

  const createFundedAccount = async () => {
    setAccountError("");
    if (!userId || !firmName.trim() || !(Number(firmCapital) >= 0) || !(Number(firmTarget) >= 0)) { setAccountError("Enter a prop firm name, starting capital, and payout target."); return; }
    const sb = supabase();
    const { data: u } = await sb.from("users").select("id").eq("auth_user_id", userId).single();
    if (!u?.id) { setAccountError("Your user profile could not be loaded. Please sign in again."); return; }
    const { data, error } = await sb.from("funded_journal_accounts").insert({ user_id: u.id, firm_name: firmName.trim(), starting_capital: Number(firmCapital), payout_target: Number(firmTarget), currency: firmCurrency, color: firmColor }).select("id").single();
    if (error || !data?.id) { setAccountError(error?.message ?? "Could not save this prop firm."); return; }
    setSelectedFirmId(data.id);
    setForm((f) => ({ ...f, account: "Funded", currency: "USD", fundedAccountId: data.id }));
    setFirmName(""); setFirmCapital("100000"); setFirmTarget("5000");
    await load();
  };

  const save = async () => {
    if (!userId) return;
    const sb = supabase();
    const { data: u } = await sb
      .from("users")
      .select("id")
      .eq("auth_user_id", userId)
      .single();
    if (!u?.id) return;

    const pnl = Number(form.pnl || 0);
    if (!Number.isFinite(pnl)) return;

    const payload = {
      user_id: u.id,
      email: (await sb.auth.getUser()).data.user?.email ?? null,
      type: form.strategy.trim() || "Other",
      entry_type: form.strategy.trim() || "Other",
      trade_date: form.tradeDate,
      account_type: form.account,
      funded_account_id: form.account === "Funded" ? (form.fundedAccountId || selectedFirmId || null) : null,
      currency: form.account === "Funded" ? ((fundedAccounts.find((a) => a.id === (form.fundedAccountId || selectedFirmId))?.currency as Currency) ?? "USD") : form.currency,
      session: form.session,
      symbol: form.symbol.trim(),
      strategy: form.strategy.trim() || "Other",
      result: form.result,
      pnl,
      total: pnl,
      emotion: form.emotion.trim(),
      note: form.emotion.trim(),
      data: {
        account: form.account,
        currency: form.account === "Funded" ? ((fundedAccounts.find((a) => a.id === (form.fundedAccountId || selectedFirmId))?.currency as Currency) ?? "USD") : form.currency,
      },
    };

    if (editingId) {
      await sb
        .from("journal_entries")
        .update(payload)
        .eq("id", editingId)
        .eq("user_id", u.id);
    } else {
      await sb.from("journal_entries").insert(payload);
    }

    setEditingId(null);
    setForm({
      tradeDate: todaySast(),
      account: "Personal",
      currency: "ZAR",
      session: "Asia",
      symbol: "XAUUSD",
      strategy: "EMA20",
      result: "WIN",
      pnl: "",
      emotion: "",
      fundedAccountId: selectedFirmId,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
    await load();
  };

  const edit = (e: Entry) => {
    setEditingId(e.id);
    setForm({
      tradeDate: e.trade_date,
      account: e.account_type,
      currency: e.account_type === "Funded" ? "USD" : e.currency,
      session: e.session,
      symbol: e.symbol,
      strategy: e.strategy,
      result: e.result,
      pnl: String(e.pnl),
      emotion: e.emotion,
      fundedAccountId: e.funded_account_id ?? "",
    });
    if (e.funded_account_id) setSelectedFirmId(e.funded_account_id);
  };

  const remove = async (id: string) => {
    if (!userId || !window.confirm("Delete this journal entry?")) return;
    const sb = supabase();
    const { data: u } = await sb
      .from("users")
      .select("id")
      .eq("auth_user_id", userId)
      .single();
    if (u?.id) {
      await sb
        .from("journal_entries")
        .delete()
        .eq("id", id)
        .eq("user_id", u.id);
      await load();
    }
  };

  const set = (key: string, value: string) =>
    setForm((f) => ({ ...f, [key]: value } as typeof f));

  const currentWeek = startOfWeek(todaySast());
  const weekly = useMemo(() => {
    const week = entries.filter((e) => e.trade_date >= currentWeek);
    const summarize = (account: Account, currency: Currency) => {
      const rows = week.filter(
        (e) => e.account_type === account && e.currency === currency
      );
      return {
        trades: rows.length,
        wins: rows.filter((e) => e.result === "WIN").length,
        losses: rows.filter((e) => e.result === "LOSS").length,
        pnl: rows.reduce((sum, e) => sum + e.pnl, 0),
      };
    };
    return {
      personalZar: summarize("Personal", "ZAR"),
      personalUsd: summarize("Personal", "USD"),
      fundedUsd: summarize("Funded", "USD"),
    };
  }, [entries, currentWeek]);

  const statsRows = useMemo(() => {
    const [year, month] = statsMonth.split("-").map(Number);
    return entries.filter((e) => {
      const accountMatch =
        (statsAccount === "Personal · ZAR" && e.account_type === "Personal" && e.currency === "ZAR") ||
        (statsAccount === "Personal · USD" && e.account_type === "Personal" && e.currency === "USD") ||
        (statsAccount === "Funded · USD" && e.account_type === "Funded" && !e.funded_account_id && e.currency === "USD") || (fundedAccounts.some((a) => a.id === statsAccount) && e.funded_account_id === statsAccount);
      return accountMatch && e.trade_date?.startsWith(`${year}-${String(month).padStart(2, "0")}`);
    });
  }, [entries, statsAccount, statsMonth, fundedAccounts]);

  const yearRows = useMemo(() => {
    return entries.filter((e) => {
      const accountMatch =
        statsAccount === "All accounts" ||
        (statsAccount === "Personal · ZAR" && e.account_type === "Personal" && e.currency === "ZAR") ||
        (statsAccount === "Personal · USD" && e.account_type === "Personal" && e.currency === "USD") ||
        (statsAccount === "Funded · USD" && e.account_type === "Funded" && !e.funded_account_id && e.currency === "USD") || (fundedAccounts.some((a) => a.id === statsAccount) && e.funded_account_id === statsAccount);
      return accountMatch && e.trade_date?.startsWith(statsYear);
    });
  }, [entries, statsAccount, statsYear, fundedAccounts]);

  const summarize = (rows: Entry[]) => {
    const wins = rows.filter((e) => e.result === "WIN");
    const losses = rows.filter((e) => e.result === "LOSS");
    const net = rows.reduce((sum, e) => sum + e.pnl, 0);
    const positive = rows.reduce((sum, e) => sum + Math.max(0, e.pnl), 0);
    const negative = rows.reduce((sum, e) => sum + Math.min(0, e.pnl), 0);
    const days = new Set(rows.map((e) => e.trade_date)).size;
    return {
      trades: rows.length,
      wins: wins.length,
      losses: losses.length,
      winRate: rows.length ? (wins.length / rows.length) * 100 : 0,
      net,
      grossProfit: positive,
      grossLoss: Math.abs(negative),
      days,
    };
  };

  const monthlyStats = summarize(statsRows);
  const yearlyStats = summarize(yearRows);
  const monthlyBreakdown = Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    const rows = yearRows.filter((e) => e.trade_date?.slice(5, 7) === month);
    return { month, label: new Date(Number(statsYear), index, 1).toLocaleString("en", { month: "long" }), ...summarize(rows) };
  }).filter((m) => m.trades > 0);
  const dailyBreakdown = Object.values(
    statsRows.reduce((acc, e) => {
      const key = e.trade_date;
      if (!acc[key]) acc[key] = { date: key, pnl: 0 };
      acc[key].pnl += e.pnl;
      return acc;
    }, {} as Record<string, { date: string; pnl: number }>)
  );
  const bestDay = dailyBreakdown.length ? dailyBreakdown.reduce((a, b) => (a.pnl > b.pnl ? a : b)) : null;
  const worstDay = dailyBreakdown.length ? dailyBreakdown.reduce((a, b) => (a.pnl < b.pnl ? a : b)) : null;
  const bestMonth = monthlyBreakdown.length ? monthlyBreakdown.reduce((a, b) => (a.net > b.net ? a : b)) : null;
  const worstMonth = monthlyBreakdown.length ? monthlyBreakdown.reduce((a, b) => (a.net < b.net ? a : b)) : null;
  const statsCurrency: Currency = statsAccount.endsWith("ZAR") ? "ZAR" : "USD";
  const statsSymbol = currencySymbol(statsCurrency);

  const availableCurrencies: Currency[] =
    form.account === "Funded" ? ["USD"] : ["ZAR", "USD"];

  return (
    <main className="shell">
      <section className="card">
        <div className="section-label">FUNDED PROP FIRM SETUP</div>
        <h2 style={{ marginTop: 4 }}>Add each funded account once</h2>
        <p className="muted">Enter the prop firm name, starting capital, and payout target once. Each firm has its own colour-coded journal section and independent stats.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginTop: 14 }}>
          <label className="muted">Prop firm name<input className="coach-question" value={firmName} onChange={(e) => setFirmName(e.target.value)} placeholder="e.g. Blue Guardian" /></label>
          <label className="muted">Starting capital<input className="coach-question" type="number" min="0" step="0.01" value={firmCapital} onChange={(e) => setFirmCapital(e.target.value)} /></label>
          <label className="muted">Payout profit target<input className="coach-question" type="number" min="0" step="0.01" value={firmTarget} onChange={(e) => setFirmTarget(e.target.value)} /></label>
          <label className="muted">Currency<select value={firmCurrency} onChange={(e) => setFirmCurrency(e.target.value)}>{["USD","ZAR","EUR","GBP"].map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="muted">Identify with a colour<input type="color" value={firmColor} onChange={(e) => setFirmColor(e.target.value)} /></label>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
          <button className="primary" onClick={() => void createFundedAccount()}>Add Prop Firm Account</button>
          <span className="muted">Saved once. Select it whenever you record a daily trade.</span>
        </div>
        {accountError && <div className="condition-box" style={{ marginTop: 10, borderColor: "#dc2626" }}>{accountError}</div>}
        {fundedAccounts.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12, marginTop: 16 }}>
          {fundedAccounts.map((firm) => {
            const firmTrades = entries.filter((e) => e.funded_account_id === firm.id);
            const pnl = firmTrades.reduce((sum, e) => sum + e.pnl, 0);
            const balance = Number(firm.starting_capital) + pnl;
            const target = Number(firm.payout_target);
            const remaining = Math.max(0, target - pnl);
            const progress = target > 0 ? Math.min(100, Math.max(0, pnl / target * 100)) : 0;
            const symbol = firm.currency === "ZAR" ? "R" : firm.currency === "EUR" ? "€" : firm.currency === "GBP" ? "£" : "$";
            return <div key={firm.id} className="condition-box" style={{ borderTop: "4px solid " + firm.color, cursor: "pointer" }} onClick={() => { setSelectedFirmId(firm.id); setStatsAccount(firm.id); setForm((f) => ({ ...f, account: "Funded", currency: "USD", fundedAccountId: firm.id })); }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><strong>{firm.firm_name}</strong><span style={{ background: firm.color, width: 12, height: 12, borderRadius: 99, display: "inline-block" }} /></div>
              <div className="muted" style={{ marginTop: 8 }}>Starting capital</div><strong>{symbol}{Number(firm.starting_capital).toFixed(2)}</strong>
              <div className="muted" style={{ marginTop: 8 }}>Current balance</div><div style={{ fontSize: 22, fontWeight: 700 }}>{symbol}{balance.toFixed(2)}</div>
              <div className="muted" style={{ marginTop: 8 }}>Net P&amp;L · {firmTrades.length} trades</div><strong>{symbol}{pnl.toFixed(2)}</strong>
              <div className="muted" style={{ marginTop: 8 }}>Target: {symbol}{target.toFixed(2)} · Remaining: {symbol}{remaining.toFixed(2)}</div>
              <div style={{ height: 7, background: "rgba(127,127,127,.2)", borderRadius: 99, overflow: "hidden", marginTop: 8 }}><div style={{ height: "100%", width: progress + "%", background: firm.color }} /></div>
              <button className="secondary" style={{ marginTop: 12 }} onClick={(event) => { event.stopPropagation(); setSelectedFirmId(firm.id); setStatsAccount(firm.id); setForm((f) => ({ ...f, account: "Funded", currency: "USD", fundedAccountId: firm.id })); }}>Open this journal</button>
            </div>;
          })}
        </div>}
        <div className="section-label" style={{ marginTop: 24 }}>TRADING JOURNAL · DAILY RECORD</div>
        <h1 className="title">Trading Journal</h1>
        <p className="muted">
          Keep the record simple: date, account, session, instrument, strategy,
          result, P&amp;L and how you felt before/after the trade. Your entries
          are retained so weekly and account performance can be reviewed over time.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
            gap: 10,
            marginTop: 20,
          }}
        >
          <label className="muted">
            Trading date
            <input
              className="coach-question"
              type="date"
              value={form.tradeDate}
              onChange={(e) => set("tradeDate", e.target.value)}
            />
          </label>

          <label className="muted">
            Account
            <select
              value={form.account === "Personal" ? "Personal" : (form.fundedAccountId || selectedFirmId || "")}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "Personal") setForm((f) => ({ ...f, account: "Personal", fundedAccountId: "" }));
                else { setSelectedFirmId(value); setForm((f) => ({ ...f, account: "Funded", fundedAccountId: value, currency: "USD" })); }
              }}
            >
              <option value="Personal">Personal</option>
              {fundedAccounts.map((firm) => <option key={firm.id} value={firm.id}>{firm.firm_name}</option>)}
            </select>
          </label>

          <label className="muted">
            Currency
            <select
              value={form.account === "Funded" ? "USD" : form.currency}
              disabled={form.account === "Funded"}
              onChange={(e) => set("currency", e.target.value)}
            >
              {availableCurrencies.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>

          <label className="muted">
            Session
            <select value={form.session} onChange={(e) => set("session", e.target.value)}>
              <option>Asia</option>
              <option>London</option>
              <option>New York</option>
            </select>
          </label>

          <label className="muted">
            Instrument
            <input
              className="coach-question"
              value={form.symbol}
              onChange={(e) => set("symbol", e.target.value)}
              placeholder="XAUUSD"
            />
          </label>

          <label className="muted">
            Strategy
            <input
              className="coach-question"
              value={form.strategy}
              onChange={(e) => set("strategy", e.target.value)}
              placeholder="EMA20 + Fib"
            />
          </label>

          <label className="muted">
            Result
            <select value={form.result} onChange={(e) => set("result", e.target.value)}>
              <option>WIN</option>
              <option>LOSS</option>
              <option>BREAK EVEN</option>
            </select>
          </label>

          <label className="muted">
            P&amp;L ({form.account === "Funded" ? "$" : form.currency === "ZAR" ? "R" : "$"})
            <input
              className="coach-question"
              type="number"
              step="0.01"
              value={form.pnl}
              onChange={(e) => set("pnl", e.target.value)}
              placeholder="0.00"
            />
          </label>

          <label className="muted">
            Emotion / short note
            <input
              className="coach-question"
              value={form.emotion}
              onChange={(e) => set("emotion", e.target.value)}
              placeholder="Calm · FOMO · followed plan"
            />
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button className="primary" onClick={() => void save()}>
            {editingId ? "Update Entry" : "Save Trade"}
          </button>
          {editingId && (
            <button className="secondary" onClick={() => setEditingId(null)}>
              Cancel
            </button>
          )}
        </div>
        {saved && (
          <div className="condition-box" style={{ marginTop: 10 }}>
            Journal entry saved.
          </div>
        )}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="section-label">CURRENT WEEK</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
            gap: 12,
          }}
        >
          {[
            ["Personal · ZAR", weekly.personalZar],
            ["Personal · USD", weekly.personalUsd],
            ["Funded · USD", weekly.fundedUsd],
          ].map(([label, s]: any) => (
            <div className="condition-box" key={label}>
              <strong>{label}</strong>
              <div style={{ marginTop: 6 }}>
                {s.trades} trades · {s.wins}W · {s.losses}L
              </div>
              <div style={{ marginTop: 4, fontSize: 20, fontWeight: 700 }}>
                {currencySymbol(label.includes("ZAR") ? "ZAR" : "USD")}
                {s.pnl.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="section-label">MONTHLY &amp; YEARLY STATS</div>
        <h2 style={{ marginTop: 4 }}>Performance Overview</h2>
        <p className="muted">Statistics update automatically when journal entries are added, edited, or deleted. Choose one account/currency to keep results comparable.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginTop: 14 }}>
          <label className="muted">
            Account
            <select value={statsAccount} onChange={(e) => setStatsAccount(e.target.value)}>
              <option>Personal · ZAR</option>
              <option>Personal · USD</option>
              <option>Funded · USD</option>
              {fundedAccounts.map((firm) => <option key={firm.id} value={firm.id}>{firm.firm_name}</option>)}
            </select>
          </label>
          <label className="muted">
            Month
            <input className="coach-question" type="month" value={statsMonth} onChange={(e) => setStatsMonth(e.target.value)} />
          </label>
          <label className="muted">
            Year
            <select value={statsYear} onChange={(e) => setStatsYear(e.target.value)}>
              {Array.from({ length: 8 }, (_, i) => String(Number(todaySast().slice(0, 4)) - i)).map((year) => <option key={year}>{year}</option>)}
            </select>
          </label>
        </div>

        <h3 style={{ marginTop: 20 }}>Monthly Stats</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 10, marginTop: 10 }}>
          {[
            ["Trades", String(monthlyStats.trades)],
            ["Trading days", String(monthlyStats.days)],
            ["Wins / Losses", `${monthlyStats.wins} / ${monthlyStats.losses}`],
            ["Win rate", `${monthlyStats.winRate.toFixed(1)}%`],
            ["Gross profit", `${statsSymbol}${monthlyStats.grossProfit.toFixed(2)}`],
            ["Gross losses", `${statsSymbol}${monthlyStats.grossLoss.toFixed(2)}`],
            ["Net P&L", `${statsSymbol}${monthlyStats.net.toFixed(2)}`],
          ].map(([label, value]) => (
            <div className="condition-box" key={label}>
              <div className="muted">{label}</div>
              <div style={{ marginTop: 5, fontSize: 20, fontWeight: 700 }}>{value}</div>
            </div>
          ))}
        </div>
        <div className="muted" style={{ marginTop: 10 }}>
          Best day: {bestDay ? `${bestDay.date} · ${statsSymbol}${bestDay.pnl.toFixed(2)}` : "—"}
          {" · "}
          Worst day: {worstDay ? `${worstDay.date} · ${statsSymbol}${worstDay.pnl.toFixed(2)}` : "—"}
        </div>

        <h3 style={{ marginTop: 24 }}>Yearly Stats</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 10, marginTop: 10 }}>
          {[
            ["Trades", String(yearlyStats.trades)],
            ["Trading days", String(yearlyStats.days)],
            ["Wins / Losses", `${yearlyStats.wins} / ${yearlyStats.losses}`],
            ["Win rate", `${yearlyStats.winRate.toFixed(1)}%`],
            ["Gross profit", `${statsSymbol}${yearlyStats.grossProfit.toFixed(2)}`],
            ["Gross losses", `${statsSymbol}${yearlyStats.grossLoss.toFixed(2)}`],
            ["Net P&L", `${statsSymbol}${yearlyStats.net.toFixed(2)}`],
          ].map(([label, value]) => (
            <div className="condition-box" key={label}>
              <div className="muted">{label}</div>
              <div style={{ marginTop: 5, fontSize: 20, fontWeight: 700 }}>{value}</div>
            </div>
          ))}
        </div>
        <div className="muted" style={{ marginTop: 10 }}>
          Best month: {bestMonth ? `${bestMonth.label} · ${statsSymbol}${bestMonth.net.toFixed(2)}` : "—"}
          {" · "}
          Worst month: {worstMonth ? `${worstMonth.label} · ${statsSymbol}${worstMonth.net.toFixed(2)}` : "—"}
        </div>
        {monthlyBreakdown.length > 0 && (
          <div style={{ overflowX: "auto", marginTop: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Month", "Trades", "Win rate", "Gross profit", "Gross losses", "Net P&L"].map((h) => <th key={h} style={{ textAlign: "left", padding: 8 }}>{h}</th>)}</tr></thead>
              <tbody>{monthlyBreakdown.map((m) => <tr key={m.month}>
                <td style={{ padding: 8 }}>{m.label}</td>
                <td style={{ padding: 8 }}>{m.trades}</td>
                <td style={{ padding: 8 }}>{m.winRate.toFixed(1)}%</td>
                <td style={{ padding: 8 }}>{statsSymbol}{m.grossProfit.toFixed(2)}</td>
                <td style={{ padding: 8 }}>{statsSymbol}{m.grossLoss.toFixed(2)}</td>
                <td style={{ padding: 8 }}>{statsSymbol}{m.net.toFixed(2)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="section-label">TRADE HISTORY</div>
        {entries.length === 0 ? (
          <p className="muted">No journal entries yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {[
                    "Date",
                    "Account",
                    "Session",
                    "Instrument",
                    "Strategy",
                    "Result",
                    "P&L",
                    "Emotion",
                    "",
                  ].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: 8 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td style={{ padding: 8 }}>{e.trade_date}</td>
                    <td style={{ padding: 8 }}>{e.account_type} · {e.currency}</td>
                    <td style={{ padding: 8 }}>{e.session}</td>
                    <td style={{ padding: 8 }}>{e.symbol}</td>
                    <td style={{ padding: 8 }}>{e.strategy}</td>
                    <td style={{ padding: 8 }}>{e.result}</td>
                    <td style={{ padding: 8 }}>
                      {currencySymbol(e.currency)}{e.pnl.toFixed(2)}
                    </td>
                    <td style={{ padding: 8 }}>{e.emotion || "—"}</td>
                    <td style={{ padding: 8, whiteSpace: "nowrap" }}>
                      <button className="secondary" onClick={() => edit(e)}>
                        Edit
                      </button>{" "}
                      <button className="secondary" onClick={() => void remove(e.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

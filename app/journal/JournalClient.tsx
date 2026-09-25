"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Account = "Personal" | "Funded";
type Currency = "ZAR" | "USD";
type Session = "Asia" | "London" | "New York" | "—";
type Result = "WIN" | "LOSS" | "BREAK EVEN";

type Entry = {
  id: string;
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

const currencySymbol = (currency: Currency) => (currency === "ZAR" ? "R" : "$");

export default function JournalClient() {
  const [entries, setEntries] = useState<Entry[]>([]);
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
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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

    const { data } = await sb
      .from("journal_entries")
      .select(
        "id, trade_date, account_type, currency, session, symbol, strategy, result, pnl, emotion, note, created_at"
      )
      .eq("user_id", u.id)
      .order("trade_date", { ascending: false })
      .order("created_at", { ascending: false });

    setEntries(
      (data ?? []).map((x: any) => ({
        id: x.id,
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
      currency: form.account === "Funded" ? "USD" : form.currency,
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
        currency: form.account === "Funded" ? "USD" : form.currency,
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
    });
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

  const availableCurrencies: Currency[] =
    form.account === "Funded" ? ["USD"] : ["ZAR", "USD"];

  return (
    <main className="shell">
      <section className="card">
        <div className="section-label">TRADING JOURNAL · SIMPLE WEEKLY RECORD</div>
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
              value={form.account}
              onChange={(e) => {
                const account = e.target.value as Account;
                setForm((f) => ({
                  ...f,
                  account,
                  currency: account === "Funded" ? "USD" : f.currency,
                }));
              }}
            >
              <option>Personal</option>
              <option>Funded</option>
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

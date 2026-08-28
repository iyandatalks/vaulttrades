"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MARKET_OPTIONS, Market, symbolsForMarket } from "../../lib/markets";

type Signal = {
  id: string; trade_id: string; market_category: string; canonical_symbol: string; direction: "BUY" | "SELL";
  strategy_id: string; strategy_name: string | null; timeframe: string; entry: number | null; stop_loss: number | null;
  tp1: number | null; tp2: number | null; tp3: number | null; tp4: number | null; confidence: number | null; rr: number | null;
  status: string; confirmation_conditions: string[]; execution_payload: Record<string, unknown>; fired_at: string;
};

type StatusFilter = "ALL" | "ACTIVE" | "COMPLETED";
const fmt = (value: number | null) => value == null || !Number.isFinite(value) ? "—" : value.toLocaleString(undefined, { maximumFractionDigits: 5 });
const isActive = (status: string) => status === "CONFIRMED" || status === "ACTIVE";
const isCompleted = (status: string) => status === "TP1_HIT" || status === "SL_HIT";
const statusLabel = (status: string) => status === "CONFIRMED" ? "FIRED" : status === "TP1_HIT" ? "TP1 COMPLETED" : status === "SL_HIT" ? "SL COMPLETED" : status;

export default function SignalsClient() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [market, setMarket] = useState<Market>("Forex");
  const [symbol, setSymbol] = useState("XAU/USD");
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [selected, setSelected] = useState<Signal | null>(null);
  const symbols = useMemo(() => symbolsForMarket(market), [market]);

  useEffect(() => { setSymbol(symbols[0] ?? ""); }, [symbols]);

  const load = useCallback(async () => {
    try {
      await fetch("/api/signals/lifecycle", { method: "POST", cache: "no-store" }).catch(() => undefined);
      const response = await fetch("/api/signals", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load signals.");
      setSignals(data.signals || []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load signals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 10000);
    return () => window.clearInterval(timer);
  }, [load]);

  const scopedSignals = useMemo(() => signals.filter((signal) => !symbol || signal.canonical_symbol === symbol), [signals, symbol]);
  const visible = useMemo(() => scopedSignals.filter((signal) => filter === "ACTIVE" ? isActive(signal.status) : filter === "COMPLETED" ? isCompleted(signal.status) : true), [filter, scopedSignals]);
  const fired = scopedSignals.filter((signal) => signal.status === "CONFIRMED").length;
  const active = scopedSignals.filter((signal) => isActive(signal.status)).length;
  const completed = scopedSignals.filter((signal) => isCompleted(signal.status)).length;
  const wins = scopedSignals.filter((signal) => signal.status === "TP1_HIT").length;
  const losses = scopedSignals.filter((signal) => signal.status === "SL_HIT").length;
  const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
  const latest = scopedSignals[0];

  return <main className="shell">
    <section className="card" style={{ border: "1px solid rgba(212,166,55,.30)", background: "linear-gradient(145deg, rgba(10,16,30,.98), rgba(5,8,18,.98))" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div><div className="section-label">SIGNAL ENGINE</div><h1 className="title">Trading Signal Lifecycle</h1><p className="muted" style={{ maxWidth: 780 }}>Confirmed M5/M15 execution signals are tracked from FIRED to ACTIVE and completed at TP1 or SL. TP2–TP4 remain reference targets. MetaKit is not connected.</p></div>
        <div style={{ minWidth: 180, padding: 14, borderRadius: 12, border: "1px solid rgba(212,166,55,.35)", background: "rgba(212,166,55,.08)" }}><div className="muted" style={{ fontSize: 11, letterSpacing: ".08em" }}>FIRED</div><div style={{ fontSize: 30, fontWeight: 900, marginTop: 3 }}>{fired}</div><div style={{ color: "#9ca7ba", fontSize: 12 }}>Lifecycle checks every 10s</div></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginTop: 20 }}>
        <label className="block"><span className="muted" style={{ display: "block", marginBottom: 6 }}>Market</span><select value={market} onChange={(e) => setMarket(e.target.value as Market)} style={{ width: "100%", borderRadius: 8, border: "1px solid rgba(255,255,255,.14)", background: "#0b1020", color: "#f4f6fb", padding: "10px 12px" }}>{MARKET_OPTIONS.map((option) => <option key={option.value} value={option.value} disabled={option.locked}>{option.label}</option>)}</select></label>
        <label className="block"><span className="muted" style={{ display: "block", marginBottom: 6 }}>Symbol</span><select value={symbol} onChange={(e) => setSymbol(e.target.value)} disabled={!symbols.length} style={{ width: "100%", borderRadius: 8, border: "1px solid rgba(255,255,255,.14)", background: "#0b1020", color: "#f4f6fb", padding: "10px 12px" }}>{symbols.length ? symbols.map((item) => <option key={item} value={item}>{item}</option>) : <option>Coming Soon</option>}</select></label>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        {(["ALL", "ACTIVE", "COMPLETED"] as StatusFilter[]).map((value) => <button key={value} type="button" onClick={() => setFilter(value)} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid rgba(212,166,55,.35)", background: filter === value ? "#d4a637" : "transparent", color: filter === value ? "#050812" : "#d7dbe7", fontWeight: 800, cursor: "pointer" }}>{value}</button>)}
        <button type="button" onClick={() => { setLoading(true); void load(); }} style={{ marginLeft: "auto", padding: "9px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.04)", color: "#d7dbe7", fontWeight: 800, cursor: "pointer" }}>Refresh</button>
      </div>
    </section>

    <section className="card"><div className="section-label">LIFECYCLE SUMMARY</div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
      {[["Fired", fired], ["Active", active], ["Completed", completed], ["TP1 Wins", wins], ["SL Losses", losses], ["Win Rate", `${winRate}%`]].map(([label, value]) => <div className="condition-box" key={String(label)}><div className="muted">{label}</div><strong style={{ fontSize: 22 }}>{value}</strong></div>)}
    </div></section>

    <section className="card"><div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}><div><div className="section-label">SIGNAL FEED</div><h2 className="title">{market} · {symbol || "No symbol"}</h2></div>{latest && <div className="muted">Latest: {new Date(latest.fired_at).toLocaleString()}</div>}</div>
      {error && <div className="error-box" style={{ marginTop: 16 }}><strong>Signal feed error</strong><p className="muted">{error}</p></div>}
      {loading && signals.length === 0 ? <p className="muted" style={{ marginTop: 20 }}>Loading signal lifecycle…</p> : visible.length === 0 ? <div className="condition-box" style={{ marginTop: 16 }}><strong>No {filter.toLowerCase()} signals for {symbol || market}.</strong><p className="muted">Confirmed Scanner events will appear here automatically.</p></div> : <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
        {visible.map((signal) => <button key={signal.id} type="button" onClick={() => setSelected(signal)} style={{ textAlign: "left", border: "1px solid rgba(255,255,255,.09)", borderRadius: 12, padding: 16, background: "rgba(255,255,255,.025)", color: "#f4f6fb", cursor: "pointer" }}><div style={{ display: "grid", gridTemplateColumns: "minmax(120px,1fr) minmax(100px,.6fr) minmax(90px,.6fr) minmax(110px,.7fr) minmax(140px,.8fr)", gap: 12, alignItems: "center" }}><div><strong style={{ fontSize: 18 }}>{signal.canonical_symbol}</strong><div className="muted" style={{ marginTop: 3 }}>{signal.strategy_name || signal.strategy_id}</div></div><div style={{ fontWeight: 900, color: signal.direction === "BUY" ? "#86efac" : "#fca5a5" }}>{signal.direction}</div><div><div className="muted">TF</div><strong>{signal.timeframe}</strong></div><div><div className="muted">ENTRY</div><strong>{fmt(signal.entry)}</strong></div><div><div className="muted">STATUS</div><strong>{statusLabel(signal.status)}</strong></div></div><div className="muted" style={{ marginTop: 10, fontSize: 12 }}>Trade ID: {signal.trade_id}</div></button>)}
      </div>}
    </section>

    {selected && <div onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}><div onClick={(e) => e.stopPropagation()} style={{ width: "min(900px,100%)", maxHeight: "90vh", overflow: "auto", borderRadius: 16, border: "1px solid rgba(212,166,55,.35)", background: "#070b16", padding: 24 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><div><div className="section-label">TRADE LIFECYCLE</div><h2 className="title">{selected.canonical_symbol} · {selected.direction}</h2></div><button type="button" onClick={() => setSelected(null)}>Close</button></div><div className="condition-box" style={{ marginTop: 16 }}><strong>{statusLabel(selected.status)}</strong><p>Trade ID: {selected.trade_id}</p></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginTop: 12 }}>{[["Entry", selected.entry], ["SL", selected.stop_loss], ["TP1", selected.tp1], ["TP2", selected.tp2], ["TP3", selected.tp3], ["TP4", selected.tp4]].map(([label, value]) => <div className="condition-box" key={String(label)}><div className="muted">{label}</div><strong style={{ fontSize: 18 }}>{fmt(value as number | null)}</strong></div>)}</div><div className="condition-box" style={{ marginTop: 12 }}><strong>Execution payload</strong><pre style={{ marginTop: 10, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#d7dbe7", fontSize: 12 }}>{JSON.stringify(selected.execution_payload, null, 2)}</pre></div></div></div>}
  </main>;
}

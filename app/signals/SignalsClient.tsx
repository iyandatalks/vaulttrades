"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { MARKET_OPTIONS, Market } from "../../lib/markets";

type Signal = {
  id: string; trade_id: string; market_category: string; canonical_symbol: string; direction: "BUY" | "SELL";
  strategy_id: string; strategy_name: string | null; timeframe: string; entry: number | null; stop_loss: number | null;
  tp1: number | null; tp2: number | null; tp3: number | null; tp4: number | null; confidence: number | null; rr: number | null;
  status: string; confirmation_conditions: string[]; execution_payload: Record<string, unknown>; fired_at: string;
  completed_at?: string | null;
};
type AutomationStatus = { markets?: Record<string, boolean>; strategies?: Record<string, boolean>; emaAutomationWindow?: { timezone: string; start: string; lastSignal: string; timeframe: string } };
type StatusFilter = "ALL" | "ACTIVE" | "COMPLETED";

const COMPLETED_WINDOW_MS = 6 * 60 * 60 * 1000;
const fmt = (value: number | null) => value == null || !Number.isFinite(value) ? "—" : value.toLocaleString(undefined, { maximumFractionDigits: 5 });
const isActive = (status: string) => status === "CONFIRMED" || status === "ACTIVE";
const isCompleted = (status: string) => status === "TP1_HIT" || status === "SL_HIT" || status === "CYCLE_COMPLETE" || status === "INVALIDATED";
const completionTime = (signal: Signal) => signal.completed_at ? new Date(signal.completed_at).getTime() : NaN;
const isVisibleCompleted = (signal: Signal, now = Date.now()) => isCompleted(signal.status) && Number.isFinite(completionTime(signal)) && now - completionTime(signal) <= COMPLETED_WINDOW_MS;
const statusLabel = (status: string) => status === "CONFIRMED" ? "FIRED" : status === "ACTIVE" ? "ACTIVE" : status === "TP1_HIT" ? "TP1 COMPLETED" : status === "SL_HIT" ? "SL COMPLETED" : status === "INVALIDATED" ? "REPLACED" : status;
const marketCategory = (market: Market) => market === "Forex" ? "FOREX" : market === "Crypto" ? "CRYPTO" : market.toUpperCase();

export default function SignalsClient() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [market, setMarket] = useState<Market>("Forex");
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [selected, setSelected] = useState<Signal | null>(null);
  const [automation, setAutomation] = useState<AutomationStatus>({});
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(timer); }, []);

  const load = async () => {
    try {
      const [signalsResponse, statusResponse] = await Promise.all([fetch("/api/signals", { cache: "no-store" }), fetch("/api/automation/status", { cache: "no-store" })]);
      const data = await signalsResponse.json();
      const status = await statusResponse.json();
      if (!signalsResponse.ok) throw new Error(data.error || "Unable to load signals.");
      setSignals(data.signals || []);
      setAutomation(status || {});
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load signals.");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    void load();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    const supabase = createClient(url, key);
    const channel = supabase.channel("scanner-signals-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "scanner_signals" }, (payload) => setSignals((current) => [payload.new as Signal, ...current.filter((s) => s.id !== (payload.new as Signal).id)].slice(0, 100)))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "scanner_signals" }, (payload) => setSignals((current) => current.map((s) => s.id === (payload.new as Signal).id ? payload.new as Signal : s)))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  const feedSignals = useMemo(() => signals.filter((signal) => signal.market_category === marketCategory(market)).filter((signal) => isActive(signal.status) || isVisibleCompleted(signal, now)), [signals, market, now]);
  const visible = useMemo(() => feedSignals.filter((signal) => filter === "ACTIVE" ? isActive(signal.status) : filter === "COMPLETED" ? isVisibleCompleted(signal, now) : true), [filter, feedSignals, now]);
  const active = feedSignals.filter((signal) => isActive(signal.status)).length;
  const completed = feedSignals.filter((signal) => isVisibleCompleted(signal, now)).length;
  const wins = feedSignals.filter((signal) => signal.status === "TP1_HIT").length;
  const losses = feedSignals.filter((signal) => signal.status === "SL_HIT").length;
  const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;

  return <main className="shell">
    <section className="card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div><div className="section-label">AUTOMATED SIGNAL ENGINE</div><h1 className="title">Signal Feed</h1><p className="muted" style={{ maxWidth: 780 }}>The Signal Feed reads the independent market engine. The Analyzer is not required to run the scanner. Only confirmed Entry Confirmation events are published; completed history remains visible for 6 hours.</p></div>
        <div className="condition-box"><div className="muted">EXECUTION</div><strong>OFF · OBSERVE</strong></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginTop: 18 }}>
        <label className="block"><span className="muted" style={{ display: "block", marginBottom: 6 }}>Market</span><select value={market} onChange={(e) => setMarket(e.target.value as Market)} style={{ width: "100%", borderRadius: 8, border: "1px solid rgba(255,255,255,.14)", background: "#0b1020", color: "#f4f6fb", padding: "10px 12px" }}>{MARKET_OPTIONS.map((option) => <option key={option.value} value={option.value} disabled={option.locked}>{option.label}</option>)}</select></label>
        <div className="condition-box"><div className="muted">{market} AUTOMATION</div><strong>{automation.markets?.[marketCategory(market)] ? "ON" : "OFF"}</strong></div>
        <div className="condition-box"><div className="muted">ADAPTIVE</div><strong>{automation.strategies?.adaptiveExecution ? "ON" : "OFF"}</strong></div>
        <div className="condition-box"><div className="muted">EMA MORNING</div><strong>{automation.strategies?.ema20 ? "ON" : "OFF"}</strong><div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{automation.emaAutomationWindow?.start}–{automation.emaAutomationWindow?.lastSignal} {automation.emaAutomationWindow?.timezone}</div></div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>{(["ALL", "ACTIVE", "COMPLETED"] as StatusFilter[]).map((value) => <button key={value} type="button" onClick={() => setFilter(value)} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid rgba(212,166,55,.35)", background: filter === value ? "#d4a637" : "transparent", color: filter === value ? "#050812" : "#d7dbe7", fontWeight: 800, cursor: "pointer" }}>{value}</button>)}</div>
    </section>

    <section className="card"><div className="section-label">LIFECYCLE SUMMARY · 6H FEED WINDOW</div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>{[["Active", active], ["Completed", completed], ["TP1 Wins", wins], ["SL Losses", losses], ["Win Rate", `${winRate}%`]].map(([label, value]) => <div className="condition-box" key={String(label)}><div className="muted">{label}</div><strong style={{ fontSize: 22 }}>{value}</strong></div>)}</div></section>

    <section className="card"><div className="section-label">SIGNAL FEED · {market.toUpperCase()}</div><h2 className="title">Confirmed Signals</h2>
      {error && <div className="error-box" style={{ marginTop: 16 }}><strong>Signal feed</strong><p className="muted">{error}</p></div>}
      {loading && signals.length === 0 ? <p className="muted" style={{ marginTop: 20 }}>Loading saved signals…</p> : visible.length === 0 ? <div className="condition-box" style={{ marginTop: 16 }}><strong>No {filter.toLowerCase()} signals for {market}.</strong><p className="muted">New confirmed signals are generated by the background engine. No manual Analyzer run is required.</p></div> : <div style={{ display: "grid", gap: 10, marginTop: 16 }}>{visible.map((signal) => <button key={signal.id} type="button" onClick={() => setSelected(signal)} style={{ textAlign: "left", border: isActive(signal.status) ? "1px solid rgba(134,239,172,.35)" : "1px solid rgba(255,255,255,.09)", borderRadius: 12, padding: 16, background: "rgba(255,255,255,.025)", color: "#f4f6fb", cursor: "pointer" }}><div style={{ display: "grid", gridTemplateColumns: "minmax(130px,1fr) minmax(90px,.5fr) minmax(80px,.4fr) minmax(110px,.7fr) minmax(130px,.8fr)", gap: 12, alignItems: "center" }}><div><strong style={{ fontSize: 18 }}>{signal.canonical_symbol}</strong><div className="muted" style={{ marginTop: 3 }}>{signal.strategy_name || signal.strategy_id}</div></div><div style={{ fontWeight: 900, color: signal.direction === "BUY" ? "#86efac" : "#fca5a5" }}>{signal.direction}</div><div><div className="muted">TF</div><strong>{signal.timeframe}</strong></div><div><div className="muted">ENTRY</div><strong>{fmt(signal.entry)}</strong></div><div><div className="muted">STATUS</div><strong>{statusLabel(signal.status)}</strong></div></div><div className="muted" style={{ marginTop: 10, fontSize: 12 }}>Trade ID: {signal.trade_id} · {new Date(signal.fired_at).toLocaleString()}</div></button>)}</div>}
    </section>

    {selected && <div onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}><div onClick={(e) => e.stopPropagation()} style={{ width: "min(900px,100%)", maxHeight: "90vh", overflow: "auto", borderRadius: 16, border: "1px solid rgba(212,166,55,.35)", background: "#070b16", padding: 24 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><div><div className="section-label">CONFIRMED SIGNAL</div><h2 className="title">{selected.canonical_symbol} · {selected.direction}</h2></div><button type="button" onClick={() => setSelected(null)}>Close</button></div><div className="condition-box" style={{ marginTop: 16 }}><strong>{statusLabel(selected.status)}</strong><p>Entry Confirmation: YES · Trade ID: {selected.trade_id}</p></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginTop: 12 }}>{[["Entry", selected.entry], ["SL", selected.stop_loss], ["TP1", selected.tp1], ["TP2", selected.tp2], ["TP3", selected.tp3], ["TP4", selected.tp4]].map(([label, value]) => <div className="condition-box" key={String(label)}><div className="muted">{label}</div><strong style={{ fontSize: 18 }}>{fmt(value as number | null)}</strong></div>)}</div></div></div>}
  </main>;
}

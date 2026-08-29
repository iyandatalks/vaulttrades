"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Signal = {
  id: string;
  trade_id: string;
  market_category: string;
  canonical_symbol: string;
  direction: "BUY" | "SELL";
  strategy_id: string;
  strategy_name: string | null;
  timeframe: string;
  entry: number | null;
  stop_loss: number | null;
  tp1: number | null;
  tp2: number | null;
  tp3: number | null;
  tp4: number | null;
  confidence: number | null;
  rr: number | null;
  status: string;
  confirmation_conditions: string[];
  execution_payload: Record<string, unknown>;
  fired_at: string;
  completed_at?: string | null;
};

type StatusFilter = "ALL" | "ACTIVE" | "COMPLETED";

const COMPLETED_WINDOW_MS = 6 * 60 * 60 * 1000;

const fmt = (value: number | null) =>
  value == null || !Number.isFinite(value)
    ? "—"
    : value.toLocaleString(undefined, { maximumFractionDigits: 5 });

const isActive = (status: string) => status === "CONFIRMED" || status === "ACTIVE";
const isCompleted = (status: string) =>
  status === "TP1_HIT" || status === "SL_HIT" || status === "CYCLE_COMPLETE";
const completionTime = (signal: Signal) =>
  signal.completed_at ? new Date(signal.completed_at).getTime() : NaN;
const isVisibleCompleted = (signal: Signal, now = Date.now()) =>
  isCompleted(signal.status) &&
  Number.isFinite(completionTime(signal)) &&
  now - completionTime(signal) <= COMPLETED_WINDOW_MS;
const statusLabel = (status: string) => {
  if (status === "CONFIRMED") return "FIRED";
  if (status === "ACTIVE") return "ACTIVE";
  if (status === "TP1_HIT") return "TP1 COMPLETED";
  if (status === "SL_HIT") return "SL COMPLETED";
  return status;
};

const marketLabel = (value: string) =>
  value.toLowerCase() === "crypto" ? "CRYPTO" : "FOREX";

export default function SignalsClient() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [marketFilter, setMarketFilter] = useState<"ALL" | "FOREX" | "CRYPTO">("ALL");
  const [strategyFilter, setStrategyFilter] = useState("ALL");
  const [selected, setSelected] = useState<Signal | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const load = async () => {
    try {
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
  };

  useEffect(() => {
    void load();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;

    const supabase = createClient(url, key);
    const channel = supabase
      .channel("scanner-signals-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "scanner_signals" },
        (payload) => {
          const next = payload.new as Signal;
          setSignals((current) =>
            [next, ...current.filter((signal) => signal.id !== next.id)].slice(0, 100),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "scanner_signals" },
        (payload) => {
          const next = payload.new as Signal;
          setSignals((current) =>
            current.map((signal) => (signal.id === next.id ? next : signal)),
          );
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          setError("Live signal connection unavailable. Saved signals are still available.");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const strategies = useMemo(
    () => Array.from(new Set(signals.map((signal) => signal.strategy_name || signal.strategy_id))).sort(),
    [signals],
  );

  const feedSignals = useMemo(() => {
    return signals
      .filter((signal) => {
        const market = marketLabel(signal.market_category);
        const strategy = signal.strategy_name || signal.strategy_id;
        const marketMatches = marketFilter === "ALL" || market === marketFilter;
        const strategyMatches = strategyFilter === "ALL" || strategy === strategyFilter;
        const statusMatches =
          filter === "ALL"
            ? isActive(signal.status) || isVisibleCompleted(signal, now)
            : filter === "ACTIVE"
              ? isActive(signal.status)
              : isVisibleCompleted(signal, now);
        return marketMatches && strategyMatches && statusMatches;
      })
      .sort((a, b) => new Date(b.fired_at).getTime() - new Date(a.fired_at).getTime());
  }, [signals, filter, marketFilter, strategyFilter, now]);

  const active = feedSignals.filter((signal) => isActive(signal.status)).length;
  const completed = feedSignals.filter((signal) => isVisibleCompleted(signal, now)).length;
  const wins = feedSignals.filter((signal) => signal.status === "TP1_HIT").length;
  const losses = feedSignals.filter((signal) => signal.status === "SL_HIT").length;
  const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
  const latest = feedSignals[0];

  return (
    <main className="shell">
      <section
        className="card"
        style={{
          border: "1px solid rgba(212,166,55,.30)",
          background: "linear-gradient(145deg, rgba(10,16,30,.98), rgba(5,8,18,.98))",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 18,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div className="section-label">AUTOMATED SCANNER · SIGNALS</div>
            <h1 className="title">Live Trading Signals</h1>
            <p className="muted" style={{ maxWidth: 820 }}>
              This tab is a viewer for signals generated by the unattended scanner. It does not run
              the scanner, open Analyzer, or place trades. New signals arrive automatically from the
              scanner ledger.
            </p>
          </div>
          <div
            style={{
              minWidth: 190,
              padding: 15,
              borderRadius: 12,
              border: "1px solid rgba(134,239,172,.28)",
              background: "rgba(134,239,172,.06)",
            }}
          >
            <div className="muted" style={{ fontSize: 11, letterSpacing: ".08em" }}>
              SCANNER STATUS
            </div>
            <div style={{ fontSize: 21, fontWeight: 900, marginTop: 5 }}>UNATTENDED</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Scheduled · no manual run
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
            gap: 10,
            marginTop: 20,
          }}
        >
          <div className="condition-box">
            <div className="muted">MARKETS</div>
            <strong>FOREX · CRYPTO</strong>
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Controlled by scanner configuration</div>
          </div>
          <div className="condition-box">
            <div className="muted">AUTOMATED STRATEGY</div>
            <strong>EMA20 · M5</strong>
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Strategy enable/disable is server controlled</div>
          </div>
          <div className="condition-box">
            <div className="muted">AUTOMATION WINDOW</div>
            <strong>01:30–08:45 SAST</strong>
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Africa/Johannesburg</div>
          </div>
          <div className="condition-box">
            <div className="muted">EXECUTION</div>
            <strong>OBSERVE MODE</strong>
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>No MetaKit order execution</div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-label">SIGNAL FILTERS</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
            gap: 10,
            marginTop: 10,
          }}
        >
          <label className="block">
            <span className="muted" style={{ display: "block", marginBottom: 6 }}>Market</span>
            <select
              value={marketFilter}
              onChange={(event) => setMarketFilter(event.target.value as "ALL" | "FOREX" | "CRYPTO")}
              style={{ width: "100%", borderRadius: 8, border: "1px solid rgba(255,255,255,.14)", background: "#0b1020", color: "#f4f6fb", padding: "10px 12px" }}
            >
              <option value="ALL">All markets</option>
              <option value="FOREX">Forex</option>
              <option value="CRYPTO">Crypto</option>
            </select>
          </label>
          <label className="block">
            <span className="muted" style={{ display: "block", marginBottom: 6 }}>Strategy</span>
            <select
              value={strategyFilter}
              onChange={(event) => setStrategyFilter(event.target.value)}
              style={{ width: "100%", borderRadius: 8, border: "1px solid rgba(255,255,255,.14)", background: "#0b1020", color: "#f4f6fb", padding: "10px 12px" }}
            >
              <option value="ALL">All strategies</option>
              {strategies.map((strategy) => <option key={strategy} value={strategy}>{strategy}</option>)}
            </select>
          </label>
          <div>
            <span className="muted" style={{ display: "block", marginBottom: 6 }}>Lifecycle</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(["ALL", "ACTIVE", "COMPLETED"] as StatusFilter[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid rgba(212,166,55,.35)", background: filter === value ? "#d4a637" : "transparent", color: filter === value ? "#050812" : "#d7dbe7", fontWeight: 800, cursor: "pointer" }}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-label">AUTOMATED SIGNAL SUMMARY</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 10, marginTop: 10 }}>
          {[["Active", active], ["Completed", completed], ["TP1 Wins", wins], ["SL Losses", losses], ["Win Rate", `${winRate}%`]].map(([label, value]) => (
            <div className="condition-box" key={String(label)}>
              <div className="muted">{label}</div>
              <strong style={{ fontSize: 22 }}>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div className="section-label">SIGNAL FEED · AUTOMATIC</div>
            <h2 className="title">Latest Scanner Signals</h2>
          </div>
          {latest && <div className="muted">Latest: {new Date(latest.fired_at).toLocaleString()}</div>}
        </div>

        {error && (
          <div className="error-box" style={{ marginTop: 16 }}>
            <strong>Signal feed</strong>
            <p className="muted">{error}</p>
          </div>
        )}

        {loading && signals.length === 0 ? (
          <p className="muted" style={{ marginTop: 20 }}>Loading saved scanner signals…</p>
        ) : feedSignals.length === 0 ? (
          <div className="condition-box" style={{ marginTop: 16 }}>
            <strong>No automated signals in the selected view.</strong>
            <p className="muted" style={{ marginBottom: 0 }}>
              The scanner runs independently on its schedule. This screen does not contain a manual
              scanner control.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
            {feedSignals.map((signal) => {
              const activeSignal = isActive(signal.status);
              return (
                <button
                  key={signal.id}
                  type="button"
                  onClick={() => setSelected(signal)}
                  style={{
                    textAlign: "left",
                    border: activeSignal ? "1px solid rgba(134,239,172,.38)" : "1px solid rgba(255,255,255,.10)",
                    borderRadius: 14,
                    padding: 18,
                    background: activeSignal ? "rgba(134,239,172,.035)" : "rgba(255,255,255,.025)",
                    color: "#f4f6fb",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div>
                      <div className="section-label">AUTOMATED SCANNER</div>
                      <strong style={{ fontSize: 22 }}>{signal.canonical_symbol}</strong>
                      <div className="muted" style={{ marginTop: 4 }}>
                        {marketLabel(signal.market_category)} · {signal.strategy_name || signal.strategy_id} · {signal.timeframe}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", fontSize: 12, fontWeight: 900 }}>
                        {statusLabel(signal.status)}
                      </span>
                      <span style={{ fontSize: 20, fontWeight: 950, color: signal.direction === "BUY" ? "#86efac" : "#fca5a5" }}>
                        {signal.direction}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(105px,1fr))", gap: 8, marginTop: 16 }}>
                    {[["ENTRY", signal.entry], ["SL", signal.stop_loss], ["TP1", signal.tp1], ["TP2", signal.tp2], ["TP3", signal.tp3], ["TP4", signal.tp4]].map(([label, value]) => (
                      <div className="condition-box" key={String(label)}>
                        <div className="muted" style={{ fontSize: 11 }}>{label}</div>
                        <strong>{fmt(value as number | null)}</strong>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
                    <div className="muted" style={{ fontSize: 12 }}>
                      Confidence: {signal.confidence == null ? "—" : `${signal.confidence}%`} · RR: {signal.rr == null ? "—" : signal.rr}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      Fired {new Date(signal.fired_at).toLocaleString()}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{ width: "min(900px,100%)", maxHeight: "90vh", overflow: "auto", borderRadius: 16, border: "1px solid rgba(212,166,55,.35)", background: "#070b16", padding: 24 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div className="section-label">AUTOMATED TRADE SIGNAL</div>
                <h2 className="title">{selected.canonical_symbol} · {selected.direction}</h2>
                <p className="muted">{marketLabel(selected.market_category)} · {selected.strategy_name || selected.strategy_id} · {selected.timeframe}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)}>Close</button>
            </div>

            <div className="condition-box" style={{ marginTop: 16 }}>
              <strong>{statusLabel(selected.status)}</strong>
              <p style={{ marginBottom: 0 }}>Generated by the unattended scanner. Trade execution is disabled while Observe Mode is active.</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginTop: 12 }}>
              {[["Entry", selected.entry], ["SL", selected.stop_loss], ["TP1", selected.tp1], ["TP2", selected.tp2], ["TP3", selected.tp3], ["TP4", selected.tp4]].map(([label, value]) => (
                <div className="condition-box" key={String(label)}>
                  <div className="muted">{label}</div>
                  <strong style={{ fontSize: 18 }}>{fmt(value as number | null)}</strong>
                </div>
              ))}
            </div>

            <div className="condition-box" style={{ marginTop: 12 }}>
              <div className="muted">Confirmation conditions</div>
              <div style={{ marginTop: 8 }}>
                {selected.confirmation_conditions?.length ? selected.confirmation_conditions.join(" · ") : "Recorded by the authoritative strategy engine."}
              </div>
            </div>

            <div className="muted" style={{ marginTop: 12, fontSize: 12 }}>Trade ID: {selected.trade_id}</div>
          </div>
        </div>
      )}
    </main>
  );
}

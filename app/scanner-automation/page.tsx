"use client";

// TradingView signal feed: chart/history stay synchronized with recorded signal timeframes.

import { useEffect, useState } from "react";
import type { SupervisionResponse } from "../../lib/scanner-automation/supervisionTypes";

const SIGNAL_MAX_AGE_HOURS = 2;
const SIGNAL_MAX_AGE_MS = SIGNAL_MAX_AGE_HOURS * 60 * 60 * 1000;

type Signal = {
  id: string;
  trade_id: string;
  canonical_symbol: string;
  direction: string;
  strategy_name: string;
  timeframe: string;
  entry: number | null;
  stop_loss: number | null;
  tp1: number | null;
  tp2: number | null;
  tp3: number | null;
  tp4: number | null;
  tp5: number | null;
  confirmation_timeframe?: string | null;
  entry_quality?: string | null;
  confidence: number | null;
  rr: number | null;
  status: string;
  fired_at: string;
  execution_payload?: Record<string, unknown> | null;
  source_snapshot?: Record<string, unknown> | null;
};

type ScannerConfig = {
  enabled: boolean;
  observe_mode: boolean;
  forex_enabled: boolean;
  crypto_enabled: boolean;
  enabled_strategies: string[];
  trade_time_start: string;
  trade_time_end: string;
  timezone: string;
};

function formatAge(firedAt: string, now: number) {
  const elapsed = Math.max(0, now - new Date(firedAt).getTime());
  const totalMinutes = Math.floor(elapsed / 60000);
  if (totalMinutes < 1) return "Issued now";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `Issued ${hours}h ${minutes}m ago`;
  return `Issued ${minutes}m ago`;
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

export default function ScannerAutomationPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<number | null>(null);
  const [config, setConfig] = useState<ScannerConfig | null>(null);
  const [configError, setConfigError] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [historySignals, setHistorySignals] = useState<Signal[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [supervision, setSupervision] = useState<SupervisionResponse | null>(null);
  const [supervisionLoading, setSupervisionLoading] = useState(false);
  const [supervisionError, setSupervisionError] = useState("");
  const loadSignals = async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/signals", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load signals.");
      const fresh = (data.signals || []).filter((signal: Signal) => Date.now() - new Date(signal.fired_at).getTime() <= SIGNAL_MAX_AGE_MS); setSignals(fresh);
      setError("");
      setLastRefreshed(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load signals.");
    } finally {
      setRefreshing(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch("/api/signals/history?days=5&symbol=XAUUSD&source=tradingview", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load five-day signal history.");
      setHistorySignals(data.signals || []);
      setHistoryError("");
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : "Unable to load five-day signal history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadSupervision = async () => {
    setSupervisionLoading(true);
    try {
      const response = await fetch("/api/scanner-automation/audit?supervision=1&hours=24", { cache: "no-store" });
      const data = await response.json() as SupervisionResponse | { error?: string };
      if (!response.ok) {
        throw new Error("error" in data && data.error ? data.error : "Unable to load scanner supervision.");
      }
      setSupervision(data as SupervisionResponse);
      setSupervisionError("");
    } catch (e) {
      setSupervisionError(e instanceof Error ? e.message : "Unable to load scanner supervision.");
    } finally {
      setSupervisionLoading(false);
    }
  };

  const loadConfig = async () => {
    try {
      const response = await fetch("/api/scanner-automation/config", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load scanner configuration.");
      setConfig(data.config);
      setConfigError("");
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "Unable to load scanner configuration.");
    }
  };

  const saveConfig = async (patch: Partial<ScannerConfig>) => {
    if (!config) return;
    setSavingConfig(true);
    setConfigSaved(false);
    try {
      const next = { ...config, ...patch };
      const response = await fetch("/api/scanner-automation/config", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save scanner configuration.");
      setConfig(data.config);
      setConfigError("");
      setConfigSaved(true);
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "Unable to save scanner configuration.");
    } finally {
      setSavingConfig(false);
    }
  };

  useEffect(() => {
    void loadSignals();
    void loadHistory();
    void loadConfig();
    void loadSupervision();
    const id = setInterval(() => {
      void loadSignals();
      void loadSupervision();
    }, 15000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="shell">
      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="section-label">SCANNER AUTOMATION</div>
            <h1 className="title">Scanner Automation</h1>
            <p className="muted">Manage automated monitoring and monitor newly confirmed VaultTrades signals from one place.</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={() => void loadSignals()} disabled={refreshing} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid rgba(212,166,55,.45)", background: "rgba(212,166,55,.08)", color: "#d4a637", fontWeight: 800, cursor: refreshing ? "wait" : "pointer" }}>
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
            {lastRefreshed && <span className="muted" style={{ fontSize: 11 }}>Updated {new Date(lastRefreshed).toLocaleTimeString()}</span>}
          </div>
        </div>
      </section>

      {config && (
        <section className="card" style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div className="section-label">AUTOMATION CONFIGURATION</div>
              <h2 style={{ margin: "6px 0 4px", fontSize: 20 }}>Signal Feed</h2>
              <p className="muted" style={{ margin: 0 }}>Only confirmed signals are published. A confirmed signal is handed to automation immediately when the alert is received; the two-hour window below controls how long it remains visible in this feed.</p>
            </div>
            <div style={{ fontWeight: 800, fontSize: 12, padding: "7px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,.12)" }}>{config.enabled ? "AUTOMATION ON" : "AUTOMATION OFF"}</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginTop: 18 }}>
            {[["Automation", config.enabled ? "ON" : "OFF"], ["Observe-only", config.observe_mode ? "ON" : "OFF"], ["Forex / metals", config.forex_enabled ? "ON" : "OFF"], ["Crypto", config.crypto_enabled ? "ON" : "OFF"], ["Trading window", `${formatTime(config.trade_time_start)}–${formatTime(config.trade_time_end)}`], ["Timezone", config.timezone]].map(([label, value]) => (
              <div key={label} style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.025)" }}>
                <div className="muted" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em" }}>{label}</div>
                <div style={{ fontWeight: 800, fontSize: 13, marginTop: 5 }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 18 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700 }}><input type="checkbox" checked={config.enabled} disabled={savingConfig} onChange={(e) => void saveConfig({ enabled: e.target.checked })} /> Enable scheduled scanner</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700 }}><input type="checkbox" checked={config.observe_mode} disabled={savingConfig} onChange={(e) => void saveConfig({ observe_mode: e.target.checked })} /> Observe-only mode</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700 }}><input type="checkbox" checked={config.forex_enabled} disabled={savingConfig} onChange={(e) => void saveConfig({ forex_enabled: e.target.checked })} /> Forex / metals</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700 }}><input type="checkbox" checked={config.crypto_enabled} disabled={savingConfig} onChange={(e) => void saveConfig({ crypto_enabled: e.target.checked })} /> Crypto</label>
          </div>

          <div style={{ marginTop: 18, padding: "14px", borderRadius: 10, border: "1px solid rgba(212,166,55,.22)", background: "rgba(212,166,55,.035)" }}>
            <div className="section-label">TRADINGVIEW AUTOMATION · 10 ALERT SLOTS</div>
            <p className="muted" style={{ margin: "6px 0 12px", fontSize: 11 }}>
              These ten strategy/timeframe combinations are the complete automation set. They are displayed together and are not selected from a dropdown.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
              {[
                ["01", "EMA20 Pullback Morning Engine", "ema20-pullback-morning-engine", "M5"],
                ["02", "EMA20 Pullback Morning Engine", "ema20-pullback-morning-engine", "M15"],
                ["03", "EMA20 Pullback Morning Engine", "ema20-pullback-morning-engine", "M30"],
                ["04", "EMA20 Pullback Morning Engine", "ema20-pullback-morning-engine", "H1"],
                ["05", "Justine Core + Session Liquidity", "justine-session-liquidity-m15", "M5"],
                ["06", "Justine Core + Session Liquidity", "justine-session-liquidity-m15", "H1"],
                ["07", "Justine Core + Session Liquidity", "justine-session-liquidity-m15", "M15"],
                ["08", "Vault Auto Select FIB Retrace", "vault_auto_select_fib_retrace_latest", "M5"],
                ["09", "Vault Auto Select FIB Retrace", "vault_auto_select_fib_retrace_latest", "M15"],
                ["10", "Vault Auto Select FIB Retrace", "vault_auto_select_fib_retrace_latest", "H1"],
              ].map(([slot, name, id, timeframe]) => (
                <div key={slot} style={{ display: "grid", gridTemplateColumns: "48px minmax(0,1fr) auto", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.09)", background: "rgba(255,255,255,.02)" }}>
                  <div style={{ fontSize: 10, fontWeight: 900, color: "#d4a637" }}>ALERT {slot}</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 850 }}>{name}</div>
                    <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>{id}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 900 }}>XAUUSD · {timeframe}</div>
                    <div style={{ fontSize: 10, fontWeight: 900, marginTop: 3 }}>{config.enabled ? "ENABLED" : "DISABLED"} · {config.observe_mode ? "OBSERVE" : "LIVE"}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 10 }}>
              Analysis-only timeframes: M1 · M10 · H4 · D1. They remain available for analysis but are not part of automation.
            </div>
          </div>
          {configSaved && <div style={{ marginTop: 10, fontSize: 11, fontWeight: 800 }}>Saved</div>}
          {savingConfig && <div className="muted" style={{ marginTop: 10, fontSize: 11 }}>Saving…</div>}
          {configError && <p style={{ color: "#ffb5b5", marginTop: 12 }}>{configError}</p>}
        </section>
      )}


      <section className="card" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="section-label">SIGNAL SUPERVISION</div>
            <h2 style={{ margin: "6px 0 4px", fontSize: 20 }}>Production Signal Supervision</h2>
            <p className="muted" style={{ margin: 0 }}>Observe the TradingView webhook, signal ledger, execution queue and scheduled scanner as one monitored chain.</p>
          </div>
          <button type="button" onClick={() => void loadSupervision()} disabled={supervisionLoading} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid rgba(212,166,55,.45)", background: "rgba(212,166,55,.08)", color: "#d4a637", fontWeight: 800, cursor: supervisionLoading ? "wait" : "pointer" }}>
            {supervisionLoading ? "Checking…" : "Refresh Supervision"}
          </button>
        </div>

        {supervision && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginTop: 18 }}>
              {[
                ["Webhook received", supervision.tradingView.received],
                ["Signals persisted", supervision.tradingView.persisted],
                ["Rejected", supervision.tradingView.rejected],
                ["Failed", supervision.tradingView.failed],
                ["Queue total", supervision.executionQueue.total],
                ["Queue pending", supervision.executionQueue.queued],
              ].map(([label, value]) => (
                <div key={label} style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.025)" }}>
                  <div className="muted" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em" }}>{label}</div>
                  <div style={{ fontWeight: 900, fontSize: 18, marginTop: 5 }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
              {[
                ["Webhook", supervision.health.webhookReceiving],
                ["Persistence", supervision.health.signalPersisting],
                ["Queue", supervision.health.queueAvailable],
                ["Scanner run", supervision.health.scannerRunObserved],
              ].map(([label, healthy]) => (
                <div key={String(label)} style={{ padding: "7px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", fontSize: 11, fontWeight: 800 }}>
                  {label}: {healthy ? "OK" : "WAITING"}
                </div>
              ))}
              <span className="muted" style={{ fontSize: 11, alignSelf: "center" }}>
                Last activity: {supervision.health.lastActivityAt ? new Date(supervision.health.lastActivityAt).toLocaleString() : "none in 24h"}
              </span>
            </div>
            {supervision.tradingView.latestEvent && (
              <div style={{ marginTop: 14, padding: 12, borderRadius: 10, border: "1px solid rgba(212,166,55,.18)", background: "rgba(212,166,55,.04)", fontSize: 12 }}>
                <strong>Latest webhook:</strong> {supervision.tradingView.latestEvent.status} · {supervision.tradingView.latestEvent.stage} · {supervision.tradingView.latestEvent.symbol ?? "—"} · {supervision.tradingView.latestEvent.timeframe ?? "—"} · {supervision.tradingView.latestEvent.strategy_id ?? "—"}
              </div>
            )}
            {supervision.scannerEngine.latestRun && (
              <div style={{ marginTop: 10, fontSize: 11 }} className="muted">
                Latest scanner run: {supervision.scannerEngine.latestRun.status} · detected {supervision.scannerEngine.latestRun.signals_detected ?? 0} · published {supervision.scannerEngine.latestRun.signals_published ?? 0} · duplicates {supervision.scannerEngine.latestRun.duplicates ?? 0}
              </div>
            )}
          </>
        )}
        {supervisionError && <p style={{ color: "#ffb5b5", marginTop: 14 }}>{supervisionError}</p>}
      </section>

      {!config && (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="muted">Loading scanner configuration…</div>
          {configError && <p style={{ color: "#ffb5b5", marginTop: 12 }}>{configError}</p>}
        </section>
      )}

      <section className="card" style={{ marginTop: 16 }}>
        <div className="section-label">AUTOMATION SCOPE</div>
        <h2 style={{ margin: "6px 0 4px", fontSize: 20 }}>Fixed TradingView Alert Coverage</h2>
        <p className="muted" style={{ margin: 0 }}>
          Automation is defined by the ten fixed slots above. There is no strategy/timeframe selector on this page. M1, M10, H4 and D1 are analysis-only.
        </p>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <div>
            <div className="section-label">TRADINGVIEW SIGNAL HISTORY</div>
            <h2 style={{ margin: "6px 0 4px", fontSize: 20 }}>XAUUSD · TradingView Signals</h2>
            <p className="muted" style={{ margin: 0 }}>Only authenticated TradingView signals recorded by the webhook are shown here.</p>
          </div>
          <button type="button" onClick={() => void loadHistory()} disabled={historyLoading} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid rgba(212,166,55,.45)", background: "rgba(212,166,55,.08)", color: "#d4a637", fontWeight: 800, cursor: historyLoading ? "wait" : "pointer" }}>
            {historyLoading ? "Loading…" : "Refresh 5-Day History"}
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Time", "Symbol", "TF", "Confirm TF", "Strategy", "Side", "Entry", "SL", "TP1", "TP2", "TP3", "TP4", "TP5", "Quality", "Confidence", "Status", "Trade ID"].map((heading) => <th key={heading} style={{ textAlign: "left", padding: "10px 8px", fontSize: 12, borderBottom: "1px solid rgba(212,166,55,.25)", whiteSpace: "nowrap" }}>{heading}</th>)}</tr></thead>
            <tbody>
              {historySignals.map((signal) => {
                const values = [new Date(signal.fired_at).toLocaleString(), signal.canonical_symbol, signal.timeframe, signal.confirmation_timeframe ?? "—", signal.strategy_name, signal.direction, signal.entry?.toFixed(2) ?? "—", signal.stop_loss?.toFixed(2) ?? "—", signal.tp1?.toFixed(2) ?? "—", signal.tp2?.toFixed(2) ?? "—", signal.tp3?.toFixed(2) ?? "—", signal.tp4?.toFixed(2) ?? "—", signal.tp5?.toFixed(2) ?? "—", signal.entry_quality ?? "—", signal.confidence != null ? `${signal.confidence}%` : "—", signal.status, signal.trade_id];
                return <tr key={signal.id}>{values.map((value, index) => <td key={index} style={{ padding: "10px 8px", fontSize: 12, borderBottom: "1px solid rgba(255,255,255,.06)", whiteSpace: "nowrap", fontWeight: index === 3 ? 800 : 400 }}>{value}</td>)}</tr>;
              })}
              {!historySignals.length && <tr><td colSpan={17} style={{ padding: 28, textAlign: "center" }} className="muted">No XAUUSD TradingView signals were recorded in the last five days.</td></tr>}
            </tbody>
          </table>
        </div>
        {historyError && <p style={{ color: "#ffb5b5", marginTop: 14 }}>{historyError}</p>}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <div>
            <div className="section-label">LIVE TRADINGVIEW SIGNAL FEED</div>
            <h2 style={{ margin: "6px 0 4px", fontSize: 20 }}>Signal Feed</h2>
            <p className="muted" style={{ margin: 0 }}>Real webhook-recorded signals only. OBSERVE prevents live execution while still proving the complete signal path.</p>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Signal age", "Symbol", "TF", "Confirm TF", "Strategy", "Side", "Entry", "SL", "TP1", "TP2", "TP3", "TP4", "TP5", "Quality", "Confidence", "Status"].map((heading) => <th key={heading} style={{ textAlign: "left", padding: "10px 8px", fontSize: 12, borderBottom: "1px solid rgba(212,166,55,.25)", whiteSpace: "nowrap" }}>{heading}</th>)}</tr></thead>
            <tbody>
              {signals.map((signal) => {
                const isBuy = signal.direction.toUpperCase() === "BUY";
                const isSell = signal.direction.toUpperCase() === "SELL";
                const rowBackground = isBuy ? "rgba(34,197,94,.12)" : isSell ? "rgba(239,68,68,.12)" : "transparent";
                const values = [formatAge(signal.fired_at, now), signal.canonical_symbol, signal.timeframe, signal.confirmation_timeframe ?? "—", signal.strategy_name, signal.direction, signal.entry?.toFixed(2) ?? "—", signal.stop_loss?.toFixed(2) ?? "—", signal.tp1?.toFixed(2) ?? "—", signal.tp2?.toFixed(2) ?? "—", signal.tp3?.toFixed(2) ?? "—", signal.tp4?.toFixed(2) ?? "—", signal.tp5?.toFixed(2) ?? "—", signal.entry_quality ?? "—", signal.confidence != null ? `${signal.confidence}%` : "—", signal.status];
                return <tr key={signal.id} style={{ background: rowBackground }}>{values.map((value, index) => <td key={index} style={{ padding: "10px 8px", fontSize: 12, borderBottom: "1px solid rgba(255,255,255,.06)", whiteSpace: "nowrap", fontWeight: index === 4 ? 800 : 400 }}>{value}</td>)}</tr>;
              })}
              {!signals.length && <tr><td colSpan={16} style={{ padding: 28, textAlign: "center" }} className="muted">Waiting for a new confirmed signal…</td></tr>}
            </tbody>
          </table>
        </div>
        {error && <p style={{ color: "#ffb5b5", marginTop: 14 }}>{error}</p>}
      </section>
    </main>
  );
}

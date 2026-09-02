"use client";

import { useEffect, useState } from "react";

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
  confidence: number | null;
  rr: number | null;
  status: string;
  fired_at: string;
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

  const loadSignals = async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/signals", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load signals.");
      setSignals((data.signals || []).filter((signal: Signal) => Date.now() - new Date(signal.fired_at).getTime() <= SIGNAL_MAX_AGE_MS));
      setError("");
      setLastRefreshed(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load signals.");
    } finally {
      setRefreshing(false);
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
    void loadConfig();
    const id = setInterval(() => void loadSignals(), 15000);
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
            <p className="muted">Manage the automated scanner and monitor newly confirmed signals from one place.</p>
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
              <p className="muted" style={{ margin: 0 }}>The scanner runs automatically and publishes only confirmed signals. This does not change the existing entry-confirmation process.</p>
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

          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
            <span className="muted" style={{ fontSize: 11 }}>Strategy: {config.enabled_strategies.includes("autoFibRetrace") ? "Vault Auto Fib Retrace + TP Ladder" : "Not configured"} · Trading window: {formatTime(config.trade_time_start)}–{formatTime(config.trade_time_end)} · Timezone: {config.timezone}</span>
            {configSaved && <span style={{ fontSize: 11, fontWeight: 800 }}>Saved</span>}
            {savingConfig && <span className="muted" style={{ fontSize: 11 }}>Saving…</span>}
          </div>
          {configError && <p style={{ color: "#ffb5b5", marginTop: 12 }}>{configError}</p>}
        </section>
      )}

      {!config && (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="muted">Loading scanner configuration…</div>
          {configError && <p style={{ color: "#ffb5b5", marginTop: 12 }}>{configError}</p>}
        </section>
      )}

      <section className="card" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <div>
            <div className="section-label">CONFIRMED SIGNALS</div>
            <h2 style={{ margin: "6px 0 4px", fontSize: 20 }}>Signal Feed</h2>
            <p className="muted" style={{ margin: 0 }}>Only newly confirmed signals from the last 2 hours are shown.</p>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Signal age", "Symbol", "TF", "Strategy", "Side", "Entry", "SL", "TP1", "TP2", "TP3", "Confidence", "Status"].map((heading) => <th key={heading} style={{ textAlign: "left", padding: "10px 8px", fontSize: 12, borderBottom: "1px solid rgba(212,166,55,.25)", whiteSpace: "nowrap" }}>{heading}</th>)}</tr></thead>
            <tbody>
              {signals.map((signal) => {
                const isBuy = signal.direction.toUpperCase() === "BUY";
                const isSell = signal.direction.toUpperCase() === "SELL";
                const rowBackground = isBuy ? "rgba(34,197,94,.12)" : isSell ? "rgba(239,68,68,.12)" : "transparent";
                const values = [formatAge(signal.fired_at, now), signal.canonical_symbol, signal.timeframe, signal.strategy_name, signal.direction, signal.entry?.toFixed(2) ?? "—", signal.stop_loss?.toFixed(2) ?? "—", signal.tp1?.toFixed(2) ?? "—", signal.tp2?.toFixed(2) ?? "—", signal.tp3?.toFixed(2) ?? "—", signal.confidence != null ? `${signal.confidence}%` : "—", signal.status];
                return <tr key={signal.id} style={{ background: rowBackground }}>{values.map((value, index) => <td key={index} style={{ padding: "10px 8px", fontSize: 12, borderBottom: "1px solid rgba(255,255,255,.06)", whiteSpace: "nowrap", fontWeight: index === 4 ? 800 : 400 }}>{value}</td>)}</tr>;
              })}
              {!signals.length && <tr><td colSpan={12} style={{ padding: 28, textAlign: "center" }} className="muted">Waiting for a new confirmed automated signal…</td></tr>}
            </tbody>
          </table>
        </div>
        {error && <p style={{ color: "#ffb5b5", marginTop: 14 }}>{error}</p>}
      </section>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";

type Config = {
  enabled: boolean;
  observe_mode: boolean;
  forex_enabled: boolean;
  crypto_enabled: boolean;
  enabled_strategies: string[];
  trade_time_start?: string;
  trade_time_end?: string;
  timezone?: string;
};

const STRATEGIES = [
  { id: "adaptiveExecution", name: "Adaptive Execution Engine" },
  { id: "ema20", name: "EMA20 Pullback Morning Engine" },
];

export default function AutomationControls() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/scanner-automation/config", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load automation controls.");
        setConfig(data.config);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load automation controls."))
      .finally(() => setLoading(false));
  }, []);

  async function patch(changes: Partial<Config>, key: string) {
    if (!config) return;
    setSaving(key);
    setError("");
    const next = { ...config, ...changes };
    setConfig(next);
    try {
      const response = await fetch("/api/scanner-automation/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save automation setting.");
      setConfig(data.config);
    } catch (err) {
      setConfig(config);
      setError(err instanceof Error ? err.message : "Unable to save automation setting.");
    } finally {
      setSaving(null);
    }
  }

  function toggleStrategy(id: string) {
    if (!config) return;
    const enabled = config.enabled_strategies.includes(id);
    const strategies = enabled
      ? config.enabled_strategies.filter((value) => value !== id)
      : [...config.enabled_strategies, id];
    void patch({ enabled_strategies: strategies }, `strategy:${id}`);
  }

  return (
    <section className="card" style={{ border: "1px solid rgba(212,166,55,.30)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <div className="section-label">AUTOMATED MARKET ENGINE</div>
          <h2 className="title">Automation Controls</h2>
          <p className="muted" style={{ maxWidth: 760 }}>
            These controls publish qualifying scanner signals. OFF disables automation publication for that market or strategy; it does not stop the background engine from observing the market.
          </p>
        </div>
        <div className="muted" style={{ fontSize: 12 }}>
          MetaKit execution: <strong>OFF</strong>
        </div>
      </div>

      {error && <div className="error-box" style={{ marginTop: 12 }}>{error}</div>}

      {loading || !config ? (
        <div className="condition-box" style={{ marginTop: 16 }}>Loading automation controls…</div>
      ) : (
        <>
          <div style={{ marginTop: 16 }}>
            <div className="section-label">MARKET CONTROLS</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 10, marginTop: 8 }}>
              <ToggleRow label="Forex" enabled={config.forex_enabled} busy={saving === "market:forex"} onClick={() => void patch({ forex_enabled: !config.forex_enabled }, "market:forex")} />
              <ToggleRow label="Crypto" enabled={config.crypto_enabled} busy={saving === "market:crypto"} onClick={() => void patch({ crypto_enabled: !config.crypto_enabled }, "market:crypto")} />
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <div className="section-label">STRATEGY CONTROLS</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 10, marginTop: 8 }}>
              {STRATEGIES.map((strategy) => (
                <ToggleRow
                  key={strategy.id}
                  label={strategy.name}
                  enabled={config.enabled_strategies.includes(strategy.id)}
                  busy={saving === `strategy:${strategy.id}`}
                  onClick={() => toggleStrategy(strategy.id)}
                />
              ))}
            </div>
          </div>

          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 10 }}>
            <ToggleRow label="Automation publication" enabled={config.enabled} busy={saving === "engine"} onClick={() => void patch({ enabled: !config.enabled }, "engine")} />
            <ToggleRow label="Observe Mode" enabled={config.observe_mode} busy={saving === "observe"} onClick={() => void patch({ observe_mode: !config.observe_mode }, "observe")} />
            <div className="condition-box">
              <div className="muted">EMA AUTOMATION WINDOW</div>
              <strong>{config.trade_time_start?.slice(0, 5) || "01:30"}–{config.trade_time_end?.slice(0, 5) || "08:45"} SAST</strong>
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{config.timezone || "Africa/Johannesburg"}</div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function ToggleRow({ label, enabled, busy, onClick }: { label: string; enabled: boolean; busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={enabled}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        width: "100%",
        padding: "14px 16px",
        borderRadius: 10,
        border: enabled ? "1px solid rgba(134,239,172,.42)" : "1px solid rgba(255,255,255,.12)",
        background: enabled ? "rgba(134,239,172,.07)" : "rgba(255,255,255,.025)",
        color: "#f4f6fb",
        cursor: busy ? "wait" : "pointer",
        textAlign: "left",
      }}
    >
      <strong>{label}</strong>
      <span style={{ minWidth: 58, textAlign: "center", padding: "6px 9px", borderRadius: 999, fontSize: 11, fontWeight: 900, border: "1px solid rgba(255,255,255,.14)" }}>
        {busy ? "…" : enabled ? "ON" : "OFF"}
      </span>
    </button>
  );
}

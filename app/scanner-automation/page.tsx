"use client";

import { useEffect, useState } from "react";

type Config = {
  enabled: boolean;
  observe_mode: boolean;
  forex_enabled: boolean;
  crypto_enabled: boolean;
  enabled_strategies: string[];
  timezone: string;
};

const defaultConfig: Config = {
  enabled: false,
  observe_mode: true,
  forex_enabled: true,
  crypto_enabled: false,
  enabled_strategies: ["autoFibRetrace"],
  timezone: "Africa/Johannesburg",
};

export default function ScannerAutomationPage() {
  const [config, setConfig] = useState<Config>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/scanner-automation/config", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load scanner configuration.");
      setConfig({ ...defaultConfig, ...data.config });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load scanner configuration.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const save = async (patch: Partial<Config>) => {
    const next = { ...config, ...patch };
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/scanner-automation/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: next.enabled,
          observe_mode: next.observe_mode,
          forex_enabled: next.forex_enabled,
          crypto_enabled: next.crypto_enabled,
          enabled_strategies: next.enabled_strategies,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save scanner configuration.");
      setConfig({ ...defaultConfig, ...data.config });
      setMessage(next.enabled ? "Scanner automation enabled in observe-only mode." : "Scanner automation disabled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save scanner configuration.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="shell" style={{ maxWidth: 900, margin: "0 auto", padding: "34px 20px 60px" }}>
      <section className="card" style={{ padding: 32 }}>
        <div className="section-label">SCANNER AUTOMATION</div>
        <h1 className="title" style={{ fontSize: 34, margin: "8px 0" }}>Vault Auto Fib Scanner</h1>
        <p className="muted" style={{ maxWidth: 700, lineHeight: 1.7 }}>
          Configure the real scheduled scanner. The scheduler reads this configuration before scanning, and signals remain observe-only until execution is explicitly enabled elsewhere.
        </p>

        {loading ? <p className="muted">Loading configuration…</p> : (
          <div style={{ display: "grid", gap: 14, marginTop: 24 }}>
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, padding: 18, borderRadius: 12, border: "1px solid rgba(212,166,55,.25)", background: "rgba(255,255,255,.025)" }}>
              <span><strong>Enable scheduled scanner</strong><br /><span className="muted">Runs automatically on the Vercel cron schedule.</span></span>
              <input type="checkbox" checked={config.enabled} disabled={saving} onChange={(e) => void save({ enabled: e.target.checked })} />
            </label>

            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, padding: 18, borderRadius: 12, border: "1px solid rgba(255,255,255,.08)" }}>
              <span><strong>Observe-only mode</strong><br /><span className="muted">Signals are published for monitoring; no broker order execution is performed by this scanner.</span></span>
              <input type="checkbox" checked={config.observe_mode} disabled={saving} onChange={(e) => void save({ observe_mode: e.target.checked })} />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, borderRadius: 10, border: "1px solid rgba(255,255,255,.08)" }}>
                <input type="checkbox" checked={config.forex_enabled} disabled={saving} onChange={(e) => void save({ forex_enabled: e.target.checked })} />
                <span><strong>Forex / metals</strong><br /><span className="muted">Includes the configured Vault Auto Fib FX/metals universe.</span></span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, borderRadius: 10, border: "1px solid rgba(255,255,255,.08)" }}>
                <input type="checkbox" checked={config.crypto_enabled} disabled={saving} onChange={(e) => void save({ crypto_enabled: e.target.checked })} />
                <span><strong>Crypto</strong><br /><span className="muted">Includes the configured Vault Auto Fib crypto universe.</span></span>
              </label>
            </div>

            <div style={{ padding: 18, borderRadius: 12, background: "rgba(212,166,55,.06)", border: "1px solid rgba(212,166,55,.2)" }}>
              <div className="section-label">ACTIVE STRATEGY</div>
              <strong>Vault Auto Fib Retrace + TP Ladder</strong>
              <p className="muted" style={{ marginBottom: 0 }}>This is the only strategy currently permitted by the automated scanner configuration.</p>
            </div>

            <div style={{ padding: 14, borderRadius: 10, background: "rgba(255,255,255,.025)", color: "#8992a7", fontSize: 12 }}>
              Scheduler timezone: {config.timezone || "Africa/Johannesburg"}. Scanner execution is observe-only by default.
            </div>
          </div>
        )}

        {message && <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: "rgba(70,180,120,.10)", color: "#b8f0cf" }}>{message}</div>}
        {error && <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: "rgba(220,70,70,.12)", color: "#ffb5b5" }}>{error}</div>}
      </section>
    </main>
  );
}

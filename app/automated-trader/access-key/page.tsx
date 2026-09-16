"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type License = {
  id: string;
  status: string;
  start_at: string;
  end_at: string | null;
  access_key: string | null;
  platform: string | null;
  mt_login: string | null;
  broker_name: string | null;
  broker_server: string | null;
};

export default function AccessKeyPage() {
  const [license, setLicense] = useState<License | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setError("");
    try {
      const response = await fetch("/api/automated-trader/access-key", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load access key.");
      setLicense(data.license ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load access key.");
    }
  };

  useEffect(() => { void load(); }, []);

  const generate = async () => {
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      const response = await fetch("/api/automated-trader/access-key", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to generate access key.");
      setLicense(data.license);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to generate access key.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!license?.access_key) return;
    await navigator.clipboard.writeText(license.access_key);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <main className="shell" style={{ maxWidth: 900, margin: "0 auto", padding: "42px 20px 60px" }}>
      <section className="card" style={{ padding: "38px 28px", textAlign: "center" }}>
        <div className="section-label">VAULTTRADES MT5 EXECUTION</div>
        <h1 className="title" style={{ fontSize: 36, margin: "12px 0 10px" }}>Your VaultTrades Access Key</h1>
        <p className="muted" style={{ maxWidth: 680, margin: "0 auto", lineHeight: 1.7 }}>
          This key authenticates your <strong>VaultTradesExecutionEA</strong> with the VaultTrades MT5 execution queue. It is not a Vercel environment variable and it should not be hard-coded into the EA source.
        </p>

        <div style={{ margin: "28px auto 0", maxWidth: 700, padding: 22, borderRadius: 14, background: "#050812", border: "1px solid rgba(212,166,55,.28)", textAlign: "left" }}>
          <div className="section-label">ACCESS KEY</div>
          <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "stretch" }}>
            <input readOnly value={license?.access_key ?? "No key generated yet"} style={{ flex: 1, minWidth: 0, padding: "13px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,.12)", background: "#0a0f1c", color: "#f4f6fb", fontFamily: "monospace", fontSize: 13 }} />
            <button onClick={() => void copy()} disabled={!license?.access_key} style={{ padding: "0 18px", borderRadius: 8, border: 0, background: "#d4a637", color: "#050812", fontWeight: 900 }}>{copied ? "Copied" : "Copy"}</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginTop: 18 }}>
            <div><span className="muted">Status</span><div style={{ marginTop: 4, fontWeight: 800 }}>{license?.status ?? "Not issued"}</div></div>
            <div><span className="muted">MT5 Login</span><div style={{ marginTop: 4, fontWeight: 800 }}>{license?.mt_login ?? "Connect MT5 first"}</div></div>
            <div><span className="muted">Broker</span><div style={{ marginTop: 4, fontWeight: 800 }}>{license?.broker_name ?? "—"}</div></div>
            <div><span className="muted">Server</span><div style={{ marginTop: 4, fontWeight: 800 }}>{license?.broker_server ?? "—"}</div></div>
          </div>

          <button onClick={() => void generate()} disabled={busy} style={{ marginTop: 22, width: "100%", padding: 13, borderRadius: 8, border: "1px solid rgba(212,166,55,.45)", background: "transparent", color: "#d4a637", fontWeight: 900 }}>
            {busy ? "Generating..." : license?.access_key ? "Regenerate Access Key" : "Generate Access Key"}
          </button>
          {license?.access_key && <p className="muted" style={{ margin: "10px 0 0", fontSize: 12 }}>Regenerating immediately invalidates the previous key. Update the EA input before polling again.</p>}
        </div>

        <div style={{ margin: "24px auto 0", maxWidth: 700, padding: 20, borderRadius: 12, background: "rgba(212,166,55,.06)", border: "1px solid rgba(212,166,55,.16)", textAlign: "left" }}>
          <div className="section-label">MT5 EA SETUP</div>
          <ol className="muted" style={{ lineHeight: 1.9, marginBottom: 0 }}>
            <li>Open <strong>VaultTradesExecutionEA</strong> in MetaTrader 5.</li>
            <li>Set <code>InpVaultTradesBaseUrl</code> to <strong>https://vaulttrades.vercel.app</strong>.</li>
            <li>Paste the generated key into <code>InpAccessKey</code>.</li>
            <li>Keep <code>InpExecutionMode</code> on <strong>OBSERVE</strong> for the first connection test.</li>
            <li>Keep <code>InpEnableLiveExecution</code> disabled until the queue/acknowledgement test is confirmed.</li>
          </ol>
        </div>

        {error && <div style={{ marginTop: 18, padding: 14, borderRadius: 8, background: "rgba(220,70,70,.12)", color: "#ffb5b5" }}>{error}</div>}

        <Link href="/automated-trader" style={{ display: "inline-block", marginTop: 24, color: "#d4a637", textDecoration: "none", fontWeight: 800 }}>← Back to Automated Trader</Link>
      </section>
    </main>
  );
}

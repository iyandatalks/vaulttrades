"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type License = {
  id: string;
  user_id: string;
  email: string | null;
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
  const [licenses, setLicenses] = useState<License[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    setError("");
    try {
      const response = await fetch("/api/automated-trader/access-key", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load MT5 execution licenses.");
      setLicenses(data.licenses ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load MT5 execution licenses.");
    }
  };

  useEffect(() => { void load(); }, []);

  const generate = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/automated-trader/access-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to provision access key.");
      setEmail("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to provision access key.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (key: string, id: string) => {
    await navigator.clipboard.writeText(key);
    setCopied(id);
    window.setTimeout(() => setCopied(null), 1800);
  };

  return (
    <main className="shell" style={{ maxWidth: 1050, margin: "0 auto", padding: "42px 20px 60px" }}>
      <section className="card" style={{ padding: "38px 28px" }}>
        <div className="section-label">ADMIN • MT5 EXECUTION</div>
        <h1 className="title" style={{ fontSize: 36, margin: "12px 0 10px" }}>MT5 Copy-Trading Provisioning</h1>
        <p className="muted" style={{ maxWidth: 760, lineHeight: 1.7 }}>
          Administrator-only console. Provision the VaultTrades execution credential for a customer account and use it when configuring the VaultTrades MT5 EA. Customers do not see this console or the credential.
        </p>

        <div style={{ marginTop: 26, padding: 22, borderRadius: 14, background: "#050812", border: "1px solid rgba(212,166,55,.28)" }}>
          <div className="section-label">PROVISION CUSTOMER</div>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Customer email" type="email" style={{ flex: 1, padding: "13px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,.12)", background: "#0a0f1c", color: "#f4f6fb" }} />
            <button onClick={() => void generate()} disabled={busy || !email.trim()} style={{ padding: "0 18px", borderRadius: 8, border: 0, background: "#d4a637", color: "#050812", fontWeight: 900 }}>{busy ? "Provisioning..." : "Generate / Regenerate Key"}</button>
          </div>
          <p className="muted" style={{ margin: "10px 0 0", fontSize: 12 }}>Regenerating replaces the previous credential, so the EA must be updated before its next poll.</p>
        </div>

        <div style={{ marginTop: 24, display: "grid", gap: 12 }}>
          {licenses.length === 0 ? <div className="muted" style={{ padding: 22, textAlign: "center", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10 }}>No MT5 execution credentials have been provisioned.</div> : licenses.map(license => license.access_key && (
            <article key={license.id} style={{ padding: 20, borderRadius: 12, background: "#050812", border: "1px solid rgba(212,166,55,.18)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                <div><strong>{license.email || license.user_id}</strong><div className="muted" style={{ marginTop: 5 }}>{license.broker_name || "Broker pending"} · {license.mt_login || "MT5 login pending"} · {license.status}</div></div>
                <button onClick={() => void copy(license.access_key!, license.id)} style={{ padding: "9px 14px", borderRadius: 7, border: 0, background: "#d4a637", color: "#050812", fontWeight: 900 }}>{copied === license.id ? "Copied" : "Copy Key"}</button>
              </div>
              <div style={{ marginTop: 14, padding: "11px 13px", borderRadius: 8, background: "#0a0f1c", color: "#f4f6fb", fontFamily: "monospace", fontSize: 12, overflowX: "auto" }}>{license.access_key}</div>
              <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>Server: {license.broker_server || "pending"}</div>
            </article>
          ))}
        </div>

        <div style={{ marginTop: 24, padding: 20, borderRadius: 12, background: "rgba(212,166,55,.06)", border: "1px solid rgba(212,166,55,.16)" }}>
          <div className="section-label">ADMIN EA HANDOFF</div>
          <ol className="muted" style={{ lineHeight: 1.9, marginBottom: 0 }}>
            <li>Install <strong>VaultTradesExecutionEA</strong> on the customer's MT5 terminal.</li>
            <li>Set the VaultTrades server address and paste the customer's provisioned access key into the EA.</li>
            <li>Start in <strong>OBSERVE</strong> mode and confirm polling/queue acknowledgement.</li>
            <li>Only after the demo verification is complete, enable live execution deliberately.</li>
          </ol>
        </div>

        {error && <div style={{ marginTop: 18, padding: 14, borderRadius: 8, background: "rgba(220,70,70,.12)", color: "#ffb5b5" }}>{error}</div>}
        <Link href="/automated-trader" style={{ display: "inline-block", marginTop: 24, color: "#d4a637", textDecoration: "none", fontWeight: 800 }}>← Back to Automated Trader</Link>
      </section>
    </main>
  );
}

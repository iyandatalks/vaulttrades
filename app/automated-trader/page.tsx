"use client";

import { useEffect, useState } from "react";

type Status = { active: boolean; paymentConfigured: boolean; product: any; subscription: any; accounts: any[] };

export default function AutomatedTraderPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", number: "", password: "", brokerId: "", server: "" });

  const load = async () => {
    const res = await fetch("/api/automated-trader/status", { cache: "no-store" });
    if (!res.ok) return;
    setStatus(await res.json());
  };
  useEffect(() => { void load(); }, []);

  const subscribe = async () => {
    setBusy("subscribe"); setError("");
    try {
      const res = await fetch("/api/automated-trader/subscribe", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to start subscription.");
      window.location.href = data.approveUrl;
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to start subscription."); setBusy(""); }
  };

  const connect = async () => {
    setBusy("connect"); setError("");
    try {
      const res = await fetch("/api/automated-trader/metakit/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, number: form.number, password: form.password, brokerId: form.brokerId, server: form.server }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to connect MT5 account.");
      setForm({ name: "", number: "", password: "", brokerId: "", server: "" });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to connect MT5 account."); }
    finally { setBusy(""); }
  };

  return <main className="shell">
    <section className="card">
      <div className="section-label">AUTOMATED TRADER · M15 ENGINE</div>
      <h1 className="title">VaultTrades M15 Automated Trader</h1>
      <p className="muted">The automated service is built around the two approved strategy engines, evaluated on M15. The execution layer is separate from the strategy engine and is authorized only while the Automated Trader subscription is active.</p>
    </section>

    <section className="card" style={{ marginTop: 16 }}>
      <div className="section-label">SERVICE ENTITLEMENT</div>
      <h2 className="title" style={{ fontSize: 24 }}>{status?.active ? "AUTOMATION ACTIVE" : "AUTOMATION NOT ACTIVE"}</h2>
      <p className="muted">{status?.active ? "Your recurring Automated Trader entitlement is active. New execution is permitted only while this entitlement remains active." : "Purchase the Automated Trader service first. Payment status is verified server-side; access is never granted by the button alone."}</p>
      <button disabled={busy === "subscribe" || status?.active || !status?.paymentConfigured} onClick={() => void subscribe()} style={{ marginTop: 14, padding: "12px 18px", borderRadius: 8, border: 0, fontWeight: 800, cursor: status?.active || !status?.paymentConfigured ? "not-allowed" : "pointer", background: "#d4a637", color: "#050812" }}>{busy === "subscribe" ? "Opening PayPal..." : status?.active ? "Subscription Active" : "Subscribe to Automated Trader"}</button>
      {!status?.paymentConfigured && <p className="muted" style={{ marginTop: 10 }}>Checkout is waiting for the administrator to configure the PayPal recurring plan ID.</p>}
    </section>

    <section className="card" style={{ marginTop: 16 }}>
      <div className="section-label">MT5 CONNECTION</div>
      <h2 className="title" style={{ fontSize: 24 }}>Connect your MetaTrader 5 account</h2>
      <p className="muted">Your MT5 credentials are sent server-to-server to MetaKit to create a Full execution account. VaultTrades does not store the MT5 password. MetaKit requires a Full account for copier execution.</p>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", marginTop: 16 }}>
        {([['name','Account name'],['number','MT5 login'],['password','Master password'],['brokerId','MetaKit broker ID'],['server','Exact broker server']] as const).map(([key,label]) => <label key={key} style={{ display: "grid", gap: 6, color: "#aeb5c6", fontSize: 12 }}><span>{label}</span><input type={key === 'password' ? 'password' : 'text'} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} style={{ padding: 11, borderRadius: 7, border: "1px solid rgba(212,166,55,.25)", background: "#050812", color: "#f4f6fb" }} /></label>)}
      </div>
      <button disabled={busy === "connect"} onClick={() => void connect()} style={{ marginTop: 16, padding: "12px 18px", borderRadius: 8, border: "1px solid rgba(212,166,55,.45)", background: "transparent", color: "#d4a637", fontWeight: 800 }}>{busy === "connect" ? "Connecting..." : "Connect MT5 to MetaKit"}</button>
      {status?.accounts?.map(account => <div key={account.id} style={{ marginTop: 14, padding: 14, borderRadius: 8, background: "#050812", border: "1px solid rgba(212,166,55,.2)" }}><strong>{account.account_name || `MT5 ${account.mt_login}`}</strong><div className="muted" style={{ marginTop: 5 }}>MetaKit #{account.metakit_account_id} · {account.broker_server || "server pending"} · {account.status}</div></div>)}
    </section>

    <section className="card" style={{ marginTop: 16 }}>
      <div className="section-label">EXECUTION ARCHITECTURE</div>
      <p className="muted">M15 Strategy Engine → VaultTrades Signal → controlled execution source → MetaKit copier → your MT5 Full account. Subscription expiry disables new automation and places the follower copier into a safe wind-down state rather than silently leaving copied positions unmanaged.</p>
      <p className="muted">MetaKit currently executes programmatic trading through its copier infrastructure rather than a direct order endpoint, so the production execution source must be provisioned separately before live trading is enabled.</p>
    </section>

    {error && <div style={{ marginTop: 16, padding: 14, borderRadius: 8, background: "rgba(220,70,70,.12)", color: "#ffb5b5" }}>{error}</div>}
  </main>;
}

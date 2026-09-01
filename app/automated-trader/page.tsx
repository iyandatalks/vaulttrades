"use client";

import { useEffect, useState } from "react";

type Account = { id:string|number; metakit_account_id:number; account_name:string|null; mt_login:string; broker_server:string|null; status:string; enabled_instruments:string[]|null };
type Status = { active: boolean; paymentConfigured: boolean; product: any; subscription: any; accounts: Account[] };

export default function AutomatedTraderPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", number: "", password: "", brokerId: "", server: "" });
  const [symbols, setSymbols] = useState<Record<number,string[]>>({});
  const [selected, setSelected] = useState<Record<number,string[]>>({});

  const load = async () => {
    const res = await fetch("/api/automated-trader/status", { cache: "no-store" });
    if (!res.ok) return;
    const next = await res.json() as Status;
    setStatus(next);
    setSelected(Object.fromEntries(next.accounts.map(account => [account.metakit_account_id, account.enabled_instruments || ["XAUUSD"]])));
    await Promise.all(next.accounts.map(async account => {
      try {
        const symbolRes = await fetch(`/api/automated-trader/metakit/symbols?accountId=${account.metakit_account_id}`, { cache: "no-store" });
        const data = await symbolRes.json();
        if (symbolRes.ok) setSymbols(current => ({ ...current, [account.metakit_account_id]: data.symbols || [] }));
      } catch { /* account controls remain usable with saved preferences */ }
    }));
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

  const disconnect = async (metakitAccountId:number) => {
    if (!window.confirm("Disconnect this MT5 account from MetaKit? Any open positions will remain at the broker and will no longer be managed by MetaKit.")) return;
    setBusy(`disconnect-${metakitAccountId}`); setError("");
    try {
      const res = await fetch("/api/automated-trader/metakit/disconnect", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ metakitAccountId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to disconnect MetaKit account.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to disconnect MetaKit account."); }
    finally { setBusy(""); }
  };

  const saveInstruments = async (metakitAccountId:number) => {
    setBusy(`instruments-${metakitAccountId}`); setError("");
    try {
      const enabledInstruments = selected[metakitAccountId] || [];
      const res = await fetch("/api/automated-trader/metakit/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ metakitAccountId, enabledInstruments }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to save instrument settings.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save instrument settings."); }
    finally { setBusy(""); }
  };

  const toggleInstrument = (accountId:number, symbol:string) => {
    setSelected(current => {
      const currentList = current[accountId] || [];
      return { ...current, [accountId]: currentList.includes(symbol) ? currentList.filter(x => x !== symbol) : [...currentList, symbol] };
    });
  };

  const demoVideoUrl = process.env.NEXT_PUBLIC_AUTOMATION_DEMO_URL;

  return <main className="shell">
    <section className="card">
      <div className="section-label">AUTOMATED TRADER</div>
      <div className="section-label" style={{ marginTop: 6 }}>AUTOMATED COPY TRADING · LIVE</div>
      <h1 className="title">Trade Smarter with<br />VaultTrades</h1>
      <p className="muted">Connect your broker and let our algorithm trade for you — fully automated, 24/7.</p>
      <button disabled={busy === "subscribe" || status?.active || !status?.paymentConfigured} onClick={() => void subscribe()} style={{ marginTop: 14, padding: "12px 18px", borderRadius: 8, border: 0, fontWeight: 800, cursor: status?.active || !status?.paymentConfigured ? "not-allowed" : "pointer", background: "#d4a637", color: "#050812" }}>{busy === "subscribe" ? "Opening PayPal..." : status?.active ? "Subscription Active" : "Let's Get Started"}</button>
    </section>

    <section className="card" style={{ marginTop: 16 }}>
      <div className="section-label">SERVICE ENTITLEMENT</div>
      <h2 className="title" style={{ fontSize: 24 }}>{status?.active ? "AUTOMATION ACTIVE" : "AUTOMATION NOT ACTIVE"}</h2>
      <p className="muted">{status?.active ? "Your Automated Trader entitlement is active. Instrument permissions below determine which connected MT5 instruments may be used for automated execution." : "Purchase the Automated Trader service first. Payment status is verified server-side; access is never granted by the button alone."}</p>
      {!status?.active && <button disabled={busy === "subscribe" || !status?.paymentConfigured} onClick={() => void subscribe()} style={{ marginTop: 14, padding: "12px 18px", borderRadius: 8, border: 0, fontWeight: 800, cursor: !status?.paymentConfigured ? "not-allowed" : "pointer", background: "#d4a637", color: "#050812" }}>{busy === "subscribe" ? "Opening PayPal..." : "Subscribe to Automated Trader"}</button>}
      {!status?.paymentConfigured && <p className="muted" style={{ marginTop: 10 }}>Checkout is waiting for the administrator to configure the PayPal recurring plan ID.</p>}
    </section>

    <section className="card" style={{ marginTop: 16 }}>
      <div className="section-label">MT5 CONNECTION</div>
      <h2 className="title" style={{ fontSize: 24 }}>Connect your MetaTrader 5 account</h2>
      <p className="muted">Connect a Full execution account to your account. VaultTrades does not store the MT5 password.</p>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", marginTop: 16 }}>
        {([['name','Account name'],['number','MT5 login'],['password','Master password'],['brokerId','Broker ID'],['server','Exact broker server']] as const).map(([key,label]) => <label key={key} style={{ display: "grid", gap: 6, color: "#aeb5c6", fontSize: 12 }}><span>{label}</span><input type={key === 'password' ? 'password' : 'text'} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} style={{ padding: 11, borderRadius: 7, border: "1px solid rgba(212,166,55,.25)", background: "#050812", color: "#f4f6fb" }} /></label>)}
      </div>
      <button disabled={busy === "connect"} onClick={() => void connect()} style={{ marginTop: 16, padding: "12px 18px", borderRadius: 8, border: "1px solid rgba(212,166,55,.45)", background: "transparent", color: "#d4a637", fontWeight: 800 }}>{busy === "connect" ? "Connecting..." : "Connect MT5"}</button>

      {status?.accounts?.map(account => {
        const accountSymbols = symbols[account.metakit_account_id] || [];
        const options = [...new Set([...accountSymbols, ...(selected[account.metakit_account_id] || [])])].sort();
        return <div key={account.id} style={{ marginTop: 18, padding: 16, borderRadius: 10, background: "#050812", border: "1px solid rgba(212,166,55,.2)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", gap:12, alignItems:"center", flexWrap:"wrap" }}><div><strong>{account.account_name || `MT5 ${account.mt_login}`}</strong><div className="muted" style={{ marginTop: 5 }}>{account.broker_server || "server pending"} · {account.status}</div></div><button disabled={busy === `disconnect-${account.metakit_account_id}`} onClick={() => void disconnect(account.metakit_account_id)} style={{ padding:"9px 13px", borderRadius:7, border:"1px solid rgba(239,68,68,.45)", background:"transparent", color:"#ffb5b5", fontWeight:800 }}>{busy === `disconnect-${account.metakit_account_id}` ? "Disconnecting..." : "Disconnect"}</button></div>
          <div style={{ marginTop: 16 }}><div className="section-label">INSTRUMENT PERMISSIONS</div><p className="muted">Enable only the instruments you want the automated trader to use on this MT5 account.</p><div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:8, marginTop:10 }}>{options.length ? options.map(symbol => {const checked=(selected[account.metakit_account_id] || []).includes(symbol);return <label key={symbol} style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 10px", borderRadius:7, background:checked?"rgba(212,166,55,.10)":"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.08)", cursor:"pointer" }}><input type="checkbox" checked={checked} onChange={() => toggleInstrument(account.metakit_account_id,symbol)} /><span>{symbol}</span></label>;}) : <span className="muted">Broker instruments are loading…</span>}</div><button disabled={busy === `instruments-${account.metakit_account_id}`} onClick={() => void saveInstruments(account.metakit_account_id)} style={{ marginTop:12, padding:"10px 14px", borderRadius:7, border:"1px solid rgba(212,166,55,.45)", background:"transparent", color:"#d4a637", fontWeight:800 }}>{busy === `instruments-${account.metakit_account_id}` ? "Saving..." : "Save instrument permissions"}</button></div>
        </div>;
      })}
    </section>

    {error && <div style={{ marginTop: 16, padding: 14, borderRadius: 8, background: "rgba(220,70,70,.12)", color: "#ffb5b5" }}>{error}</div>}

    <section className="card" style={{ marginTop: 18, textAlign: "center", overflow: "hidden" }}>
      <div className="section-label">AUTOMATION IN ACTION</div>
      <h2 className="title" style={{ fontSize: 25, marginBottom: 8 }}>Built by Traders, for Traders</h2>
      <p className="muted" style={{ maxWidth: 680, margin: "0 auto" }}>See how VaultTrades automation monitors the market, evaluates signals and prepares execution without requiring you to watch every candle.</p>
      <div style={{ marginTop: 18, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(212,166,55,.22)", background: "#050812" }}>
        {demoVideoUrl ? <video controls playsInline preload="metadata" style={{ display:"block", width:"100%", maxHeight:460, background:"#02040a" }} src={demoVideoUrl} aria-label="VaultTrades automated trading demonstration" /> : <div style={{ minHeight: 280, display:"grid", placeItems:"center", padding:28, background:"radial-gradient(circle at 50% 20%, rgba(212,166,55,.10), transparent 55%)" }}><div><div style={{ fontSize: 12, letterSpacing: 1.4, color:"#d4a637", fontWeight:800 }}>LIVE AUTOMATION PREVIEW</div><div style={{ marginTop:10, fontSize:22, fontWeight:800 }}>Market scan → Signal → Confirmation → Execution</div><div className="muted" style={{ marginTop:10 }}>The production demo clip can be enabled with NEXT_PUBLIC_AUTOMATION_DEMO_URL.</div></div></div>}
      </div>
      <p className="muted" style={{ marginTop: 14, fontSize: 13 }}>Automation is designed to support disciplined execution. Results vary and no trading system guarantees profits.</p>
    </section>

    <section style={{ marginTop: 22, padding: "18px 12px 28px", textAlign: "center", color: "#8992a7", fontSize: 12, lineHeight: 1.7 }}>
      <strong style={{ color: "#aeb5c6" }}>Risk Disclaimer</strong>
      <p style={{ maxWidth: 900, margin: "8px auto 0" }}>Trading financial markets involves substantial risk, including the possible loss of capital. VaultTrades provides software, market analysis and automation tools and does not provide financial advice or guarantee trading results. Automated execution can experience slippage, latency, rejected orders, outages and broker-specific limitations. You are responsible for your trading decisions, account settings and risk management.</p>
    </section>
  </main>;
}

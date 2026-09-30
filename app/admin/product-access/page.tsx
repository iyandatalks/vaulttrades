"use client";

import { useState } from "react";

const products = [
  { code: "analyzer", name: "Analyzer", description: "Market analysis access." },
  { code: "copy_trading", name: "Copy Trading", description: "MT5 Copier entitlement and license." },
  { code: "founders_mentorship", name: "Founders Mentorship", description: "Mentorship access." },
] as const;

export default function AdminProductAccessPage() {
  const [email, setEmail] = useState("");
  const [mt5Login, setMt5Login] = useState("");
  const [durationDays, setDurationDays] = useState("30");
  const [user, setUser] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function search() {
    setMessage("");
    const r = await fetch(`/api/admin/product-access?email=${encodeURIComponent(email)}`, { cache: "no-store" });
    const d = await r.json();
    if (!r.ok) return setMessage(d.error || "Search failed.");
    setUser(d.users?.[0] || null);
    if (!d.users?.length) setMessage("No VaultTrades user found.");
  }

  async function change(product: string, action: "grant" | "deactivate") {
    if (!user) return;
    if (action === "deactivate" && !confirm(`Deactivate ${product} for ${user.email}?`)) return;
    setBusy(true); setMessage("");
    try {
      const r = await fetch("/api/admin/product-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, product, action, mt5Login, durationDays: Number(durationDays) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Operation failed.");
      setMessage(d.message);
      await search();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Operation failed.");
    } finally { setBusy(false); }
  }

  return (
    <main className="vt-info-page">
      <div className="vt-info-wrap">
        <header className="vt-info-hero">
          <div className="vt-label">ADMIN · PRODUCT ACCESS</div>
          <h1>Grant or deactivate customer products.</h1>
          <p>Use this control for legacy founders, complimentary access and support corrections. Manual access is time-limited and does not change or cancel a customer&apos;s automatic paid entitlement.</p>
        </header>

        <section className="vt-info-card">
          <div className="vt-label">CUSTOMER</div>
          <div style={{display:"flex",gap:10,marginTop:12}}>
            <input value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>{if(e.key==="Enter") void search();}} placeholder="Customer email" style={{flex:1,padding:12,borderRadius:10}} />
            <button className="vt-primary" onClick={()=>void search()}>Find Customer</button>
          </div>
          {user && <div style={{marginTop:18}}><strong>{user.email}</strong><div className="muted">Role: {user.role}</div></div>}
        </section>

        {user && <section className="vt-info-card" style={{marginTop:18}}>
          <div style={{padding:12,background:"rgba(212,166,55,.08)",border:"1px solid rgba(212,166,55,.18)",borderRadius:10,marginBottom:14}}><strong>Manual access only:</strong> grants below create a separate time-limited entitlement. Existing automatic/paid access is left untouched and can continue normally.</div>
          <div className="vt-label">PRODUCT ACCESS</div>
          <div style={{display:"grid",gap:12,marginTop:14}}>
            {products.map(p => {
              const license = user.products?.[p.code];
              const manualActive = license?.manual?.status === "active" && (!license.manual.end_at || new Date(license.manual.end_at).getTime() > Date.now());
              const automaticActive = license?.automatic?.status === "active" && (!license.automatic.end_at || new Date(license.automatic.end_at).getTime() > Date.now());
              const active = manualActive || automaticActive;
              return <div key={p.code} style={{padding:16,border:"1px solid rgba(255,255,255,.09)",borderRadius:12}}>
                <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                  <div><strong>{p.name}</strong><div className="muted">{p.description}</div></div>
                  <strong style={{color:active?"#d4a637":"#7f8a99"}}>{active?"ACTIVE":"INACTIVE"}</strong>
                </div>
                {p.code === "copy_trading" && <input value={mt5Login} onChange={e=>setMt5Login(e.target.value)} placeholder="MT5 account number (required for Copy Trading grant)" style={{width:"100%",padding:10,borderRadius:8,marginTop:12}} />}\n                <input type="number" min="1" max="3650" value={durationDays} onChange={e=>setDurationDays(e.target.value)} placeholder="Manual access days (1–3650)" style={{width:"100%",padding:10,borderRadius:8,marginTop:12}} />
                <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
                  <button className="vt-primary" disabled={busy} onClick={()=>void change(p.code,"grant")}>Grant Access</button>
                  <button className="vt-secondary" disabled={busy || !license?.manual} onClick={()=>void change(p.code,"deactivate")}>Deactivate</button>
                </div>
                {license?.manual && <div className="muted" style={{marginTop:10}}>Manual grant: {license.manual.status} · Until: {license.manual.end_at ? new Date(license.manual.end_at).toLocaleString() : "No expiry"}{license.manual.mt_login ? ` · MT5: ${license.manual.mt_login}` : ""}</div>}\n                {license?.automatic && <div className="muted" style={{marginTop:6}}>Automatic access: {license.automatic.status} · Until: {license.automatic.end_at ? new Date(license.automatic.end_at).toLocaleString() : "No expiry"}{license.automatic.mt_login ? ` · MT5: ${license.automatic.mt_login}` : ""}</div>}
              </div>;
            })}
          </div>
        </section>}

        {message && <div className="vt-info-card" style={{marginTop:18}}>{message}</div>}
      </div>
    </main>
  );
}

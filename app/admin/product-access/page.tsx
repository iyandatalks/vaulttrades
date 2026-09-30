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
        body: JSON.stringify({ email: user.email, product, action, mt5Login }),
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
          <p>Use this control for support, complimentary access, corrections and emergency deactivation. PayPal remains the normal customer purchase path.</p>
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
          <div className="vt-label">PRODUCT ACCESS</div>
          <div style={{display:"grid",gap:12,marginTop:14}}>
            {products.map(p => {
              const license = user.products?.[p.code];
              const active = license?.status === "active" && (!license.end_at || new Date(license.end_at).getTime() > Date.now());
              return <div key={p.code} style={{padding:16,border:"1px solid rgba(255,255,255,.09)",borderRadius:12}}>
                <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                  <div><strong>{p.name}</strong><div className="muted">{p.description}</div></div>
                  <strong style={{color:active?"#d4a637":"#7f8a99"}}>{active?"ACTIVE":"INACTIVE"}</strong>
                </div>
                {p.code === "copy_trading" && <input value={mt5Login} onChange={e=>setMt5Login(e.target.value)} placeholder="MT5 account number (required for Copy Trading grant)" style={{width:"100%",padding:10,borderRadius:8,marginTop:12}} />}
                <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
                  <button className="vt-primary" disabled={busy} onClick={()=>void change(p.code,"grant")}>Grant Access</button>
                  <button className="vt-secondary" disabled={busy || !license} onClick={()=>void change(p.code,"deactivate")}>Deactivate</button>
                </div>
                {license && <div className="muted" style={{marginTop:10}}>Status: {license.status} · Until: {license.end_at ? new Date(license.end_at).toLocaleString() : "No expiry"}{license.mt_login ? ` · MT5: ${license.mt_login}` : ""}</div>}
              </div>;
            })}
          </div>
        </section>}

        {message && <div className="vt-info-card" style={{marginTop:18}}>{message}</div>}
      </div>
    </main>
  );
}

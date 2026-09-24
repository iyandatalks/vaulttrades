"use client";

import { useEffect, useState } from "react";

type Request = { id:string; auth_user_id:string; request_type:string; message:string; status:string; created_at:string };

export default function AdminCopySupportPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const r = await fetch("/api/admin/copy-support", { cache: "no-store" });
    const d = await r.json();
    if (r.ok) setRequests(d.requests || []);
  };

  useEffect(() => { void load(); }, []);

  const reset = async () => {
    if (!email.trim()) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/copy-support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Reset failed.");
      alert(d.message);
      setEmail("");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Reset failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="vt-info-page">
      <div className="vt-info-wrap">
        <header className="vt-info-hero">
          <div className="vt-label">ADMIN · COPY SUPPORT</div>
          <h1>Copier activation control.</h1>
          <p>Review support requests and reset one customer's Copier activation when required.</p>
        </header>
        <section className="vt-info-card">
          <div className="vt-label">RESET ACTIVATION</div>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Customer email" style={{ width:"100%", padding:12, borderRadius:10 }} />
          <button className="vt-primary" onClick={()=>void reset()} disabled={busy || !email.trim()} style={{ marginTop:12 }}>
            {busy ? "Resetting…" : "Reset Copier Activation"}
          </button>
        </section>
        <section className="vt-info-card" style={{ marginTop:24 }}>
          <div className="vt-label">OPEN REQUESTS</div>
          {requests.length===0 ? <p>No support requests.</p> : requests.map(r => (
            <article key={r.id} style={{ padding:"14px 0", borderBottom:"1px solid rgba(255,255,255,.08)" }}>
              <strong>{r.status} · {r.request_type}</strong>
              <div className="muted" style={{ fontSize:12 }}>{new Date(r.created_at).toLocaleString()} · {r.auth_user_id}</div>
              <p>{r.message}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

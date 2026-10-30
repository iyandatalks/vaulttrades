"use client";

import { useCallback, useEffect, useState } from "react";

type Promotion = {
  id: string; title: string; description: string; category: string; image_url: string | null;
  cta_text: string; target_url: string; is_active: boolean; display_order: number;
  starts_at: string | null; ends_at: string | null;
};
const empty = { title: "", description: "", category: "Prop Firm", image_url: "", cta_text: "Explore", target_url: "/partners", is_active: true, display_order: 0, starts_at: "", ends_at: "" };
const categories = ["Prop Firm", "Broker", "VaultTrades Product", "Tool", "Other"];
const field: React.CSSProperties = { width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,.16)", background: "#050812", color: "#f4f6fb" };

export default function PromotionManager() {
  const [items, setItems] = useState<Promotion[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/promotions", { cache: "no-store" });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Could not load promotions.");
      setItems(d.promotions || []);
    } catch (e) { setFailed(true); setMessage(e instanceof Error ? e.message : "Could not load promotions."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  function reset() { setEditing(null); setForm(empty); }
  function edit(p: Promotion) {
    setEditing(p.id);
    setForm({ title: p.title, description: p.description, category: p.category, image_url: p.image_url || "", cta_text: p.cta_text, target_url: p.target_url, is_active: p.is_active, display_order: p.display_order, starts_at: p.starts_at ? p.starts_at.slice(0,16) : "", ends_at: p.ends_at ? p.ends_at.slice(0,16) : "" });
    document.getElementById("vt-promotion-form")?.scrollIntoView({ behavior: "smooth" });
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage(""); setFailed(false);
    try {
      const payload = { ...form, starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null, ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null, ...(editing ? { id: editing } : {}) };
      const r = await fetch("/api/admin/promotions", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Could not save promotion.");
      setMessage(editing ? "Promotion updated." : "Promotion added."); reset(); await load();
    } catch (e) { setFailed(true); setMessage(e instanceof Error ? e.message : "Could not save promotion."); }
    finally { setBusy(false); }
  }
  async function toggle(p: Promotion) {
    setBusy(true); setMessage("");
    try {
      const r = await fetch("/api/admin/promotions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, is_active: !p.is_active }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Could not change status.");
      setMessage(!p.is_active ? "Promotion activated." : "Promotion paused."); await load();
    } catch (e) { setFailed(true); setMessage(e instanceof Error ? e.message : "Could not change status."); }
    finally { setBusy(false); }
  }
  async function remove(p: Promotion) {
    if (!confirm(`Remove "${p.title}" permanently?`)) return;
    setBusy(true); setMessage("");
    try {
      const r = await fetch("/api/admin/promotions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Could not remove promotion.");
      if (editing === p.id) reset(); setMessage("Promotion removed."); await load();
    } catch (e) { setFailed(true); setMessage(e instanceof Error ? e.message : "Could not remove promotion."); }
    finally { setBusy(false); }
  }

  return <div style={{ display: "grid", gap: 20 }}>
    <section className="vt-info-card" id="vt-promotion-form">
      <div className="vt-label">{editing ? "EDIT PROMOTION" : "ADD PROMOTION"}</div>
      <h2 style={{ marginTop: 8 }}>{editing ? "Update popup content" : "Create a site popup"}</h2>
      <p className="muted">Only active promotions inside their scheduled dates can appear. The popup stays small in the bottom-left and visitors can close it.</p>
      <form onSubmit={save}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
          <label>Title<input required maxLength={120} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} style={field}/></label>
          <label>Category<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} style={field}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
          <label>CTA button text<input required maxLength={60} value={form.cta_text} onChange={e=>setForm({...form,cta_text:e.target.value})} style={field}/></label>
          <label>Destination URL / path<input required value={form.target_url} onChange={e=>setForm({...form,target_url:e.target.value})} placeholder="/partners or https://" style={field}/></label>
          <label>Image URL (optional)<input type="url" value={form.image_url} onChange={e=>setForm({...form,image_url:e.target.value})} placeholder="https://" style={field}/></label>
          <label>Display order (lower appears first)<input type="number" value={form.display_order} onChange={e=>setForm({...form,display_order:Number(e.target.value)})} style={field}/></label>
          <label>Start showing (optional)<input type="datetime-local" value={form.starts_at} onChange={e=>setForm({...form,starts_at:e.target.value})} style={field}/></label>
          <label>Stop showing (optional)<input type="datetime-local" value={form.ends_at} onChange={e=>setForm({...form,ends_at:e.target.value})} style={field}/></label>
          <label style={{gridColumn:"1 / -1"}}>Description<textarea required maxLength={500} rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} style={field}/></label>
        </div>
        <label style={{display:"flex",gap:10,alignItems:"center",marginTop:16}}><input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})}/> Active on the website</label>
        {message && <p role={failed ? "alert" : "status"} style={{color:failed?"#fca5a5":"#86efac"}}>{message}</p>}
        <div className="vt-actions" style={{justifyContent:"flex-start",marginTop:16}}>
          <button className="vt-primary" type="submit" disabled={busy}>{busy?"Saving…":editing?"Save Changes":"Add Promotion"}</button>
          {editing && <button className="vt-secondary" type="button" onClick={reset} disabled={busy}>Cancel</button>}
        </div>
      </form>
    </section>
    <section className="vt-info-card">
      <div className="vt-label">PROMOTION QUEUE</div><h2 style={{marginTop:8}}>Manage popups</h2>
      {loading ? <p className="muted">Loading…</p> : items.length === 0 ? <p className="muted">No promotions yet.</p> :
        <div style={{display:"grid",gap:12,marginTop:14}}>
          {items.map(p=><article key={p.id} style={{border:"1px solid #303747",borderRadius:10,padding:14}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
              <div style={{flex:"1 1 280px"}}>
                <strong>{p.title}</strong><span className="muted"> · {p.category}</span>
                <p className="muted" style={{margin:"6px 0"}}>{p.description}</p>
                <div className="muted" style={{overflowWrap:"anywhere"}}>{p.target_url}</div>
                <div style={{marginTop:6,color:p.is_active?"#4ade80":"#fbbf24",fontWeight:700}}>{p.is_active?"Active":"Paused"} · Order {p.display_order}</div>
              </div>
              <div className="vt-actions" style={{justifyContent:"flex-start",flexWrap:"wrap"}}>
                <button className="vt-secondary" type="button" disabled={busy} onClick={()=>edit(p)}>Edit</button>
                <button className="vt-secondary" type="button" disabled={busy} onClick={()=>void toggle(p)}>{p.is_active?"Pause":"Activate"}</button>
                <button className="vt-secondary" type="button" disabled={busy} onClick={()=>void remove(p)}>Remove</button>
              </div>
            </div>
          </article>)}
        </div>}
    </section>
  </div>;
}

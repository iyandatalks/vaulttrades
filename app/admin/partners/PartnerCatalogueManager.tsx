"use client";

import { useCallback, useEffect, useState } from "react";

type Partner = {
  id: string; name: string; category: string; referral_code: string | null;
  referral_url: string; cta_text: string; description: string;
  is_published: boolean; sort_order: number;
};
const emptyForm = { name: "", category: "Broker", referral_code: "", referral_url: "", cta_text: "Explore", description: "", is_published: false, sort_order: 0 };
const categories = ["Broker", "Prop Firm", "Tool", "VaultTrades Product"];
const fieldStyle: React.CSSProperties = { width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,.16)", background: "#050812", color: "#f4f6fb" };

export default function PartnerCatalogueManager() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/partners", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load partners.");
      setPartners(json.partners || []);
    } catch (e) { setFailed(true); setMessage(e instanceof Error ? e.message : "Could not load partners."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  function startEdit(p: Partner) {
    setEditingId(p.id);
    setForm({ name: p.name, category: p.category, referral_code: p.referral_code || "", referral_url: p.referral_url, cta_text: p.cta_text, description: p.description, is_published: p.is_published, sort_order: p.sort_order ?? 0 });
    setMessage(""); setFailed(false);
    document.getElementById("partner-catalogue-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function reset() { setEditingId(null); setForm(emptyForm); setMessage(""); setFailed(false); }
  function update<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) { setForm(old => ({ ...old, [key]: value })); }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setFailed(false);
    try {
      const res = await fetch("/api/admin/partners", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { ...form, id: editingId } : form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save partner.");
      reset();
      setMessage(editingId ? "Partner updated." : "Partner added.");
      await load();
    } catch (e) { setFailed(true); setMessage(e instanceof Error ? e.message : "Could not save partner."); }
    finally { setBusy(false); }
  }
  async function togglePublished(p: Partner) {
    setBusy(true); setMessage(""); setFailed(false);
    try {
      const res = await fetch("/api/admin/partners", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, is_published: !p.is_published }) });
      const json = await res.json(); if (!res.ok) throw new Error(json.error || "Could not change visibility.");
      setMessage(!p.is_published ? "Partner published on the public page." : "Partner unpublished and hidden from the public page.");
      await load();
    } catch (e) { setFailed(true); setMessage(e instanceof Error ? e.message : "Could not change visibility."); }
    finally { setBusy(false); }
  }
  async function remove(p: Partner) {
    if (!window.confirm(`Remove "${p.name}" permanently? This cannot be undone.`)) return;
    setBusy(true); setMessage(""); setFailed(false);
    try {
      const res = await fetch("/api/admin/partners", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id }) });
      const json = await res.json(); if (!res.ok) throw new Error(json.error || "Could not remove partner.");
      if (editingId === p.id) reset();
      setMessage(`Removed ${p.name}.`); await load();
    } catch (e) { setFailed(true); setMessage(e instanceof Error ? e.message : "Could not remove partner."); }
    finally { setBusy(false); }
  }

  return <div style={{ display: "grid", gap: 22 }}>
    <section className="vt-info-card" id="partner-catalogue-form">
      <div className="vt-label">{editingId ? "EDIT PARTNER" : "ADD PARTNER"}</div>
      <h2 style={{ marginTop: 8 }}>{editingId ? "Edit partner details and link" : "Add a partner listing"}</h2>
      <p className="muted">Changes are saved to the catalogue. Only published listings appear publicly.</p>
      <form onSubmit={save}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
          <label>Partner name<input required maxLength={120} value={form.name} onChange={e=>update("name",e.target.value)} style={fieldStyle}/></label>
          <label>Category<select value={form.category} onChange={e=>update("category",e.target.value)} style={fieldStyle}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
          <label>Referral code (optional)<input value={form.referral_code} onChange={e=>update("referral_code",e.target.value)} style={fieldStyle}/></label>
          <label>Referral URL<input required type="url" value={form.referral_url} onChange={e=>update("referral_url",e.target.value)} placeholder="https://" style={fieldStyle}/></label>
          <label>Button text<input required maxLength={60} value={form.cta_text} onChange={e=>update("cta_text",e.target.value)} style={fieldStyle}/></label>
          <label>Display order (lower appears first)<input type="number" value={form.sort_order} onChange={e=>update("sort_order",Number(e.target.value))} style={fieldStyle}/></label>
          <label style={{ gridColumn: "1 / -1" }}>Description<textarea required maxLength={1000} rows={3} value={form.description} onChange={e=>update("description",e.target.value)} style={fieldStyle}/></label>
        </div>
        <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 16 }}><input type="checkbox" checked={form.is_published} onChange={e=>update("is_published",e.target.checked)}/> Published on the public Partners page</label>
        {message && <p role={failed ? "alert" : "status"} style={{ color: failed ? "#fca5a5" : "#86efac" }}>{message}</p>}
        <div className="vt-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap", marginTop: 18 }}>
          <button className="vt-primary" type="submit" disabled={busy}>{busy ? "Saving…" : editingId ? "Save Changes" : "Add Partner"}</button>
          {editingId && <button className="vt-secondary" type="button" onClick={reset} disabled={busy}>Cancel Edit</button>}
        </div>
      </form>
    </section>
    <section className="vt-info-card">
      <div className="vt-label">PARTNER CATALOGUE</div><h2 style={{ marginTop: 8 }}>Manage existing partners</h2>
      <p className="muted">Edit links, change visibility or permanently remove a listing.</p>
      {loading ? <p className="muted">Loading partner listings…</p> : partners.length === 0 ? <p className="muted">No catalogue entries yet. Add your first partner above.</p> :
        <div style={{ display: "grid", gap: 12 }}>
          {partners.map(p=><article key={p.id} style={{ border: "1px solid #303747", borderRadius: 10, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "start" }}>
              <div style={{ minWidth: 220, flex: "1 1 300px" }}>
                <strong>{p.name}</strong> <span className="muted">· {p.category}</span>
                <div style={{ marginTop: 6, overflowWrap: "anywhere" }}><a href={p.referral_url} target="_blank" rel="noreferrer" style={{ color: "#d6b56d" }}>{p.referral_url}</a></div>
                <p className="muted" style={{ margin: "7px 0" }}>{p.description}</p>
                <span style={{ color: p.is_published ? "#4ade80" : "#fbbf24", fontWeight: 700 }}>{p.is_published ? "Published" : "Draft / hidden"}</span>
              </div>
              <div className="vt-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
                <button className="vt-secondary" type="button" onClick={()=>startEdit(p)} disabled={busy}>Edit</button>
                <button className="vt-secondary" type="button" onClick={()=>void togglePublished(p)} disabled={busy}>{p.is_published ? "Unpublish" : "Publish"}</button>
                <button className="vt-secondary" type="button" onClick={()=>void remove(p)} disabled={busy}>Remove</button>
              </div>
            </div>
          </article>)}
        </div>}
    </section>
  </div>;
}

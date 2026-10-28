"use client";
import { useState } from "react";
import Link from "next/link";

const categories = ["Broker", "Prop Firm", "Tool", "VaultTrades Product"] as const;
export default function PartnerForm() {
  const [form, setForm] = useState({ name: "", category: "Broker", referral_code: "", referral_url: "", cta_text: "Explore", description: "", is_published: false });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  function update(key: string, value: string | boolean) { setForm((old) => ({ ...old, [key]: value })); }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setFailed(false);
    try {
      const response = await fetch("/api/admin/partners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Partner could not be saved.");
      setMessage(form.is_published ? "Partner saved and published to the public directory." : "Partner saved as a draft. Publish it later from Partner Management.");
      setForm({ name: "", category: "Broker", referral_code: "", referral_url: "", cta_text: "Explore", description: "", is_published: false });
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "Partner could not be saved."); }
    finally { setBusy(false); }
  }
  const inputStyle = { width: "100%", marginTop: 8, padding: 12, borderRadius: 9, border: "1px solid rgba(255,255,255,.12)", background: "#050812", color: "#f4f6fb" };
  return <form onSubmit={submit}>
    <div className="vt-info-grid">
      <label><span className="vt-label">PARTNER NAME</span><input required maxLength={120} value={form.name} onChange={e=>update("name",e.target.value)} placeholder="e.g. Broker or Prop Firm" style={inputStyle}/></label>
      <label><span className="vt-label">CATEGORY</span><select value={form.category} onChange={e=>update("category",e.target.value)} style={inputStyle}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
      <label><span className="vt-label">REFERRAL CODE (OPTIONAL)</span><input value={form.referral_code} onChange={e=>update("referral_code",e.target.value)} placeholder="Optional partner code" style={inputStyle}/></label>
      <label><span className="vt-label">REFERRAL URL</span><input required type="url" value={form.referral_url} onChange={e=>update("referral_url",e.target.value)} placeholder="https://..." style={inputStyle}/></label>
      <label><span className="vt-label">CTA TEXT</span><input required maxLength={60} value={form.cta_text} onChange={e=>update("cta_text",e.target.value)} placeholder="Sign Up / Join Now / Get Tool" style={inputStyle}/></label>
      <label style={{gridColumn:"1 / -1"}}><span className="vt-label">DESCRIPTION</span><textarea required maxLength={1000} value={form.description} onChange={e=>update("description",e.target.value)} placeholder="Short public description" rows={4} style={inputStyle}/></label>
    </div>
    <label style={{display:"flex",gap:10,alignItems:"center",marginTop:18}}><input type="checkbox" checked={form.is_published} onChange={e=>update("is_published",e.target.checked)}/> Publish immediately on the public Partners page</label>
    {message && <p role={failed?"alert":"status"} style={{color:failed?"#fca5a5":"#86efac",marginTop:16}}>{message}</p>}
    <div className="vt-actions" style={{justifyContent:"flex-start",marginTop:20,flexWrap:"wrap"}}><button className="vt-primary" disabled={busy} type="submit">{busy?"Saving…":"Save Partner"}</button><Link className="vt-secondary" href="/admin/partners">Back to Partner Management</Link></div>
  </form>;
}

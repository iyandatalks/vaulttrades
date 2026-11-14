"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Lead = {
  id: string; first_name: string; email: string; cellphone: string; source: string;
  campaign: string | null; created_at: string; partner_status: string;
  partner_notes: string | null; partner_updated_at: string | null;
  partner_display_name: string | null; partner_code: string | null;
};
type Counts = { total: number; new: number; contacted: number; qualified: number; converted: number };

const statusOptions = [
  ["new", "New enquiry"], ["contacted", "Contacted"], ["qualified", "Qualified"],
  ["converted", "Converted"], ["closed", "Closed / not proceeding"],
];

export default function BusinessLeadsClient({ isAdmin, leadCaptureUrl }: { isAdmin: boolean; leadCaptureUrl: string }) {
  const [copiedLink, setCopiedLink] = useState(false);
  async function copyLeadLink() { await navigator.clipboard.writeText(leadCaptureUrl); setCopiedLink(true); window.setTimeout(() => setCopiedLink(false), 1800); }
  const [leads, setLeads] = useState<Lead[]>([]);
  const [counts, setCounts] = useState<Counts>({ total: 0, new: 0, contacted: 0, qualified: 0, converted: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState("new");
  const [draftNotes, setDraftNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [partnerCode, setPartnerCode] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/member-portal/business-leads", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load business leads.");
      setLeads(data.leads ?? []); setCounts(data.counts ?? { total: 0, new: 0, contacted: 0, qualified: 0, converted: 0 }); setPartnerCode(data.partnerCode ?? "");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load business leads."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => filter === "all" ? leads : leads.filter(x => x.partner_status === filter), [leads, filter]);
  function beginEdit(lead: Lead) { setEditing(lead.id); setDraftStatus(lead.partner_status); setDraftNotes(lead.partner_notes ?? ""); setMessage(""); }
  async function copyLeadLink() { await navigator.clipboard.writeText(`https://vaulttradesve.com/start?ref=${partnerCode}`); setCopiedLink(true); window.setTimeout(() => setCopiedLink(false), 1800); }
  async function save(id: string) {
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/member-portal/business-leads", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: draftStatus, notes: draftNotes }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save follow-up.");
      setLeads(current => current.map(x => x.id === id ? { ...x, ...data.lead } : x));
      setEditing(null); setMessage("Follow-up updated.");
      await load();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to save follow-up."); }
    finally { setSaving(false); }
  }

  return <main className="vt-member-shell">
    <header className="vt-member-header">
      <div><span className="vt-member-kicker">VAULTTRADES · PARTNER WORKSPACE</span><h1>Business Leads</h1>
        <p>Track enquiries attributed to your business, record follow-up and move each prospect through your pipeline.</p></div>
      <div className="vt-member-header-actions"><Link href="/member-portal" className="vt-member-outline">Knowledge Base</Link><Link href="/member-portal/reseller-onboarding" className="vt-member-outline">Partner setup</Link></div>
    </header>
    <section className="vt-lead-link-panel">
      <div><span className="vt-member-kicker">YOUR TRACKED ENQUIRY LINK</span><strong>Share this link to receive partner enquiries.</strong><p>Visitors who submit the form through this link and consent to share their details with your business will appear in this dashboard. This is separate from your account-registration referral link.</p><code>{leadCaptureUrl}</code></div>
      <button className="vt-member-button" onClick={() => void copyLeadLink()}>{copiedLink ? "Copied" : "Copy lead link"}</button>
    </section>
    <div className="vt-member-layout" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
      <section className="vt-member-content">
        <div className="vt-lead-link-panel"><div><span className="vt-member-kicker">YOUR TRACKED LEAD LINK</span><strong>Share this link to capture enquiries for your business.</strong><small>Prospects who submit through this link and consent to partner follow-up will appear in your Business Leads workspace.</small><code>https://vaulttradesve.com/start?ref={partnerCode || "…"}</code></div><button className="vt-member-button" onClick={() => void copyLeadLink()} disabled={!partnerCode}>{copiedLink ? "Copied" : "Copy lead link"}</button></div>
        <div className="vt-lead-metrics">
          {([["All enquiries", counts.total], ["New", counts.new], ["Contacted", counts.contacted], ["Qualified", counts.qualified], ["Converted", counts.converted]] as const).map(([label, value]) =>
            <div className="vt-lead-metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}
        </div>
        <div className="vt-lead-toolbar">
          <div><span className="vt-member-kicker">YOUR PROSPECT PIPELINE</span><h2>Enquiries and follow-up</h2></div>
          <select value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filter leads">
            <option value="all">All statuses</option>{statusOptions.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        {error && <div className="vt-member-pending"><strong>Could not load leads</strong><span>{error}</span><button className="vt-member-button" onClick={() => void load()}>Retry</button></div>}
        {loading ? <p>Loading your business leads…</p> : !error && visible.length === 0 ?
          <div className="vt-member-pending"><strong>No attributed enquiries yet.</strong><span>When someone submits the VaultTrades opportunity form through your tracked partner link and agrees to share their details with your business, the enquiry will appear here.</span></div> :
          <div className="vt-lead-list">{visible.map(lead => <article className="vt-lead-card" key={lead.id}>
            <div className="vt-lead-card-head"><div><span className="vt-member-kicker">{new Date(lead.created_at).toLocaleDateString()}</span><h3>{lead.first_name}</h3><small>{lead.partner_display_name || "Partner enquiry"}{lead.partner_code ? " · " + lead.partner_code : ""}</small></div>
              <span className={"vt-lead-status " + lead.partner_status}>{statusOptions.find(x => x[0] === lead.partner_status)?.[1] ?? lead.partner_status}</span></div>
            <div className="vt-lead-contact"><a href={"mailto:" + encodeURIComponent(lead.email)}>{lead.email}</a><a href={"tel:" + lead.cellphone.replace(/[^+\d]/g, "")}>{lead.cellphone}</a><a href={"https://wa.me/" + lead.cellphone.replace(/\D/g, "")} target="_blank" rel="noreferrer">WhatsApp ↗</a></div>
            <div className="vt-lead-meta"><span>Source: {lead.source}</span>{lead.campaign && <span>Campaign: {lead.campaign}</span>}</div>
            {editing === lead.id ? <div className="vt-lead-editor">
              <label>Follow-up status<select value={draftStatus} onChange={e => setDraftStatus(e.target.value)}>{statusOptions.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>Private business follow-up notes<textarea value={draftNotes} onChange={e => setDraftNotes(e.target.value)} maxLength={2000} rows={3} placeholder="Record the last contact, next step or prospect questions. These notes are visible to your business and VaultTrades administrators."/></label>
              <div><button className="vt-member-button" onClick={() => void save(lead.id)} disabled={saving}>{saving ? "Saving…" : "Save follow-up"}</button><button className="vt-member-outline" onClick={() => setEditing(null)}>Cancel</button></div>
            </div> : <div className="vt-lead-followup"><p>{lead.partner_notes || "No follow-up notes recorded."}</p><button className="vt-member-outline" onClick={() => beginEdit(lead)}>Update follow-up</button></div>}
          </article>)}</div>}
        {message && <p className="vt-member-submit-message" role="status">{message}</p>}
        <p className="vt-member-note">Prospect contact details are private business information. Use them only for the purpose covered by the prospect's consent. Existing unassigned leads are not automatically allocated to a partner.</p>
      </section>
    </div>
  </main>;
}

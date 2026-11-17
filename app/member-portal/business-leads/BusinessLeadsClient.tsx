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

export default function BusinessLeadsClient({ isAdmin }: { isAdmin: boolean }) {
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
  const [deleting, setDeleting] = useState(false);

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
  async function removeLead(id: string) {
    if (!window.confirm("Remove this lead from your business leads? This cannot be undone.")) return;
    setDeleting(true); setMessage("");
    try {
      const response = await fetch("/api/member-portal/business-leads", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to remove lead.");
      setMessage("Lead removed."); await load();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to remove lead."); }
    finally { setDeleting(false); }
  }
  async function removeAllLeads() {
    if (!leads.length || !window.confirm("Delete ALL leads currently assigned to your business? This cannot be undone.")) return;
    setDeleting(true); setMessage("");
    try {
      const response = await fetch("/api/member-portal/business-leads", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to clear leads.");
      setMessage(`Removed ${data.deleted ?? 0} leads.`); await load();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to clear leads."); }
    finally { setDeleting(false); }
  }

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
    <div className="vt-member-layout" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
      <section className="vt-member-content">
        <div className="vt-lead-link-panel"><div><span className="vt-member-kicker">YOUR TRACKED LEAD LINK</span><strong>Share this link to capture enquiries for your business.</strong><small>Prospects who submit through this link and consent to partner follow-up will appear in your Business Leads workspace.</small><code>https://vaulttradesve.com/start?ref={partnerCode || "…"}</code></div><button className="vt-member-button" onClick={() => void copyLeadLink()} disabled={!partnerCode}>{copiedLink ? "Copied" : "Copy lead link"}</button></div>
        <div className="vt-lead-metrics">
          {([["All enquiries", counts.total], ["New", counts.new], ["Contacted", counts.contacted], ["Qualified", counts.qualified], ["Converted", counts.converted]] as const).map(([label, value]) =>
            <div className="vt-lead-metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}
        </div>
        <div className="vt-lead-toolbar">
          <div><span className="vt-member-kicker">YOUR PROSPECT PIPELINE</span><h2>Enquiries and follow-up</h2></div><button className="vt-lead-delete-all" onClick={() => void removeAllLeads()} disabled={deleting || leads.length === 0}>Delete all leads</button>
          <select value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filter leads">
            <option value="all">All statuses</option>{statusOptions.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        {error && <div className="vt-member-pending"><strong>Could not load leads</strong><span>{error}</span><button className="vt-member-button" onClick={() => void load()}>Retry</button></div>}
        {loading ? <p>Loading your business leads…</p> : !error && visible.length === 0 ?
          <div className="vt-member-pending"><strong>No attributed enquiries yet.</strong><span>When someone submits the VaultTrades opportunity form through your tracked partner link and agrees to share their details with your business, the enquiry will appear here.</span></div> :
          <div className="vt-lead-list">{visible.map(lead => <article className="vt-lead-row" key={lead.id}>
            <div className="vt-lead-source"><span className="vt-member-kicker">PLATFORM / SOURCE</span><strong>{lead.source || "Website"}</strong>{lead.campaign && <small>{lead.campaign}</small>}</div>
            <div className="vt-lead-person"><span className="vt-member-kicker">NAME</span><strong>{lead.first_name}</strong><small>{new Date(lead.created_at).toLocaleDateString()}</small></div>
            <div className="vt-lead-email"><span className="vt-member-kicker">EMAIL ADDRESS</span><a href={"mailto:" + encodeURIComponent(lead.email)}>{lead.email}</a></div>
            <div className="vt-lead-phone"><span className="vt-member-kicker">CELL PHONE</span><a href={"tel:" + lead.cellphone.replace(/[^+\d]/g, "")}>{lead.cellphone}</a></div>
            <div className="vt-lead-actions"><span className={"vt-lead-status " + lead.partner_status}>{statusOptions.find(x => x[0] === lead.partner_status)?.[1] ?? lead.partner_status}</span>
              <button className="vt-member-outline" onClick={() => beginEdit(lead)}>Follow-up</button>
              <button className="vt-lead-delete" onClick={() => void removeLead(lead.id)} disabled={deleting}>Remove</button>
            </div>
            {editing === lead.id && <div className="vt-lead-editor">
              <label>Follow-up status<select value={draftStatus} onChange={e => setDraftStatus(e.target.value)}>{statusOptions.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>Private business follow-up notes<textarea value={draftNotes} onChange={e => setDraftNotes(e.target.value)} maxLength={2000} rows={2} placeholder="Record the last contact, next step or prospect questions."/></label>
              <div><button className="vt-member-button" onClick={() => void save(lead.id)} disabled={saving}>{saving ? "Saving…" : "Save follow-up"}</button><button className="vt-member-outline" onClick={() => setEditing(null)}>Cancel</button></div>
            </div>}
          </article>)}</div>}
        {message && <p className="vt-member-submit-message" role="status">{message}</p>}
        <p className="vt-member-note">Prospect contact details are private business information. Use them only for the purpose covered by the prospect's consent. Existing unassigned leads are not automatically allocated to a partner.</p>
      </section>
    </div>
  </main>;
}

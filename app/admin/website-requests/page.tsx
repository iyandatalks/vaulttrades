"use client";

import "./website-requests.css";
import { useCallback, useEffect, useState } from "react";

type WebsiteRequest = {
  id: string;
  member_email: string;
  domain_preference: string;
  preferred_name_1: string | null;
  preferred_name_2: string | null;
  preferred_name_3: string | null;
  custom_domain: string | null;
  status: string;
  admin_notes: string | null;
  assigned_domain: string | null;
  submitted_at: string;
};

export default function AdminWebsiteRequestsPage() {
  const [requests, setRequests] = useState<WebsiteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [domains, setDomains] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/website-requests", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to load website requests.");
      setRequests(data.requests || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load requests.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function update(id: string, status: "in_progress" | "ready" | "rejected") {
    setBusy(id); setMessage("");
    try {
      const response = await fetch("/api/admin/website-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, adminNotes: notes[id] || "", assignedDomain: domains[id] || "" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to update request.");
      setMessage("Website request updated and member notified.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update request.");
    } finally { setBusy(""); }
  }

  return <main className="vt-website-admin">
    <header><div><span>ADMIN · WEBSITE SETUP</span><h1>Member website requests</h1><p>Review subdomain choices or custom domains and record the confirmed setup status.</p></div><button onClick={() => void refresh()}>Refresh</button></header>
    {message && <div className="vt-website-message">{message}</div>}
    {loading ? <p>Loading requests…</p> : requests.length === 0 ? <div className="vt-website-empty">No website requests yet.</div> :
      <section className="vt-website-list">{requests.map(row => <article key={row.id}>
        <div className="vt-website-top"><div><span>{row.domain_preference === "vaulttrades_subdomain" ? "VAULTTRADES SUBDOMAIN" : "CUSTOM DOMAIN"}</span><h2>{row.member_email}</h2><p>Submitted {new Date(row.submitted_at).toLocaleString()}</p></div><b className={"vt-website-status " + row.status}>{row.status.replace("_", " ")}</b></div>
        {row.domain_preference === "vaulttrades_subdomain" ? <div className="vt-website-choices"><strong>Preferred names</strong><ol><li>{row.preferred_name_1}.vaulttradesve.com</li><li>{row.preferred_name_2}.vaulttradesve.com</li><li>{row.preferred_name_3}.vaulttradesve.com</li></ol></div> : <div className="vt-website-choices"><strong>Member's domain</strong><p>{row.custom_domain}</p></div>}
        <label>Assigned domain<input value={domains[row.id] ?? row.assigned_domain ?? ""} onChange={event => setDomains(current => ({ ...current, [row.id]: event.target.value }))} placeholder="memberdomain.vaulttradesve.com" /></label>
        <label>Admin notes<textarea rows={2} value={notes[row.id] ?? row.admin_notes ?? ""} onChange={event => setNotes(current => ({ ...current, [row.id]: event.target.value }))} placeholder="Availability, DNS or setup notes" /></label>
        <div className="vt-website-actions">
          <button disabled={busy === row.id} onClick={() => void update(row.id, "in_progress")}>Mark in progress</button>
          <button disabled={busy === row.id} onClick={() => void update(row.id, "ready")}>Mark ready</button>
          <button className="danger" disabled={busy === row.id} onClick={() => void update(row.id, "rejected")}>Request changes</button>
        </div>
      </article>)}</section>}
  </main>;
}

"use client";

import { useCallback, useEffect, useState } from "react";

type RequestRow = {
  id: string;
  user_id: string;
  auth_user_id: string;
  member_email: string;
  broker_name: string;
  broker_server: string | null;
  mt5_login: string;
  product_code: string;
  status: string;
  admin_notes: string | null;
  submitted_at: string;
  license_generated_at: string | null;
};

const productNames: Record<string, string> = {
  nexus: "VaultTrades Nexus",
  nexus_plus: "VaultTrades Nexus Plus",
  vortex: "VaultTrades Vortex",
};

export default function AdminEaLicensingPage() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/ea-licensing", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to load the licensing queue.");
      setRequests(data.requests || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load the licensing queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function updateRequest(id: string, status: "in_progress" | "rejected") {
    setBusyId(id); setMessage("");
    try {
      const response = await fetch("/api/admin/ea-licensing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, adminNotes: notes[id] || "" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to update request.");
      setMessage(status === "in_progress" ? "Request marked as in progress." : "Request rejected and member notified.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update request.");
    } finally { setBusyId(""); }
  }

  async function uploadFile(id: string, form: HTMLFormElement) {
    const formData = new FormData(form);
    const file = formData.get("file");
    if (!(file instanceof File) || !file.size) {
      setMessage("Choose the personalised .ex5 file or .zip package first.");
      return;
    }
    setBusyId(id); setMessage("");
    try {
      const response = await fetch(`/api/admin/ea-licensing/${id}/upload`, { method: "POST", body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.detail || "EA upload failed.");
      setMessage(data.message || "EA uploaded and made available.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "EA upload failed.");
    } finally { setBusyId(""); }
  }

  return (
    <main className="vt-ea-admin">
      <header className="vt-ea-admin-header">
        <div><span>ADMIN · MEMBER LICENSING</span><h1>EA licensing queue</h1><p>Review MT5 account submissions, prepare the personalised EA and upload the member's private download.</p></div>
        <button type="button" onClick={() => void refresh()} className="vt-ea-refresh">Refresh queue</button>
      </header>
      {message && <div className="vt-ea-message" role="status">{message}</div>}
      {loading ? <p className="vt-ea-muted">Loading requests…</p> : requests.length === 0 ? <section className="vt-ea-empty">No MT5 licensing requests have been submitted.</section> :
        <section className="vt-ea-queue">
          {requests.map(row => {
            const due = new Date(new Date(row.submitted_at).getTime() + 48 * 60 * 60 * 1000);
            return <article className="vt-ea-request" key={row.id}>
              <div className="vt-ea-request-top">
                <div><span className="vt-ea-label">{productNames[row.product_code] || row.product_code}</span><h2>{row.member_email}</h2><p>MT5 account: <strong>{row.mt5_login}</strong> · Broker: {row.broker_name}{row.broker_server ? ` · ${row.broker_server}` : ""}</p></div>
                <span className={"vt-ea-status " + row.status}>{row.status.replace("_", " ")}</span>
              </div>
              <div className="vt-ea-meta"><span>Submitted: {new Date(row.submitted_at).toLocaleString()}</span><span>48-hour target: {due.toLocaleString()}</span>{row.license_generated_at && <span>Generated: {new Date(row.license_generated_at).toLocaleString()}</span>}</div>
              {row.status !== "ready" && row.status !== "cancelled" && <div className="vt-ea-controls">
                <label>Admin notes (optional)<textarea value={notes[row.id] ?? row.admin_notes ?? ""} onChange={event => setNotes(current => ({ ...current, [row.id]: event.target.value }))} rows={2} placeholder="Internal note or reason for requesting clarification" /></label>
                <div className="vt-ea-actions">
                  <button type="button" disabled={busyId === row.id} onClick={() => void updateRequest(row.id, "in_progress")}>Mark in progress</button>
                  <button type="button" className="danger" disabled={busyId === row.id} onClick={() => void updateRequest(row.id, "rejected")}>Request correction / reject</button>
                </div>
                <form className="vt-ea-upload" onSubmit={event => { event.preventDefault(); void uploadFile(row.id, event.currentTarget); }}>
                  <label>Upload personalised EA file (.ex5 or .zip)<input type="file" name="file" accept=".ex5,.zip,application/zip,application/octet-stream" required /></label>
                  <button type="submit" disabled={busyId === row.id}>{busyId === row.id ? "Processing…" : "Upload and release to member"}</button>
                </form>
              </div>}
              {row.status === "ready" && <div className="vt-ea-ready">The private download is available to this member in their Knowledge Base.</div>}
              {row.status === "rejected" && row.admin_notes && <p className="vt-ea-notes">Member-facing note: {row.admin_notes}</p>}
            </article>;
          })}
        </section>}
    </main>
  );
}

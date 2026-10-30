"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Notification = {
  id: string; event_type: string; title: string; body: string; severity: "normal"|"warning"|"critical";
  customer_email?: string|null; action_href: string; created_at: string; read_at?: string|null;
};

export default function AdminInboxPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/inbox", { cache: "no-store" });
    const result = await response.json();
    if (response.ok) setItems(result.notifications || []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function markRead(id: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/inbox", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [id] }),
      });
      if (response.ok) setItems(current => current.map(item => item.id === id ? { ...item, read_at: new Date().toISOString() } : item));
    } finally { setBusy(false); }
  }

  const unread = items.filter(item => !item.read_at).length;
  return <main className="vt-info-page"><div className="vt-info-wrap">
    <header className="vt-info-hero">
      <div className="vt-label">VAULTTRADES · ADMIN</div>
      <h1>Admin Inbox</h1>
      <p>Customer support and Copier events in one place. This inbox is available from the website; you do not need to open Supabase to review incoming requests.</p>
      <div className="vt-actions" style={{justifyContent:"flex-start",marginTop:14}}>
        <span className="vt-copy-access-pill">{unread} unread</span>
        <button className="vt-secondary" type="button" onClick={() => void load()}>Refresh</button>
        <Link className="vt-secondary" href="/admin/copy-support">Copier reset requests</Link>
      </div>
    </header>
    <section className="vt-info-card" style={{marginTop:22}}>
      <div className="vt-label">RECENT ACTIVITY</div>
      {items.length === 0 ? <p>No notifications yet. New supported events will appear here.</p> : items.map(item =>
        <article key={item.id} className={`vt-admin-inbox-item ${item.read_at ? "is-read" : "is-unread"}`}>
          <div className="vt-admin-inbox-top">
            <strong>{item.title}</strong>
            <span className={`vt-admin-severity severity-${item.severity}`}>{item.severity}</span>
          </div>
          <p>{item.body}</p>
          <div className="vt-admin-inbox-meta">{item.customer_email || "Customer account"} · {new Date(item.created_at).toLocaleString()} · {item.read_at ? "Read" : "Unread"}</div>
          <div className="vt-admin-inbox-actions">
            <Link className="vt-copy-action" href={item.action_href || "/admin/copy-support"}>Open related section</Link>
            {!item.read_at && <button type="button" className="vt-copy-action-button" disabled={busy} onClick={() => void markRead(item.id)}>Mark read</button>}
          </div>
        </article>
      )}
    </section>
  </div></main>;
}

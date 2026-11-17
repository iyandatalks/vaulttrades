"use client";

import { useState, type FormEvent } from "react";

type Member = {
  id: string; auth_user_id: string; email: string; first_name: string | null; last_name: string | null;
  role: string | null; display_name: string; community_approved: boolean;
  portal_override: "grant" | "revoke" | "automatic"; portal_override_reason: string;
};

export default function AdminAccessManagement() {
  const [query, setQuery] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function search(event?: FormEvent) {
    event?.preventDefault();
    setBusy("search"); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/access-management?q=${encodeURIComponent(query)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Search failed.");
      setMembers(data.members || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Search failed."); }
    finally { setBusy(""); }
  }

  async function act(member: Member | null, action: string, extra: Record<string, unknown> = {}) {
    const key = member?.auth_user_id || "invite";
    setBusy(key + action); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/access-management", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, authUserId: member?.auth_user_id, reason, ...extra }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Action failed.");
      setMessage(data.message || "Saved.");
      if (member) await search();
      if (action === "invite_partner") setEmail("");
    } catch (e) { setError(e instanceof Error ? e.message : "Action failed."); }
    finally { setBusy(""); }
  }

  return <main className="vt-admin-access">
    <style>{`
      .vt-admin-access{max-width:1120px;margin:0 auto;padding:36px 22px 72px;color:#f5f1e8}
      .vt-admin-access .eyebrow{color:#d5b46b;font-size:12px;letter-spacing:.16em;font-weight:700}
      .vt-admin-access h1{font-size:clamp(30px,4vw,42px);margin:10px 0}
      .vt-admin-access .lead{color:#d3d0c8;max-width:780px;line-height:1.65}
      .vt-admin-access .panel{background:#171817;border:1px solid #51452f;border-radius:16px;padding:22px;margin:22px 0}
      .vt-admin-access label{display:block;color:#e8e1d3;font-size:13px;font-weight:600;margin-bottom:8px}
      .vt-admin-access input{width:100%;box-sizing:border-box;background:#0d0f0e;border:1px solid #62553c;border-radius:9px;color:#fff;padding:12px;margin-top:7px}
      .vt-admin-access button{background:#d6b56e;color:#17140d;border:0;border-radius:9px;padding:10px 14px;font-weight:700;cursor:pointer;margin:6px 8px 0 0}
      .vt-admin-access button.secondary{background:#30322f;color:#f1e7d1;border:1px solid #60543b}
      .vt-admin-access button.danger{background:#7b3835;color:#fff}
      .vt-admin-access button:disabled{opacity:.55;cursor:wait}
      .vt-admin-access .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}
      .vt-admin-access .member{border:1px solid #484235;border-radius:12px;padding:16px;background:#101211}
      .vt-admin-access .member h3{margin:0 0 5px;font-size:17px}
      .vt-admin-access .muted{color:#b9b6ad;font-size:13px;line-height:1.5}
      .vt-admin-access .status{display:inline-block;border:1px solid #6b5c3e;border-radius:99px;padding:4px 8px;font-size:11px;margin:8px 5px 8px 0;color:#ead6a5}
      .vt-admin-access .notice{padding:12px 14px;border-radius:9px;background:#20271f;border:1px solid #4d6748;color:#e3f0dc;margin:14px 0}
      .vt-admin-access .error{background:#2b1b1b;border-color:#794544;color:#ffd8d4}
      @media(max-width:600px){.vt-admin-access{padding:24px 14px 50px}.vt-admin-access .panel{padding:16px}}
    `}</style>
    <div className="eyebrow">VAULTTRADES · ADMINISTRATION</div>
    <h1>Access & Partner Management</h1>
    <p className="lead">Use these controls only when the normal automation needs an administrative correction. Manual overrides are recorded and remain separate from payment records, product licences and plan changes.</p>
    <section className="panel">
      <h2>Find a registered account</h2>
      <form onSubmit={search}>
        <label>Search by email, first name or surname<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Enter at least 2 characters" minLength={2} /></label>
        <button disabled={busy === "search" || query.trim().length < 2}>{busy === "search" ? "Searching…" : "Search accounts"}</button>
      </form>
    </section>
    <section className="panel">
      <h2>Invite a new partner</h2>
      <p className="muted">For someone who has not registered yet. This sends a Supabase account invitation. After they complete registration, search for their email above and use Register Partner to assign the partner role.</p>
      <label>Invitation email<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="person@example.com" /></label>
      <button disabled={!email.trim() || busy === "inviteinvite_partner"} onClick={() => void act(null, "invite_partner", { email })}>{busy === "invite" ? "Sending…" : "Send partner invitation"}</button>
    </section>
    <section className="panel">
      <label>Administrative note / reason (optional)<input value={reason} onChange={e => setReason(e.target.value)} maxLength={500} placeholder="e.g. Correcting an automated access sync issue" /></label>
      <p className="muted">This note is stored with the administrative action for audit purposes.</p>
    </section>
    {message && <div className="notice">{message}</div>}
    {error && <div className="notice error">{error}</div>}
    <div className="grid">
      {members.map(member => <article className="member" key={member.auth_user_id}>
        <h3>{member.display_name}</h3>
        <div className="muted">{member.email}</div>
        <span className="status">Role: {member.role || "member"}</span>
        <span className="status">Community: {member.community_approved ? "Approved" : "Not approved"}</span>
        <span className="status">Portal: {member.portal_override === "automatic" ? "Automatic" : `Manual ${member.portal_override}`}</span>
        <div className="muted">Account ID: {member.auth_user_id}</div>
        <h4>Community access</h4>
        <button disabled={!!busy} onClick={() => void act(member, "community_access", { approved: true, displayName: member.display_name })}>Grant Community</button>
        <button className="danger" disabled={!!busy} onClick={() => void act(member, "community_access", { approved: false, displayName: member.display_name })}>Revoke Community</button>
        <h4>Partners Portal access</h4>
        <button disabled={!!busy} onClick={() => void act(member, "portal_override", { decision: "grant" })}>Manual grant</button>
        <button className="danger" disabled={!!busy} onClick={() => void act(member, "portal_override", { decision: "revoke" })}>Manual revoke</button>
        <button className="secondary" disabled={!!busy} onClick={() => void act(member, "portal_override", { decision: "automatic" })}>Return to automation</button>
        <h4>Partner registration</h4>
        {member.role === "partner" || member.role === "reseller"
          ? <span className="status">Registered partner</span>
          : <button disabled={!!busy} onClick={() => void act(member, "register_partner")}>Register Partner</button>}
      </article>)}
    </div>
    {query.trim().length >= 2 && members.length === 0 && !busy && <p className="muted">No matching registered accounts were found.</p>}
  </main>;
}

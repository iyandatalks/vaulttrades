"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import CommunityCalendar from "@/app/member-portal/CommunityCalendar";
import "./community-workspace.css";

type Member = { auth_user_id: string; display_name: string; is_approved: boolean };
type Announcement = { id: string; title: string; body: string; category: string; published_at: string | null; created_at: string };
type Post = { id: string; auth_user_id: string; display_name: string; category: string; title: string; body: string; deal_stage: string | null; moderation_status: string; participation_points: number; is_featured: boolean; created_at: string };
type Comment = { id: string; post_id: string; auth_user_id: string; display_name: string; body: string; created_at: string };
type Leader = { rank: number; display_name: string; verified_deals: number };

const stageLabels: Record<string, string> = { new: "New", contacted: "Contacted", qualified: "Qualified", converted: "Converted", closed: "Closed" };

export default function CommunityWorkspace() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState("feed");
  const [displayName, setDisplayName] = useState("");
  const [postCategory, setPostCategory] = useState("member_discussion");
  const [postTitle, setPostTitle] = useState("");
  const [postBody, setPostBody] = useState("");
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/vaulttrades-community", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Community unavailable.");
      setData(result);
      if (result.member?.display_name) setDisplayName(result.member.display_name);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load the Community."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function submitAction(payload: Record<string, unknown>) {
    setBusy(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/vaulttrades-community", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The action could not be completed.");
      setMessage(result.message || "Saved.");
      await load();
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : "The action could not be completed."); return false; }
    finally { setBusy(false); }
  }

  function requestAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitAction({ action: "request_access", displayName });
  }
  function createPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitAction({ action: "create_post", category: postCategory, title: postTitle, body: postBody }).then(ok => {
      if (ok) { setPostTitle(""); setPostBody(""); }
    });
  }
  function publishAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitAction({ action: "admin_announcement", title: announcementTitle, body: announcementBody }).then(ok => {
      if (ok) { setAnnouncementTitle(""); setAnnouncementBody(""); }
    });
  }

  const posts: Post[] = data?.posts ?? [];
  const announcements: Announcement[] = data?.announcements ?? [];
  const comments: Comment[] = data?.comments ?? [];
  const memberPosts = useMemo(() => posts.filter(post => post.category === "member_discussion" || post.category === "new_business_deal"), [posts]);
  const generalPosts = useMemo(() => posts.filter(post => post.category === "general_discussion" || post.category === "opportunity"), [posts]);
  const isAdmin = Boolean(data?.isAdmin);

  if (loading) return <main className="vt-community-workspace"><div className="vt-cw-loading">Loading your Community workspace…</div></main>;
  if (error && !data) return <main className="vt-community-workspace"><div className="vt-cw-loading"><p>{error}</p><button onClick={() => void load()}>Try again</button></div></main>;

  if (!data?.approved) return (
    <main className="vt-community-workspace">
      <header className="vt-cw-header"><div><span>VAULTTRADES · PRIVATE COMMUNITY</span><h1>Request Community access.</h1><p>The Community is a moderated space for approved participants. Choose the display name other members will see; your account identity remains private.</p></div><Link href="/member-portal" className="vt-cw-back">Knowledge Base</Link></header>
      <form className="vt-cw-panel vt-cw-access-form" onSubmit={requestAccess}>
        <label>Preferred Community display name<input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={48} minLength={2} required placeholder="Choose a name for the Community" /></label>
        <p>Your real account name and email are not shown to other Community members. An administrator must approve your access before you can view posts, sessions or the member directory.</p>
        <button disabled={busy}>{busy ? "Submitting…" : data?.member ? "Update request" : "Request access"}</button>
      </form>
      {message && <p className="vt-cw-message">{message}</p>}{error && <p className="vt-cw-error">{error}</p>}
    </main>
  );

  function renderPost(post: Post) {
    const postComments = comments.filter(comment => comment.post_id === post.id);
    const canComment = post.category === "member_discussion" || post.category === "new_business_deal";
    return <article className="vt-cw-post" key={post.id}>
      <div className="vt-cw-post-top"><div><span>{post.category === "new_business_deal" ? "NEW BUSINESS DEAL" : post.category.replaceAll("_", " ").toUpperCase()}</span><strong>{post.display_name}</strong></div><small>{new Date(post.created_at).toLocaleString("en-ZA")}</small></div>
      <h3>{post.title}</h3><p>{post.body}</p>
      {post.category === "new_business_deal" && <div className="vt-cw-deal-stage">Deal stage: <strong>{stageLabels[post.deal_stage || "new"] || post.deal_stage}</strong>{post.moderation_status === "pending" && <em> · Awaiting verification</em>}</div>}
      {post.moderation_status === "pending" && <div className="vt-cw-pending">Awaiting moderator approval</div>}
      {postComments.length > 0 && <div className="vt-cw-comments">{postComments.map(comment => <div key={comment.id}><strong>{comment.display_name}</strong><p>{comment.body}</p></div>)}</div>}
      {canComment && post.moderation_status === "approved" && <form className="vt-cw-comment-form" onSubmit={event => { event.preventDefault(); const body = commentDrafts[post.id] || ""; void submitAction({ action: "create_comment", postId: post.id, body }).then(ok => { if (ok) setCommentDrafts(current => ({ ...current, [post.id]: "" })); }); }}>
        <input value={commentDrafts[post.id] || ""} onChange={e => setCommentDrafts(current => ({ ...current, [post.id]: e.target.value }))} maxLength={3000} placeholder="Add to this member discussion…" />
        <button disabled={busy || !(commentDrafts[post.id] || "").trim()}>Comment</button>
      </form>}
      {isAdmin && post.moderation_status === "pending" && <div className="vt-cw-admin-actions"><button onClick={() => void submitAction({ action: "moderate_post", id: post.id, approved: true })}>Approve</button><button className="secondary" onClick={() => void submitAction({ action: "moderate_post", id: post.id, approved: false })}>Reject</button></div>}
      {isAdmin && post.category === "new_business_deal" && post.moderation_status === "approved" && <div className="vt-cw-admin-actions"><label>Verify deal stage<select value={post.deal_stage || "new"} onChange={e => void submitAction({ action: "moderate_post", id: post.id, approved: true, dealStage: e.target.value })}>{Object.entries(stageLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>}
    </article>;
  }

  return <main className="vt-community-workspace">
    <header className="vt-cw-header">
      <div><span>VAULTTRADES · PRIVATE COMMUNITY</span><h1>Community.</h1><p>Learn together. Share responsibly. Build business through verified progress.</p><small>Signed in as <strong>{data.member?.display_name || "VaultTrades Admin"}</strong> · Your real account identity remains private to other members.</small></div>
      <div className="vt-cw-header-actions"><Link href="/member-portal" className="vt-cw-back">Knowledge Base</Link>{isAdmin && <span className="vt-cw-admin-tag">ADMINISTRATOR</span>}</div>
    </header>

    <nav className="vt-cw-tabs">
      {[[ "feed", "Community Feed" ],[ "discussions", "Member Discussions" ],[ "deals", "New Business Deals" ],[ "leaderboard", "Business Leaderboard" ],[ "members", "Members" ],[ "sessions", "Sessions & Calendar" ],...(isAdmin ? [[ "admin", "Administration" ]] : [])].map(([value,label]) => <button key={value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}>{label}</button>)}
    </nav>

    {message && <p className="vt-cw-message">{message}</p>}{error && <p className="vt-cw-error">{error}</p>}

    {tab === "feed" && <section className="vt-cw-grid">
      <div className="vt-cw-main">
        <div className="vt-cw-section-heading"><div><span>COMMUNITY UPDATES</span><h2>Announcements & opportunities</h2></div></div>
        {announcements.length ? announcements.map(item => <article className="vt-cw-announcement" key={item.id}><span>{item.category.toUpperCase()}</span><h3>{item.title}</h3><p>{item.body}</p><small>{new Date(item.published_at || item.created_at).toLocaleString("en-ZA")}</small></article>) : <div className="vt-cw-empty">No announcements have been published yet.</div>}
        <div className="vt-cw-section-heading"><div><span>READ-ONLY COMMUNITY POSTS</span><h2>General discussion</h2><p>These posts are published by the Community team for everyone to read. Member replies are kept in the separate discussion area.</p></div></div>
        {generalPosts.length ? generalPosts.map(renderPost) : <div className="vt-cw-empty">No general discussion posts yet.</div>}
      </div>
      <aside className="vt-cw-side"><div className="vt-cw-panel"><span>YOUR COMMUNITY</span><h3>Trade with structure.</h3><p>Keep member discussion constructive. Protect private information and avoid posting account credentials, customer details or personal financial data.</p><button onClick={() => setTab("discussions")}>Join member discussions</button></div><div className="vt-cw-panel"><span>BUSINESS LEADERBOARD</span><h3>Verified progress</h3>{(data.leaderboard || []).slice(0,5).map((row: Leader) => <div className="vt-cw-mini-rank" key={row.rank}><b>#{row.rank} {row.display_name}</b><small>{row.verified_deals} verified deals</small></div>)}{!data.leaderboard?.length && <p>No verified deals yet.</p>}<button className="ghost" onClick={() => setTab("leaderboard")}>View leaderboard</button></div></aside>
    </section>}

    {tab === "discussions" && <section className="vt-cw-column"><div className="vt-cw-section-heading"><div><span>APPROVED MEMBERS</span><h2>Member discussions</h2><p>Posts and comments are moderated before appearing to the Community. General discussion posts remain read-only.</p></div></div>
      <form className="vt-cw-compose" onSubmit={createPost}><h3>Start a discussion</h3><label>Post type<select value={postCategory} onChange={e => setPostCategory(e.target.value)}><option value="member_discussion">Member discussion</option><option value="new_business_deal">New Business Deal</option></select></label><label>Title<input value={postTitle} onChange={e => setPostTitle(e.target.value)} required maxLength={140} /></label><label>Message<textarea value={postBody} onChange={e => setPostBody(e.target.value)} required minLength={5} maxLength={5000} rows={4} /></label><button disabled={busy}>Submit for moderation</button></form>
      {memberPosts.length ? memberPosts.map(renderPost) : <div className="vt-cw-empty">No member discussions or business deals have been submitted yet.</div>}
    </section>}

    {tab === "deals" && <section className="vt-cw-column"><div className="vt-cw-section-heading"><div><span>BUSINESS DEVELOPMENT</span><h2>New Business Deals</h2><p>Record a new deal milestone without posting a customer's name, email, phone number or payment details. VaultTrades administrators verify deal stages before they count on the leaderboard.</p></div></div>
      <div className="vt-cw-deal-rules"><strong>How it works</strong><ol><li>Submit a deal record with a general title and product plan.</li><li>Administrators review and verify its stage.</li><li>Only approved, verified Converted deals count on the leaderboard.</li></ol></div>
      <form className="vt-cw-compose" onSubmit={createDeal}><h3>Submit a deal record</h3><label>Deal title<input value={postTitle} onChange={e => setPostTitle(e.target.value)} required maxLength={140} placeholder="e.g. Nexus Plus enquiry" /></label><label>Deal details<textarea value={postBody} onChange={e => setPostBody(e.target.value)} required maxLength={5000} rows={3} placeholder="Describe the deal stage without including personal customer details." /></label><button disabled={busy}>Submit deal for verification</button></form>
      {posts.filter(post => post.category === "new_business_deal").map(renderPost)}
    </section>}

    {tab === "leaderboard" && <section className="vt-cw-column"><div className="vt-cw-section-heading"><div><span>VERIFIED NEW BUSINESS DEALS</span><h2>Business leaderboard</h2><p>Rankings reflect the number of approved deals verified at the Converted stage. General discussions, comments and journal/P&amp;L activity do not add points here.</p></div></div>
      <div className="vt-cw-rank-list">{(data.leaderboard || []).map((row: Leader) => <div key={row.rank}><b>#{row.rank}</b><strong>{row.display_name}</strong><span>{row.verified_deals} verified converted {row.verified_deals === 1 ? "deal" : "deals"}</span></div>)}</div>
      {!data.leaderboard?.length && <div className="vt-cw-empty">The leaderboard will populate when the first business deal has been verified as Converted.</div>}
    </section>}

    {tab === "members" && <section className="vt-cw-column"><div className="vt-cw-section-heading"><div><span>APPROVED PARTICIPANTS</span><h2>Community members</h2><p>Only the approved display names chosen by members appear here. Real account identities remain private.</p></div></div><div className="vt-cw-member-grid">{(data.members || []).map((item: Member) => <div key={item.auth_user_id}><span>{item.display_name.slice(0,1).toUpperCase()}</span><strong>{item.display_name}</strong></div>)}</div></section>}

    {tab === "sessions" && <section className="vt-cw-column"><div className="vt-cw-section-heading"><div><span>UPCOMING COMMUNITY SESSIONS</span><h2>Meetings & calendar</h2><p>Current-month calendar and private meeting links published by the administrator through the Knowledge Base.</p></div></div><CommunityCalendar isAdmin={isAdmin} /></section>}

    {tab === "admin" && isAdmin && <section className="vt-cw-grid"><div className="vt-cw-main">
      <form className="vt-cw-compose" onSubmit={publishAnnouncement}><h3>Publish a Community announcement</h3><label>Title<input value={announcementTitle} onChange={e => setAnnouncementTitle(e.target.value)} required maxLength={140} /></label><label>Announcement<textarea value={announcementBody} onChange={e => setAnnouncementBody(e.target.value)} required maxLength={5000} rows={4} /></label><button disabled={busy}>Publish announcement</button></form>
      <div className="vt-cw-section-heading"><div><span>MEMBER ACCESS</span><h2>Pending approval requests</h2></div></div>
      {(data.pendingMembers || []).map((item: Member) => <div className="vt-cw-admin-row" key={item.auth_user_id}><strong>{item.display_name}</strong><div><button onClick={() => void submitAction({ action: "approve_member", authUserId: item.auth_user_id, displayName: item.display_name, approved: true })}>Approve</button><button className="secondary" onClick={() => void submitAction({ action: "approve_member", authUserId: item.auth_user_id, displayName: item.display_name, approved: false })}>Revoke</button></div></div>)}
      {!(data.pendingMembers || []).length && <div className="vt-cw-empty">No pending member requests.</div>}
    </div><aside className="vt-cw-side"><div className="vt-cw-panel"><span>MODERATION QUEUE</span><h3>Member submissions</h3>{(data.moderationQueue || []).map((post: Post) => <div className="vt-cw-mini-rank" key={post.id}><b>{post.title}</b><small>{post.display_name} · {post.category.replaceAll("_"," ")}</small><button onClick={() => void submitAction({ action: "moderate_post", id: post.id, approved: true })}>Approve post</button></div>)}{!(data.moderationQueue || []).length && <p>No posts awaiting moderation.</p>}</div></aside></section>}

    <footer className="vt-cw-footer"><span>VAULTTRADES COMMUNITY</span><p>Trade with structure. Manage risk. Execute with discipline.</p><Link href="/member-portal">Return to Knowledge Base ↗</Link></footer>
  </main>;
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Announcement = { id:string; title:string; body:string; category:string; published_at:string|null };
type Post = { id:string; display_name:string; category:string; title:string; body:string; deal_stage:string|null; participation_points:number; is_featured:boolean; created_at:string };
type Data = { announcements:Announcement[]; posts:Post[]; leaderboard:{display_name:string;points:number}[]; memberName:{display_name:string;is_approved:boolean}|null; canPost:boolean; signedIn:boolean; isAdmin:boolean; pendingPosts:Post[]; pendingNames:{auth_user_id:string;display_name:string}[] };
const stages = [["introduced","Introduced"],["conversation_started","Conversation started"],["needs_identified","Needs identified"],["proposal_shared","Proposal shared"],["follow_up","Follow-up"],["won","Won"],["not_proceeding","Not proceeding"]];

export default function CommunityHubClient() {
 const [data,setData]=useState<Data|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [displayName,setDisplayName]=useState("");
 const [title,setTitle]=useState("");
 const [body,setBody]=useState("");
 const [category,setCategory]=useState("general_discussion");
 const [dealStage,setDealStage]=useState("introduced");
 const [announcementTitle,setAnnouncementTitle]=useState("");
 const [announcementBody,setAnnouncementBody]=useState("");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 async function load(){setLoading(true);try{const r=await fetch("/api/community-hub",{cache:"no-store"});const j=await r.json();if(!r.ok)throw new Error(j.error||"Unable to load community.");setData(j);setDisplayName(j.memberName?.display_name??"");}catch(e){setError(e instanceof Error?e.message:"Unable to load community.");}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
 async function action(payload:Record<string,unknown>){setBusy(true);setMessage("");try{const r=await fetch("/api/community-hub",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const j=await r.json();if(!r.ok)throw new Error(j.error||"Action could not be completed.");setMessage(j.message||"Saved.");await load();}catch(e){setMessage(e instanceof Error?e.message:"Action could not be completed.");}finally{setBusy(false);}}
 const nameReady=Boolean(data?.memberName?.is_approved);
 return <main className="vt-community-hub">
  <header className="vch-hero"><nav><Link href="/" className="vch-brand">VAULT<span>TRADES</span></Link><span>TRADE · TECHNOLOGY · BUILD</span><Link href="/member-portal?section=community" className="vch-calendar">MEMBER CALENDAR ↗</Link></nav>
   <div className="vch-hero-copy"><span className="vch-kicker">THE VAULTTRADES COMMUNITY</span><h1>Build with structure.<br/><em>Grow through participation.</em></h1><p>A central space for member updates, shared trading experiences, business development and accountability. The Community stays at VaultTrades; partner websites do not duplicate it.</p><div className="vch-pills"><span>Announcements</span><span>Member progress</span><span>Business opportunities</span><span>Shared learning</span></div></div>
  </header>
  <section className="vch-section"><div className="vch-heading"><div><span className="vch-kicker">LATEST FROM VAULTTRADES</span><h2>Announcements & updates</h2></div></div>
   {loading?<p>Loading announcements…</p>:data?.announcements.length?<div className="vch-announcements">{data.announcements.map(a=><article key={a.id}><small>{a.category} · {a.published_at?new Date(a.published_at).toLocaleDateString():""}</small><h3>{a.title}</h3><p>{a.body}</p></article>)}</div>:<div className="vch-empty">Official announcements and community updates will appear here when published by VaultTrades.</div>}
  </section>
  <section className="vch-section vch-dark"><div className="vch-heading"><div><span className="vch-kicker">COMMUNITY PARTICIPATION</span><h2>Progress, discussions & shared experiences</h2></div><p>Posts are moderated before publication. Member identities appear under approved community names, never real account names.</p></div>
   {data?.posts.length?<div className="vch-posts">{data.posts.map(p=><article key={p.id}><div className="vch-post-meta"><span>{p.category.replaceAll("_"," ")}</span><time>{new Date(p.created_at).toLocaleDateString()}</time></div><h3>{p.title}</h3><p>{p.body}</p><footer><strong>{p.display_name}</strong>{p.category==="new_business_deal"&&p.deal_stage&&<span>Business stage: {stages.find(x=>x[0]===p.deal_stage)?.[1]??p.deal_stage}</span>}</footer></article>)}</div>:<div className="vch-empty">No approved community posts yet. Member discussions and shared experiences will appear here after moderation.</div>}
  </section>
  <section className="vch-section"><div className="vch-heading"><div><span className="vch-kicker">BUSINESS PARTICIPATION</span><h2>Community leaderboard</h2></div><p>Scores are earned only through approved “New Business Deal” posts and verified stage progression. General discussion and trading experiences do not score.</p></div>
   {data?.leaderboard.length?<div className="vch-leaderboard">{data.leaderboard.map((x,i)=><div key={x.display_name}><span>{String(i+1).padStart(2,"0")}</span><strong>{x.display_name}</strong><b>{x.points} pts</b></div>)}</div>:<div className="vch-empty">The leaderboard will populate when approved New Business Deal posts are recorded. No rankings or results are being invented.</div>}
  </section>
  <section className="vch-section vch-dark"><div className="vch-two"><div><span className="vch-kicker">OUR OBJECTIVES</span><h2>What this community is here to build.</h2><ul><li>Encourage structured trading, risk discipline and consistent review.</li><li>Share learning, practical experience and responsible use of technology.</li><li>Support member accountability, mentorship and development.</li><li>Recognise verified business participation and progress.</li><li>Create a place to discover collaboration and project opportunities.</li></ul></div><div><span className="vch-kicker">OPPORTUNITIES</span><h2>Learn, contribute and build.</h2><div className="vch-opportunity"><strong>Training & mentorship</strong><p>Online learning sessions, practical guidance and development resources.</p></div><div className="vch-opportunity"><strong>Business development</strong><p>Share deal progress, learn from participation and explore responsible digital-business activity.</p></div><div className="vch-opportunity"><strong>Projects & collaboration</strong><p>Discover opportunities to contribute skills, ideas and experience across the VaultTrades ecosystem.</p></div></div></div></section>
  <section className="vch-section"><div className="vch-heading"><div><span className="vch-kicker">MEMBER PARTICIPATION</span><h2>Take part in the Community</h2></div><p>Participation is for eligible signed-in members. Public visitors can read approved posts and updates.</p></div>
   {!data?.signedIn?<div className="vch-empty">Sign in to your VaultTrades account to submit a community name and participate. <Link href="/auth/login?next=%2Fcommunity">Sign in ↗</Link></div>:!data?.canPost?<div className="vch-empty">An active VaultTrades membership is required to submit community posts. <Link href="/plans">View membership access ↗</Link></div>:<div className="vch-participation">
    {!nameReady?<div className="vch-name-form"><h3>Choose your public community name</h3><p>This unique name is displayed publicly. Your real name, email and account details remain private.</p><label>Community name<input value={displayName} onChange={e=>setDisplayName(e.target.value)} maxLength={24} placeholder="Choose a unique name"/></label><button disabled={busy||displayName.trim().length<3} onClick={()=>void action({action:"set_name",displayName})}>Submit name for approval</button><small>{data?.memberName&&!data.memberName.is_approved?"Your community name is awaiting administrator approval.":""}</small></div>:<div className="vch-post-form"><h3>Share a discussion or business update</h3><label>Category<select value={category} onChange={e=>setCategory(e.target.value)}><option value="general_discussion">General discussion</option><option value="trading_experience">Trading experience</option><option value="new_business_deal">New business deal</option></select></label>{category==="new_business_deal"&&<label>Current deal stage<select value={dealStage} onChange={e=>setDealStage(e.target.value)}>{stages.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>}<label>Title<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={120}/></label><label>Post<textarea value={body} onChange={e=>setBody(e.target.value)} rows={5} maxLength={2500}/></label><button disabled={busy||title.trim().length<4||body.trim().length<20} onClick={()=>void action({action:"create_post",title,body,category,dealStage})}>Submit for moderation</button></div>}
   </div>}
   {data?.isAdmin&&<div className="vch-admin"><h3>Community administration</h3><div className="vch-admin-form"><label>Announcement title<input value={announcementTitle} onChange={e=>setAnnouncementTitle(e.target.value)}/></label><label>Announcement<textarea rows={3} value={announcementBody} onChange={e=>setAnnouncementBody(e.target.value)}/></label><button disabled={busy||announcementTitle.trim().length<3||announcementBody.trim().length<5} onClick={()=>void action({action:"publish_announcement",title:announcementTitle,body:announcementBody})}>Publish announcement</button></div>
    {data.pendingNames.map(n=><div className="vch-review" key={n.auth_user_id}><span>Community name: <strong>{n.display_name}</strong></span><button onClick={()=>void action({action:"approve_name",authUserId:n.auth_user_id})}>Approve name</button></div>)}
    {data.pendingPosts.map(p=><div className="vch-review" key={p.id}><span><strong>{p.title}</strong> · {p.display_name}</span><button onClick={()=>void action({action:"moderate_post",id:p.id,status:"approved"})}>Approve</button><button className="vch-reject" onClick={()=>void action({action:"moderate_post",id:p.id,status:"rejected"})}>Reject</button></div>)}
   </div>}
   {message&&<p className="vch-message" role="status">{message}</p>}{error&&<p className="vch-message">{error}</p>}
  </section>
  <footer className="vch-footer"><span className="vch-brand">VAULT<span>TRADES</span></span><p>Trade with structure. Manage risk. Execute with discipline.</p><Link href="/opportunity">Explore the VaultTrades opportunity ↗</Link><small>Trading involves risk. Shared experiences and historical progress are not forecasts or guarantees.</small></footer>
 </main>;
}

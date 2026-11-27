"use client";

import { useEffect, useState } from "react";

type Profile = { id: string; email: string; first_name: string | null; last_name: string | null; referral_code: string; };
type WebsiteRequest = { id: string; user_id: string; auth_user_id: string; member_email: string; domain_preference: string; preferred_name_1: string | null; preferred_name_2: string | null; preferred_name_3: string | null; custom_domain: string | null; status: string; admin_notes: string | null; assigned_domain: string | null; submitted_at: string; partner_paypal_nexus_url: string | null; partner_paypal_nexus_plus_url: string | null; partner_paypal_vortex_url: string | null; general_contact_whatsapp: string | null; };
export default function PartnerWebsiteManager() {
  const [users,setUsers] = useState<Profile[]>([]);
  const [requests,setRequests] = useState<WebsiteRequest[]>([]);
  const [profileId,setProfileId] = useState("");
  const [domain,setDomain] = useState("");
  const [generalContactWhatsApp,setGeneralContactWhatsApp] = useState("");
  const [requestId,setRequestId] = useState("");
  const [notes,setNotes] = useState("");
  const [nexusLink,setNexusLink] = useState("");
  const [plusLink,setPlusLink] = useState("");
  const [vortexLink,setVortexLink] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [message,setMessage] = useState("");
  async function load() {
    const r = await fetch("/api/admin/partner-websites",{cache:"no-store"});
    const d = await r.json();
    if(!r.ok) throw new Error(d.error || "Could not load records.");
    setUsers(d.users || []); setRequests(d.requests || []);
  }
  useEffect(()=>{ load().catch(e=>setError(e.message)); },[]);
  async function assign(e:React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const r=await fetch("/api/admin/partner-websites",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({profileId,domain,requestId:requestId||undefined,adminNotes:notes,generalContactWhatsApp})});
      const d=await r.json(); if(!r.ok) throw new Error(d.error||"Assignment failed.");
      setMessage("Website assignment saved. The domain is now linked to the selected partner."); setRequestId(""); setDomain(""); setNotes(""); setGeneralContactWhatsApp(""); await load();
    } catch(e) { setError(e instanceof Error?e.message:"Assignment failed."); } finally { setBusy(false); }
  }
  async function savePaymentLinks(e:React.FormEvent) {
    e.preventDefault(); if(!requestId){setError("Select the partner website request or assignment first.");return;}
    setBusy(true);setError("");setMessage("");
    try { const r=await fetch("/api/admin/partner-websites",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:requestId,action:"payment_links",paymentLinks:{nexus:nexusLink,nexus_plus:plusLink,vortex:vortexLink}})}); const d=await r.json(); if(!r.ok) throw new Error(d.error||"Could not save payment links."); setMessage("Partner PayPal payment links saved. Checkout on this partner domain will now use these links."); await load(); }
    catch(e){setError(e instanceof Error?e.message:"Could not save payment links.");} finally{setBusy(false);}
  }
  async function deactivate(id:string) {
    if(!window.confirm("Deactivate this website assignment? New leads will no longer be accepted through this domain.")) return;
    setBusy(true); setError(""); setMessage("");
    try { const r=await fetch("/api/admin/partner-websites",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,status:"cancelled"})}); const d=await r.json(); if(!r.ok) throw new Error(d.error||"Could not deactivate."); setMessage("Assignment deactivated."); await load(); }
    catch(e){setError(e instanceof Error?e.message:"Could not deactivate.");} finally{setBusy(false);}
  }
  return <div style={{display:"grid",gap:22,marginTop:24}}>
    <section className="vt-info-card"><div className="vt-label">ASSIGN A PARTNER WEBSITE</div><h2 style={{marginTop:8}}>Approve and link a domain</h2><p>Select the partner profile, enter the exact subdomain and the website owner’s public sales WhatsApp number. The recruiter’s number is resolved separately and remains private in the partner profile.</p>
      <form onSubmit={assign} style={{display:"grid",gap:14}}>
        <label>Partner account<select required value={profileId} onChange={e=>setProfileId(e.target.value)} style={field}><option value="">Select partner account</option>{users.map(u=><option key={u.id} value={u.id}>{[u.first_name,u.last_name].filter(Boolean).join(" ")||u.email} · {u.email} · {u.referral_code}</option>)}</select></label>
        <label>Existing website request (optional)<select value={requestId} onChange={e=>{setRequestId(e.target.value);const row=requests.find(x=>x.id===e.target.value);if(row){setProfileId(row.user_id);setDomain(row.assigned_domain||row.custom_domain||row.domain_preference||"");setGeneralContactWhatsApp(row.general_contact_whatsapp||"");setNotes(row.admin_notes||"");setNexusLink(row.partner_paypal_nexus_url||"");setPlusLink(row.partner_paypal_nexus_plus_url||"");setVortexLink(row.partner_paypal_vortex_url||"");}}} style={field}><option value="">Create or update partner's assignment automatically</option>{requests.map(x=><option key={x.id} value={x.id}>{x.member_email} · {x.assigned_domain||x.domain_preference} · {x.status}</option>)}</select></label>
        <label>Assigned domain<input required value={domain} onChange={e=>setDomain(e.target.value)} placeholder="partner.vaulttradesve.com" style={field}/></label>
        <label>General Contact · public sales WhatsApp<input required type="tel" value={generalContactWhatsApp} onChange={e=>setGeneralContactWhatsApp(e.target.value)} placeholder="0630687676" style={field}/><small>This is the website owner’s public business number. The recruiter’s Priority Contact stays private in the partner’s profile.</small></label>
        <label>Admin notes (optional)<textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} style={field}/></label>
        <button disabled={busy||!profileId||!domain.trim()||!generalContactWhatsApp.trim()} style={button}>{busy?"Saving…":"Approve and assign website"}</button>
      </form>
      {error&&<p role="alert" style={{color:"#fca5a5"}}>{error}</p>}{message&&<p role="status" style={{color:"#86efac"}}>{message}</p>}
    </section>
    <section className="vt-info-card"><div className="vt-label">PARTNER CHECKOUT PAYMENT LINKS</div><h2 style={{marginTop:8}}>Assign PayPal links to the selected partner</h2><p>These are the links prospects use to pay the partner membership fee for each plan. They are separate from VaultTrades EA and website setup payments.</p><form onSubmit={savePaymentLinks} style={{display:"grid",gap:12}}><label>VaultTrades Nexus · $120 partner fee<input type="url" value={nexusLink} onChange={e=>setNexusLink(e.target.value)} placeholder="https://www.paypal.com/ncp/payment/..." style={field}/></label><label>VaultTrades Nexus Plus · $200 partner fee<input type="url" value={plusLink} onChange={e=>setPlusLink(e.target.value)} placeholder="https://www.paypal.com/ncp/payment/..." style={field}/></label><label>VaultTrades Vortex · $440 partner fee<input type="url" value={vortexLink} onChange={e=>setVortexLink(e.target.value)} placeholder="https://www.paypal.com/ncp/payment/..." style={field}/></label><button disabled={busy||!requestId} style={button}>{busy?"Saving…":"Save partner payment links"}</button><small>{requestId?"Links will be saved against the selected website request and used by checkout for its assigned domain.":"Select a website request below or above to load its payment-link settings."}</small></form></section>
    <section className="vt-info-card"><div className="vt-label">WEBSITE REQUESTS & ASSIGNMENTS</div><h2 style={{marginTop:8}}>Current records ({requests.length})</h2><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:760}}><thead><tr style={{textAlign:"left"}}>{["Partner / email","Preferred names","Assigned domain","Status","Action"].map(x=><th key={x} style={{padding:10,borderBottom:"1px solid #394150"}}>{x}</th>)}</tr></thead><tbody>{requests.map(x=><tr key={x.id}><td style={{padding:10,borderBottom:"1px solid #303747"}}>{x.member_email}</td><td style={{padding:10,borderBottom:"1px solid #303747"}}>{[x.preferred_name_1,x.preferred_name_2,x.preferred_name_3].filter(Boolean).join(" · ")||"—"}</td><td style={{padding:10,borderBottom:"1px solid #303747"}}>{x.assigned_domain||"Not assigned"}</td><td style={{padding:10,borderBottom:"1px solid #303747"}}>{x.status}</td><td style={{padding:10,borderBottom:"1px solid #303747"}}>{x.assigned_domain&&x.status==="ready"?<button disabled={busy} onClick={()=>deactivate(x.id)} style={button}>Deactivate</button>:<button disabled={busy} onClick={()=>{setRequestId(x.id);setProfileId(x.user_id);setDomain(x.assigned_domain||x.custom_domain||x.domain_preference||"");setGeneralContactWhatsApp(x.general_contact_whatsapp||"");setNotes(x.admin_notes||"");setNexusLink(x.partner_paypal_nexus_url||"");setPlusLink(x.partner_paypal_nexus_plus_url||"");setVortexLink(x.partner_paypal_vortex_url||"");window.scrollTo({top:0,behavior:"smooth"});}} style={button}>Review / assign</button>}</td></tr>)}{requests.length===0&&<tr><td colSpan={5} style={{padding:14}}>No website requests have been submitted yet. You can still assign a domain manually using the form above.</td></tr>}</tbody></table></div></section>
  </div>;
}
const field:React.CSSProperties={width:"100%",padding:12,marginTop:6,borderRadius:8,border:"1px solid #394150",background:"#111827",color:"#f9fafb"};
const button:React.CSSProperties={padding:"11px 16px",borderRadius:8,border:"1px solid #b88b3d",background:"#b88b3d",color:"#111827",fontWeight:700,cursor:"pointer"};

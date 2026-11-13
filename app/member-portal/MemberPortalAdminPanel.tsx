"use client";

import { useEffect, useState } from "react";

type MemberUser={id:string;email:string;first_name:string|null;last_name:string|null};
type LicensingRequest={id:string;user_id:string;member_email:string;broker_name:string;broker_server:string|null;mt5_login:string;product_code:string;status:string;submitted_at:string;license_resource_name:string|null;license_resource_url:string|null};

export default function MemberPortalAdminPanel(){
  const [search,setSearch]=useState("");
  const [users,setUsers]=useState<MemberUser[]>([]);
  const [requests,setRequests]=useState<LicensingRequest[]>([]);
  const [selected,setSelected]=useState("");
  const [resourceName,setResourceName]=useState("");
  const [resourceUrl,setResourceUrl]=useState("");
  const [phone,setPhone]=useState("27746653633");
  const [message,setMessage]=useState("");
  const [loading,setLoading]=useState(false);

  useEffect(()=>{fetch("/api/member-portal/admin",{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject()).then(data=>{if(data.adminWhatsappNumber)setPhone(data.adminWhatsappNumber);}).catch(()=>{});},[]);

  async function searchMembers(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setLoading(true);setMessage("");
    try{
      const response=await fetch(`/api/member-portal/admin?q=${encodeURIComponent(search)}`,{cache:"no-store"});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"Member search failed.");
      setUsers(data.users??[]);setRequests(data.requests??[]);setSelected("");
      if(!(data.users??[]).length)setMessage("No member profile matched that email search.");
    }catch(error){setMessage(error instanceof Error?error.message:"Member search failed.");}
    finally{setLoading(false);}
  }

  async function assignLicense(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(!selected)return;setLoading(true);setMessage("");
    try{
      const response=await fetch("/api/member-portal/admin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"license_assign",requestId:selected,resourceName,resourceUrl})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"Could not assign the licence link.");
      setMessage("The individual EA link has been attached to this member's licensing record. Their Knowledge Base status is now Ready and an in-app notification was created.");
      setResourceName("");setResourceUrl("");
      const refreshed=await fetch(`/api/member-portal/admin?q=${encodeURIComponent(search)}`,{cache:"no-store"}).then(r=>r.json());
      setUsers(refreshed.users??[]);setRequests(refreshed.requests??[]);
    }catch(error){setMessage(error instanceof Error?error.message:"Could not assign the licence link.");}
    finally{setLoading(false);}
  }

  async function savePhone(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setLoading(true);setMessage("");
    try{
      const response=await fetch("/api/member-portal/admin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"settings_update",adminWhatsappNumber:phone})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"Unable to update the number.");
      setPhone(data.adminWhatsappNumber);setMessage("Admin WhatsApp number saved. Future EA submissions will use this number.");
    }catch(error){setMessage(error instanceof Error?error.message:"Unable to update the number.");}
    finally{setLoading(false);}
  }

  const selectedRequest=requests.find(item=>item.id===selected);
  return <section className="vt-member-admin-workspace">
    <span className="vt-member-kicker">PRIVATE ADMINISTRATION</span>
    <h1>Knowledge Base administration.</h1>
    <p className="vt-member-lead">Manage the shared supporting links, publish community meetings and assign personalised EA delivery links to individual member profiles. Files stay in your approved cloud storage; this workspace stores only their names and secure URLs.</p>
    <div className="vt-member-admin-info"><strong>Shared versus individual resources</strong><p>Topic resources are shared with members who have the relevant membership entitlement. EA licence links are different: they are attached to one specific licensing request and are visible only to that member and administrators.</p></div>

    <section className="vt-member-admin-card">
      <h2>Individual EA licence delivery</h2>
      <p>Search for a member by email, select their submitted MT5 request, then add the display name and Google Drive / cloud link for that member's licensed EA.</p>
      <form className="vt-member-form" onSubmit={searchMembers}>
        <label>Search member email<input type="search" minLength={3} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Enter at least 3 characters of the member email"/></label>
        <button className="vt-member-button" type="submit" disabled={loading||search.trim().length<3}>{loading?"Searching…":"Search member"}</button>
      </form>
      {users.length>0&&<div className="vt-member-table-wrap"><table className="vt-member-table"><thead><tr><th>Member</th><th>EA request</th><th>MT5 login</th><th>Status</th><th>Select</th></tr></thead><tbody>
        {requests.map(item=><tr key={item.id}><td>{item.member_email}</td><td>{item.product_code.replace("_"," ").toUpperCase()}</td><td>{item.mt5_login}</td><td>{item.status}</td><td><button type="button" className="vt-member-admin-select" onClick={()=>setSelected(item.id)}>{selected===item.id?"Selected":"Choose request"}</button></td></tr>)}
      </tbody></table></div>}
      {users.length>0&&requests.length===0&&<p className="vt-member-note">Member profile found, but no MT5 licensing request has been submitted for the matching account yet.</p>}
      {selectedRequest&&<form className="vt-member-form" onSubmit={assignLicense}>
        <h3>Assign the licensed EA to {selectedRequest.member_email}</h3>
        <p className="vt-member-form-note">MT5 {selectedRequest.mt5_login} · {selectedRequest.product_code.toUpperCase()} · Submitted {new Date(selectedRequest.submitted_at).toLocaleString()}</p>
        <label>File / resource display name<input required value={resourceName} onChange={e=>setResourceName(e.target.value)} placeholder="e.g. VaultTrades Nexus – Personalised EA"/></label>
        <label>Private file link<input required type="url" value={resourceUrl} onChange={e=>setResourceUrl(e.target.value)} placeholder="https://drive.google.com/..."/></label>
        <button className="vt-member-button" type="submit" disabled={loading}>{loading?"Assigning…":"Attach link to this member's profile"}</button>
      </form>}
    </section>

    <section className="vt-member-admin-card">
      <h2>Admin WhatsApp notification number</h2>
      <p>When a member submits an MT5 licensing request, VaultTrades saves it to the database and creates an admin inbox notification. The member's browser then opens WhatsApp with the exact request details prefilled to this number.</p>
      <form className="vt-member-form" onSubmit={savePhone}>
        <label>WhatsApp number including country code<input required inputMode="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="27746653633"/></label>
        <p className="vt-member-form-note">Use digits with the country code, without a leading plus. Current configured number: {phone}.</p>
        <button className="vt-member-button" type="submit" disabled={loading}>Save WhatsApp number</button>
      </form>
      <p className="vt-member-note">Important: the database submission happens first. WhatsApp opens with the message ready; the member must press Send in WhatsApp. The website cannot silently send a WhatsApp message without an approved WhatsApp Business API integration.</p>
    </section>
    {message&&<p className="vt-member-submit-message" role="status">{message}</p>}
  </section>;
}

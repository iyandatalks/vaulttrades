"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Order = {
  id: string;
  customer_email: string;
  reseller_website: string;
  plan_code: string;
  expected_mrr_amount: number;
  declared_mrr_amount: number;
  reseller_transaction_reference: string;
  reseller_payment_date: string;
  reseller_payment_time: string | null;
  reseller_payment_status: string;
  vaulttrades_payment_status: string;
  created_at: string;
};

const planNames: Record<string,string> = {
  nexus: "VaultTrades Nexus",
  nexus_plus: "VaultTrades Nexus Plus",
  vortex: "VaultTrades Vortex",
};

export default function ResellerPaymentsClient() {
  const [orders,setOrders] = useState<Order[]>([]);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState("");
  const [error,setError] = useState("");
  const [message,setMessage] = useState("");
  const [rejection,setRejection] = useState<Record<string,string>>({});

  async function load() {
    setLoading(true); setError("");
    try {
      const response=await fetch("/api/reseller/purchase-orders",{cache:"no-store"});
      const data=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(data.error||"Unable to load payment declarations.");
      setOrders(data.orders??[]);
    } catch(err) { setError(err instanceof Error?err.message:"Unable to load payment declarations."); }
    finally { setLoading(false); }
  }
  useEffect(()=>{void load();},[]);

  async function review(order:Order,action:"confirm"|"reject") {
    setBusy(order.id);setError("");setMessage("");
    try {
      const response=await fetch("/api/reseller/purchase-orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({orderId:order.id,action,reason:rejection[order.id]??""})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(data.error||"Unable to update this declaration.");
      setMessage(action==="confirm"?"Payment confirmed. The customer's membership access has been activated.":"Declaration rejected. The customer has been notified.");
      await load();
    } catch(err) {setError(err instanceof Error?err.message:"Unable to review payment.");}
    finally {setBusy("");}
  }

  return <main className="vt-member-shell">
    <header className="vt-member-header">
      <div><span className="vt-member-kicker">RESELLER WORKSPACE</span><h1>Payment verification</h1><p>Check your own PayPal account before confirming any customer payment.</p></div>
      <div className="vt-member-header-actions"><Link href="/member-portal" className="vt-member-outline">Knowledge Base</Link><button type="button" className="vt-member-outline" onClick={()=>void load()}>Refresh</button></div>
    </header>
    <article className="vt-member-content">
      <div className="vt-member-pending">
        <strong>Two independent payment checks</strong>
        <span>VaultTrades verifies the website and EA setup payment through its own PayPal checkout. You must independently verify the MRR payment in your own PayPal account. The Confirm action becomes available only after VaultTrades has verified its payment.</span>
      </div>
      {error&&<p className="vt-member-submit-message" role="alert">{error}</p>}
      {message&&<p className="vt-member-submit-message" role="status">{message}</p>}
      {loading?<p>Loading declarations…</p>:orders.length===0?<p>No customer payment declarations have been submitted to your reseller account yet.</p>:<div className="vt-reseller-orders">
        {orders.map(order=><section className="vt-reseller-order" key={order.id}>
          <div className="vt-reseller-order-top"><div><span className="vt-member-kicker">{planNames[order.plan_code]??order.plan_code}</span><h2>{order.customer_email}</h2></div><span className={"vt-reseller-status "+(order.reseller_payment_status==="confirmed_by_reseller"?"is-confirmed":order.reseller_payment_status==="rejected_by_reseller"?"is-rejected":"is-pending")}>{order.reseller_payment_status.replaceAll("_"," ")}</span></div>
          <dl>
            <div><dt>Customer's declared reseller website</dt><dd>{order.reseller_website}</dd></div>
            <div><dt>Expected MRR payment</dt><dd>$${Number(order.expected_mrr_amount).toFixed(2)} USD</dd></div>
            <div><dt>Amount declared paid</dt><dd>$${Number(order.declared_mrr_amount).toFixed(2)} USD</dd></div>
            <div><dt>PayPal transaction / invoice</dt><dd>{order.reseller_transaction_reference}</dd></div>
            <div><dt>Payment date and time</dt><dd>{order.reseller_payment_date}{order.reseller_payment_time ? " · " + order.reseller_payment_time : ""}</dd></div>
            <div><dt>VaultTrades setup payment</dt><dd><span className={order.vaulttrades_payment_status==="verified"?"vt-reseller-verified":"vt-reseller-unverified"}>{order.vaulttrades_payment_status.replaceAll("_"," ")}</span></dd></div>
          </dl>
          {order.reseller_payment_status==="awaiting_reseller_confirmation"&&<div className="vt-reseller-review">
            {order.vaulttrades_payment_status==="verified"?<p>VaultTrades has verified its setup fees. Confirm only after you have checked that the MRR payment appears as received in your PayPal account.</p>:<p>Waiting for VaultTrades to verify the website and EA setup payment. You cannot confirm access yet.</p>}
            <label>Reason (required only if rejecting)<textarea rows={2} value={rejection[order.id]??""} onChange={e=>setRejection(current=>({...current,[order.id]:e.target.value}))} placeholder="Enter a reason if you reject this declaration."/></label>
            <div className="vt-reseller-actions">
              <button type="button" disabled={busy===order.id||order.vaulttrades_payment_status!=="verified"} onClick={()=>void review(order,"confirm")}>{busy===order.id?"Saving…":"Confirm PayPal receipt"}</button>
              <button type="button" className="is-reject" disabled={busy===order.id||!(rejection[order.id]??"").trim()} onClick={()=>void review(order,"reject")}>Reject declaration</button>
            </div>
          </div>}
        </section>)}
      </div>}
    </article>
  </main>;
}

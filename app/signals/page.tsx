"use client";

import { useEffect, useState } from "react";

type Signal = { id:string; trade_id:string; canonical_symbol:string; direction:string; strategy_name:string; timeframe:string; entry:number|null; stop_loss:number|null; tp1:number|null; tp2:number|null; tp3:number|null; tp4:number|null; confidence:number|null; rr:number|null; status:string; fired_at:string; };

function formatAge(firedAt: string, now: number) {
  const elapsed = Math.max(0, now - new Date(firedAt).getTime());
  const totalMinutes = Math.floor(elapsed / 60000);
  if (totalMinutes < 1) return "Issued now";
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `Issued ${days}d ${hours}h ago`;
  if (hours > 0) return `Issued ${hours}h ${minutes}m ago`;
  return `Issued ${minutes}m ago`;
}

export default function SignalsPage(){
  const [signals,setSignals]=useState<Signal[]>([]); const [error,setError]=useState(""); const [now,setNow]=useState(Date.now());
  useEffect(()=>{ const load=async()=>{try{const r=await fetch("/api/signals",{cache:"no-store"});const x=await r.json();if(!r.ok)throw new Error(x.error||"Unable to load signals.");setSignals(x.signals||[]);setError("");}catch(e){setError(e instanceof Error?e.message:"Unable to load signals.");}};void load();const id=setInterval(()=>void load(),15000);return()=>clearInterval(id);},[]);
  useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(id);},[]);
  return <main className="shell">
    <section className="card"><div className="section-label">SIGNAL TAB · AUTOMATED LEDGER</div><h1 className="title">Automated Signals</h1><p className="muted">Signals remain visible in the ledger after they are issued. The age shows how long ago each signal was generated, so you can judge its freshness without relying on a fixed clock time.</p></section>
    <section className="card" style={{marginTop:16}}><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Signal age","Symbol","TF","Strategy","Side","Entry","SL","TP1","TP2","TP3","Confidence","Status"].map(x=><th key={x} style={{textAlign:"left",padding:"10px 8px",fontSize:12,borderBottom:"1px solid rgba(212,166,55,.25)",whiteSpace:"nowrap"}}>{x}</th>)}</tr></thead><tbody>{signals.map(s=>{const isBuy=s.direction.toUpperCase()==="BUY";const isSell=s.direction.toUpperCase()==="SELL";const rowBackground=isBuy?"rgba(34,197,94,.12)":isSell?"rgba(239,68,68,.12)":"transparent";return <tr key={s.id} style={{background:rowBackground}}>{[formatAge(s.fired_at,now),s.canonical_symbol,s.timeframe,s.strategy_name,s.direction,s.entry?.toFixed(2)??"—",s.stop_loss?.toFixed(2)??"—",s.tp1?.toFixed(2)??"—",s.tp2?.toFixed(2)??"—",s.tp3?.toFixed(2)??"—",s.confidence!=null?`${s.confidence}%`:"—",s.status].map((v,i)=><td key={i} style={{padding:"10px 8px",fontSize:12,borderBottom:"1px solid rgba(255,255,255,.06)",whiteSpace:"nowrap",fontWeight:i===4?800:400}}>{v}</td>)}</tr>;})}{!signals.length&&<tr><td colSpan={12} style={{padding:28,textAlign:"center"}} className="muted">Waiting for the scheduled automated signal engine…</td></tr>}</tbody></table></div>{error&&<p style={{color:"#ffb5b5",marginTop:14}}>{error}</p>}</section>
  </main>;
}

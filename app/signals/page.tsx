"use client";

import { useEffect, useState } from "react";

const SIGNAL_MAX_AGE_HOURS = 2;
const SIGNAL_MAX_AGE_MS = SIGNAL_MAX_AGE_HOURS * 60 * 60 * 1000;
type Signal = { id:string; trade_id:string; canonical_symbol:string; direction:string; strategy_name:string; timeframe:string; entry:number|null; stop_loss:number|null; tp1:number|null; tp2:number|null; tp3:number|null; tp4:number|null; confidence:number|null; rr:number|null; status:string; fired_at:string; };

function formatAge(firedAt: string, now: number) {
  const elapsed = Math.max(0, now - new Date(firedAt).getTime());
  const totalMinutes = Math.floor(elapsed / 60000);
  if (totalMinutes < 1) return "Issued now";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `Issued ${hours}h ${minutes}m ago`;
  return `Issued ${minutes}m ago`;
}

export default function SignalsPage(){
  const [signals,setSignals]=useState<Signal[]>([]); const [error,setError]=useState(""); const [now,setNow]=useState(Date.now()); const [refreshing,setRefreshing]=useState(false); const [lastRefreshed,setLastRefreshed]=useState<number|null>(null);
  const load=async()=>{setRefreshing(true);try{const r=await fetch("/api/signals",{cache:"no-store"});const x=await r.json();if(!r.ok)throw new Error(x.error||"Unable to load signals.");setSignals((x.signals||[]).filter((s:Signal)=>Date.now()-new Date(s.fired_at).getTime()<=SIGNAL_MAX_AGE_MS));setError("");setLastRefreshed(Date.now());}catch(e){setError(e instanceof Error?e.message:"Unable to load signals.");}finally{setRefreshing(false);}};
  useEffect(()=>{void load();const id=setInterval(()=>void load(),15000);return()=>clearInterval(id);},[]);
  useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(id);},[]);
  return <main className="shell">
    <section className="card"><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,flexWrap:"wrap"}}><div><div className="section-label">SIGNAL TAB · AUTOMATED LEDGER</div><h1 className="title">Automated Signals</h1><p className="muted">Only newly confirmed signals from the last 2 hours are shown. Signals older than 2 hours are removed from the execution-facing ledger.</p></div><div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}><button type="button" onClick={()=>void load()} disabled={refreshing} style={{padding:"10px 16px",borderRadius:8,border:"1px solid rgba(212,166,55,.45)",background:"rgba(212,166,55,.08)",color:"#d4a637",fontWeight:800,cursor:refreshing?"wait":"pointer"}}>{refreshing?"Refreshing…":"Refresh"}</button>{lastRefreshed&&<span className="muted" style={{fontSize:11}}>Updated {new Date(lastRefreshed).toLocaleTimeString()}</span>}</div></div></section>
    <section className="card" style={{marginTop:16}}><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Signal age","Symbol","TF","Strategy","Side","Entry","SL","TP1","TP2","TP3","Confidence","Status"].map(x=><th key={x} style={{textAlign:"left",padding:"10px 8px",fontSize:12,borderBottom:"1px solid rgba(212,166,55,.25)",whiteSpace:"nowrap"}}>{x}</th>)}</tr></thead><tbody>{signals.map(s=>{const isBuy=s.direction.toUpperCase()==="BUY";const isSell=s.direction.toUpperCase()==="SELL";const rowBackground=isBuy?"rgba(34,197,94,.12)":isSell?"rgba(239,68,68,.12)":"transparent";return <tr key={s.id} style={{background:rowBackground}}>{[formatAge(s.fired_at,now),s.canonical_symbol,s.timeframe,s.strategy_name,s.direction,s.entry?.toFixed(2)??"—",s.stop_loss?.toFixed(2)??"—",s.tp1?.toFixed(2)??"—",s.tp2?.toFixed(2)??"—",s.tp3?.toFixed(2)??"—",s.confidence!=null?`${s.confidence}%`:"—",s.status].map((v,i)=><td key={i} style={{padding:"10px 8px",fontSize:12,borderBottom:"1px solid rgba(255,255,255,.06)",whiteSpace:"nowrap",fontWeight:i===4?800:400}}>{v}</td>)}</tr>;})}{!signals.length&&<tr><td colSpan={12} style={{padding:28,textAlign:"center"}} className="muted">Waiting for a new confirmed automated signal…</td></tr>}</tbody></table></div>{error&&<p style={{color:"#ffb5b5",marginTop:14}}>{error}</p>}</section>
  </main>;
}

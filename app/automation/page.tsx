"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Signal = {
  id:string; signal_id:string; strategy_id:string; strategy_name:string|null; symbol:string; direction:string; timeframe:string;
  entry_price:number; stop_loss:number|null; tp1:number|null; tp2:number|null; tp3:number|null; tp4:number|null; tp5:number|null;
  rr:number|null; confidence:number|null; execution_mode:string; event:string; source:string; generated_at:string; received_at:string;
  tp1_hit_at:string|null; tp2_hit_at:string|null; tp3_hit_at:string|null; tp4_hit_at:string|null; tp5_hit_at:string|null;
  stop_loss_hit_at:string|null; closed_at:string|null; close_reason:string|null; status:string; last_update_at:string;
};

const fmt=(v:number|null|undefined)=>v==null?"—":Number(v).toFixed(2);
const dt=(v:string|null|undefined)=>v?new Date(v).toLocaleString():"—";

export default function AutomationPage(){
  const [signals,setSignals]=useState<Signal[]>([]);
  const [query,setQuery]=useState("");
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState("");
  const [accessChecked,setAccessChecked]=useState(false);

  const load=async(manual=false)=>{
    if(manual)setRefreshing(true);
    try{
      setError("");
      const r=await fetch("/api/automation/signals?ts="+Date.now(),{cache:"no-store"});
      const d=await r.json();
      if(!r.ok) throw new Error(d.error||"Unable to load signals");
      setSignals(d.signals||[]);
    }catch(e){setError(e instanceof Error?e.message:"Unable to load signals");}
    finally{setLoading(false);if(manual)setRefreshing(false);}
  };

  useEffect(()=>{
    void load();
    const timer=window.setInterval(()=>void load(),15000);
    return()=>window.clearInterval(timer);
  },[]);

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    if(!q)return signals;
    return signals.filter(s=>[s.signal_id,s.strategy_id,s.strategy_name,s.symbol,s.direction,s.timeframe,s.status].filter(Boolean).join(" ").toLowerCase().includes(q));
  },[signals,query]);

  const headers=["Signal ID","Strategy","TF","Dir","Entry","SL","TP1","TP2","TP3","TP4","TP5","Generated","TP1 Hit","TP2 Hit","TP3 Hit","TP4 Hit","TP5 Hit","SL Hit","Closed","Status"];

  if(!accessChecked) return <main className="vt-info-page"><div className="vt-info-wrap"><div className="vt-info-card">Checking access…</div></div></main>;\n\n  return <main className="vt-info-page">
    <div className="vt-info-wrap">
      <header className="vt-info-hero">
        <div className="vt-label">VAULTTRADES AUTOMATION</div>
        <h1>TradingView Signal Automation</h1>
        <div className="vt-actions" style={{justifyContent:"flex-start",marginTop:18}}>
          <Link className="vt-secondary" href="/automated-trader/subscribe">Automation — $99.99 / month</Link>
          <button className="vt-secondary" onClick={()=>void load(true)} disabled={refreshing}>{refreshing?"Refreshing…":"Refresh"}</button>
        </div>
      </header>

      <section className="vt-info-card" style={{marginBottom:20}}>
        <div className="vt-label">LIVE CHART</div>
        <div style={{marginTop:12,overflow:"hidden",borderRadius:12,border:"1px solid rgba(212,166,55,.22)",background:"#050812"}}>
          <iframe title="TradingView XAUUSD" src="https://www.tradingview.com/widgetembed/?symbol=OANDA%3AXAUUSD&interval=15&hidesidetoolbar=1&symboledit=1&saveimage=0&toolbarbg=f1f3f6&studies=%5B%5D&theme=dark&style=1&timezone=Africa%2FJohannesburg&withdateranges=1&hideideas=1&hidelegend=0" style={{width:"100%",height:520,border:0}} loading="lazy" />
        </div>
      </section>

      <section className="vt-info-card" style={{marginBottom:20}}>
        <button type="button" className="vt-label" onClick={()=>document.getElementById("signal-search-input")?.focus()} style={{background:"none",border:0,padding:0,cursor:"pointer",textAlign:"left"}}>SIGNAL SEARCH</button>
        <div style={{marginTop:8,color:"#8992a7",fontSize:13}}>Search received signals by signal ID, strategy, timeframe, direction or status.</div>
        <div style={{marginTop:8,color:"#8992a7",fontSize:13}}>Search by Signal ID, strategy, timeframe, direction, or status.</div>\n        <input id="signal-search-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search signal ID, strategy, timeframe, direction or status..." aria-label="Search signals" style={{width:"100%",marginTop:10,padding:"13px 14px",borderRadius:9,border:"1px solid rgba(212,166,55,.25)",background:"#050812",color:"#f4f6fb",outline:"none"}} />{query&&<button className="vt-secondary" onClick={()=>setQuery("")}>Clear</button>}</div>
        <div style={{marginTop:9,color:"#8992a7",fontSize:12}}>{query?`Showing ${filtered.length} matching signal${filtered.length===1?"":"s"}.`:`Showing ${signals.length} received signal${signals.length===1?"":"s"}.`}</div>
      </section>

      <section className="vt-info-card">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <div><div className="vt-label">LIVE SIGNAL FEED</div><h2 style={{margin:"8px 0 0"}}>TradingView Signals</h2></div>
          <div className="vt-status-pill">{loading?"LOADING":String(filtered.length)+" SIGNALS"}</div>
        </div>
        {error&&<div style={{marginTop:14,padding:12,borderRadius:8,background:"rgba(220,70,70,.12)",color:"#ffb5b5"}}>{error}</div>}
        <div style={{marginTop:18,overflowX:"auto"}}>
          <table style={{width:"100%",minWidth:1700,borderCollapse:"collapse",fontSize:12}}>
            <thead><tr>{headers.map(h=><th key={h} style={{textAlign:"left",padding:"10px 9px",borderBottom:"1px solid rgba(255,255,255,.1)",color:"#aeb5c6",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
            <tbody>
              {!loading&&filtered.length===0&&<tr><td colSpan={20} style={{padding:28,textAlign:"center",color:"#8992a7"}}>No TradingView signals have been received yet.</td></tr>}
              {filtered.map(s=><tr key={s.id}>
                <td style={{padding:"10px 9px",whiteSpace:"nowrap",fontWeight:800}}>{s.signal_id}</td>
                <td style={{padding:"10px 9px",whiteSpace:"nowrap"}}>{s.strategy_name||s.strategy_id}</td>
                <td style={{padding:"10px 9px"}}>{s.timeframe}</td>
                <td style={{padding:"10px 9px",fontWeight:900}}>{s.direction}</td>
                <td style={{padding:"10px 9px"}}>{fmt(s.entry_price)}</td><td style={{padding:"10px 9px"}}>{fmt(s.stop_loss)}</td>
                <td style={{padding:"10px 9px"}}>{fmt(s.tp1)}</td><td style={{padding:"10px 9px"}}>{fmt(s.tp2)}</td><td style={{padding:"10px 9px"}}>{fmt(s.tp3)}</td><td style={{padding:"10px 9px"}}>{fmt(s.tp4)}</td><td style={{padding:"10px 9px"}}>{fmt(s.tp5)}</td>
                <td style={{padding:"10px 9px",whiteSpace:"nowrap"}}>{dt(s.generated_at)}</td>
                <td style={{padding:"10px 9px",whiteSpace:"nowrap"}}>{dt(s.tp1_hit_at)}</td><td style={{padding:"10px 9px",whiteSpace:"nowrap"}}>{dt(s.tp2_hit_at)}</td><td style={{padding:"10px 9px",whiteSpace:"nowrap"}}>{dt(s.tp3_hit_at)}</td><td style={{padding:"10px 9px",whiteSpace:"nowrap"}}>{dt(s.tp4_hit_at)}</td><td style={{padding:"10px 9px",whiteSpace:"nowrap"}}>{dt(s.tp5_hit_at)}</td>
                <td style={{padding:"10px 9px",whiteSpace:"nowrap"}}>{dt(s.stop_loss_hit_at)}</td><td style={{padding:"10px 9px",whiteSpace:"nowrap"}}>{dt(s.closed_at)}</td>
                <td style={{padding:"10px 9px",fontWeight:900}}>{s.status}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </main>;
}

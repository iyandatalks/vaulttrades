"use client";

import { useEffect, useState } from "react";

const SIGNAL_MAX_AGE_HOURS = 2;
const SIGNAL_MAX_AGE_MS = SIGNAL_MAX_AGE_HOURS * 60 * 60 * 1000;
type Signal = { id:string; trade_id:string; canonical_symbol:string; direction:string; strategy_name:string; timeframe:string; entry:number|null; stop_loss:number|null; tp1:number|null; tp2:number|null; tp3:number|null; tp4:number|null; confidence:number|null; rr:number|null; status:string; fired_at:string; };
type ScannerConfig = { enabled:boolean; observe_mode:boolean; forex_enabled:boolean; crypto_enabled:boolean; enabled_strategies:string[]; trade_time_start:string; trade_time_end:string; timezone:string; };

function formatAge(firedAt: string, now: number) {
  const elapsed = Math.max(0, now - new Date(firedAt).getTime());
  const totalMinutes = Math.floor(elapsed / 60000);
  if (totalMinutes < 1) return "Issued now";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `Issued ${hours}h ${minutes}m ago`;
  return `Issued ${minutes}m ago`;
}

function formatTime(value:string){ return value.slice(0,5); }

export default function SignalsPage(){
  const [signals,setSignals]=useState<Signal[]>([]); const [error,setError]=useState(""); const [now,setNow]=useState(Date.now()); const [refreshing,setRefreshing]=useState(false); const [lastRefreshed,setLastRefreshed]=useState<number|null>(null);
  const [config,setConfig]=useState<ScannerConfig|null>(null); const [configError,setConfigError]=useState(""); const [savingConfig,setSavingConfig]=useState(false); const [configSaved,setConfigSaved]=useState(false);

  const load=async()=>{setRefreshing(true);try{const r=await fetch("/api/signals",{cache:"no-store"});const x=await r.json();if(!r.ok)throw new Error(x.error||"Unable to load signals.");setSignals((x.signals||[]).filter((s:Signal)=>Date.now()-new Date(s.fired_at).getTime()<=SIGNAL_MAX_AGE_MS));setError("");setLastRefreshed(Date.now());}catch(e){setError(e instanceof Error?e.message:"Unable to load signals.");}finally{setRefreshing(false);}};
  const loadConfig=async()=>{try{const r=await fetch("/api/scanner-automation/config",{cache:"no-store"});const x=await r.json();if(!r.ok)throw new Error(x.error||"Unable to load scanner configuration.");setConfig(x.config);setConfigError("");}catch(e){setConfigError(e instanceof Error?e.message:"Unable to load scanner configuration.");}};
  const saveConfig=async(patch:Partial<ScannerConfig>)=>{if(!config)return;setSavingConfig(true);setConfigSaved(false);try{const next={...config,...patch};const r=await fetch("/api/scanner-automation/config",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(next)});const x=await r.json();if(!r.ok)throw new Error(x.error||"Unable to save scanner configuration.");setConfig(x.config);setConfigError("");setConfigSaved(true);}catch(e){setConfigError(e instanceof Error?e.message:"Unable to save scanner configuration.");}finally{setSavingConfig(false);}};

  useEffect(()=>{void load();void loadConfig();const id=setInterval(()=>void load(),15000);return()=>clearInterval(id);},[]);
  useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(id);},[]);

  return <main className="shell">
    <section className="card">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,flexWrap:"wrap"}}>
        <div><div className="section-label">SIGNAL TAB · AUTOMATED LEDGER</div><h1 className="title">Automated Signals</h1><p className="muted">Only newly confirmed signals from the last 2 hours are shown. Signals older than 2 hours are removed from the execution-facing ledger.</p></div>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}><button type="button" onClick={()=>void load()} disabled={refreshing} style={{padding:"10px 16px",borderRadius:8,border:"1px solid rgba(212,166,55,.45)",background:"rgba(212,166,55,.08)",color:"#d4a637",fontWeight:800,cursor:refreshing?"wait":"pointer"}}>{refreshing?"Refreshing…":"Refresh"}</button>{lastRefreshed&&<span className="muted" style={{fontSize:11}}>Updated {new Date(lastRefreshed).toLocaleTimeString()}</span>}</div>
      </div>
    </section>

    {config&&<section className="card" style={{marginTop:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,flexWrap:"wrap"}}>
        <div><div className="section-label">AUTOMATION CONFIGURATION</div><h2 style={{margin:"6px 0 4px",fontSize:20}}>Signal Feed</h2><p className="muted" style={{margin:0}}>Configure the automated signal feed here. The scanner runs automatically; this does not change the existing entry-confirmation process.</p></div>
        <div style={{fontWeight:800,fontSize:12,padding:"7px 10px",borderRadius:999,border:"1px solid rgba(255,255,255,.12)"}}>{config.enabled?"AUTOMATION ON":"AUTOMATION OFF"}</div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10,marginTop:18}}>
        {[
          ["Automation",config.enabled?"ON":"OFF"],
          ["Observe-only",config.observe_mode?"ON":"OFF"],
          ["Forex / metals",config.forex_enabled?"ON":"OFF"],
          ["Crypto",config.crypto_enabled?"ON":"OFF"],
          ["Trading window",`${formatTime(config.trade_time_start)}–${formatTime(config.trade_time_end)}`],
          ["Timezone",config.timezone],
        ].map(([label,value])=><div key={label} style={{padding:"12px 14px",borderRadius:10,border:"1px solid rgba(255,255,255,.10)",background:"rgba(255,255,255,.025)"}}><div className="muted" style={{fontSize:10,textTransform:"uppercase",letterSpacing:".08em"}}>{label}</div><div style={{fontWeight:800,fontSize:13,marginTop:5}}>{value}</div></div>)}
      </div>

      <div style={{display:"flex",gap:18,flexWrap:"wrap",marginTop:18}}>
        <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,fontWeight:700}}><input type="checkbox" checked={config.enabled} disabled={savingConfig} onChange={e=>void saveConfig({enabled:e.target.checked})}/> Enable scheduled scanner</label>
        <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,fontWeight:700}}><input type="checkbox" checked={config.observe_mode} disabled={savingConfig} onChange={e=>void saveConfig({observe_mode:e.target.checked})}/> Observe-only mode</label>
        <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,fontWeight:700}}><input type="checkbox" checked={config.forex_enabled} disabled={savingConfig} onChange={e=>void saveConfig({forex_enabled:e.target.checked})}/> Forex / metals</label>
        <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,fontWeight:700}}><input type="checkbox" checked={config.crypto_enabled} disabled={savingConfig} onChange={e=>void saveConfig({crypto_enabled:e.target.checked})}/> Crypto</label>
      </div>

      <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginTop:14}}><span className="muted" style={{fontSize:11}}>Strategy: {config.enabled_strategies.includes("autoFibRetrace")?"Vault Auto Fib Retrace + TP Ladder":"Not configured"} · Trading window: {formatTime(config.trade_time_start)}–{formatTime(config.trade_time_end)} · Timezone: {config.timezone}</span>{configSaved&&<span style={{fontSize:11,fontWeight:800}}>Saved</span>}{savingConfig&&<span className="muted" style={{fontSize:11}}>Saving…</span>}</div>
      {configError&&<p style={{color:"#ffb5b5",marginTop:12}}>{configError}</p>}
    </section>}

    {!config&&<section className="card" style={{marginTop:16}}><div className="muted">Loading automation configuration…</div>{configError&&<p style={{color:"#ffb5b5",marginTop:12}}>{configError}</p>}</section>}

    <section className="card" style={{marginTop:16}}><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Signal age","Symbol","TF","Strategy","Side","Entry","SL","TP1","TP2","TP3","Confidence","Status"].map(x=><th key={x} style={{textAlign:"left",padding:"10px 8px",fontSize:12,borderBottom:"1px solid rgba(212,166,55,.25)",whiteSpace:"nowrap"}}>{x}</th>)}</tr></thead><tbody>{signals.map(s=>{const isBuy=s.direction.toUpperCase()==="BUY";const isSell=s.direction.toUpperCase()==="SELL";const rowBackground=isBuy?"rgba(34,197,94,.12)":isSell?"rgba(239,68,68,.12)":"transparent";return <tr key={s.id} style={{background:rowBackground}}>{[formatAge(s.fired_at,now),s.canonical_symbol,s.timeframe,s.strategy_name,s.direction,s.entry?.toFixed(2)??"—",s.stop_loss?.toFixed(2)??"—",s.tp1?.toFixed(2)??"—",s.tp2?.toFixed(2)??"—",s.tp3?.toFixed(2)??"—",s.confidence!=null?`${s.confidence}%`:"—",s.status].map((v,i)=><td key={i} style={{padding:"10px 8px",fontSize:12,borderBottom:"1px solid rgba(255,255,255,.06)",whiteSpace:"nowrap",fontWeight:i===4?800:400}}>{v}</td>)})}{!signals.length&&<tr><td colSpan={12} style={{padding:28,textAlign:"center"}} className="muted">Waiting for a new confirmed automated signal…</td></tr>}</tbody></table></div>{error&&<p style={{color:"#ffb5b5",marginTop:14}}>{error}</p>}</section>
  </main>;
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Account = { id:string|number; metakit_account_id:number; account_name:string|null; mt_login:string; broker_server:string|null; status:string; enabled_instruments:string[]|null };
type Status = { active:boolean; paymentConfigured:boolean; product:any; subscription:any; accounts:Account[] };

const steps = [
  ["01","TradingView", "Your TradingView strategy is the signal source for the automated workflow."],
  ["02","Broker", "Connect the supported broker account to TradingView so the trading account is available for execution."],
  ["03","VaultTrades Access", "Your VaultTrades Access Key authenticates the MT5 execution worker with the VaultTrades service."],
  ["04","MT5 Execution", "Run the VaultTradesExecutionEA on MT5, connect the worker and keep execution in Observe mode until you are ready."],
] as const;

export default function AutomatedTraderPage(){
  const [status,setStatus]=useState<Status|null>(null); const [busy,setBusy]=useState(""); const [error,setError]=useState("");
  const [form,setForm]=useState({name:"",number:"",password:"",brokerId:"",server:""}); const [symbols,setSymbols]=useState<Record<number,string[]>>({}); const [selected,setSelected]=useState<Record<number,string[]>>({});
  const load=async()=>{try{const r=await fetch("/api/automated-trader/status",{cache:"no-store"});if(!r.ok)return;const next=await r.json() as Status;setStatus(next);setSelected(Object.fromEntries(next.accounts.map(a=>[a.metakit_account_id,a.enabled_instruments||["XAUUSD"]])));await Promise.all(next.accounts.map(async a=>{try{const s=await fetch(`/api/automated-trader/metakit/symbols?accountId=${a.metakit_account_id}`,{cache:"no-store"});const d=await s.json();if(s.ok)setSymbols(cur=>({...cur,[a.metakit_account_id]:d.symbols||[]}));}catch{}}));}catch{}};
  useEffect(()=>{void load();},[]);
  const connect=async()=>{setBusy("connect");setError("");try{const r=await fetch("/api/automated-trader/metakit/connect",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to connect MT5 account.");setForm({name:"",number:"",password:"",brokerId:"",server:""});await load();}catch(e){setError(e instanceof Error?e.message:"Unable to connect MT5 account.");}finally{setBusy("");}};
  const disconnect=async(id:number)=>{if(!window.confirm("Disconnect this MT5 account? Any open positions will remain at the broker and will no longer be managed by VaultTrades."))return;setBusy(`disconnect-${id}`);setError("");try{const r=await fetch("/api/automated-trader/metakit/disconnect",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({metakitAccountId:id})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to disconnect account.");await load();}catch(e){setError(e instanceof Error?e.message:"Unable to disconnect account.");}finally{setBusy("");}};
  const save=async(id:number)=>{setBusy(`save-${id}`);setError("");try{const r=await fetch("/api/automated-trader/metakit/settings",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({metakitAccountId:id,enabledInstruments:selected[id]||[]})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to save instrument permissions.");await load();}catch(e){setError(e instanceof Error?e.message:"Unable to save instrument permissions.");}finally{setBusy("");}};
  const toggle=(id:number,symbol:string)=>setSelected(cur=>{const list=cur[id]||[];return {...cur,[id]:list.includes(symbol)?list.filter(x=>x!==symbol):[...list,symbol]};});
  return <main className="shell" style={{maxWidth:1180,margin:"0 auto",padding:"34px 20px 48px"}}>
    <section className="card" style={{textAlign:"center",padding:"44px 28px"}}>
      <div className="section-label">AUTOMATED TRADER</div>
      <h1 className="title" style={{fontSize:40,lineHeight:1.1,margin:"14px auto 12px"}}>TradingView to MT5<br/>through VaultTrades</h1>
      <p className="muted" style={{maxWidth:720,margin:"0 auto"}}>Connect the signal source, broker and MT5 execution worker in a controlled sequence. No video is required to understand the setup.</p>
      {status?.active?<button disabled style={{marginTop:22,padding:"13px 25px",borderRadius:9,border:0,fontWeight:900,background:"#d4a637",color:"#050812"}}>Subscription Active</button>:<Link href="/automated-trader/subscribe" style={{display:"inline-flex",alignItems:"center",justifyContent:"center",marginTop:22,padding:"13px 25px",borderRadius:9,background:"#d4a637",color:"#050812",fontWeight:900,textDecoration:"none"}}>Let's Get Started</Link>}
    </section>

    <section style={{marginTop:24,textAlign:"center"}}>
      <div className="section-label">HOW THE CONNECTION WORKS</div>
      <h2 className="title" style={{fontSize:30,margin:"8px auto 10px"}}>Four clear steps from signal to execution</h2>
      <p className="muted" style={{maxWidth:720,margin:"0 auto 22px"}}>TradingView remains the strategy signal source. VaultTrades provides the controlled handoff to the MT5 execution worker.</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14}}>{steps.map(([n,t,d])=><article key={n} style={{minHeight:205,padding:"22px 20px",borderRadius:14,background:"linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.018))",border:"1px solid rgba(212,166,55,.20)",textAlign:"left"}}><span style={{display:"grid",placeItems:"center",width:38,height:38,borderRadius:10,background:"rgba(212,166,55,.12)",color:"#d4a637",fontWeight:900}}>{n}</span><h3 style={{margin:"20px 0 8px",fontSize:18}}>{t}</h3><p className="muted" style={{margin:0,lineHeight:1.6,fontSize:13}}>{d}</p></article>)}</div>
    </section>

    <section className="vt-connection" style={{marginTop:24}}>
      <article className="vt-status-card">
        <div className="vt-label">CONNECTION CHECKLIST</div>
        <h2 style={{margin:"10px 0 4px",fontSize:25}}>Know what is connected</h2>
        <div className="vt-status-row"><span className="vt-status-name">TradingView strategy</span><span className="vt-status-pill">SIGNAL SOURCE</span></div>
        <div className="vt-status-row"><span className="vt-status-name">Broker in TradingView</span><span className="vt-status-pill">BROKER</span></div>
        <div className="vt-status-row"><span className="vt-status-name">VaultTrades Access Key</span><span className="vt-status-pill">EA AUTH</span></div>
        <div className="vt-status-row"><span className="vt-status-name">MT5 Execution EA</span><span className="vt-status-pill">WORKER</span></div>
        <p className="muted" style={{margin:"16px 0 0"}}>The dashboard will show connection state as the backend connection/heartbeat capability is added. Do not enter secrets into public text fields.</p>
      </article>
      <article className="vt-technical">
        <div className="vt-label">CURRENT MT5 EA CONFIGURATION</div>
        <h2 style={{margin:"10px 0 8px",fontSize:22}}>The technical inputs are preserved.</h2>
        <p>These are the configuration values shown in the current VaultTradesExecutionEA setup. The dashboard explains them so the customer does not need to understand the EA inputs before starting.</p>
        <ul>
          <li><code>InpVaultTradesBaseUrl</code> — <strong>https://vaulttrades.vercel.app</strong></li>
          <li><code>InpAccessKey</code> — secure VaultTrades authentication key</li>
          <li><code>InpWorkerId</code> — <strong>mt5-ea</strong></li>
          <li><code>InpPollSeconds</code> — <strong>5 seconds</strong></li>
          <li><code>InpExecutionMode</code> — <strong>OBSERVE</strong></li>
          <li><code>InpEnableLiveExecution</code> — <strong>false</strong> until deliberately enabled</li>
          <li><code>InpVolume</code> — <strong>0.01</strong> in the current configuration</li>
          <li><code>InpDeviationPoints</code> — <strong>30</strong> in the current configuration</li>
        </ul>
      </article>
    </section>

    <section className="card" style={{marginTop:24,textAlign:"center",padding:"30px 26px"}}>
      <div className="section-label">MT5 ACCOUNT</div>
      <h2 className="title" style={{fontSize:27,margin:"8px auto"}}>Connect your MetaTrader 5 account</h2>
      <p className="muted" style={{maxWidth:700,margin:"0 auto"}}>Connect a full MetaKit execution account. VaultTrades does not store the MT5 password.</p>
      <div style={{display:"grid",gap:12,gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",margin:"22px auto 0",maxWidth:980,textAlign:"left"}}>{([['name','Account name'],['number','MT5 login'],['password','Master password'],['brokerId','Broker ID'],['server','Exact broker server']] as const).map(([key,label])=><label key={key} style={{display:"grid",gap:6,color:"#aeb5c6",fontSize:12}}><span>{label}</span><input type={key==='password'?'password':'text'} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})} style={{padding:12,borderRadius:8,border:"1px solid rgba(212,166,55,.25)",background:"#050812",color:"#f4f6fb"}}/></label>)}</div>
      <button disabled={busy==="connect"} onClick={()=>void connect()} style={{marginTop:18,padding:"12px 22px",borderRadius:8,border:0,background:"#d4a637",color:"#050812",fontWeight:900}}>{busy==="connect"?"Connecting...":"Connect MT5"}</button>
      {status?.accounts.map(account=>{const options=[...new Set([...(symbols[account.metakit_account_id]||[]),...(selected[account.metakit_account_id]||[])])].sort();return <div key={account.id} style={{margin:"24px auto 0",maxWidth:980,textAlign:"left",padding:20,borderRadius:12,background:"#050812",border:"1px solid rgba(212,166,55,.2)"}}><div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}><div><strong>{account.account_name||`MT5 ${account.mt_login}`}</strong><div className="muted" style={{marginTop:5}}>{account.broker_server||"server pending"} · {account.status}</div></div><button disabled={busy===`disconnect-${account.metakit_account_id}`} onClick={()=>void disconnect(account.metakit_account_id)} style={{padding:"9px 13px",borderRadius:7,border:"1px solid rgba(239,68,68,.45)",background:"transparent",color:"#ffb5b5",fontWeight:800}}>{busy===`disconnect-${account.metakit_account_id}`?"Disconnecting...":"Disconnect"}</button></div><div style={{marginTop:16}}><div className="section-label">INSTRUMENT PERMISSIONS</div><p className="muted">Enable only the broker instruments the automated trader may use.</p><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:8,marginTop:10}}>{options.length?options.map(symbol=>{const checked=(selected[account.metakit_account_id]||[]).includes(symbol);return <label key={symbol} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 10px",borderRadius:7,background:checked?"rgba(212,166,55,.10)":"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.08)",cursor:"pointer"}}><input type="checkbox" checked={checked} onChange={()=>toggle(account.metakit_account_id,symbol)}/><span>{symbol}</span></label>}) : <span className="muted">Broker instruments are loading…</span>}</div><button disabled={busy===`save-${account.metakit_account_id}`} onClick={()=>void save(account.metakit_account_id)} style={{marginTop:12,padding:"10px 14px",borderRadius:7,border:"1px solid rgba(212,166,55,.45)",background:"transparent",color:"#d4a637",fontWeight:800}}>{busy===`save-${account.metakit_account_id}`?"Saving...":"Save instrument permissions"}</button></div></div>})}
    </section>
    {error&&<div style={{marginTop:16,padding:14,borderRadius:8,background:"rgba(220,70,70,.12)",color:"#ffb5b5",textAlign:"center"}}>{error}</div>}
    <section style={{marginTop:22,padding:"18px 12px 28px",textAlign:"center",color:"#8992a7",fontSize:12,lineHeight:1.7}}>Trading involves risk. Past performance does not guarantee results. Automated execution does not guarantee profits.</section>
  </main>;
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Plan = { id?: string; currency: string; starting_capital: number; monthly_income_goal: number; buffer_target: number; months: number; monthly_returns: number[] };
const defaults: Plan = { currency: "USD", starting_capital: 50000, monthly_income_goal: 500, buffer_target: 5000, months: 12, monthly_returns: [3,4,0.5,2,-1,3,2,2,2,2,2,2] };
const money=(v:number,c:string)=>new Intl.NumberFormat(undefined,{style:"currency",currency:c,maximumFractionDigits:2}).format(v);

export default function FundedAccountWealthBuilder(){
 const [plan,setPlan]=useState<Plan>(defaults); const [userId,setUserId]=useState<string|null>(null); const [saving,setSaving]=useState(false); const [saved,setSaved]=useState(false);
 useEffect(()=>{(async()=>{const sb=createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);const {data:a}=await sb.auth.getUser();if(!a.user)return;const {data:u}=await sb.from("users").select("id").eq("auth_user_id",a.user.id).single();if(!u)return;setUserId(u.id);const {data:p}=await sb.from("prop_firm_wealth_plans").select("*").eq("user_id",u.id).in("name",["My Funded Account Plan","My Prop Firm Plan"]).order("updated_at",{ascending:false}).limit(1).maybeSingle();if(p)setPlan({...defaults,...p,monthly_returns:Array.isArray(p.monthly_returns)?p.monthly_returns:defaults.monthly_returns});})();},[]);
 const projection=useMemo(()=>{let equity=Number(plan.starting_capital)||0;const rows:number[]=[];for(let i=0;i<Math.max(1,plan.months);i++){const r=Number(plan.monthly_returns[i]??0)/100;equity*=1+r;rows.push(equity);}const end=equity;const growth=end-(Number(plan.starting_capital)||0);const buffer=Math.max(0,growth);const income=Math.min(buffer,Number(plan.monthly_income_goal)||0);const runway=income>0?buffer/income:0;return {rows,end,growth,buffer,income,runway};},[plan]);
 const set=(key:keyof Plan,value:string)=>setPlan(p=>({...p,[key]:key==='currency'||key==='months'?key==='months'?Math.max(1,Math.min(60,Number(value)||1)):value:Math.max(0,Number(value)||0)}));
 const save=async()=>{if(!userId)return;setSaving(true);setSaved(false);const sb=createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);const {error}=await sb.from("prop_firm_wealth_plans").upsert({user_id:userId,name:"My Funded Account Plan",currency:plan.currency,starting_capital:plan.starting_capital,monthly_income_goal:plan.monthly_income_goal,buffer_target:plan.buffer_target,months:plan.months,monthly_returns:plan.monthly_returns,updated_at:new Date().toISOString()},{onConflict:"user_id,name"});setSaving(false);setSaved(!error);};
 return <section className="card" style={{margin:"24px 0 0",border:"1px solid rgba(212,166,55,.35)"}}><div className="section-label">FUNDED ACCOUNT WEALTH BUILDER</div><h2 style={{margin:"8px 0"}}>Build Equity → Build Buffer → Create Income</h2><p className="muted">A Founders benefit for planning capital growth without forcing trades. Use the capital base for personal trading, one funded account, or the combined capital of multiple funded accounts. The model remains capital-agnostic and compounds only the monthly assumptions you enter.</p>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12,marginTop:18}}>
  <label>Currency<select value={plan.currency} onChange={e=>set("currency",e.target.value)}><option>USD</option><option>ZAR</option><option>GBP</option><option>EUR</option></select></label>
  <label>Capital Base<input type="number" min="1" value={plan.starting_capital} onChange={e=>set("starting_capital",e.target.value)}/></label>
  <label>Monthly Income Goal<input type="number" min="0" value={plan.monthly_income_goal} onChange={e=>set("monthly_income_goal",e.target.value)}/></label>
  <label>Buffer Target<input type="number" min="0" value={plan.buffer_target} onChange={e=>set("buffer_target",e.target.value)}/></label>
  <label>Projection Months<input type="number" min="1" max="60" value={plan.months} onChange={e=>set("months",e.target.value)}/></label>
 </div>
 <div style={{marginTop:18}}><strong>Monthly Return Assumptions (%)</strong><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(90px,1fr))",gap:8,marginTop:10}}>{Array.from({length:plan.months},(_,i)=><label key={i} style={{fontSize:12}}>M{i+1}<input type="number" step="0.1" value={plan.monthly_returns[i]??0} onChange={e=>setPlan(p=>{const a=[...p.monthly_returns];a[i]=Number(e.target.value)||0;return {...p,monthly_returns:a};})}/></label>)}</div></div>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginTop:20}}>
  <div className="condition-box"><span className="muted">Projected Equity</span><h3>{money(projection.end,plan.currency)}</h3></div>
  <div className="condition-box"><span className="muted">Equity Built</span><h3>{money(projection.growth,plan.currency)}</h3></div>
  <div className="condition-box"><span className="muted">Buffer Target</span><h3>{money(plan.buffer_target,plan.currency)}</h3></div>
  <div className="condition-box"><span className="muted">Income Capacity</span><h3>{money(projection.income,plan.currency)}/mo</h3></div>
  <div className="condition-box"><span className="muted">Freedom Runway</span><h3>{projection.runway.toFixed(1)} months</h3></div>
 </div>
 <p className="muted" style={{marginTop:16}}>Planning note: a negative or 0% month does not force a trade. The model compounds the assumptions you enter; income capacity is a planning estimate, not a guaranteed return or passive-income promise. For multiple funded accounts, use their combined capital as the capital base when modelling the portfolio as one wealth-building plan.</p>
 <button className="button" type="button" onClick={save} disabled={saving}>{saving?"Saving…":saved?"Plan Saved":"Save Wealth Plan"}</button>
 </section>;
}

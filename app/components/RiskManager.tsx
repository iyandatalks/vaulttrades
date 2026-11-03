"use client";

import { useMemo, useState } from "react";

type Props = { initialEntry?: number | null; initialStop?: number | null; initialTp1?: number | null; initialTp2?: number | null; symbol?: string };
type AccountType = "Instant Prime" | "Instant Funding" | "1-Step FLASH" | "1-Step NOVA" | "2-Step PRO v2";
type Stage = "Evaluation" | "Funded";
type Platform = "MT5" | "MatchTrader";
const num=(v:string)=>{const n=Number(v);return Number.isFinite(n)?n:0};
const money=(v:number)=>v.toLocaleString(undefined,{style:"currency",currency:"USD",maximumFractionDigits:2});
const fmt=(v:number,d=2)=>v.toLocaleString(undefined,{maximumFractionDigits:d});
const clamp=(v:number,min=0,max=100)=>Math.min(max,Math.max(min,v));

type FieldProps = {label:string;value:number;set:(v:number)=>void;step?:string};
function Field({label,value,set,step="any"}:FieldProps){
 const [text,setText]=useState(String(value));
 return <label style={{display:"block",minWidth:0}}>
  <span style={{color:"#aeb5c6",fontSize:10,fontWeight:800,letterSpacing:".07em"}}>{label}</span>
  <input type="number" step={step} value={text} onChange={e=>{setText(e.target.value);if(e.target.value!==""&&Number.isFinite(Number(e.target.value)))set(Number(e.target.value));}} onBlur={()=>{if(text==="")setText(String(value));}} style={{width:"100%",boxSizing:"border-box",marginTop:6,padding:"10px 11px",borderRadius:8,border:"1px solid rgba(212,166,55,.28)",background:"#050812",color:"#f4f6fb"}}/>
 </label>;
}
function SelectField({label,value,options,onChange}:{label:string;value:string;options:string[];onChange:(v:string)=>void}){
 return <label style={{display:"block",minWidth:0}}><span style={{color:"#aeb5c6",fontSize:10,fontWeight:800,letterSpacing:".07em"}}>{label}</span><select value={value} onChange={e=>onChange(e.target.value)} style={{display:"block",width:"100%",marginTop:6,padding:"10px 11px",borderRadius:8,border:"1px solid rgba(212,166,55,.28)",background:"#050812",color:"#f4f6fb"}}>{options.map(o=><option key={o} value={o}>{o}</option>)}</select></label>;
}
const rules:Record<AccountType,{daily:number|null;max:number;drawdown:"trailing"|"static";target:number|null;split:number;minPayout:number;payoutDays:number;consistency:number|null;ess:number|null;maxDailyProfit:number|null;note:string}> = {
 "Instant Prime":{daily:2.5,max:5,drawdown:"trailing",target:null,split:80,minPayout:2,payoutDays:14,consistency:null,ess:20,maxDailyProfit:null,note:"Funded account. 20% Equity Stability Score applies."},
 "Instant Funding":{daily:3,max:6,drawdown:"trailing",target:null,split:60,minPayout:2,payoutDays:30,consistency:15,ess:null,maxDailyProfit:null,note:"Funded account. 15% consistency score applies; initial split is 60%."},
 "1-Step FLASH":{daily:4,max:7,drawdown:"trailing",target:10,split:80,minPayout:2,payoutDays:14,consistency:null,ess:null,maxDailyProfit:3,note:"One evaluation phase; funded account has a 3% maximum daily profit rule."},
 "1-Step NOVA":{daily:3,max:5,drawdown:"trailing",target:5,split:90,minPayout:2,payoutDays:14,consistency:null,ess:20,maxDailyProfit:null,note:"Evaluation: 6% trailing drawdown and no daily loss limit. Funded: 3% daily loss and 5% trailing drawdown."},
 "2-Step PRO v2":{daily:4,max:9,drawdown:"static",target:8,split:85,minPayout:3,payoutDays:14,consistency:null,ess:null,maxDailyProfit:3000,note:"Phase 1 target 8%; Phase 2 target 5%. Static 9% maximum loss. Funded max daily profit is $3,000 for accounts below $300k."}
};
const panel:React.CSSProperties={padding:13,borderRadius:10,background:"rgba(45,125,255,.06)",border:"1px solid rgba(45,125,255,.22)"};
const stat:React.CSSProperties={padding:12,borderRadius:9,border:"1px solid rgba(212,166,55,.28)",background:"rgba(255,255,255,.02)",minWidth:0};

export default function RiskManager({initialEntry=null,initialStop=null,initialTp1=null,initialTp2=null,symbol="XAU/USD"}:Props){
 const [accountType,setAccountType]=useState<AccountType>("Instant Funding");
 const [stage,setStage]=useState<Stage>("Funded");
 const [phase,setPhase]=useState("Phase 1");
 const [platform,setPlatform]=useState<Platform>("MT5");
 const [account,setAccount]=useState(5000);
 const [margin,setMargin]=useState(5000);
 const [dailyReference,setDailyReference]=useState(5000);
 const [dailyUsed,setDailyUsed]=useState(0);
 const [highWater,setHighWater]=useState(5000);
 const [equity,setEquity]=useState(5000);
 const [riskPct,setRiskPct]=useState(.25);
 const [personalDailyStop,setPersonalDailyStop]=useState(.75);
 const [dailyTargetPct,setDailyTargetPct]=useState(.30);
 const [monthlyDays,setMonthlyDays]=useState(20);
 const [monthlyProfitGoal,setMonthlyProfitGoal]=useState(6);
 const [entry,setEntry]=useState(initialEntry??0),[sl,setSl]=useState(initialStop??0),[tp1,setTp1]=useState(initialTp1??0),[tp2,setTp2]=useState(initialTp2??0);
 const [valuePerMove,setValuePerMove]=useState(100),[marginPerLot,setMarginPerLot]=useState(1000),[lotStep,setLotStep]=useState(.01),[maxOpenLots,setMaxOpenLots]=useState(20);
 const [withdrawal,setWithdrawal]=useState(0);
 const selected=rules[accountType];
 const isNova=accountType==="1-Step NOVA";
 const effectiveDaily=selected.daily===null?null:(isNova&&stage==="Evaluation"?null:selected.daily);
 const effectiveMax=isNova&&stage==="Evaluation"?6:selected.max;
 const effectiveTarget=isNova&&stage==="Funded"?null:(accountType==="2-Step PRO v2"&&phase==="Phase 2"?5:selected.target);
 const effectiveSplit=selected.split;
 const calc=useMemo(()=>{
  const dailyAllowance=effectiveDaily===null?Infinity:Math.max(0,dailyReference)*effectiveDaily/100;
  const dailyRemaining=effectiveDaily===null?Infinity:Math.max(0,dailyAllowance-Math.max(0,dailyUsed));
  const personalStop=account*Math.max(0,personalDailyStop)/100;
  const personalRemaining=Math.max(0,personalStop-Math.max(0,dailyUsed));
  const tradeCap=account*Math.max(0,riskPct)/100;
  const budget=Math.min(tradeCap,dailyRemaining,personalRemaining);
  const distance=Math.abs(entry-sl);
  const riskLot=distance*Math.max(0,valuePerMove);
  const riskLots=riskLot>0?budget/riskLot:0;
  const marginLots=marginPerLot>0?Math.max(0,margin)/marginPerLot:0;
  const raw=Math.min(riskLots,marginLots,Math.max(0,maxOpenLots));
  const lots=lotStep>0?Math.max(0,Math.floor(raw/lotStep+1e-9)*lotStep):raw;
  const loss=lots*riskLot,used=lots*marginPerLot;
  const r1=distance>0?Math.abs(tp1-entry)/distance:0,r2=distance>0?Math.abs(tp2-entry)/distance:0;
  const dailyBreach=effectiveDaily===null?null:dailyReference*(1-effectiveDaily/100);
  const maxBreach=selected.drawdown==="static"?account*(1-effectiveMax/100):highWater-account*effectiveMax/100;
  const dailyTarget=account*dailyTargetPct/100;
  const monthlyTarget=account*monthlyProfitGoal/100;
  const payoutGross=Math.max(0,withdrawal),traderShare=payoutGross*effectiveSplit/100,companyShare=payoutGross-traderShare;
  const balanceAfter=equity-payoutGross;
  const netProfit=Math.max(0,equity-account);
  const minPayout=account*selected.minPayout/100;
  const targetAmount=effectiveTarget===null?null:account*effectiveTarget/100;
  const targetProgress=targetAmount&&targetAmount>0?clamp(netProfit/targetAmount*100):0;
  return{dailyAllowance,dailyRemaining,personalStop,personalRemaining,budget,distance,riskLot,riskLots,marginLots,lots,loss,used,marginAfter:Math.max(0,margin-used),riskAccount:account?loss/account*100:0,r1,r2,dailyBreach,maxBreach,dailyTarget,monthlyTarget,payoutGross,traderShare,companyShare,balanceAfter,netProfit,minPayout,targetAmount,targetProgress,valid:account>0&&margin>=0&&entry>0&&distance>0&&budget>0&&lots>0};
 },[account,margin,dailyReference,dailyUsed,highWater,equity,riskPct,personalDailyStop,dailyTargetPct,monthlyProfitGoal,monthlyDays,entry,sl,tp1,tp2,valuePerMove,marginPerLot,lotStep,maxOpenLots,effectiveDaily,effectiveMax,selected.drawdown,selected.minPayout,selected.split,withdrawal,effectiveTarget]);
 const setAccountPreset=(v:string)=>{const n=Number(v);if(Number.isFinite(n)&&n>0){setAccount(n);setMargin(n);setDailyReference(n);setHighWater(n);setEquity(n);}};
 const setAccountKind=(v:string)=>{const t=v as AccountType;setAccountType(t);setStage(t==="Instant Funding"||t==="Instant Prime"?"Funded":"Evaluation");setPhase("Phase 1");};
 const moneyOrUnlimited=(v:number)=>Number.isFinite(v)?money(v):"No firm daily limit";
 return <section className="card" style={{border:"1px solid rgba(212,166,55,.32)",background:"linear-gradient(145deg,rgba(10,16,30,.98),rgba(5,8,18,.98))"}}>
  <div className="section-label">VAULTTRADES RISK MANAGER</div>
  <div style={{display:"flex",justifyContent:"space-between",gap:16,flexWrap:"wrap",alignItems:"center"}}><div><h2 className="title" style={{marginBottom:4}}>Prop Account Risk & Payout Calculator</h2><p className="muted" style={{margin:0}}>Account-specific limits, position sizing, drawdown protection and payout planning.</p></div><span style={{fontSize:10,fontWeight:900,color:"#d4a637",border:"1px solid rgba(212,166,55,.35)",borderRadius:8,padding:"8px 10px"}}>TOP ONE TRADER</span></div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:11,marginTop:17}}>
   <SelectField label="ACCOUNT TYPE" value={accountType} options={Object.keys(rules)} onChange={setAccountKind}/>
   <SelectField label="ACCOUNT SIZE ($)" value={String(account)} options={["5000","10000","25000","50000","100000","200000","Custom"]} onChange={v=>v==="Custom"?setAccountPreset("100000"):setAccountPreset(v)}/>
   <SelectField label="TRADING PLATFORM" value={platform} options={["MT5","MatchTrader"]} onChange={v=>setPlatform(v as Platform)}/>
   <SelectField label="ACCOUNT STAGE" value={stage} options={["Evaluation","Funded"]} onChange={v=>setStage(v as Stage)}/>
   {accountType==="2-Step PRO v2"&&<SelectField label="EVALUATION PHASE" value={phase} options={["Phase 1","Phase 2"]} onChange={setPhase}/>}
  </div>
  <div style={{marginTop:13,padding:12,borderRadius:9,background:"rgba(212,166,55,.06)",border:"1px solid rgba(212,166,55,.22)"}}><strong style={{color:"#d4a637",fontSize:12}}>SELECTED PROGRAM RULES</strong><p className="muted" style={{margin:"7px 0 0",fontSize:12}}>{selected.note}</p><div style={{display:"flex",gap:16,flexWrap:"wrap",marginTop:9,fontSize:12}}><span>Daily loss: <b>{effectiveDaily===null?"None":effectiveDaily+"%"}</b></span><span>Max drawdown: <b>{effectiveMax}% {selected.drawdown}</b></span><span>Profit split: <b>{effectiveSplit}% trader</b></span><span>Minimum payout: <b>{selected.minPayout}%</b></span></div></div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:11,marginTop:15}}>
   <Field label="ACCOUNT BALANCE ($)" value={account} set={setAccount}/>
   <Field label="CURRENT EQUITY ($)" value={equity} set={setEquity}/>
   <Field label="AVAILABLE MARGIN ($)" value={margin} set={setMargin}/>
   <Field label="DAILY REFERENCE BALANCE / EQUITY ($)" value={dailyReference} set={setDailyReference}/>
   <Field label="DAILY LOSS ALREADY USED ($)" value={dailyUsed} set={setDailyUsed}/>
   <Field label="HIGHEST CLOSED BALANCE / HWM ($)" value={highWater} set={setHighWater}/>
  </div>
  <div style={{marginTop:16,...panel}}><div style={{color:"#d4a637",fontSize:10,fontWeight:900,letterSpacing:".12em",marginBottom:10}}>TRADE INPUT · {symbol} · {platform}</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:11}}><Field label="ENTRY" value={entry} set={setEntry}/><Field label="STOP LOSS" value={sl} set={setSl}/><Field label="TP1" value={tp1} set={setTp1}/><Field label="TP2" value={tp2} set={setTp2}/><Field label="$ / PRICE UNIT / 1 LOT" value={valuePerMove} set={setValuePerMove}/><Field label="MARGIN / 1 LOT ($)" value={marginPerLot} set={setMarginPerLot}/><Field label="LOT STEP" value={lotStep} set={setLotStep} step=".01"/><Field label="MAX COMBINED OPEN LOTS" value={maxOpenLots} set={setMaxOpenLots}/></div></div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:11,marginTop:15}}><Field label="RISK PER TRADE (%)" value={riskPct} set={setRiskPct} step=".01"/><Field label="YOUR PERSONAL DAILY STOP (%)" value={personalDailyStop} set={setPersonalDailyStop} step=".01"/><Field label="DAILY PROFIT TARGET (%)" value={dailyTargetPct} set={setDailyTargetPct} step=".01"/><Field label="MONTHLY PROFIT TARGET (%)" value={monthlyProfitGoal} set={setMonthlyProfitGoal} step=".1"/><Field label="TRADING DAYS PER MONTH" value={monthlyDays} set={setMonthlyDays} step="1"/></div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:9,marginTop:16}}>{[["FIRM DAILY LOSS ALLOWANCE",effectiveDaily===null?"No firm daily limit":money(calc.dailyAllowance)],["FIRM DAILY LOSS REMAINING",effectiveDaily===null?"No firm daily limit":money(calc.dailyRemaining)],["YOUR DAILY STOP REMAINING",money(calc.personalRemaining)],["MAX DRAWDOWN BREACH LEVEL",money(calc.maxBreach)],["RECOMMENDED RISK BUDGET",money(calc.budget)],["RECOMMENDED LOT SIZE",fmt(calc.lots,2)],["PROJECTED LOSS AT SL",money(calc.loss)],["MARGIN REQUIRED",money(calc.used)]].map(([label,value])=><div key={label} style={stat}><div style={{color:"#aeb5c6",fontSize:9,fontWeight:900,letterSpacing:".07em"}}>{label}</div><div style={{fontSize:19,fontWeight:950,marginTop:5,overflowWrap:"anywhere"}}>{value}</div></div>)}</div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:9,marginTop:12}}><div className="condition-box"><strong>Daily loss boundary</strong><p className="muted" style={{marginBottom:0}}>{calc.dailyBreach===null?"No firm daily loss boundary in this stage.":money(calc.dailyBreach)+" based on the reference value entered."}</p></div><div className="condition-box"><strong>Personal daily target</strong><p className="muted" style={{marginBottom:0}}>{money(calc.dailyTarget)} gross profit target.</p></div><div className="condition-box"><strong>Monthly gross target</strong><p className="muted" style={{marginBottom:0}}>{money(calc.monthlyTarget)} over {monthlyDays} trading days · approx. {money(monthlyDays>0?calc.monthlyTarget/monthlyDays:0)} per day.</p></div><div className="condition-box"><strong>Projected R:R</strong><p className="muted" style={{marginBottom:0}}>TP1 {fmt(calc.r1)}R · TP2 {fmt(calc.r2)}R.</p></div></div>
  {calc.targetAmount!==null&&<div style={{marginTop:12,padding:12,borderRadius:9,border:"1px solid rgba(212,166,55,.25)"}}><strong>Evaluation target progress</strong><p className="muted" style={{margin:"5px 0"}}>{money(calc.netProfit)} profit against {money(calc.targetAmount)} target ({fmt(calc.targetProgress)}%). Remaining: {money(Math.max(0,calc.targetAmount-calc.netProfit))}.</p><div style={{height:7,background:"#20283a",borderRadius:9,overflow:"hidden"}}><div style={{height:"100%",width:calc.targetProgress+"%",background:"#d4a637"}}/></div></div>}
  <div style={{marginTop:16,...panel}}><strong style={{color:"#d4a637"}}>PAYOUT & RETAINED BALANCE PLANNER</strong><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:11,marginTop:11}}><Field label="GROSS PROFIT WITHDRAWAL REQUEST ($)" value={withdrawal} set={setWithdrawal}/><div style={stat}><div style={{color:"#aeb5c6",fontSize:9,fontWeight:900}}>MINIMUM PAYOUT AMOUNT</div><div style={{fontSize:19,fontWeight:900,marginTop:5}}>{money(calc.minPayout)}</div></div><div style={stat}><div style={{color:"#aeb5c6",fontSize:9,fontWeight:900}}>YOUR ESTIMATED SHARE</div><div style={{fontSize:19,fontWeight:900,marginTop:5}}>{money(calc.traderShare)}</div></div><div style={stat}><div style={{color:"#aeb5c6",fontSize:9,fontWeight:900}}>FIRM SHARE</div><div style={{fontSize:19,fontWeight:900,marginTop:5}}>{money(calc.companyShare)}</div></div><div style={stat}><div style={{color:"#aeb5c6",fontSize:9,fontWeight:900}}>BALANCE AFTER GROSS WITHDRAWAL</div><div style={{fontSize:19,fontWeight:900,marginTop:5}}>{money(calc.balanceAfter)}</div></div></div><p className="muted" style={{fontSize:11,marginBottom:0}}>Payout eligibility is subject to the firm's payout cycle, consistency / ESS requirements, minimum payout, verification and any account-specific conditions. The gross withdrawal entered is deducted from account equity; the trader share is the estimated cash paid to you.</p></div>
  <div style={{marginTop:14,padding:13,borderRadius:9,border:calc.valid?"1px solid rgba(40,200,110,.45)":"1px solid rgba(255,165,45,.45)",background:calc.valid?"rgba(40,200,110,.07)":"rgba(255,165,45,.07)"}}><strong>{calc.valid?("SIZE AVAILABLE: "+fmt(calc.lots,2)+" LOTS"):"ENTER VALID ACCOUNT, MARGIN, ENTRY AND STOP VALUES"}</strong><p className="muted" style={{margin:"6px 0 0"}}>{calc.valid?("A stop hit is approximately "+money(calc.loss)+". The size is constrained by your per-trade risk, remaining personal daily stop, firm daily-loss room, margin and open-lot cap."):"This calculator estimates position size only; it does not place trades."}</p></div>
  <p className="muted" style={{marginTop:13,fontSize:11,lineHeight:1.6}}>Important: MT5 and MatchTrader can use different symbol contract sizes, tick values, margin requirements and volume steps. Enter the actual instrument specifications shown by your platform; the selected platform does not automatically assume identical XAUUSD contract specifications. Firm rules can change. Confirm the current rule set in your trader dashboard before trading. This calculator is a planning aid, not a guarantee against breaches.</p>
 </section>;
}

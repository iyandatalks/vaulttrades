/**
 * VaultTrades — Swing Developing Strategy
 * Source of truth: supplied Pine Script v6, 1,106 lines.
 *
 * Pine sequence:
 * H1 direction -> M15 alignment -> EMA 9/15 pullback -> recovery
 * -> M15 SMI confirmation -> NEW BUY/SELL event.
 *
 * The source does not define SL/TP/RR. This module does not invent them.
 */
import type { StrategyRuleSet } from "./types";

export const SWING_DEVELOPING_ID = "swingDeveloping" as const;
export const SWING_DEVELOPING_NAME = "Swing Developing Strategy" as const;

export type SwingCandle = { time?: number | string; open:number; high:number; low:number; close:number; volume?:number };
export type SwingDirection = "LONG" | "SHORT" | "NEUTRAL";
export type SwingStage = "WAIT" | "DIRECTION" | "PULLBACK" | "ENTRY_READY" | "ENTER_LONG" | "ENTER_SHORT";

export interface SwingDevelopingSettings {
  emaFastLen:number; emaSlowLen:number; emaTrendLen:number;
  smiLength:number; smiSmooth1:number; smiSmooth2:number; smiOB:number; smiOS:number;
  requireEMA100:boolean; requirePullback:boolean;
}
export interface SwingDevelopingInput { h1:SwingCandle[]; m15:SwingCandle[]; current?:SwingCandle; settings?:Partial<SwingDevelopingSettings> }
export interface SwingTimeframeState {
  close:number; ema9:number; ema15:number; ema100:number; smi:number;
  bullish:boolean; bearish:boolean; above100:boolean; below100:boolean;
  longDirection:boolean; shortDirection:boolean;
}
export interface SwingDevelopingResult {
  strategyId:typeof SWING_DEVELOPING_ID; strategyName:typeof SWING_DEVELOPING_NAME;
  direction:SwingDirection; stage:SwingStage; signal:"BUY"|"SELL"|"NONE"; isNewSignal:boolean;
  entryPrice:number|null; stopLoss:null; takeProfit:null; riskReward:null; confidence:null;
  h1:SwingTimeframeState; m15:SwingTimeframeState;
  pullback:{long:boolean;short:boolean;active:boolean};
  recovery:{long:boolean;short:boolean;longTrigger:boolean;shortTrigger:boolean};
  momentum:{long:boolean;short:boolean;h1SMI:number;m15SMI:number};
  states:{longSetupDeveloping:boolean;shortSetupDeveloping:boolean;longWatch:boolean;shortWatch:boolean;longEntryReady:boolean;shortEntryReady:boolean;longEntry:boolean;shortEntry:boolean;longSignal:boolean;shortSignal:boolean};
  evidence:string[]; invalidation:string[]; message:string;
}

const DEFAULTS:SwingDevelopingSettings={emaFastLen:9,emaSlowLen:15,emaTrendLen:100,smiLength:7,smiSmooth1:2,smiSmooth2:2,smiOB:40,smiOS:-40,requireEMA100:true,requirePullback:true};

function ema(v:number[],len:number):number[]{if(!v.length)return[];const r=new Array(v.length);const a=2/(len+1);r[0]=v[0];for(let i=1;i<v.length;i++)r[i]=a*v[i]+(1-a)*r[i-1];return r;}
function highest(v:number[],len:number):number[]{return v.map((_,i)=>{let x=-Infinity;for(let j=Math.max(0,i-len+1);j<=i;j++)x=Math.max(x,v[j]);return x;});}
function lowest(v:number[],len:number):number[]{return v.map((_,i)=>{let x=Infinity;for(let j=Math.max(0,i-len+1);j<=i;j++)x=Math.min(x,v[j]);return x;});}
function smi(c:SwingCandle[],len:number,s1:number,s2:number):number[]{if(!c.length)return[];const hh=highest(c.map(x=>x.high),len),ll=lowest(c.map(x=>x.low),len),rel=c.map((x,i)=>x.close-(hh[i]+ll[i])/2),dist=c.map((_,i)=>(hh[i]-ll[i])/2),rs=ema(ema(rel,s1),s2),ds=ema(ema(dist,s1),s2);return rs.map((x,i)=>ds[i]===0?0:100*x/ds[i]);}
function states(c:SwingCandle[],s:SwingDevelopingSettings):SwingTimeframeState[]{if(!c.length)return[];const cl=c.map(x=>x.close),e9=ema(cl,s.emaFastLen),e15=ema(cl,s.emaSlowLen),e100=ema(cl,s.emaTrendLen),m=smi(c,s.smiLength,s.smiSmooth1,s.smiSmooth2);return c.map((x,i)=>{const bull=e9[i]>e15[i],bear=e9[i]<e15[i],above=x.close>e100[i],below=x.close<e100[i];return{close:x.close,ema9:e9[i],ema15:e15[i],ema100:e100[i],smi:m[i],bullish:bull,bearish:bear,above100:above,below100:below,longDirection:bull&&(!s.requireEMA100||above),shortDirection:bear&&(!s.requireEMA100||below)};});}
function empty():SwingTimeframeState{return{close:0,ema9:0,ema15:0,ema100:0,smi:0,bullish:false,bearish:false,above100:false,below100:false,longDirection:false,shortDirection:false};}

export function analyzeSwingDeveloping(input:SwingDevelopingInput):SwingDevelopingResult{
 const s={...DEFAULTS,...(input.settings??{})}; const hs=states(input.h1,s),ms=states(input.m15,s); const h=hs[hs.length-1],m=ms[ms.length-1];
 if(!h||!m)return{strategyId:SWING_DEVELOPING_ID,strategyName:SWING_DEVELOPING_NAME,direction:"NEUTRAL",stage:"WAIT",signal:"NONE",isNewSignal:false,entryPrice:null,stopLoss:null,takeProfit:null,riskReward:null,confidence:null,h:h??empty(),m15:m??empty(),pullback:{long:false,short:false,active:false},recovery:{long:false,short:false,longTrigger:false,shortTrigger:false},momentum:{long:false,short:false,h1SMI:h?.smi??0,m15SMI:m?.smi??0},states:{longSetupDeveloping:false,shortSetupDeveloping:false,longWatch:false,shortWatch:false,longEntryReady:false,shortEntryReady:false,longEntry:false,shortEntry:false,longSignal:false,shortSignal:false},evidence:["Insufficient H1/M15 data."],invalidation:["Provide sufficient H1 and M15 candles."],message:"WAIT — insufficient H1/M15 data."};
 const n=ms.length,ld=new Array<boolean>(n).fill(false),sd=new Array<boolean>(n).fill(false),lw=new Array<boolean>(n).fill(false),sw=new Array<boolean>(n).fill(false),lr=new Array<boolean>(n).fill(false),sr=new Array<boolean>(n).fill(false),lm=new Array<boolean>(n).fill(false),sm=new Array<boolean>(n).fill(false),le=new Array<boolean>(n).fill(false),se=new Array<boolean>(n).fill(false);
 for(let i=0;i<n;i++){const x=ms[i];ld[i]=h.longDirection&&x.longDirection;sd[i]=h.shortDirection&&x.shortDirection;const pL=x.close<=x.ema9||x.close<=x.ema15,pS=x.close>=x.ema9||x.close>=x.ema15;lw[i]=ld[i]&&pL;sw[i]=sd[i]&&pS;lr[i]=x.close>x.ema9;sr[i]=x.close<x.ema9;lm[i]=x.smi>=s.smiOB;sm[i]=x.smi<=s.smiOS;const prevLW=i>0?lw[i-1]:false,prevSW=i>0?sw[i-1]:false;le[i]=ld[i]&&prevLW&&lr[i]&&lm[i];se[i]=sd[i]&&prevSW&&sr[i]&&sm[i];}
 const i=n-1,longDirection=ld[i],shortDirection=sd[i],longWatch=lw[i],shortWatch=sw[i],longRecovery=lr[i],shortRecovery=sr[i],longRecoveryTrigger=i>0?lw[i-1]&&lr[i]:false,shortRecoveryTrigger=i>0?sw[i-1]&&sr[i]:false,longEntry=le[i],shortEntry=se[i],longSignal=longEntry&&!((i>0&&le[i-1])||false),shortSignal=shortEntry&&!((i>0&&se[i-1])||false);
 const longReady=longWatch&&!longRecovery,shortReady=shortWatch&&!shortRecovery,longDev=longDirection&&!longWatch,shortDev=shortDirection&&!shortWatch;
 let direction:SwingDirection="NEUTRAL",stage:SwingStage="WAIT",signal:"BUY"|"SELL"|"NONE"="NONE";
 if(longSignal){direction="LONG";stage="ENTER_LONG";signal="BUY"}else if(shortSignal){direction="SHORT";stage="ENTER_SHORT";signal="SELL"}else if(longReady){direction="LONG";stage="ENTRY_READY"}else if(shortReady){direction="SHORT";stage="ENTRY_READY"}else if(longWatch){direction="LONG";stage="PULLBACK"}else if(shortWatch){direction="SHORT";stage="PULLBACK"}else if(longDev){direction="LONG";stage="DIRECTION"}else if(shortDev){direction="SHORT";stage="DIRECTION"}
 const evidence:string[]=[],missing:string[]=[];
 if(h.longDirection)evidence.push("H1 bullish: EMA 9 > EMA 15 and EMA 100 direction is valid.");if(h.shortDirection)evidence.push("H1 bearish: EMA 9 < EMA 15 and EMA 100 direction is valid.");if(m.longDirection)evidence.push("M15 bullish and aligned with H1.");if(m.shortDirection)evidence.push("M15 bearish and aligned with H1.");if(longWatch)evidence.push("M15 entered the bullish EMA 9/15 pullback zone.");if(shortWatch)evidence.push("M15 entered the bearish EMA 9/15 pullback zone.");if(longRecoveryTrigger)evidence.push("M15 recovered above EMA 9 after the prior bullish pullback.");if(shortRecoveryTrigger)evidence.push("M15 recovered below EMA 9 after the prior bearish pullback.");if(lm[i])evidence.push(`M15 SMI ${m.smi.toFixed(1)} >= ${s.smiOB}.`);if(sm[i])evidence.push(`M15 SMI ${m.smi.toFixed(1)} <= ${s.smiOS}.`);
 if(!longDirection&&!shortDirection)missing.push("H1 + M15 directional alignment.");if(longDirection&&!longWatch)missing.push("M15 bullish EMA 9/15 pullback.");if(shortDirection&&!shortWatch)missing.push("M15 bearish EMA 9/15 pullback.");if(longReady)missing.push(`M15 recovery above EMA 9 and SMI >= ${s.smiOB}.`);if(shortReady)missing.push(`M15 recovery below EMA 9 and SMI <= ${s.smiOS}.`);
 if(longSignal)evidence.push("NEW BUY ENTRY — complete Pine entry condition transitioned true.");if(shortSignal)evidence.push("NEW SELL ENTRY — complete Pine entry condition transitioned true.");
 let message="WAIT";if(longSignal)message="ENTER LONG — H1 bullish + M15 bullish + prior pullback + current recovery above EMA 9 + bullish SMI.";else if(shortSignal)message="ENTER SHORT — H1 bearish + M15 bearish + prior pullback + current recovery below EMA 9 + bearish SMI.";else if(longReady)message="LONG ENTRY READY — wait for recovery above EMA 9 with SMI confirmation.";else if(shortReady)message="SHORT ENTRY READY — wait for recovery below EMA 9 with SMI confirmation.";else if(longWatch)message="LONG PULLBACK — bullish swing direction confirmed; pullback is active.";else if(shortWatch)message="SHORT PULLBACK — bearish swing direction confirmed; pullback is active.";else if(longDev)message="LONG DIRECTION — H1 + M15 aligned; wait for EMA 9/15 pullback.";else if(shortDev)message="SHORT DIRECTION — H1 + M15 aligned; wait for EMA 9/15 pullback.";
 return{strategyId:SWING_DEVELOPING_ID,strategyName:SWING_DEVELOPING_NAME,direction,stage,signal,isNewSignal:longSignal||shortSignal,entryPrice:longSignal||shortSignal?(input.current?.close??m.close):null,stopLoss:null,takeProfit:null,riskReward:null,confidence:null,h,m15:m,pullback:{long:xorFalse(m.close<=m.ema9||m.close<=m.ema15),short:m.close>=m.ema9||m.close>=m.ema15,active:longWatch||shortWatch},recovery:{long:longRecovery,short:shortRecovery,longTrigger:longRecoveryTrigger,shortTrigger:shortRecoveryTrigger},momentum:{long:lm[i],short:sm[i],h1SMI:h.smi,m15SMI:m.smi},states:{longSetupDeveloping:longDev,shortSetupDeveloping:shortDev,longWatch,shortWatch,longEntryReady:longReady,shortEntryReady:shortReady,longEntry,shortEntry,longSignal,shortSignal},evidence,invalidation:missing,message};
}
function xorFalse(v:boolean):boolean{return v;}

export const swingDevelopingRules:StrategyRuleSet={id:SWING_DEVELOPING_ID,name:SWING_DEVELOPING_NAME,description:"H1 + M15 swing direction with EMA 9/15 pullback, recovery and M15 SMI 7-2-2 confirmation.",source:"PINE_SCRIPT",timeframes:["H1","M15"],sequence:["H1 direction","M15 alignment","EMA 9/15 pullback","Recovery through EMA 9","M15 SMI confirmation","NEW BUY/SELL"],mandatoryRules:["H1 EMA 9 > EMA 15 for long or < for short.","When EMA 100 is required, H1 and M15 price must be on the corresponding side of EMA 100.","H1 and M15 must align.","M15 must have a prior valid pullback.","Current M15 candle must recover above EMA 9 for long or below EMA 9 for short.","M15 SMI must be >= +40 for long or <= -40 for short."],optionalConfluence:["EMA 100 directional filter can be disabled by the Pine input."],invalidationRules:["No H1/M15 alignment.","No required prior pullback.","No recovery through EMA 9.","No SMI confirmation."],executionRules:["BUY only on longEntry and not longEntry[1].","SELL only on shortEntry and not shortEntry[1]."],riskRules:["The source Pine strategy defines no stop loss, take profit or RR."],aiInstructions:["Treat DIRECTION, PULLBACK and ENTRY READY as states, not entries.","Only the final BUY/SELL signal is an entry event.","Do not invent SL, TP or RR."]};
export const swingDevelopingStrategy={id:SWING_DEVELOPING_ID,name:SWING_DEVELOPING_NAME,description:swingDevelopingRules.description,timeframes:["H1","M15"] as const,analyze:analyzeSwingDeveloping,rules:swingDevelopingRules};
export default swingDevelopingStrategy;

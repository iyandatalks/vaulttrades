import type { StrategyAnalysis, StrategyDefinition, StrategyRuleSet } from "./types";

/**
 * Source: Vault_Auto_Fib_Retrace_TP_Ladder_Clean_Structure_v6_FIXED.pine
 * The source is an indicator, not strategy(). Rendering calls are exposed as
 * state. No standalone BUY/SELL entry is invented where Pine has none.
 */
export const AUTO_FIB_RETRACE_ID = "autoFibRetrace" as const;
export const AUTO_FIB_RETRACE_NAME = "Vault Auto Fib Retrace + TP Ladder | Dashboard Professional Signal";

export type AutoFibMode = "Both" | "Buy Retrace" | "Sell Retrace";
export type Anchor = "Asia Low"|"Asia High"|"London Low"|"London High"|"New York Low"|"New York High"|"Previous Day Low"|"Previous Day High"|"Previous Week Low"|"Previous Week High"|"Auto Swing Low"|"Auto Swing High";

export interface Candle { time:number; open:number; high:number; low:number; close:number; volume?:number; }
export interface PreviousLiquidity { dayHigh:number|null; dayLow:number|null; weekHigh:number|null; weekLow:number|null; }
export interface MtfStructure { timeframe:string; state:"Bull"|"Bear"|"Range"; }
export interface AutoFibSettings {
  mode:AutoFibMode; pivotLen:number; asiaSession:string; londonSession:string; nySession:string; sessionOffsetMinutes:number;
  buyStartAnchor:Anchor; buyEndAnchor:Anchor; sellStartAnchor:Anchor; sellEndAnchor:Anchor;
  useManualBuyStartPrice:boolean; manualBuyStartPrice:number; useManualBuyEndPrice:boolean; manualBuyEndPrice:number;
  useManualSellStartPrice:boolean; manualSellStartPrice:number; useManualSellEndPrice:boolean; manualSellEndPrice:number;
  useDxyPanel:boolean; useDxyMA:boolean; dxyMaType:"EMA"|"SMA"; dxyMaLen:number; dxyMaTouch:number;
  showDevilTopSignals:boolean; devilTopPivotLen:number; devilTopTolerancePct:number;
  enableZoneConfirm:boolean; confirmAtrMult:number; retestBars:number;
  showOrderBlocks:boolean; obSwingLength:number; obDeleteMitigated:boolean; obATRLength:number; obImpulseATR:number; obVolumeLength:number; obVolumeFactor:number;
  projProbabilityThreshold:number; projATRLength:number; projMaxATRDistance:number; projRequireRetest:boolean;
}

const DEFAULTS:AutoFibSettings={
  mode:"Both",pivotLen:5,asiaSession:"0000-0600",londonSession:"0700-1000",nySession:"1230-1700",sessionOffsetMinutes:0,
  buyStartAnchor:"Asia Low",buyEndAnchor:"Asia High",sellStartAnchor:"Asia High",sellEndAnchor:"Asia Low",
  useManualBuyStartPrice:false,manualBuyStartPrice:0,useManualBuyEndPrice:false,manualBuyEndPrice:0,
  useManualSellStartPrice:false,manualSellStartPrice:0,useManualSellEndPrice:false,manualSellEndPrice:0,
  useDxyPanel:true,useDxyMA:true,dxyMaType:"EMA",dxyMaLen:50,dxyMaTouch:0.15,
  showDevilTopSignals:true,devilTopPivotLen:5,devilTopTolerancePct:0.25,
  enableZoneConfirm:true,confirmAtrMult:0.60,retestBars:8,
  showOrderBlocks:true,obSwingLength:5,obDeleteMitigated:false,obATRLength:14,obImpulseATR:1.5,obVolumeLength:20,obVolumeFactor:1.5,
  projProbabilityThreshold:70,projATRLength:14,projMaxATRDistance:2,projRequireRetest:true,
};

const FIB=[0,23.6,38.2,50,61.8,78.6,88,100,107.9,115.5,125];
const BUY_TP=[61.8,50,38.2,23.6];
const SELL_TP=[61.8,50,38.2,0];
const buyLevel=(top:number,bot:number,p:number)=>top-(top-bot)*p/100;
const sellLevel=(top:number,bot:number,p:number)=>bot+(top-bot)*p/100;
const mid=(top:number,bot:number)=>(top+bot)/2;

function sma(v:number[],n:number):number|null{if(v.length<n||n<1)return null;return v.slice(-n).reduce((a,b)=>a+b,0)/n;}
function ema(v:number[],n:number):number|null{if(!v.length||n<1)return null;let x=v[0],a=2/(n+1);for(let i=1;i<v.length;i++)x=a*v[i]+(1-a)*x;return x;}
function atr(c:Candle[],n:number):number|null{if(c.length<2)return null;const t:number[]=[];for(let i=1;i<c.length;i++)t.push(Math.max(c[i].high-c[i].low,Math.abs(c[i].high-c[i-1].close),Math.abs(c[i].low-c[i-1].close)));return sma(t,Math.min(n,t.length));}
function session(s:string,t:number,off:number){const [a,b]=s.split("-").map(x=>Number(x.slice(0,2))*60+Number(x.slice(2,4)));let m=(new Date(t).getUTCHours()*60+new Date(t).getUTCMinutes()+off)%1440;if(m<0)m+=1440;return a<=b?m>=a&&m<b:m>=a||m<b;}
function extrema(c:Candle[],s:string,off:number){let hi:number|null=null,lo:number|null=null,hib:number|null=null,lob:number|null=null;for(let i=0;i<c.length;i++)if(session(s,c[i].time,off)){if(hi===null||c[i].high>hi){hi=c[i].high;hib=i;}if(lo===null||c[i].low<lo){lo=c[i].low;lob=i;}}return{high:hi,low:lo,highIndex:hib,lowIndex:lob};}
function pivot(c:Candle[],i:number,n:number,type:"high"|"low"){if(i-n<0||i+n>=c.length)return false;const x=type==="high"?c[i].high:c[i].low;for(let j=i-n;j<=i+n;j++)if(j!==i&&((type==="high"?c[j].high:c[j].low)>=x&&type==="high"||(type==="low"?c[j].low:c[j].high)<=x&&type==="low"))return false;return true;}
function lastPivot(c:Candle[],n:number,type:"high"|"low"){for(let i=c.length-1;i>=0;i--)if(pivot(c,i,n,type))return{price:type==="high"?c[i].high:c[i].low,index:i};return{price:null,index:null};}

function anchor(a:Anchor,s:any){switch(a){case"Asia Low":return{s:s.asia.low,i:s.asia.lowIndex};case"Asia High":return{s:s.asia.high,i:s.asia.highIndex};case"London Low":return{s:s.london.low,i:s.london.lowIndex};case"London High":return{s:s.london.high,i:s.london.highIndex};case"New York Low":return{s:s.ny.low,i:s.ny.lowIndex};case"New York High":return{s:s.ny.high,i:s.ny.highIndex};case"Previous Day Low":return{s:s.p.dayLow,i:null};case"Previous Day High":return{s:s.p.dayHigh,i:null};case"Previous Week Low":return{s:s.p.weekLow,i:null};case"Previous Week High":return{s:s.p.weekHigh,i:null};case"Auto Swing Low":return{s:s.sl.price,i:s.sl.index};default:return{s:s.sh.price,i:s.sh.index};}}

export interface FibLevel{pct:number;price:number;label:string;}
export interface OrderBlockState{active:boolean;high:number|null;low:number|null;mid:number|null;structureActive:boolean;mitigated:boolean;retest:boolean;entryValid:boolean;entryTrigger:boolean;institutional:boolean;breaker:boolean;strength:"STRONG"|"NORMAL"|"NONE";}
export interface ProjectionState{direction:"BUY"|"SELL"|"NONE";probability:number;safeEntry:number|null;tp1:number|null;tp2:number|null;tp3:number|null;status:string;}
export interface AutoFibResult extends StrategyAnalysis{
  mode:AutoFibMode;buy:{ready:boolean;start:number|null;end:number|null;high:number|null;low:number|null;midpoint:number|null;flipPrice:number|null;flipActive:boolean;fibLevels:FibLevel[];tp1:number|null;tp2:number|null;tp3:number|null;tp4:number|null};
  sell:{ready:boolean;start:number|null;end:number|null;high:number|null;low:number|null;midpoint:number|null;flipPrice:number|null;flipActive:boolean;fibLevels:FibLevel[];tp1:number|null;tp2:number|null;tp3:number|null;tp4:number|null};
  dxy:{close:number|null;ma:number|null;bullish:boolean;bearish:boolean;aboveMa:boolean;belowMa:boolean;atMa:boolean;bullMaConfirm:boolean;bearMaConfirm:boolean;volumeSpike:boolean};
  liquiditySweeps:{pdh:boolean;pdl:boolean;pwh:boolean;pwl:boolean};buyConfluence:number;sellConfluence:number;bias:"STRONG BUY"|"STRONG SELL";
  orderBlocks:{bullish:OrderBlockState;bearish:OrderBlockState};projection:{buy:ProjectionState;sell:ProjectionState};m5Confirmation:{bullish:boolean;bearish:boolean};mtfStructure:MtfStructure[];
}

function emptyOB():OrderBlockState{return{active:false,high:null,low:null,mid:null,structureActive:false,mitigated:false,retest:false,entryValid:false,entryTrigger:false,institutional:false,breaker:false,strength:"NONE"};}
function emptyProjection():ProjectionState{return{direction:"NONE",probability:0,safeEntry:null,tp1:null,tp2:null,tp3:null,status:"WAIT"};}

function orderBlocks(c:Candle[],s:AutoFibSettings){const bull=emptyOB(),bear=emptyOB();if(!s.showOrderBlocks||!c.length)return{bullish:bull,bearish:bear};let ph:number|null=null,pl:number|null=null,phi:number|null=null,pli:number|null=null,bBroken:number|null=null,sBroken:number|null=null,bActive=false,sActive=false,bOB:any=null,sOB:any=null,bValid=false,sValid=false;for(let i=Math.max(2,s.obSwingLength*2);i<c.length;i++){const pi=i-s.obSwingLength;if(pivot(c,pi,s.obSwingLength,"high")){ph=c[pi].high;phi=pi;}if(pivot(c,pi,s.obSwingLength,"low")){pl=c[pi].low;pli=pi;}const x=c[i];const bosB=ph!==null&&phi!==null&&x.close>ph&&phi!==bBroken;const bosS=pl!==null&&pli!==null&&x.close<pl&&pli!==sBroken;if(bosB){bBroken=phi;bActive=true;sActive=false;bValid=false;sValid=false;for(let j=1;j<=15&&i-j>=0;j++)if(c[i-j].close<c[i-j].open){bOB={high:c[i-j].high,low:c[i-j].low,index:i-j};break;} }if(bosS){sBroken=pli;sActive=true;bActive=false;bValid=false;sValid=false;for(let j=1;j<=15&&i-j>=0;j++)if(c[i-j].close>c[i-j].open){sOB={high:c[i-j].high,low:c[i-j].low,index:i-j};break;} }const bm=!!(bActive&&bOB&&x.low<=bOB.high&&x.high>=bOB.low),sm=!!(sActive&&sOB&&x.high>=sOB.low&&x.low<=sOB.high);if(bm&&bOB&&x.close>bOB.low)bValid=true;if(sm&&sOB&&x.close<sOB.high)sValid=true;if(bActive&&bOB&&x.close<bOB.low){bValid=false;bActive=false;}if(sActive&&sOB&&x.close>sOB.high){sValid=false;sActive=false;}if(s.obDeleteMitigated&&bm)bActive=false;if(s.obDeleteMitigated&&sm)sActive=false;}
const x=c[c.length-1],a=atr(c,s.obATRLength),range=x.high-x.low,vol=sma(c.map(z=>z.volume??0),s.obVolumeLength),hv=vol!==null&&(x.volume??0)>vol*s.obVolumeFactor;
if(bOB){const m=mid(bOB.high,bOB.low),mit=x.low<=bOB.high&&x.high>=bOB.low,re=mit&&x.close>bOB.low,inst=a!==null&&range>a*s.obImpulseATR&&hv;bull.active=bActive;bull.high=bOB.high;bull.low=bOB.low;bull.mid=m;bull.structureActive=bActive;bull.mitigated=mit;bull.retest=re;bull.entryValid=bValid;bull.entryTrigger=bValid&&bActive&&x.close>x.open;bull.institutional=inst;bull.breaker=x.close<bOB.low;bull.strength=inst?"STRONG":"NORMAL";}
if(sOB){const m=mid(sOB.high,sOB.low),mit=x.high>=sOB.low&&x.low<=sOB.high,re=mit&&x.close<sOB.high,inst=a!==null&&range>a*s.obImpulseATR&&hv;bear.active=sActive;bear.high=sOB.high;bear.low=sOB.low;bear.mid=m;bear.structureActive=sActive;bear.mitigated=mit;bear.retest=re;bear.entryValid=sValid;bear.entryTrigger=sValid&&sActive&&x.close<x.open;bear.institutional=inst;bear.breaker=x.close>sOB.high;bear.strength=inst?"STRONG":"NORMAL";}
return{bullish:bull,bearish:bear};}

function dxyState(d:Candle[]|undefined,s:AutoFibSettings){if(!d?.length||!s.useDxyPanel)return{close:null,ma:null,bullish:false,bearish:false,aboveMa:false,belowMa:false,atMa:false,bullMaConfirm:false,bearMaConfirm:false,volumeSpike:false};const cl=d.at(-1)!.close,prev=d.length>1?d.at(-2)!.close:null,ma=s.useDxyMA?(s.dxyMaType==="EMA"?ema(d.map(x=>x.close),s.dxyMaLen):sma(d.map(x=>x.close),s.dxyMaLen)):null,vs=sma(d.map(x=>x.volume??0),20),v=d.at(-1)!.volume??0,bull=prev!==null&&cl>prev,bear=prev!==null&&cl<prev,above=ma!==null&&cl>ma,below=ma!==null&&cl<ma,at=ma!==null&&ma!==0&&Math.abs((cl-ma)/ma)*100<=s.dxyMaTouch;return{close:cl,ma,bullish:bull,bearish:bear,aboveMa:above,belowMa:below,atMa:at,bullMaConfirm:bull&&above,bearMaConfirm:bear&&below,volumeSpike:vs!==null&&v>vs*1.5};}

function fibs(top:number|null,bot:number|null,side:"buy"|"sell"){if(top===null||bot===null||top===bot)return[];return FIB.map(p=>({pct:p,price:side==="buy"?buyLevel(top,bot,p):sellLevel(top,bot,p),label:`${p.toFixed(1)}%`}));}

const RULES:StrategyRuleSet={
  id:AUTO_FIB_RETRACE_ID,name:AUTO_FIB_RETRACE_NAME,source:"PINE_SCRIPT",
  description:"Session/liquidity anchored Auto Fib Retrace + TP Ladder with DXY flow, order blocks, projection, M5 confirmation and MTF structure.",
  timeframes:["Chart","M5","M1","M5","M15","M30","H1","H4","D"],
  sequence:["Resolve anchors","Build Buy/Sell Fib ranges","Calculate Fib ladder","Calculate flips","Calculate DXY/liquidity confluence","Read order blocks","Read projection","Read M5 confirmation","Read MTF structure"],
  mandatoryRules:["Two distinct anchors are required for each range.","Buy flip = close >= Buy 61.8% flip price.","Sell flip = close <= Sell 78.6% flip price.","Confluence uses the Pine weights."],
  optionalConfluence:["DXY direction","DXY MA","DXY volume spike","PDH/PDL/PWH/PWL sweeps","Order blocks","M5 displacement","MTF structure","Devil Top"],
  invalidationRules:["Invalid anchors produce no range.","Order-block validity is lost through its boundary.","Projection entry is removed when ATR distance exceeds the maximum."],
  executionRules:["The source is an indicator and has no strategy.entry().","Do not turn a visual flip marker into an invented order.","Use the returned state for Analyzer advice."],
  riskRules:["Fib ladder itself has no standalone SL/RR rule.","Do not manufacture RR when no source SL exists."],
  aiInstructions:["Treat this as an analytical Fib/liquidity engine.","Explain active range, flip, confluence and targets.","Keep DXY as confluence, not a replacement for Fib structure.","If the source has no explicit entry event, return WAITING/DEVELOPING instead of inventing BUY/SELL."]
};
export const autoFibRetraceDefinition:StrategyDefinition={rules:RULES};

export interface AutoFibInput{candles:Candle[];dxyCandles?:Candle[];m5Candles?:Candle[];previousLiquidity?:PreviousLiquidity;mtfStructure?:MtfStructure[];settings?:Partial<AutoFibSettings>;}

export function analyzeAutoFibRetrace(input:AutoFibInput):AutoFibResult{
 const s={...DEFAULTS,...(input.settings??{})};const c=input.candles;const last=c.at(-1);if(!last)return empty(s);
 const asia=extrema(c,s.asiaSession,s.sessionOffsetMinutes),london=extrema(c,s.londonSession,s.sessionOffsetMinutes),ny=extrema(c,s.nySession,s.sessionOffsetMinutes);const p=input.previousLiquidity??{dayHigh:null,dayLow:null,weekHigh:null,weekLow:null};const sh=lastPivot(c,s.pivotLen,"high"),sl=lastPivot(c,s.pivotLen,"low");const src={asia,london,ny,p,sh,sl};
 const bs=s.useManualBuyStartPrice?s.manualBuyStartPrice:anchor(s.buyStartAnchor,src).s,be=s.useManualBuyEndPrice?s.manualBuyEndPrice:anchor(s.buyEndAnchor,src).s,ss=s.useManualSellStartPrice?s.manualSellStartPrice:anchor(s.sellStartAnchor,src).s,se=s.useManualSellEndPrice?s.manualSellEndPrice:anchor(s.sellEndAnchor,src).s;
 const br=bs!==null&&be!==null&&bs!==be,sr=ss!==null&&se!==null&&ss!==se;const bh=br?Math.max(bs!,be!):null,bl=br?Math.min(bs!,be!):null,shh=sr?Math.max(ss!,se!):null,slw=sr?Math.min(ss!,se!):null;
 const bflip=br?buyLevel(bh!,bl!,61.8):null,sflip=sr?sellLevel(shh!,slw!,78.6):null;const bfa=(s.mode==="Both"||s.mode==="Buy Retrace")&&br&&last.close>=bflip!;const sfa=(s.mode==="Both"||s.mode==="Sell Retrace")&&sr&&last.close<=sflip!;const bm=br?mid(bh!,bl!):null,sm=sr?mid(shh!,slw!):null;
 const d=dxyState(input.dxyCandles,s),pdh=p.dayHigh!==null&&last.high>p.dayHigh&&last.close<p.dayHigh,pdl=p.dayLow!==null&&last.low<p.dayLow&&last.close>p.dayLow,pwh=p.weekHigh!==null&&last.high>p.weekHigh&&last.close<p.weekHigh,pwl=p.weekLow!==null&&last.low<p.weekLow&&last.close>p.weekLow;
 let bc=(bfa?20:0)+(d.bearish?15:0)+(d.bearMaConfirm?10:0)+(d.volumeSpike?10:0)+(pdl?15:0)+(bm!==null&&last.close>=bm?20:0);let sc=(sfa?20:0)+(d.bullish?15:0)+(d.bullMaConfirm?10:0)+(d.volumeSpike?10:0)+(pdh?15:0)+(sm!==null&&last.close<=sm?20:0);bc=Math.min(bc,100);sc=Math.min(sc,100);
 const ob=orderBlocks(c,s),m5=input.m5Candles?.length&&s.enableZoneConfirm?(()=>{const x=input.m5Candles!.at(-1)!,q=input.m5Candles!.at(-2)!,a=atr(input.m5Candles!,14);return{bullish:a!==null&&x.close>x.open&&x.close-x.open>a*s.confirmAtrMult&&x.close>q.high,bearish:a!==null&&x.close<x.open&&x.open-x.close>a*s.confirmAtrMult&&x.close<q.low};})():{bullish:false,bearish:false};
 /* Source truth: projBuyProbability/projSellProbability are declared 0.0 in the supplied FIXED Pine and never assigned. Therefore the >=70 projection gate never passes. */
 const probB=0,probS=0;const bullBias=ob.bullish.structureActive&&bc>=60,bearBias=ob.bearish.structureActive&&sc>=60;const bullRetest=bullBias&&ob.bullish.mid!==null&&last.low<=ob.bullish.mid,bearRetest=bearBias&&ob.bearish.mid!==null&&last.high>=ob.bearish.mid;const bullInst=bullBias&&bullRetest&&ob.bullish.mid!==null&&last.close>ob.bullish.mid,bearInst=bearBias&&bearRetest&&ob.bearish.mid!==null&&last.close<ob.bearish.mid;const safeB=bullInst&&probB>=s.projProbabilityThreshold?ob.bullish.mid:null,safeS=bearInst&&probS>=s.projProbabilityThreshold?ob.bearish.mid:null;
 const projB:ProjectionState={direction:safeB!==null?"BUY":"NONE",probability:probB,safeEntry:safeB,tp1:safeB!==null?p.dayHigh:null,tp2:safeB!==null?p.weekHigh:null,tp3:safeB!==null&&p.dayHigh!==null&&p.weekHigh!==null?Math.max(p.dayHigh,p.weekHigh):null,status:safeB!==null?"READY":"WAIT"};const projS:ProjectionState={direction:safeS!==null?"SELL":"NONE",probability:probS,safeEntry:safeS,tp1:safeS!==null?p.dayLow:null,tp2:safeS!==null?p.weekLow:null,tp3:safeS!==null&&p.dayLow!==null&&p.weekLow!==null?Math.min(p.dayLow,p.weekLow):null,status:safeS!==null?"READY":"WAIT"};
 const evidence:string[]=[],missing:string[]=[],invalid:string[]=[],conf:string[]=[];if(br)evidence.push(`Buy Fib range ${bs} → ${be}.`);else missing.push("Buy Fib anchors are not both valid.");if(sr)evidence.push(`Sell Fib range ${ss} → ${se}.`);else missing.push("Sell Fib anchors are not both valid.");if(bfa){evidence.push(`Buy flip active at ${bflip}.`);conf.push("Buy flip +20");}if(sfa){evidence.push(`Sell flip active at ${sflip}.`);conf.push("Sell flip +20");}if(d.bearish)conf.push("DXY bearish +15 Buy");if(d.bullish)conf.push("DXY bullish +15 Sell");if(d.bearMaConfirm)conf.push("DXY bearish MA +10 Buy");if(d.bullMaConfirm)conf.push("DXY bullish MA +10 Sell");if(d.volumeSpike)conf.push("DXY volume spike +10");if(pdl)conf.push("PDL sweep +15 Buy");if(pdh)conf.push("PDH sweep +15 Sell");if(bm!==null&&last.close>=bm)conf.push("Buy midpoint +20");if(sm!==null&&last.close<=sm)conf.push("Sell midpoint +20");if(ob.bullish.institutional)evidence.push("Institutional bullish OB detected.");if(ob.bearish.institutional)evidence.push("Institutional bearish OB detected.");if(m5.bullish)evidence.push("M5 bullish displacement confirmation.");if(m5.bearish)evidence.push("M5 bearish displacement confirmation.");if(ob.bullish.breaker)invalid.push("Bullish OB boundary broken.");if(ob.bearish.breaker)invalid.push("Bearish OB boundary broken.");
 let state:StrategyAnalysis["state"]="WAITING";if(safeB!==null||safeS!==null)state="ENTRY_READY";else if(bfa||sfa||bc>0||sc>0)state="DEVELOPING";else if(!br&&!sr)state="NO_TRADE";
 return{strategyId:AUTO_FIB_RETRACE_ID,strategyName:AUTO_FIB_RETRACE_NAME,state,signal:"NONE",confidence:Math.max(bc,sc),entry:safeB??safeS,stopLoss:null,tp1:projB.tp1??projS.tp1??(br?buyLevel(bh!,bl!,BUY_TP[0]):null),tp2:projB.tp2??projS.tp2??(br?buyLevel(bh!,bl!,BUY_TP[1]):null),finalTp:projB.tp3??projS.tp3??null,riskReward:null,evidence,missingConditions:missing,invalidation:invalid,confluence:conf,timeframe:"Chart + M5 + MTF",message:state==="DEVELOPING"?`${bc>=sc?"STRONG BUY":"STRONG SELL"} — Auto Fib structure is developing; review flip, liquidity and confluence.`:state==="NO_TRADE"?"NO TRADE — valid Fib anchors are unavailable.":"WAIT — Auto Fib structure is awaiting its source-defined confirmation.",mode:s.mode,
 buy:{ready:br,start:bs,end:be,high:bh,low:bl,midpoint:bm,flipPrice:bflip,flipActive:bfa,fibLevels:fibs(bh,bl,"buy"),tp1:br?buyLevel(bh!,bl!,BUY_TP[0]):null,tp2:br?buyLevel(bh!,bl!,BUY_TP[1]):null,tp3:br?buyLevel(bh!,bl!,BUY_TP[2]):null,tp4:br?buyLevel(bh!,bl!,BUY_TP[3]):null},
 sell:{ready:sr,start:ss,end:se,high:shh,low:slw,midpoint:sm,flipPrice:sflip,flipActive:sfa,fibLevels:fibs(shh,slw,"sell"),tp1:sr?sellLevel(shh!,slw!,SELL_TP[0]):null,tp2:sr?sellLevel(shh!,slw!,SELL_TP[1]):null,tp3:sr?sellLevel(shh!,slw!,SELL_TP[2]):null,tp4:sr?sellLevel(shh!,slw!,SELL_TP[3]):null},
 dxy:d,liquiditySweeps:{pdh,pdl,pwh,pwl},buyConfluence:bc,sellConfluence:sc,bias:bc>=sc?"STRONG BUY":"STRONG SELL",orderBlocks:ob,projection:{buy:projB,sell:projS},m5Confirmation:m5,mtfStructure:input.mtfStructure??[]};
}

function empty(s:AutoFibSettings):AutoFibResult{return{strategyId:AUTO_FIB_RETRACE_ID,strategyName:AUTO_FIB_RETRACE_NAME,state:"NO_TRADE",signal:"NONE",confidence:0,entry:null,stopLoss:null,tp1:null,tp2:null,finalTp:null,riskReward:null,evidence:[],missingConditions:["No chart candles supplied."],invalidation:[],confluence:[],timeframe:"Chart + M5 + MTF",message:"NO TRADE — no chart candles supplied.",mode:s.mode,buy:{ready:false,start:null,end:null,high:null,low:null,midpoint:null,flipPrice:null,flipActive:false,fibLevels:[],tp1:null,tp2:null,tp3:null,tp4:null},sell:{ready:false,start:null,end:null,high:null,low:null,midpoint:null,flipPrice:null,flipActive:false,fibLevels:[],tp1:null,tp2:null,tp3:null,tp4:null},dxy:{close:null,ma:null,bullish:false,bearish:false,aboveMa:false,belowMa:false,atMa:false,bullMaConfirm:false,bearMaConfirm:false,volumeSpike:false},liquiditySweeps:{pdh:false,pdl:false,pwh:false,pwl:false},buyConfluence:0,sellConfluence:0,bias:"STRONG BUY",orderBlocks:{bullish:emptyOB(),bearish:emptyOB()},projection:{buy:emptyProjection(),sell:emptyProjection()},m5Confirmation:{bullish:false,bearish:false},mtfStructure:[]};}

export const autoFibRetraceStrategy={id:AUTO_FIB_RETRACE_ID,name:AUTO_FIB_RETRACE_NAME,rules:RULES,analyze:analyzeAutoFibRetrace};
export default autoFibRetraceStrategy;

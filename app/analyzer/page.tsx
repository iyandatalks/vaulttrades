"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ANALYZER_STRATEGIES, ANALYZER_STRATEGY_MAP } from "../../lib/strategies/analyzerProfiles";
import { LiveMarketChart } from "./LiveMarketChart";

type Timeframe = "1m" | "5m" | "10m" | "15m" | "30m" | "1H" | "4H" | "1D" | "1W" | "1M";
type MarketType = "FOREX" | "INDICES" | "CRYPTO" | "STOCKS" | "SYNTHETIC";
type Candle = { datetime: string; open: number; high: number; low: number; close: number; volume: number | null };
type Scanner = {
  projectedDirection?: "BUY" | "SELL" | "NO TRADE";
  analysisState?: string;
  statusMessage?: string;
  cycleStatus?: string;
  trend?: string;
  trendReason?: string;
  institutionalActivity?: string;
  institutionalEvidence?: string[];
  confirmations?: string[];
  projectedProbability?: number;
  entry?: number | null;
  projectedEntry?: number | null;
  actualEntry?: number | null;
  stopLoss?: number | null;
  projectedStopLoss?: number | null;
  tp1?: number | null;
  projectedTp1?: number | null;
  tp2?: number | null;
  projectedTp2?: number | null;
  finalTp?: number | null;
  projectedFinalTp?: number | null;
  tp1Hit?: boolean;
  stopHit?: boolean;
  confirmationPrice?: number | null;
  reversalPrice?: number | null;
  opposingLiquidityTarget?: number | null;
  liquidityTargets?: { referencePrice: number; buySide: { price: number; source: string; touches: number } | null; sellSide: { price: number; source: string; touches: number } | null; definition: string };
  waitReason?: string;
  tradeReason?: string;
  invalidation?: string;
  pipeline?: string[];
  nextZone?: string;
  rr?: number | null;
  strategyConditionsMet?: boolean;
  entryConfirmation?: boolean;
  entryConfirmationReason?: string;
  confirmationTimeframe?: string;
  isExecutable?: boolean;
  universalValidationPassed?: boolean;
  volumeProfile?: { currentVolume: number | null; averageVolume: number | null; ratio: number | null; expansion: boolean; candleDirection: string; displacementATR: number | null };
};
type LockedTrade = {
  direction: "BUY" | "SELL";
  actualEntry: number;
  stopLoss: number;
  tp1: number | null;
  tp2: number | null;
  finalTp: number | null;
  symbol: string;
  strategy: string;
  liquidityTarget: number | null;
};

type VortexEngineView = { timeframe?: string; state?: string; direction?: string; plannedDirection?: "BUY" | "SELL" | null; entry?: number | null; stopLoss?: number | null; tp1?: number | null; tp2?: number | null; tp3?: number | null; tp4?: number | null; tp5?: number | null; entryTime?: string | null; exitTime?: string; exitPrice?: number; score?: number; fibLevel?: number | null; lotSize?: number; lotModel?: string; targetHits?: boolean[]; orderBlock?: { direction: string; top: number; bottom: number } | null; statusReason?: string; missingConditions?: string[]; latestClosedTrade?: { direction: string; entry: number; stopLoss: number; fibLevel?: number; tp1: number; tp2: number; tp3: number; tp4: number; tp5: number; entryTime: string; exitTime?: string; exitPrice?: number; status: string } | null; openTrade?: { direction: string; entry: number; stopLoss: number; tp1: number; tp2: number; tp3: number; tp4: number; tp5: number; entryTime: string; targetHits: boolean[]; lotSize: number } | null; };

type Result = {
  dataSource?: string;
  market?: { type?: MarketType; asset?: string; timeframe?: string; currentPrice?: number | null; directionalBias?: string; session?: string };
  strategy?: { id?: string; name?: string; category?: string };
  sourceIndicators?: { name: string; purpose: string; parameters: string; required: boolean }[];
  indicatorReadings?: { name: string; value: number | null; signal: string; reason: string; values?: Record<string, number | null> }[];
  chart?: { candles: Candle[]; channel20?: { upper: number | null; lower: number | null; middle: number | null }; orderBlocks?: { direction: string; top: number; bottom: number; label?: string; state?: string }[] };
  liquidityTargets?: { referencePrice: number; buySide: { price: number; source: string; touches: number; pivotTime?: string | null } | null; sellSide: { price: number; source: string; touches: number; pivotTime?: string | null } | null; definition: string; pivotLength: number; lookback: number };
  structure?: { trend?: string; support?: number | null; resistance?: number | null; latestHigh?: number | null; latestLow?: number | null };
  volatility?: { atr?: number | null; atrPct?: number | null; breakout?: string };
  decision?: "TRADE" | "NO TRADE";
  direction?: "BUY" | "SELL" | "NO TRADE";
  confidence?: number;
  setup?: string;
  marketCondition?: string;
  marketStructure?: string;
  recentPriceAction?: string;
  confirmedConditions?: string[];
  missingConditions?: string[];
  smcScores?: Record<string, number>;
  pipeline?: string[];
  nextZone?: string;
  invalidation?: string;
  entry?: number | null;
  stopLoss?: number | null;
  tp1?: number | null;
  tp2?: number | null;
  finalTp?: number | null;
  rr?: number | null;
  slDistancePct?: number | null;
  entryDistancePct?: number | null;
  nextAction?: string;
  educationalNote?: string;
  qualityChecks?: { smcStrongCount?: number; rrValid?: boolean; slDistanceValid?: boolean; entryDistanceValid?: boolean; universalTradeGate?: boolean };
  scanner?: Scanner;
  timeframeEngines?: Partial<Record<Timeframe, VortexEngineView>>;
  strategyEngine?: { source?: string; timeframe?: string; state?: string; signal?: string; direction?: string; closedDirection?: "BUY" | "SELL" | null; plannedDirection?: "BUY" | "SELL" | null; entryTime?: string | null; lifecycleReason?: string; tp1?: number | null; tp2?: number | null; tp3?: number | null; tp4?: number | null; tp5?: number | null; lotSize?: number; lotModel?: string; targetHits?: boolean[]; performance?: { tradesTaken: number; closedTrades: number; openTrades: number; winners: number; losers: number; winRate: number; profitFactor: number | null; totalR: number }; openTrades?: Array<{ direction: "BUY" | "SELL"; entry: number; stopLoss: number; takeProfit: number; entryTime: string; entryDay: string; status: string }>; closedTrades?: Array<{ direction: "BUY" | "SELL"; entry: number; stopLoss: number; takeProfit: number; entryTime: string; entryDay: string; status: string; exitTime?: string; exitPrice?: number }>; latestClosedTrade?: { direction: "BUY" | "SELL"; entry: number; stopLoss: number; fibLevel?: number; takeProfit?: number; tp1?: number; tp2?: number; tp3?: number; tp4?: number; tp5?: number; entryTime?: string; entryDay?: string; status: string; exitTime?: string; exitPrice?: number } | null; openTrade?: { direction: "BUY" | "SELL"; entry: number; stopLoss: number; tp1: number; tp2: number; tp3: number; tp4?: number | null; tp5?: number | null; fibLevel: number; entryTime: string; confirmationTime: string; lotSize: number; targetHits: boolean[]; status: string } | null; statusReason?: string; buyConfluence?: number; sellConfluence?: number; silverDataAvailable?: boolean; silver?: { available?: boolean; close?: number | null; ma?: number | null; maSlope?: string; flow?: string; structure?: string; volumeExpansion?: boolean; flowSupportsBuy?: boolean; flowSupportsSell?: boolean; structureSupportsBuy?: boolean; structureSupportsSell?: boolean; volumeSupportsBuy?: boolean; volumeSupportsSell?: boolean }; confluenceBreakdown?: { buy: Record<string, { available: boolean; passed: boolean; points: number; weight: number }>; sell: Record<string, { available: boolean; passed: boolean; points: number; weight: number }>; buyPenalty: number; sellPenalty: number }; trend?: string; sweptLiquidity?: number | null; rejectionExtreme?: number | null; sweepTime?: string | null; mssTime?: string | null; confirmationTime?: string | null; entry?: number | null; stopLoss?: number | null; finalTp?: number | null; rangeHigh?: number | null; rangeLow?: number | null; window?: string | null; fibLevel?: number | null; score?: number; breakoutPrice?: number | null; breakoutTime?: string | null; breakoutDirection?: "BUY" | "SELL" | null; confluence?: { macroTrend: string; fastTrend: string; rsi: number | null; rsiAligned: boolean | null; volumeRatio: number | null; volumeGood: boolean; rangeSize: number; rangeAtrRatio: number | null; longScore: number; shortScore: number; dxy: string; silver: string; gate: string }; evidence?: string[]; missingConditions?: string[]; liquidityTarget?: number | null; orderBlock?: { direction: string; top: number; bottom: number } | null; riskReward?: number | null; invalidation?: string; ema20?: number | null; slowEMA?: number | null; atr?: number | null; bullStructure?: boolean; bearStructure?: boolean; bullTouch?: boolean; bearTouch?: boolean; bullReject?: boolean; bearReject?: boolean; bullMABreak?: boolean; bearMABreak?: boolean; utBull?: boolean; utBear?: boolean; smiBull?: boolean; smiBear?: boolean; confirmation?: { long: number; short: number } };
};

const TIMEFRAMES: Timeframe[] = ["1m", "5m", "10m", "15m", "30m", "1H", "4H", "1D", "1W", "1M"];
const MARKET_TYPES: MarketType[] = ["FOREX", "INDICES", "CRYPTO", "STOCKS", "SYNTHETIC"];
const DEFAULT_SYMBOLS: Record<MarketType, string[]> = {
  FOREX: ["XAU/USD", "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD"],
  INDICES: ["NASDAQ", "SPX", "DOW", "FTSE"],
  CRYPTO: ["BTC/USD", "ETH/USD", "SOL/USD"],
  STOCKS: ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN"],
  SYNTHETIC: ["V75", "V100", "Boom 1000", "Crash 1000"],
};
const PUBLIC_STRATEGY_IDS = ["vaulttradesNexus", "ema20", "vortex"] as const;
const PUBLIC_STRATEGY_LABELS: Record<string, string> = {
  vortex: "VaultTrades Vortex",
  ema20: "VaultTrades Nexus Plus",
  vaulttradesNexus: "VaultTrades Nexus",
};
function priceDecimals(symbol = ""): number {
  const normalized = symbol.toUpperCase().replace(/[^A-Z]/g, "");
  const isMetal = /^(XAU|XAG|XPT|XPD)/.test(normalized);
  const currencyCodes = new Set(["USD","EUR","GBP","JPY","CHF","CAD","AUD","NZD","CNH","CNY","HKD","SGD","ZAR","MXN","NOK","SEK","DKK","PLN","CZK","HUF","TRY","ILS","THB"]);
  const pairs = Array.from({ length: Math.max(0, normalized.length - 5) }, (_, index) => normalized.slice(index, index + 6));
  const forexPair = !isMetal && pairs.find(pair => currencyCodes.has(pair.slice(0,3)) && currencyCodes.has(pair.slice(3,6)));
  if (forexPair) return forexPair.endsWith("JPY") ? 3 : 5;
  return 2;
}
const fmt = (v: number | null | undefined, symbol = "") => v == null || !Number.isFinite(v)
  ? "—"
  : v.toLocaleString(undefined, { minimumFractionDigits: priceDecimals(symbol), maximumFractionDigits: priceDecimals(symbol) });

type SRBWindow = { name: string; start: number; end: number };
type ClosedSRBStat = { trades: number; wins: number; losses: number; winRate: number | null; lossRate: number | null; totalR: number };
const SRB_WINDOWS: SRBWindow[] = [
  { name: "TOKYO", start: 150, end: 180 },
  { name: "LONDON 1", start: 600, end: 630 },
  { name: "LONDON 2", start: 720, end: 750 },
  { name: "NEW YORK 1", start: 930, end: 960 },
  { name: "NEW YORK 2", start: 1185, end: 1215 },
];
const emptyClosedStat = (): ClosedSRBStat => ({ trades: 0, wins: 0, losses: 0, winRate: null, lossRate: null, totalR: 0 });
function sastCandleParts(value: string) {
  const d = new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
  if (!Number.isFinite(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone:"Africa/Johannesburg", year:"numeric", month:"2-digit", day:"2-digit", weekday:"short", hour:"2-digit", minute:"2-digit", hourCycle:"h23" }).formatToParts(d);
  const get = (k:string) => parts.find(p=>p.type===k)?.value ?? "";
  return { date:get("year")+"-"+get("month")+"-"+get("day"), minute:Number(get("hour"))*60+Number(get("minute")), weekday:get("weekday") };
}
function closedSrbPerformance(input: Candle[]) {
  const sessions = SRB_WINDOWS.map(w => ({ name:w.name, ...emptyClosedStat() }));
  const grades = (["A","B","C","F"] as const).map(g => ({ grade:g, ...emptyClosedStat() }));
  const overall = emptyClosedStat(), long = emptyClosedStat(), short = emptyClosedStat();
  const add = (stat: ClosedSRBStat, win:boolean, r:number) => {
    stat.trades++; if(win) stat.wins++; else stat.losses++;
    stat.totalR += r; stat.winRate = stat.trades ? stat.wins/stat.trades*100 : null;
    stat.lossRate = stat.trades ? stat.losses/stat.trades*100 : null;
  };
  if (input.length < 25) return { sessions, grades, overall, long, short };
  const candles = [...input].sort((a,b)=>new Date(a.datetime).getTime()-new Date(b.datetime).getTime());
  const gaps = candles.slice(1).map((c,i)=>(new Date(c.datetime).getTime()-new Date(candles[i].datetime).getTime())/60000).filter(v=>v>0&&v<=240).sort((a,b)=>a-b);
  const medianGap = gaps.length ? gaps[Math.floor(gaps.length/2)] : 15;
  const expectedRangeBars = Math.max(1,Math.ceil(30/medianGap));
  const parts = candles.map(c=>sastCandleParts(c.datetime));
  const dates = [...new Set(parts.filter((p):p is NonNullable<typeof p>=>!!p && ["Mon","Tue","Wed","Thu","Fri"].includes(p.weekday)).map(p=>p.date))];
  const closes = (end:number) => candles.slice(0,end).map(c=>c.close);
  const calcEma = (v:number[], n:number) => { if(v.length<n)return null; const k=2/(n+1); let x=v.slice(0,n).reduce((a,b)=>a+b,0)/n; for(let i=n;i<v.length;i++)x=v[i]*k+x*(1-k); return x; };
  const calcRsi = (v:number[], n=14) => { if(v.length<n+1)return null; let gain=0,loss=0; for(let i=v.length-n;i<v.length;i++){const d=v[i]-v[i-1];if(d>0)gain+=d;else loss-=d;} return loss===0?100:100-100/(1+gain/loss); };
  for (const date of dates) for (let wi=0;wi<SRB_WINDOWS.length;wi++) {
    const w=SRB_WINDOWS[wi];
    const dayIdx=parts.map((p,i)=>p?.date===date?i:-1).filter(i=>i>=0);
    const rangeIdx=dayIdx.filter(i=>parts[i]!.minute>=w.start && parts[i]!.minute<w.end);
    if(rangeIdx.length<expectedRangeBars) continue;
    const rangeEnd=Math.max(...rangeIdx), hi=Math.max(...rangeIdx.map(i=>candles[i].high)), lo=Math.min(...rangeIdx.map(i=>candles[i].low)), range=hi-lo;
    if(!(range>0))continue;
    let breakIdx=-1, dir:"BUY"|"SELL"|null=null;
    for(const i of dayIdx.filter(i=>i>rangeEnd)){
      if(i>0&&candles[i].close>hi&&candles[i-1].close<=hi){breakIdx=i;dir="BUY";break;}
      if(i>0&&candles[i].close<lo&&candles[i-1].close>=lo){breakIdx=i;dir="SELL";break;}
    }
    if(breakIdx<0||!dir)continue;
    const entry=dir==="BUY"?hi-range*.681:lo+range*.681, stop=dir==="BUY"?lo:hi, target=dir==="BUY"?hi+range*.618:lo-range*.618;
    const sig=candles[breakIdx], history=candles.slice(0,breakIdx+1), cv=history.map(x=>x.close);
    const tr=history.map((x,i)=>i===0?x.high-x.low:Math.max(x.high-x.low,Math.abs(x.high-history[i-1].close),Math.abs(x.low-history[i-1].close)));
    const atr=tr.length>=15?tr.slice(-14).reduce((a,b)=>a+b,0)/14:0;
    const e20=calcEma(cv,20), e200=calcEma(cv,200), rsi=calcRsi(cv);
    const vols=history.slice(-21,-1).map(x=>x.volume).filter((x):x is number=>x!=null);
    const avgVol=vols.length?vols.reduce((a,b)=>a+b,0)/vols.length:null;
    const score=(e200!=null&&(dir==="BUY"?sig.close>e200:sig.close<e200)?15:0)+(e20!=null&&(dir==="BUY"?sig.close>e20:sig.close<e20)?15:0)+(rsi!=null&&(dir==="BUY"?rsi>50:rsi<50)?20:0)+(sig.volume!=null&&avgVol!=null&&sig.volume>avgVol?30:0)+(atr>0&&range>atr*.5?20:0);
    const grade=score>=80?"A":score>=65?"B":score>=50?"C":"F";
    if (score < 50) continue;
    const signalHistory=history.slice(0,-1);
    const priorHighs=signalHistory.map(x=>x.high), priorLows=signalHistory.map(x=>x.low);
    const upperTarget=Math.min(...priorHighs.filter(v=>v>sig.close),Infinity);
    const lowerTarget=Math.max(...priorLows.filter(v=>v<sig.close),-Infinity);
    const liqTarget=dir==="BUY"?(Number.isFinite(upperTarget)?upperTarget:null):(Number.isFinite(lowerTarget)?lowerTarget:null);
    let opposingOB:{top:number;bottom:number}|null=null;
    if(liqTarget!=null&&atr>0){
      for(let oi=Math.max(2,signalHistory.length-100);oi<signalHistory.length-1;oi++){
        const base=signalHistory[oi], impulse=signalHistory[oi+1], body=Math.abs(impulse.close-impulse.open);
        const bearish=base.close>base.open&&impulse.close<impulse.open&&body>=atr*.8&&impulse.close<base.low;
        const bullish=base.close<base.open&&impulse.close>impulse.open&&body>=atr*.8&&impulse.close>base.high;
        const valid=dir==="BUY"?(bullish&&base.high<liqTarget):(bearish&&base.low>liqTarget);
        if(valid)opposingOB={top:base.high,bottom:base.low};
      }
    }
    if(opposingOB&&entry<=opposingOB.top+atr*.55&&entry>=opposingOB.bottom-atr*.55)continue;
    const geometryOK=dir==="BUY"?stop<entry&&target>entry:stop>entry&&target<entry;
    if(!geometryOK)continue;
    let fill=-1, blocked=false;
    for(let i=breakIdx+1;i<candles.length && i<=breakIdx+12;i++){
      const b=candles[i], entryHit=dir==="BUY"?b.low<=entry:b.high>=entry;
      const riskHit=dir==="BUY"?(b.low<=stop||b.high>=target):(b.high>=stop||b.low<=target);
      if(riskHit){blocked=true;break;} if(entryHit){fill=i;break;}
    }
    if(blocked||fill<0)continue;
    let closed:false|true=false, won=false;
    for(let i=fill+1;i<candles.length;i++){
      const b=candles[i], sl=dir==="BUY"?b.low<=stop:b.high>=stop, tp=dir==="BUY"?b.high>=target:b.low<=target;
      if(sl||tp){closed=true;won=tp&&!sl;break;}
    }
    if(!closed)continue;
    const risk=Math.abs(entry-stop), reward=Math.abs(target-entry), rr= risk>0?reward/risk:0;
    add(sessions[wi],won,won?rr:-1); add(overall,won,won?rr:-1); add(dir==="BUY"?long:short,won,won?rr:-1);
    const gi=grades.findIndex(g=>g.grade===grade); if(gi>=0)add(grades[gi],won,won?rr:-1);
  }
  return { sessions, grades, overall, long, short };
}
function recentSwingStructure(input: Candle[], length = 3) {
  const highs: { index:number; price:number }[] = [], lows: { index:number; price:number }[] = [];
  if(input.length < length*2+5) return { label:"INSUFFICIENT HISTORY", lastHigh:null as number|null, lastLow:null as number|null, higherHigh:null as boolean|null, higherLow:null as boolean|null };
  for(let i=length;i<input.length-length;i++){
    const x=input[i];
    let isHigh=true,isLow=true;
    for(let j=i-length;j<=i+length;j++){if(j===i)continue;if(input[j].high>x.high)isHigh=false;if(input[j].low<x.low)isLow=false;}
    if(isHigh)highs.push({index:i,price:x.high});
    if(isLow)lows.push({index:i,price:x.low});
  }
  const h1=highs.at(-2),h2=highs.at(-1),l1=lows.at(-2),l2=lows.at(-1);
  const higherHigh=h1&&h2?h2.price>h1.price:null, higherLow=l1&&l2?l2.price>l1.price:null;
  const label=higherHigh===true&&higherLow===true?"HH + HL · BULLISH":higherHigh===false&&higherLow===false?"LH + LL · BEARISH":"MIXED / TRANSITION";
  return {label,lastHigh:h2?.price??null,lastLow:l2?.price??null,higherHigh,higherLow};
}
function RateBar({ winRate, lossRate }: { winRate:number|null; lossRate:number|null }) {
  const w=Math.max(0,Math.min(100,winRate??0)), l=Math.max(0,Math.min(100,lossRate??0));
  return <div aria-label={`Win rate ${winRate==null?"unavailable":winRate.toFixed(1)+"%"}; loss rate ${lossRate==null?"unavailable":lossRate.toFixed(1)+"%"}`} style={{height:9,display:"flex",width:"100%",overflow:"hidden",borderRadius:99,background:"#263244",marginTop:6}}>
    <div style={{width:w+"%",background:"#22c55e",transition:"width .2s"}}/><div style={{width:l+"%",background:"#ef4444",transition:"width .2s"}}/>
  </div>;
}


type LevelKind = "entry" | "sl" | "tp" | "orange";
const levelColors: Record<LevelKind, { border: string; background: string; text: string }> = {
  entry: { border: "rgba(45,125,255,.65)", background: "rgba(45,125,255,.14)", text: "#dbeafe" },
  sl: { border: "rgba(255,70,70,.65)", background: "rgba(255,70,70,.14)", text: "#fee2e2" },
  tp: { border: "rgba(40,200,110,.65)", background: "rgba(40,200,110,.14)", text: "#dcfce7" },
  orange: { border: "rgba(255,165,45,.65)", background: "rgba(255,165,45,.14)", text: "#ffedd5" },
};

function PriceLevel({ label, value, kind, symbol = "" }: { label: string; value: number | null | undefined; kind: LevelKind; symbol?: string }) {
  const colors = levelColors[kind];
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ height: 18, marginBottom: 5, padding: "0 2px", color: "#a7b0bd", fontSize: 10, lineHeight: "18px", fontWeight: 800, letterSpacing: ".08em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      <div style={{ minHeight: 52, display: "flex", alignItems: "center", justifyContent: "center", padding: "10px 8px", borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.background, color: colors.text, fontSize: 17, lineHeight: 1.1, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {fmt(value, symbol)}
      </div>
    </div>
  );
}

export default function AnalyzerPage() {
  const router = useRouter();
  const [marketType, setMarketType] = useState<MarketType>("FOREX");
  const [symbol, setSymbol] = useState("XAU/USD");
  const [timeframe, setTimeframe] = useState<Timeframe>("15m");
  const [strategy, setStrategy] = useState<string>(PUBLIC_STRATEGY_IDS[0]);
  const [vortexLotSize, setVortexLotSize] = useState(0.05);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [scannerLoading, setScannerLoading] = useState(false);
  const [error, setError] = useState("");
  const [lockedTrade, setLockedTrade] = useState<LockedTrade | null>(null);
  const [clockNow, setClockNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const localClock = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(clockNow);
  const clockMinutes = Number(localClock.slice(0, 2)) * 60 + Number(localClock.slice(3, 5));
  const weekdaySast = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Johannesburg", weekday: "short" }).format(clockNow) === "Mon" ? 1 :
    new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Johannesburg", weekday: "short" }).format(clockNow) === "Tue" ? 2 :
    new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Johannesburg", weekday: "short" }).format(clockNow) === "Wed" ? 3 :
    new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Johannesburg", weekday: "short" }).format(clockNow) === "Thu" ? 4 :
    new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Johannesburg", weekday: "short" }).format(clockNow) === "Fri" ? 5 : 0);
  const sessionWindows = [
    { name: "TOKYO", start: 150, end: 180 },
    { name: "LONDON 1", start: 600, end: 630 },
    { name: "LONDON 2", start: 720, end: 750 },
    { name: "NEW YORK 1", start: 930, end: 960 },
    { name: "NEW YORK 2", start: 1185, end: 1215 },
  ];
  const eligibleWindows = weekdaySast >= 1 && weekdaySast <= 5 ? sessionWindows.filter(w => clockMinutes >= w.end) : [];
  const currentWindow = eligibleWindows.at(-1);
  const inOpeningWindow = weekdaySast >= 1 && weekdaySast <= 5 ? sessionWindows.find(w => clockMinutes >= w.start && clockMinutes < w.end) : undefined;
  const currentSession = inOpeningWindow?.name || (weekdaySast === 6 || weekdaySast === 7 ? "WEEKEND" : "BETWEEN OPENING WINDOWS");
  const latestCompletedSession = currentWindow?.name || "NO COMPLETED WINDOW TODAY";
  const dashboardSelectedSession = inOpeningWindow?.name || currentWindow?.name || "";

  const strategyDisplayName = (id?: string, fallback?: string) => id && PUBLIC_STRATEGY_LABELS[id] ? PUBLIC_STRATEGY_LABELS[id] : fallback || "Strategy";
  const runAnalysis = async () => {
    if (!symbol.trim()) { setError("Select a market symbol first."); return; }
    if (marketType === "SYNTHETIC") { setError("Synthetic indices need the separate Synthetic/Broker data connection."); return; }
    setLoading(true); setError("");
    const priorScanner = result?.scanner;
    const lifecycleLock = lockedTrade ?? (
      priorScanner?.cycleStatus === "ACTIVE" &&
      (priorScanner?.actualEntry != null) &&
      (priorScanner?.projectedStopLoss != null) &&
      (priorScanner?.projectedDirection === "BUY" || priorScanner?.projectedDirection === "SELL")
        ? {
            status: "ACTIVE",
            actualEntry: priorScanner.actualEntry,
            stopLoss: priorScanner.projectedStopLoss,
            tp1: priorScanner.projectedTp1 ?? null,
            tp2: priorScanner.projectedTp2 ?? null,
            finalTp: priorScanner.projectedFinalTp ?? null,
            direction: priorScanner.projectedDirection,
            symbol,
            strategy,
            liquidityTarget: priorScanner?.opposingLiquidityTarget ?? null,
          }
        : null
    );
    if (!lifecycleLock) setResult(null);
    try {
      const res = await fetch("/api/analyze-market", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ marketType, symbol, timeframe, strategy, lotSize: strategy === "vortex" ? vortexLotSize : undefined }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to analyze live market data.");
      setResult(data);
      const candles = Array.isArray(data.chart?.candles) ? data.chart.candles : [];
      if (candles.length >= 30 && strategy !== "srbOb" && strategy !== "lsobr" && strategy !== "ema20" && strategy !== "fibRetracement" && strategy !== "supplyDemand" && strategy !== "vaulttradesNexus" && strategy !== "vortex") {
        setScannerLoading(true);
        try {
          const scannerRes = await fetch("/api/ai-scanner", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
            strategy,
            currentPrice: data.market?.currentPrice,
            candles,
            analysis: data,
            lifecycle: lifecycleLock && lifecycleLock.symbol === symbol && lifecycleLock.strategy === strategy ? lifecycleLock : {}
          }) });
          const scanner = await scannerRes.json();
          if (scannerRes.ok) {
            const sameTrade = lifecycleLock &&
              lifecycleLock.symbol === symbol &&
              lifecycleLock.strategy === strategy &&
              scanner.cycleStatus === "ACTIVE" &&
              scanner.projectedDirection === lifecycleLock.direction;

            if (sameTrade) {
              scanner.actualEntry = lifecycleLock.actualEntry;
              scanner.projectedStopLoss = lifecycleLock.stopLoss;
              scanner.stopLoss = lifecycleLock.stopLoss;
              scanner.projectedTp1 = lifecycleLock.tp1;
              scanner.tp1 = lifecycleLock.tp1;
              scanner.projectedTp2 = lifecycleLock.tp2;
              scanner.tp2 = lifecycleLock.tp2;
              scanner.projectedFinalTp = lifecycleLock.finalTp;
              scanner.finalTp = lifecycleLock.finalTp;
              scanner.projectedEntry = scanner.projectedEntry ?? lifecycleLock.actualEntry;
              scanner.entry = lifecycleLock.actualEntry;
              scanner.opposingLiquidityTarget = lifecycleLock.liquidityTarget ?? scanner.opposingLiquidityTarget ?? null;
              scanner.lockedExecutionLevels = true;
            }

            if (scanner.cycleStatus === "ACTIVE" && scanner.actualEntry != null &&
                scanner.projectedStopLoss != null &&
                (scanner.projectedDirection === "BUY" || scanner.projectedDirection === "SELL")) {
              setLockedTrade({
                direction: scanner.projectedDirection,
                actualEntry: scanner.actualEntry,
                stopLoss: scanner.projectedStopLoss,
                tp1: scanner.projectedTp1 ?? null,
                tp2: scanner.projectedTp2 ?? null,
                finalTp: scanner.projectedFinalTp ?? null,
                symbol,
                strategy,
                liquidityTarget: scanner.opposingLiquidityTarget ?? null,
              });
            } else if (lifecycleLock && ["INVALIDATED", "SL_HIT", "CYCLE_COMPLETE", "COMPLETED"].includes(String(scanner.cycleStatus))) {
              setLockedTrade(null);
            }

            setResult({ ...data, scanner });
          }
        } finally { setScannerLoading(false); }
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to analyze live market data."); setScannerLoading(false); }
    finally { setLoading(false); }
  };

  const changeMarket = (value: MarketType) => { setMarketType(value); setSymbol(DEFAULT_SYMBOLS[value][0]); setResult(null); setLockedTrade(null); setError(""); };
  const srbPerformance = closedSrbPerformance(result?.chart?.candles ?? []);
  const srbStructure = recentSwingStructure(result?.chart?.candles ?? []);
  const srbDisplayScore = result?.strategyEngine ? (result.strategyEngine.breakoutDirection ? (result.strategyEngine.score ?? 0) : Math.max(result.strategyEngine.confluence?.longScore ?? 0, result.strategyEngine.confluence?.shortScore ?? 0)) : 0;
  const s = result?.scanner;
  const displayDirection = s?.projectedDirection && s.projectedDirection !== "NO TRADE" ? s.projectedDirection : result?.direction;
  const projectedEntry = s?.projectedEntry ?? result?.entry;
  const actualEntry = s?.actualEntry ?? null;
  const projectedSL = s?.projectedStopLoss ?? result?.stopLoss;
  const projectedTp1 = s?.projectedTp1 ?? result?.tp1;
  const projectedTp2 = s?.projectedTp2 ?? result?.tp2;
  const projectedFinalTp = s?.projectedFinalTp ?? result?.finalTp;
  const projectedTp3 = projectedTp2 != null && projectedFinalTp != null ? projectedTp2 + (projectedFinalTp - projectedTp2) / 2 : projectedFinalTp;
  const projectedTp4 = projectedFinalTp;
  const projectedRR = s?.rr ?? result?.rr;
  const liquidityLabel = displayDirection === "SELL" ? "LIQ SELL" : "LIQ BUY";
  const liquidityTarget = s?.opposingLiquidityTarget ?? projectedFinalTp;
  const srbState = strategy === "lsobr" ? result?.strategyEngine?.state : strategy === "srbOb" ? result?.strategyEngine?.state : null;
  const rawLifecycleState = String(((strategy === "srbOb" || strategy === "lsobr") ? srbState : s?.cycleStatus || s?.analysisState || s?.statusMessage) ?? "").toUpperCase();
  const tradeIsRunning = s?.cycleStatus === "ACTIVE" || rawLifecycleState === "TRADE OPEN" || rawLifecycleState === "RUNNING" || (s?.actualEntry != null && s?.cycleStatus !== "COMPLETED");
  const pendingSourceStates = ["WAITING", "BUILDING", "INCOMPLETE RANGE", "ARMED", "LIMIT WAIT", "FIB RETEST DETECTED", "SETUP", "DEVELOPING", "WATCHING", "ENTRY READY"];
  const terminalNoTrade = ["CANCELLED", "CANCELED", "EXPIRED", "REJECTED", "INVALIDATED", "COMPLETED", "STOP HIT", "TARGET HIT", "SL_HIT", "TP_HIT", "NO TRADE"].includes(rawLifecycleState)
    || ((strategy === "lsobr" ? (rawLifecycleState === "ENTRY READY" && result?.decision === "NO TRADE") || ["REJECTED", "CANCELLED", "CANCELED", "EXPIRED", "INVALIDATED", "NO TRADE"].includes(rawLifecycleState) : strategy === "srbOb" ? ["REJECTED", "CANCELLED", "CANCELED", "EXPIRED", "INVALIDATED", "NO TRADE"].includes(rawLifecycleState) : result?.decision === "NO TRADE" && !tradeIsRunning && !s?.waitReason && !s?.statusMessage));
  const scannerStatus = strategy === "vaulttradesNexus"
    ? s?.cycleStatus === "ACTIVE" ? "TRADE ACTIVE" : s?.cycleStatus === "TP_HIT" ? "TAKE PROFIT HIT" : s?.cycleStatus === "SL_HIT" ? "STOP LOSS HIT" : "WAITING FOR TRADE"
    : tradeIsRunning ? "TRADE ACTIVE" : s?.cycleStatus === "TP_HIT" ? "TAKE PROFIT HIT" : s?.cycleStatus === "SL_HIT" ? "STOP LOSS HIT" : s?.cycleStatus === "SETUP_DEVELOPING" ? "SETUP DEVELOPING" : terminalNoTrade ? "NO TRADE" : "WAITING FOR TRADE";
  const scannerEntry = (strategy === "srbOb" || strategy === "lsobr") ? result?.strategyEngine?.entry : (actualEntry ?? projectedEntry);
  const scannerStop = (strategy === "srbOb" || strategy === "lsobr") ? result?.strategyEngine?.stopLoss : projectedSL;
  const scannerTp1 = (strategy === "srbOb" || strategy === "lsobr") ? result?.strategyEngine?.finalTp : projectedTp1;
  const openRiskManager = (trade?: { direction: "BUY" | "SELL"; entry: number; stopLoss: number; takeProfit: number }) => {
    const selectedEntry = trade?.entry ?? scannerEntry;
    const selectedStop = trade?.stopLoss ?? scannerStop;
    const selectedTarget = trade?.takeProfit ?? scannerTp1;
    const selectedDirection = trade?.direction ?? displayDirection;
    if (selectedEntry == null || selectedStop == null || selectedTarget == null || !selectedDirection || selectedDirection === "NO TRADE") return;
    const params = new URLSearchParams({ source: "analyzer", symbol, timeframe, strategy: result?.strategy?.name || strategyDisplayName(strategy), direction: selectedDirection, entry: String(selectedEntry), sl: String(selectedStop), tp1: String(selectedTarget) });
    router.push("/risk-manager?" + params.toString());
  };
  const scannerTp2 = (strategy === "srbOb" || strategy === "lsobr") ? null : projectedTp2;
  const vortexView = result?.strategyEngine;
  const vortexChartDirection = vortexView?.openTrade?.direction ??
    (s?.projectedDirection === "BUY" || s?.projectedDirection === "SELL" ? s.projectedDirection : null);
  const vortexChartLevels = strategy === "vortex" && vortexChartDirection && typeof vortexView?.entry === "number" && typeof vortexView.stopLoss === "number"
    ? {
        direction: vortexChartDirection,
        levels: [
          { label: "ENTRY", price: vortexView.entry, kind: "ENTRY" as const },
          { label: "SL", price: vortexView.stopLoss, kind: "SL" as const },
          { label: "TP1", price: vortexView.tp1, kind: "TP" as const },
          { label: "TP2", price: vortexView.tp2, kind: "TP" as const },
          { label: "TP3", price: vortexView.tp3, kind: "TP" as const },
          { label: "TP4", price: vortexView.tp4, kind: "TP" as const },
          { label: "TP5", price: vortexView.tp5, kind: "TP" as const },
        ].filter((level): level is { label: string; price: number; kind: "ENTRY" | "SL" | "TP" } => typeof level.price === "number"),
      }
    : null;
  const rawReasons = (strategy === "srbOb" || strategy === "lsobr")
    ? [...(result?.strategyEngine?.missingConditions ?? []), ...(strategy === "lsobr" && result?.decision === "NO TRADE" ? (result?.missingConditions ?? []) : []), ...(!result?.strategyEngine?.missingConditions?.length ? [result?.strategyEngine?.invalidation].filter((x): x is string => Boolean(x)) : [])]
    : [s?.waitReason, s?.statusMessage, result?.nextAction].filter((x): x is string => Boolean(x));
  const scannerReasons = [...new Set(rawReasons.map(x => x.trim()).filter(Boolean))];
  const scannerReasonFallback = tradeIsRunning
    ? "A trade is active. The recorded entry, stop loss and target remain in force."
    : scannerStatus === "NO TRADE"
      ? "No valid trade is active. Re-analyze after new market evidence or when the invalidating condition changes."
      : "No entry trigger has fired yet. The setup remains under observation.";
  const scannerReason = scannerReasons.length ? scannerReasons : [scannerReasonFallback];
  const marketDevelopmentStatus =
    s?.cycleStatus === "SL_HIT" ? "NO TRADE — DAILY OPPORTUNITY USED" :
    s?.cycleStatus === "TP_HIT" ? "TRADE COMPLETED" :
    s?.analysisState === "ACTIVE" || s?.cycleStatus === "ACTIVE" ? "TRADE ACTIVE" :
    s?.entryConfirmation === true ? "ENTRY CONFIRMED" :
    s?.analysisState === "ENTRY_ZONE" ? "WAITING — RETEST ZONE" :
    s?.analysisState === "CONFIRMATION_PENDING" ? "WAITING — MOMENTUM CONFIRMATION" :
    s?.strategyConditionsMet === true ? "WAITING — ENTRY CONFIRMATION" :
    displayDirection && displayDirection !== "NO TRADE" ? "SETUP FORMING" :
    "MARKET SETUP DEVELOPING";
  const marketDevelopmentDetail = s?.entryConfirmationReason?.trim()
    || s?.waitReason?.trim()
    || s?.tradeReason?.trim()
    || "The selected strategy is monitoring its own setup and confirmation conditions.";
  const tradeStatus = tradeIsRunning || s?.isExecutable === true
    ? "TRADE ACTIVE"
    : s?.cycleStatus === "TP_HIT" ? "TRADE COMPLETED" : terminalNoTrade ? "NO TRADE" : "WAIT";
  const validationStatus = s?.entryConfirmation === true
    ? "ENTRY CONFIRMED"
    : displayDirection && displayDirection !== "NO TRADE"
      ? "RE-ENTRY NOT CONFIRMED"
      : "ENTRY NOT CONFIRMED";

  return <main className="shell">
    <header className="header"><div className="brand-block"><img src="/vaulttrades-logo.png" alt="VaultTrades" className="logo"/><div className="tagline">Built by Traders.</div><div className="slogan">Focus, discipline, consistency.</div></div><div className="badge">ANALYZER</div></header>

    <section className="card">
      <div className="section-label">LIVE MARKET</div>
      <h1 className="title">Analyze the market, not a screenshot</h1>
      <p className="muted">Select a market, timeframe and strategy.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginTop: 18 }}>
        <label className="muted">Market<select value={marketType} disabled={loading} onChange={e => changeMarket(e.target.value as MarketType)} style={{ width: "100%", marginTop: 7, padding: 13, borderRadius: 10, background: "#050812", color: "#f4f6fb", border: "1px solid rgba(212,166,55,.35)" }}>{MARKET_TYPES.map(m => <option key={m} value={m}>{m === "SYNTHETIC" ? "Synthetic indices" : m.charAt(0) + m.slice(1).toLowerCase()}</option>)}</select></label>
        <label className="muted">Symbol<input value={symbol} disabled={loading || marketType === "SYNTHETIC"} onChange={e => setSymbol(e.target.value)} list="symbols" placeholder="e.g. XAU/USD" style={{ width: "100%", marginTop: 7, padding: 13, borderRadius: 10, background: "#050812", color: "#f4f6fb", border: "1px solid rgba(212,166,55,.35)" }}/><datalist id="symbols">{DEFAULT_SYMBOLS[marketType].map(s => <option key={s} value={s}/>)}</datalist></label>
        <label className="muted">Timeframe<select value={timeframe} disabled={loading} onChange={e => { setTimeframe(e.target.value as Timeframe); setResult(null); setLockedTrade(null); }} style={{ width: "100%", marginTop: 7, padding: 13, borderRadius: 10, background: "#050812", color: "#f4f6fb", border: "1px solid rgba(212,166,55,.35)" }}>{TIMEFRAMES.map(tf => <option key={tf} value={tf}>{tf}</option>)}</select></label>
      </div>
    </section>

    <section className="card">
      <div className="section-label">STRATEGY</div>
      <h2 className="title">Choose the strategy first</h2>
      <select value={strategy} disabled={loading} onChange={e => { setStrategy(e.target.value); if (e.target.value === "vortex") setTimeframe("1m"); setResult(null); setLockedTrade(null); }} style={{ width: "100%", marginTop: 14, padding: 14, borderRadius: 10, background: "#050812", color: "#f4f6fb", border: "1px solid rgba(212,166,55,.35)" }}>{PUBLIC_STRATEGY_IDS.map(id => <option key={id} value={id}>{PUBLIC_STRATEGY_LABELS[id]}</option>)}</select>
      <div className="condition-box" style={{ marginTop: 14 }}><strong>{strategyDisplayName(strategy)}</strong></div>
      {strategy === "vortex" && <label className="muted" style={{ display: "block", marginTop: 14 }}>Vortex lot size
        <input type="number" min="0.01" step="0.01" value={vortexLotSize} disabled={loading} onChange={e => setVortexLotSize(Math.max(0.01, Number(e.target.value) || 0.01))} style={{ width: "100%", marginTop: 7, padding: 13, borderRadius: 10, background: "#050812", color: "#f4f6fb", border: "1px solid rgba(212,166,55,.35)" }} />
        <span className="muted" style={{ display: "block", marginTop: 5, fontSize: 12 }}>Default 0.05. Lot sizes 0.01–0.04 close fully at TP1; 0.05 and above split across three progressive targets.</span>
      </label>}
    </section>

    <section className="card"><div className="actions"><button className="primary" type="button" disabled={loading || marketType === "SYNTHETIC"} onClick={() => void runAnalysis()}>{loading ? "Analyzing live market..." : "Analyze Live Market"}</button></div>{marketType === "SYNTHETIC" && <div className="condition-box" style={{ marginTop: 12 }}><strong>Market data unavailable</strong><p className="muted">Please select another market or try again later.</p></div>}{error && <div className="error-box" style={{ marginTop: 12 }}><strong>Market data unavailable</strong><p className="muted">Please try again later.</p></div>}</section>

    {result && <>
      <section className="card"><div className="section-label">LIVE CHART</div><div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}><div><h2 className="title" style={{ marginBottom: 3 }}>{result.market?.asset}</h2><div className="muted">{result.market?.timeframe} · Current price {fmt(result.market?.currentPrice, symbol)}</div></div><div className="condition-box" style={{ padding: "10px 14px" }}><strong>Strategy: {strategyDisplayName(result.strategy?.id, result.strategy?.name)}</strong></div></div><LiveMarketChart symbol={symbol} candles={result.chart?.candles || []} channel={result.chart?.channel20} liquidityTargets={s?.liquidityTargets ?? result.liquidityTargets} orderBlocks={result.chart?.orderBlocks ?? []} orderBlock={strategy === "lsobr" ? result.strategyEngine?.orderBlock ?? null : null} tradeLevels={vortexChartLevels} /></section>

      {strategy === "vaulttradesNexus" ? <section className="card execution-card" style={{ border: "1px solid rgba(212,166,55,.28)", background: "linear-gradient(145deg, rgba(10,16,30,.98), rgba(5,8,18,.98))" }}>
        <div className="section-label">TRADE STATUS</div>
        {result.strategyEngine?.openTrades?.length ? <>
          <h2 className="title" style={{ marginBottom: 12 }}>TRADE ACTIVE</h2>
          <p className="muted" style={{ marginTop: 0 }}>{result.strategyEngine.statusReason}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 12 }}>
            {result.strategyEngine.openTrades.map((trade) => {
              const currentPrice = Number(result.market?.currentPrice);
              const hasCurrentPrice = Number.isFinite(currentPrice);
              const moveFromEntry = hasCurrentPrice ? (trade.direction === "BUY" ? currentPrice - trade.entry : trade.entry - currentPrice) : null;
              const distanceToTarget = hasCurrentPrice ? (trade.direction === "BUY" ? trade.takeProfit - currentPrice : currentPrice - trade.takeProfit) : null;
              const distanceToStop = hasCurrentPrice ? (trade.direction === "BUY" ? currentPrice - trade.stopLoss : trade.stopLoss - currentPrice) : null;
              return <div className="condition-box" key={trade.entryTime}>
                <strong style={{ fontSize: 18, color: trade.direction === "BUY" ? "#35c98a" : "#f06b72" }}>{trade.direction} · TRADE ACTIVE</strong>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8, marginTop: 10 }}>
                  <PriceLevel label="ENTRY" value={trade.entry} kind="entry" symbol={symbol} />
                  <PriceLevel label="STOP LOSS" value={trade.stopLoss} kind="sl" symbol={symbol} />
                  <PriceLevel label="TAKE PROFIT" value={trade.takeProfit} kind="tp" symbol={symbol} />
                </div>
                <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>Signal date: {trade.entryDay} · Entry time: {trade.entryTime}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(125px,1fr))", gap: 8, marginTop: 10 }}>
                  <div className="condition-box"><strong>CURRENT PRICE</strong><div style={{ marginTop: 5 }}>{hasCurrentPrice ? fmt(currentPrice, symbol) : "Unavailable"}</div></div>
                  <div className="condition-box"><strong>MOVE FROM ENTRY</strong><div style={{ marginTop: 5 }}>{moveFromEntry == null ? "—" : (moveFromEntry > 0 ? "+" : "") + fmt(moveFromEntry, symbol)}</div></div>
                  <div className="condition-box"><strong>DISTANCE TO TP</strong><div style={{ marginTop: 5 }}>{distanceToTarget == null ? "—" : fmt(distanceToTarget, symbol)}</div></div>
                  <div className="condition-box"><strong>DISTANCE TO SL</strong><div style={{ marginTop: 5 }}>{distanceToStop == null ? "—" : fmt(distanceToStop, symbol)}</div></div>
                </div>
                <button className="primary" type="button" style={{ marginTop: 12 }} onClick={() => openRiskManager(trade)}>Calculate Lot Size</button>
              </div>;
            })}
          </div>
        </> : result.strategyEngine?.latestClosedTrade ? <>
          <h2 className="title" style={{ marginBottom: 8 }}>{result.strategyEngine.latestClosedTrade.status === "TP_HIT" ? "TAKE PROFIT HIT" : "STOP LOSS HIT"}</h2>
          <p className="muted" style={{ marginTop: 0 }}>{result.strategyEngine.statusReason}</p>
          <div className="condition-box">
            <strong style={{ color: result.strategyEngine.latestClosedTrade.direction === "BUY" ? "#35c98a" : "#f06b72" }}>{result.strategyEngine.latestClosedTrade.direction} · TRADE CLOSED</strong>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8, marginTop: 10 }}>
              <PriceLevel label="ENTRY" value={result.strategyEngine.latestClosedTrade.entry} kind="entry" symbol={symbol} />
              <PriceLevel label="STOP LOSS" value={result.strategyEngine.latestClosedTrade.stopLoss} kind="sl" symbol={symbol} />
              <PriceLevel label="TAKE PROFIT" value={result.strategyEngine.latestClosedTrade.takeProfit} kind="tp" symbol={symbol} />
            </div>
            <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>Entry: {result.strategyEngine.latestClosedTrade.entryTime} · Exit: {result.strategyEngine.latestClosedTrade.exitTime ?? "Completed candle"} · Exit price: {fmt(result.strategyEngine.latestClosedTrade.exitPrice, symbol)}</div>
          </div>
        </> : <>
          <h2 className="title" style={{ marginBottom: 8 }}>WAITING FOR VALID SIGNAL</h2>
          <p className="muted" style={{ marginTop: 0 }}>{result.strategyEngine?.statusReason ?? "No valid signal has been generated from a completed candle yet."}</p>
        </>}
      </section> : strategy === "ema20" ? <section className="card execution-card" style={{ border: "1px solid rgba(212,166,55,.28)", background: "linear-gradient(145deg, rgba(10,16,30,.98), rgba(5,8,18,.98))" }}>
        <div className="section-label">TRADE STATUS</div>
        {(() => {
          const engine = result.strategyEngine;
          const active = engine?.state === "TRADE ACTIVE";
          const completed = engine?.state === "TP HIT" || engine?.state === "SL HIT";
          const direction = active
            ? (engine?.signal === "BUY" || engine?.signal === "SELL" ? engine.signal : null)
            : (engine?.closedDirection ?? null);
          const entry = engine?.entry ?? null;
          const stop = engine?.stopLoss ?? null;
          const target = engine?.finalTp ?? null;
          const current = Number(result.market?.currentPrice);
          const hasCurrent = Number.isFinite(current);
          const move = hasCurrent && entry != null && direction ? (direction === "BUY" ? current - entry : entry - current) : null;
          const toTarget = hasCurrent && target != null && direction ? (direction === "BUY" ? target - current : current - target) : null;
          const toStop = hasCurrent && stop != null && direction ? (direction === "BUY" ? current - stop : stop - current) : null;
          const completedByTarget = engine?.state === "TP HIT";
          return <>
            {active ? <>
              <h2 className="title" style={{ marginBottom: 12 }}>TRADE ACTIVE</h2>
              <p className="muted" style={{ marginTop: 0 }}>{engine?.lifecycleReason ?? "The recorded entry, stop loss and target remain in force until reached on a completed candle."}</p>
            </> : completed ? <>
              <h2 className="title" style={{ marginBottom: 8 }}>{completedByTarget ? "TAKE PROFIT HIT" : "STOP LOSS HIT"}</h2>
              <p className="muted" style={{ marginTop: 0 }}>TRADE COMPLETED — the latest Nexus Plus trade reached its original {completedByTarget ? "target" : "stop loss"}. A new qualifying Pine signal may open the next trade.</p>
            </> : <>
              <h2 className="title" style={{ marginBottom: 8 }}>WAITING FOR VALID SIGNAL</h2>
              <p className="muted" style={{ marginTop: 0 }}>{engine?.lifecycleReason ?? engine?.statusReason ?? "Waiting for the next qualifying Nexus Plus Pine signal."}</p>
            </>}
            {(active || completed) && direction && entry != null && stop != null && target != null ? <div className="condition-box">
              <strong style={{ fontSize: 18, color: direction === "BUY" ? "#35c98a" : "#f06b72" }}>{direction} · {active ? "TRADE ACTIVE" : "TRADE CLOSED"}</strong>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8, marginTop: 10 }}>
                <PriceLevel label="ENTRY" value={entry} kind="entry" symbol={symbol} />
                <PriceLevel label="STOP LOSS" value={stop} kind="sl" symbol={symbol} />
                <PriceLevel label="TAKE PROFIT" value={target} kind="tp" symbol={symbol} />
              </div>
              <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>Signal date: {engine?.entryTime ? new Date(engine.entryTime).toLocaleDateString() : "—"} · Entry time: {engine?.entryTime ? new Date(engine.entryTime).toLocaleString() : "—"}</div>
              {active && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(125px,1fr))", gap: 8, marginTop: 10 }}>
                <div className="condition-box"><strong>CURRENT PRICE</strong><div style={{ marginTop: 5 }}>{hasCurrent ? fmt(current, symbol) : "Unavailable"}</div></div>
                <div className="condition-box"><strong>MOVE FROM ENTRY</strong><div style={{ marginTop: 5 }}>{move == null ? "—" : (move > 0 ? "+" : "") + fmt(move, symbol)}</div></div>
                <div className="condition-box"><strong>DISTANCE TO TP</strong><div style={{ marginTop: 5 }}>{toTarget == null ? "—" : fmt(toTarget, symbol)}</div></div>
                <div className="condition-box"><strong>DISTANCE TO SL</strong><div style={{ marginTop: 5 }}>{toStop == null ? "—" : fmt(toStop, symbol)}</div></div>
              </div>}
              {active && <button className="primary" type="button" style={{ marginTop: 12 }} onClick={() => openRiskManager({ direction, entry, stopLoss: stop, takeProfit: target })}>Calculate Lot Size</button>}
            </div> : !active && !completed ? <p className="muted" style={{ marginBottom: 0 }}>No active position. Waiting for the next qualifying Pine signal.</p> : null}
          </>;
        })()}
      </section> : <section className="card execution-card" style={{ border: "1px solid rgba(212,166,55,.28)", background: "linear-gradient(145deg, rgba(10,16,30,.98), rgba(5,8,18,.98))" }}>
        <div className="section-label">TRADE STATUS</div>
        {(() => {
          const v = strategy === "vortex" ? result.strategyEngine : null;
          const open = strategy === "vortex" ? v?.openTrade : null;
          const closed = strategy === "vortex" ? v?.latestClosedTrade : null;
          const active = strategy === "vortex" ? !!open : strategy === "ema20" ? tradeIsRunning : false;
          const direction = strategy === "vortex"
            ? (open?.direction ?? closed?.direction ?? v?.plannedDirection ?? (v?.direction === "BUY" || v?.direction === "SELL" ? v.direction : null))
            : (result.strategyEngine?.signal ?? displayDirection);
          const entry = strategy === "vortex" ? (open?.entry ?? closed?.entry ?? scannerEntry) : scannerEntry;
          const stop = strategy === "vortex" ? (open?.stopLoss ?? closed?.stopLoss ?? scannerStop) : scannerStop;
          const fibLevel = strategy === "vortex" ? (open?.fibLevel ?? closed?.fibLevel ?? v?.fibLevel ?? null) : null;
          const lot = strategy === "vortex" ? (open?.lotSize ?? v?.lotSize ?? 0.05) : null;
          const target = strategy === "vortex" ? (open?.tp1 ?? closed?.tp1 ?? v?.tp1) : scannerTp1;
          const current = Number(result.market?.currentPrice);
          const hasCurrent = Number.isFinite(current);
          const move = hasCurrent && entry != null && direction ? (direction === "BUY" ? current - entry : entry - current) : null;
          const toTarget = hasCurrent && target != null && direction ? (direction === "BUY" ? target - current : current - target) : null;
          const toStop = hasCurrent && stop != null && direction ? (direction === "BUY" ? current - stop : stop - current) : null;
          const vortexStatus = active
            ? "TRADE ACTIVE"
            : closed
              ? closed.status === "TP_HIT" ? "TAKE PROFIT HIT" : "STOP LOSS HIT"
              : v?.state === "SETUP DEVELOPING" ? "SETUP DEVELOPING" : "WAITING FOR VALID SIGNAL";
          const title = strategy === "vortex" ? vortexStatus : active ? "TRADE ACTIVE" : scannerStatus;
          const entryTime = strategy === "vortex" ? (open?.entryTime ?? closed?.entryTime) : result.strategyEngine?.entryTime;
          const targetLabel = "TAKE PROFIT";
          const pendingDistance = hasCurrent && entry != null ? Math.abs(current - entry) : null;
          const pendingSide = hasCurrent && entry != null ? current > entry ? "above" : current < entry ? "below" : "at" : null;
          return <>
            <h2 className="title" style={{ marginBottom: 8 }}>{title}</h2>
            {strategy === "vortex" && !active && !closed && direction && entry != null && <div style={{ marginTop: -2, marginBottom: 10 }}>
              <strong style={{ fontSize: 17, color: direction === "BUY" ? "#35c98a" : "#f06b72" }}>{direction} SETUP</strong>
              <div className="muted" style={{ marginTop: 4 }}>
                Waiting for {direction} at {fmt(entry, symbol)} · {(typeof fibLevel === "number" ? fibLevel : 68.1).toFixed(1)}% Fib retracement.
                {pendingDistance != null && pendingSide ? ` Current price is ${fmt(current, symbol)} (${fmt(pendingDistance, symbol)} ${pendingSide} entry).` : ""}
              </div>
            </div>}
            {strategy === "vortex" && !active && !closed && (!direction || entry == null) && <p className="muted" style={{ marginTop: 0 }}>No BUY or SELL Fib setup is currently anchored.</p>}
            {strategy !== "vortex" && <p className="muted" style={{ marginTop: 0 }}>{active
              ? (result.strategyEngine?.lifecycleReason ?? "The recorded entry, stop loss and target remain in force until reached on a completed candle.")
              : (result.strategyEngine?.lifecycleReason ?? result.strategyEngine?.statusReason ?? s?.waitReason ?? "Waiting for the next qualifying signal.")}</p>}
            {(strategy === "vortex" ? entry != null && stop != null : (active || (strategy === "vortex" && closed)) && direction && entry != null && stop != null && target != null) && <>
              {strategy !== "vortex" && <strong style={{ fontSize: 18, color: direction === "BUY" ? "#35c98a" : "#f06b72" }}>{direction} · {active ? "TRADE ACTIVE" : "TRADE CLOSED"}</strong>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8, marginTop: 10 }}>
                <PriceLevel label={strategy === "vortex" && !active && !closed ? `ENTRY · ${typeof fibLevel === "number" ? fibLevel : 68.1}% FIB` : "ENTRY"} value={entry} kind="entry" symbol={symbol} />
                <PriceLevel label="STOP LOSS" value={stop} kind="sl" symbol={symbol} />
                <PriceLevel label="TAKE PROFIT · TP1" value={target!} kind="tp" symbol={symbol} />
              </div>
              <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>Signal date: {entryTime ? new Date(entryTime).toLocaleDateString() : "—"} · Entry time: {entryTime ? new Date(entryTime).toLocaleString() : "—"}</div>}
              {active && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(125px,1fr))", gap: 8, marginTop: 10 }}>
                <div className="condition-box"><strong>CURRENT PRICE</strong><div style={{ marginTop: 5 }}>{hasCurrent ? fmt(current, symbol) : "Unavailable"}</div></div>
                <div className="condition-box"><strong>MOVE FROM ENTRY</strong><div style={{ marginTop: 5 }}>{move == null ? "—" : (move > 0 ? "+" : "") + fmt(move, symbol)}</div></div>
                <div className="condition-box"><strong>DISTANCE TO TP</strong><div style={{ marginTop: 5 }}>{toTarget == null ? "—" : fmt(toTarget, symbol)}</div></div>
                <div className="condition-box"><strong>DISTANCE TO SL</strong><div style={{ marginTop: 5 }}>{toStop == null ? "—" : fmt(toStop, symbol)}</div></div>
              </div>}
              {active && <button className="primary" type="button" style={{ marginTop: 12 }} onClick={() => openRiskManager({ direction: direction as "BUY" | "SELL", entry: entry!, stopLoss: stop!, takeProfit: target! })}>Calculate Lot Size</button>}
            </>}
            {!active && !(strategy === "vortex" && closed) && strategy !== "vortex" && <p className="muted" style={{ marginBottom: 0 }}>No active position. {scannerReason[0]}</p>}
          </>;
        })()}
      </section>}
      {strategy === "vaulttradesNexus" && result.strategyEngine?.performance && <section className="card">
        <div className="section-label">PERFORMANCE</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
          {[
            ["Trades", result.strategyEngine.performance.tradesTaken],
            ["Win Rate", result.strategyEngine.performance.winRate.toFixed(1) + "%"],
            ["Profit Factor", result.strategyEngine.performance.profitFactor == null ? "—" : result.strategyEngine.performance.profitFactor.toFixed(2)],
            ["Total R", (result.strategyEngine.performance.totalR > 0 ? "+" : "") + result.strategyEngine.performance.totalR.toFixed(2) + "R"],
            ["Open", result.strategyEngine.performance.openTrades],
          ].map(([label, value]) => <div key={label} className="condition-box"><strong>{label}</strong><div style={{ fontSize: 20, fontWeight: 900, marginTop: 5 }}>{value}</div></div>)}
        </div>
      </section>}
    </>}
    {scannerLoading && result && <div className="muted" style={{ textAlign: "center", padding: 10 }}>Updating market data…</div>}
  </main>;
}

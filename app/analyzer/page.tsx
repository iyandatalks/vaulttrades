"use client";

import { useEffect, useState } from "react";
import { ANALYZER_STRATEGIES, ANALYZER_STRATEGY_MAP } from "../../lib/strategies/analyzerProfiles";
import { LiveMarketChart } from "./LiveMarketChart";

type Timeframe = "1m" | "5m" | "15m" | "30m" | "1H" | "4H" | "1D" | "1W" | "1M";
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

type Result = {
  market?: { type?: MarketType; asset?: string; timeframe?: string; currentPrice?: number | null; directionalBias?: string; session?: string };
  strategy?: { id?: string; name?: string; category?: string };
  sourceIndicators?: { name: string; purpose: string; parameters: string; required: boolean }[];
  indicatorReadings?: { name: string; value: number | null; signal: string; reason: string; values?: Record<string, number | null> }[];
  chart?: { candles: Candle[]; channel20?: { upper: number | null; lower: number | null; middle: number | null } };
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
  strategyEngine?: { source?: string; state?: string; signal?: string; direction?: string; entry?: number | null; stopLoss?: number | null; finalTp?: number | null; rangeHigh?: number | null; rangeLow?: number | null; window?: string | null; fibLevel?: number; score?: number; breakoutPrice?: number | null; breakoutTime?: string | null; breakoutDirection?: "BUY" | "SELL" | null; confluence?: { macroTrend: string; fastTrend: string; rsi: number | null; rsiAligned: boolean | null; volumeRatio: number | null; volumeGood: boolean; rangeSize: number; rangeAtrRatio: number | null; longScore: number; shortScore: number; dxy: string; silver: string; gate: string }; evidence?: string[]; missingConditions?: string[]; liquidityTarget?: number | null; orderBlock?: { direction: string; top: number; bottom: number } | null; riskReward?: number | null; invalidation?: string; ema20?: number | null; slowEMA?: number | null; atr?: number | null; bullStructure?: boolean; bearStructure?: boolean; bullTouch?: boolean; bearTouch?: boolean; bullReject?: boolean; bearReject?: boolean; bullMABreak?: boolean; bearMABreak?: boolean; utBull?: boolean; utBear?: boolean; smiBull?: boolean; smiBear?: boolean; confirmation?: { long: number; short: number } };
};

const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "30m", "1H", "4H", "1D", "1W", "1M"];
const MARKET_TYPES: MarketType[] = ["FOREX", "INDICES", "CRYPTO", "STOCKS", "SYNTHETIC"];
const DEFAULT_SYMBOLS: Record<MarketType, string[]> = {
  FOREX: ["XAU/USD", "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD"],
  INDICES: ["NASDAQ", "SPX", "DOW", "FTSE"],
  CRYPTO: ["BTC/USD", "ETH/USD", "SOL/USD"],
  STOCKS: ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN"],
  SYNTHETIC: ["V75", "V100", "Boom 1000", "Crash 1000"],
};
const PUBLIC_STRATEGY_IDS = ["fibRetracement", "ema20", "supplyDemand", "srbOb"] as const;
const PUBLIC_STRATEGY_LABELS: Record<string, string> = {
  fibRetracement: "1. VaultTrades | Auto Fib Retrace + OB",
  ema20: "2. VaultTrades | EMA20 + OB",
  supplyDemand: "3. VaultTrades | Supply and Demand",
  srbOb: "4. VaultTrades LSOBR",
};
const fmt = (v: number | null | undefined) => v == null || !Number.isFinite(v) ? "—" : v.toLocaleString(undefined, { maximumFractionDigits: 5 });

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

function PriceLevel({ label, value, kind }: { label: string; value: number | null | undefined; kind: LevelKind }) {
  const colors = levelColors[kind];
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ height: 18, marginBottom: 5, padding: "0 2px", color: "#a7b0bd", fontSize: 10, lineHeight: "18px", fontWeight: 800, letterSpacing: ".08em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      <div style={{ minHeight: 52, display: "flex", alignItems: "center", justifyContent: "center", padding: "10px 8px", borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.background, color: colors.text, fontSize: 17, lineHeight: 1.1, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {fmt(value)}
      </div>
    </div>
  );
}

export default function AnalyzerPage() {
  const [marketType, setMarketType] = useState<MarketType>("FOREX");
  const [symbol, setSymbol] = useState("XAU/USD");
  const [timeframe, setTimeframe] = useState<Timeframe>("15m");
  const [strategy, setStrategy] = useState<string>(PUBLIC_STRATEGY_IDS[0]);
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
      const res = await fetch("/api/analyze-market", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ marketType, symbol, timeframe, strategy }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to analyze live market data.");
      setResult(data);
      const candles = Array.isArray(data.chart?.candles) ? data.chart.candles : [];
      if (candles.length >= 30 && strategy !== "srbOb") {
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
  const srbState = strategy === "srbOb" ? result?.strategyEngine?.state : null;
  const rawLifecycleState = (strategy === "srbOb" ? srbState : s?.cycleStatus || s?.analysisState || s?.statusMessage || "").toUpperCase();
  const tradeIsRunning = s?.cycleStatus === "ACTIVE" || rawLifecycleState === "TRADE OPEN" || rawLifecycleState === "RUNNING" || (s?.actualEntry != null && s?.cycleStatus !== "COMPLETED");
  const pendingSourceStates = ["WAITING", "BUILDING", "INCOMPLETE RANGE", "ARMED", "LIMIT WAIT", "FIB RETEST DETECTED", "SETUP", "DEVELOPING", "WATCHING", "ENTRY READY"];
  const terminalNoTrade = ["CANCELLED", "CANCELED", "EXPIRED", "REJECTED", "INVALIDATED", "COMPLETED", "STOP HIT", "TARGET HIT", "NO TRADE"].includes(rawLifecycleState)
    || (strategy === "srbOb" ? Boolean(rawLifecycleState) && !pendingSourceStates.includes(rawLifecycleState) && !tradeIsRunning : result?.decision === "NO TRADE" && !tradeIsRunning && !s?.waitReason && !s?.statusMessage);
  const scannerStatus = tradeIsRunning ? "RUNNING" : terminalNoTrade ? "NO TRADE" : "WAITING";
  const scannerEntry = strategy === "srbOb" ? result?.strategyEngine?.entry : (actualEntry ?? projectedEntry);
  const scannerStop = strategy === "srbOb" ? result?.strategyEngine?.stopLoss : projectedSL;
  const scannerTp1 = strategy === "srbOb" ? result?.strategyEngine?.finalTp : projectedTp1;
  const scannerTp2 = strategy === "srbOb" ? null : projectedTp2;
  const rawReasons = strategy === "srbOb"
    ? (result?.strategyEngine?.missingConditions?.length ? result.strategyEngine.missingConditions : [result?.strategyEngine?.invalidation].filter((x): x is string => Boolean(x)))
    : [s?.waitReason, s?.statusMessage, result?.nextAction].filter((x): x is string => Boolean(x));
  const scannerReasons = [...new Set(rawReasons.map(x => x.trim()).filter(Boolean))];
  const scannerReasonFallback = tradeIsRunning
    ? "A trade is active. The recorded entry, stop loss and target remain in force."
    : scannerStatus === "NO TRADE"
      ? "No valid trade is active. Re-analyze after new market evidence or when the invalidating condition changes."
      : "No entry trigger has fired yet. The setup remains under observation.";
  const scannerReason = scannerReasons.length ? scannerReasons : [scannerReasonFallback];

  return <main className="shell">
    <header className="header"><div className="brand-block"><img src="/vaulttrades-logo.png" alt="VaultTrades" className="logo"/><div className="tagline">Built by Traders.</div><div className="slogan">Focus, discipline, consistency.</div></div><div className="badge">AI SCANNER</div></header>

    <section className="card">
      <div className="section-label">LIVE MARKET</div>
      <h1 className="title">Analyze the market, not a screenshot</h1>
      <p className="muted">Select the market, timeframe and strategy. The selected strategy remains the source of truth; Analyzer Rules 1–6 remain the universal validation layer. AI Scanner adds institutional-volume profiling, directional context and projected trade levels without replacing either.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginTop: 18 }}>
        <label className="muted">Market<select value={marketType} disabled={loading} onChange={e => changeMarket(e.target.value as MarketType)} style={{ width: "100%", marginTop: 7, padding: 13, borderRadius: 10, background: "#050812", color: "#f4f6fb", border: "1px solid rgba(212,166,55,.35)" }}>{MARKET_TYPES.map(m => <option key={m} value={m}>{m === "SYNTHETIC" ? "Synthetic indices" : m.charAt(0) + m.slice(1).toLowerCase()}</option>)}</select></label>
        <label className="muted">Symbol<input value={symbol} disabled={loading || marketType === "SYNTHETIC"} onChange={e => setSymbol(e.target.value)} list="symbols" placeholder="e.g. XAU/USD" style={{ width: "100%", marginTop: 7, padding: 13, borderRadius: 10, background: "#050812", color: "#f4f6fb", border: "1px solid rgba(212,166,55,.35)" }}/><datalist id="symbols">{DEFAULT_SYMBOLS[marketType].map(s => <option key={s} value={s}/>)}</datalist></label>
        <label className="muted">Timeframe<select value={timeframe} disabled={loading} onChange={e => { setTimeframe(e.target.value as Timeframe); setResult(null); setLockedTrade(null); }} style={{ width: "100%", marginTop: 7, padding: 13, borderRadius: 10, background: "#050812", color: "#f4f6fb", border: "1px solid rgba(212,166,55,.35)" }}>{TIMEFRAMES.map(tf => <option key={tf} value={tf}>{tf}</option>)}</select></label>
      </div>
    </section>

    <section className="card">
      <div className="section-label">STRATEGY</div>
      <h2 className="title">Choose the strategy first</h2>
      <select value={strategy} disabled={loading} onChange={e => { setStrategy(e.target.value); setResult(null); setLockedTrade(null); }} style={{ width: "100%", marginTop: 14, padding: 14, borderRadius: 10, background: "#050812", color: "#f4f6fb", border: "1px solid rgba(212,166,55,.35)" }}>{PUBLIC_STRATEGY_IDS.map(id => <option key={id} value={id}>{PUBLIC_STRATEGY_LABELS[id]}</option>)}</select>
      <div className="condition-box" style={{ marginTop: 14 }}><strong>{strategyDisplayName(strategy)}</strong><p className="muted">{strategy === "fibRetracement" ? "Institutional liquidity and structure, prior order blocks, CHOCH-based projection, and timeframe-adjusted Fibonacci retracement levels (61.8%, 68.1%, 78.6%, 88%). The Fib level alone never confirms an entry." : strategy === "ema20" ? "Independent EMA20 pullback strategy using EMA20 and EMA105 context, persistent swing structure, EMA touch/rejection, rejection break, and UT Bot OR SMI confirmation. Uses its own source-defined stop and target rules." : strategy === "supplyDemand" ? "Independent supply and demand zone strategy. Zone reach, reaction, hold and flip are validated separately." : strategy === "srbOb" ? "Independent session-range breakout and order-block strategy. Breakouts arm a wick-anchored Fibonacci pullback; the breakout candle is not an entry." : "Strategy-specific rules are loaded from the selected strategy profile."}</p><p className="muted">Analyzer Rules 1–6 remain the universal validation layer. Only the selected strategy supplies the primary setup logic and trade levels.</p></div>
    </section>

    <section className="card"><div className="actions"><button className="primary" type="button" disabled={loading || marketType === "SYNTHETIC"} onClick={() => void runAnalysis()}>{loading ? "Analyzing live market..." : "Analyze Live Market"}</button></div>{marketType === "SYNTHETIC" && <div className="condition-box" style={{ marginTop: 12 }}><strong>Synthetic market connection</strong><p className="muted">This route deliberately does not substitute another provider. Connect the Synthetic/Broker provider before enabling synthetic analysis.</p></div>}{error && <div className="error-box" style={{ marginTop: 12 }}><strong>Analysis Error</strong><p className="muted">{error}</p></div>}</section>

    {result && <>
      <section className="card"><div className="section-label">LIVE CHART</div><div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}><div><h2 className="title" style={{ marginBottom: 3 }}>{result.market?.asset}</h2><div className="muted">{result.market?.timeframe} · Current price {fmt(result.market?.currentPrice)}</div></div><div className="condition-box" style={{ padding: "10px 14px" }}><strong>Strategy: {strategyDisplayName(result.strategy?.id, result.strategy?.name)}</strong></div></div><LiveMarketChart candles={result.chart?.candles || []} channel={result.chart?.channel20} liquidityTargets={s?.liquidityTargets ?? result.liquidityTargets} /></section>

      {strategy === "ema20" && result.strategyEngine && <section className="card" style={{ border: "1px solid rgba(212,166,55,.4)" }}>
        <div className="section-label">EMA20 + OB ENGINE · LIVE SOURCE STATE</div>
        <h2 className="title">{result.strategyEngine.state || "WAITING"} · {result.strategyEngine.signal || "NO TRADE"}</h2>
        <p className="muted">Source-native EMA20 logic: persistent confirmed structure → EMA20 pullback/rejection → break of rejection boundary → UT Bot or SMI confirmation. No new signal means no entry is fabricated.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 10, marginTop: 14 }}>
          <PriceLevel label="EMA20" value={result.strategyEngine.ema20} kind="orange" />
          <PriceLevel label="SLOW EMA CONTEXT" value={result.strategyEngine.slowEMA} kind="orange" />
          <PriceLevel label="ATR(14)" value={result.strategyEngine.atr} kind="orange" />
          <PriceLevel label="SOURCE ENTRY" value={result.strategyEngine.entry} kind="entry" />
          <PriceLevel label="SOURCE STOP" value={result.strategyEngine.stopLoss} kind="sl" />
          <PriceLevel label="SOURCE TARGET" value={result.strategyEngine.finalTp} kind="tp" />
        </div>
        <div className="condition-box" style={{ marginTop: 12 }}>
          <strong>Confirmation score · Long {result.strategyEngine.confirmation?.long ?? 0}/2 · Short {result.strategyEngine.confirmation?.short ?? 0}/2</strong>
          <p className="muted">{result.strategyEngine.evidence?.join(" · ") || "No active source confirmations on the latest candle."}</p>
          {result.strategyEngine.missingConditions?.length ? <p className="muted">Setup conditions: {result.strategyEngine.missingConditions.join(" · ")}</p> : null}
          <p className="muted">Invalidation: {result.strategyEngine.invalidation || "No active rejection setup."}</p>
        </div>
      </section>}
      <section className="card execution-card" style={{ border: "1px solid rgba(212,166,55,.28)", background: "linear-gradient(145deg, rgba(10,16,30,.98), rgba(5,8,18,.98))" }}>
        <div className="section-label">AI SCANNER</div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}><div><h2 className="title" style={{ marginBottom: 4 }}>{scannerStatus}</h2><div className="muted">{s?.trend || result.marketCondition || "Market state"} · {s?.institutionalActivity ? `Institutional activity: ${s.institutionalActivity}` : result.market?.directionalBias}</div></div><div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><div style={{ minWidth: 135, textAlign: "center", padding: 12, borderRadius: 12, background: "rgba(212,166,55,.10)", border: "1px solid rgba(212,166,55,.35)" }}><span className="muted">QUALITY</span><div style={{ fontSize: 28, fontWeight: 900 }}>{Math.round(result.confidence ?? 0)}<span style={{ fontSize: 15 }}>/100</span></div></div><div style={{ minWidth: 135, textAlign: "center", padding: 12, borderRadius: 12, background: "rgba(45,125,255,.10)", border: "1px solid rgba(45,125,255,.35)" }}><span className="muted">PROJECTED PROBABILITY</span><div style={{ fontSize: 28, fontWeight: 900 }}>{s?.projectedProbability ?? "—"}<span style={{ fontSize: 15 }}>{s?.projectedProbability != null ? "%" : ""}</span></div></div></div></div>
        <div style={{ marginTop: 15 }}><strong>Trend</strong><p>{s?.trendReason || result.marketStructure}</p><strong>{scannerStatus === "RUNNING" ? "Trade status" : scannerStatus === "NO TRADE" ? "Why no trade" : "Why we are waiting"}</strong>{scannerReason.length > 1 ? <ul style={{ marginTop: 8, paddingLeft: 22 }}>{scannerReason.map((reason, index) => <li key={index} style={{ marginBottom: 6 }}>{reason}</li>)}</ul> : <p>{scannerReason[0]}</p>}</div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10, marginTop: 16, alignItems: "start" }}>
          <PriceLevel label="ENTRY" value={scannerEntry} kind="entry" />
          <PriceLevel label="STOP LOSS" value={scannerStop} kind="sl" />
          <PriceLevel label="TP1" value={scannerTp1} kind="tp" />
          <PriceLevel label="TP2" value={scannerTp2} kind="tp" />
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
          <div className="execution-item" style={{ minWidth: 180 }}><span>TRADE STATUS</span><strong>{scannerStatus}</strong></div>
        </div>
      </section>

      <section className="card"><div className="section-label">SHARED LIQUIDITY TARGETS</div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12 }}><div className="condition-box"><strong>BUY-SIDE LIQUIDITY</strong><div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>{fmt((s?.liquidityTargets ?? result.liquidityTargets)?.buySide?.price)}</div><p className="muted">{(s?.liquidityTargets ?? result.liquidityTargets)?.buySide?.source?.replaceAll("_", " ") || "No confirmed target above current price"}</p></div><div className="condition-box"><strong>SELL-SIDE LIQUIDITY</strong><div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>{fmt((s?.liquidityTargets ?? result.liquidityTargets)?.sellSide?.price)}</div><p className="muted">{(s?.liquidityTargets ?? result.liquidityTargets)?.sellSide?.source?.replaceAll("_", " ") || "No confirmed target below current price"}</p></div><div className="condition-box"><strong>ACTIVE TRADE TARGET</strong><div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>{fmt(s?.opposingLiquidityTarget)}</div><p className="muted">Shared confirmed-swing liquidity reference. Entry confirmation remains strategy-specific.</p></div></div></section>\n\n

      <section className="card"><div className="section-label">VALIDATION</div><div className="condition-box"><strong>{s?.entryConfirmation ? "ENTRY CONFIRMED" : "ENTRY NOT CONFIRMED"}</strong><p className="muted">{s?.entryConfirmation ? "The selected strategy has completed its required entry confirmation." : "No trade is confirmed until the strategy's required entry conditions are satisfied."}</p></div></section>
    </>}
    {scannerLoading && result && <div className="muted" style={{ textAlign: "center", padding: 10 }}>AI Scanner is profiling volume, institutional activity and projected market path…</div>}
  </main>;
}

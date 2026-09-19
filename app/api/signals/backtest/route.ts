import { createClient } from "../../../../lib/supabase/server";
import { getTwelveDataTimeSeries, type MarketDataCandle } from "../../../../lib/market-data/twelvedata";

export const runtime = "nodejs";

type Signal = {
  id: string; trade_id: string; canonical_symbol: string; direction: "BUY"|"SELL";
  strategy_id: string; strategy_name: string; timeframe: string; entry: number|null;
  stop_loss: number|null; tp1: number|null; tp2: number|null; tp3: number|null; tp4: number|null; fired_at: string;
};

function mapTf(tf: string) {
  const x=tf.toUpperCase();
  if (x==="M1") return "1m"; if (x==="M5") return "5m"; if (x==="M10") return "5m";
  if (x==="M15") return "15m"; if (x==="M30") return "30m"; if (x==="H1") return "1H";
  if (x==="H4") return "4H"; if (x==="D1") return "1D"; return null;
}

function aggregate10m(c: MarketDataCandle[]) {
  const buckets=new Map<number,MarketDataCandle>();
  for (const x of c) {
    const t=Date.parse(x.datetime); if (!Number.isFinite(t)) continue;
    const key=Math.floor(t/(10*60*1000))*(10*60*1000);
    const prev=buckets.get(key);
    if (!prev) buckets.set(key,{...x,datetime:new Date(key).toISOString()});
    else { prev.high=Math.max(prev.high,x.high); prev.low=Math.min(prev.low,x.low); prev.close=x.close; prev.volume=(prev.volume??0)+(x.volume??0); }
  }
  return [...buckets.values()].sort((a,b)=>Date.parse(a.datetime)-Date.parse(b.datetime));
}

function evaluate(signal: Signal, candles: MarketDataCandle[]) {
  if (signal.entry==null || signal.stop_loss==null || signal.tp1==null) return {result:"INVALID", bars:0};
  const entry=signal.entry, sl=signal.stop_loss, tp=signal.tp1;
  const start=Date.parse(signal.fired_at);
  let startIndex=candles.findIndex(c=>Date.parse(c.datetime)>=start);
  if(startIndex<0) startIndex=0;
  for(let i=startIndex;i<candles.length;i++){
    const c=candles[i];
    if(signal.direction==="BUY"){
      if(c.low<=sl && c.high>=tp) return {result:"AMBIGUOUS_SAME_BAR",bars:i-startIndex+1};
      if(c.low<=sl) return {result:"SL",bars:i-startIndex+1};
      if(c.high>=tp) return {result:"TP1",bars:i-startIndex+1};
    } else {
      if(c.high>=sl && c.low<=tp) return {result:"AMBIGUOUS_SAME_BAR",bars:i-startIndex+1};
      if(c.high>=sl) return {result:"SL",bars:i-startIndex+1};
      if(c.low<=tp) return {result:"TP1",bars:i-startIndex+1};
    }
  }
  return {result:"OPEN",bars:Math.max(0,candles.length-startIndex)};
}

export async function GET(request:Request){
  try{
    const supabase=await createClient();
    const {data:{user}}=await supabase.auth.getUser();
    if(!user) return Response.json({error:"Authentication required."},{status:401});
    const sp=new URL(request.url).searchParams;
    const days=Math.min(Math.max(Number(sp.get("days")||"5"),1),30);
    const strategy=sp.get("strategy"); const timeframe=sp.get("timeframe");
    const cutoff=new Date(Date.now()-days*86400000).toISOString();
    let q=supabase.from("scanner_signals").select("id,trade_id,canonical_symbol,direction,strategy_id,strategy_name,timeframe,entry,stop_loss,tp1,tp2,tp3,tp4,fired_at").eq("auth_user_id",user.id).eq("canonical_symbol","XAUUSD").gte("fired_at",cutoff).order("fired_at",{ascending:false}).limit(200);
    if(strategy) q=q.eq("strategy_id",strategy); if(timeframe) q=q.eq("timeframe",timeframe.toUpperCase());
    const {data,error}=await q; if(error) throw error;
    const signals=(data??[]) as Signal[];
    const groups=new Map<string,Signal[]>();
    for(const s of signals){const key=mapTf(s.timeframe); if(key) groups.set(key,[...(groups.get(key)||[]),s]);}
    const results:any[]=[];
    for(const [providerTf,items] of groups){
      const snap=await getTwelveDataTimeSeries({symbol:"XAU/USD",timeframe:providerTf,outputsize:Math.min(5000,Math.max(100,days*24*60/(providerTf==="1m"?1:providerTf==="5m"?5:providerTf==="15m"?15:providerTf==="30m"?30:providerTf==="1H"?60:providerTf==="4H"?240:1440)))});
      let candles=snap.candles;
      if(items.some(x=>x.timeframe==="M10")) candles=aggregate10m(candles);
      for(const s of items) results.push({...s,...evaluate(s,candles)});
    }
    results.sort((a,b)=>Date.parse(b.fired_at)-Date.parse(a.fired_at));
    const summary={total:results.length,tp1:results.filter(x=>x.result==="TP1").length,sl:results.filter(x=>x.result==="SL").length,open:results.filter(x=>x.result==="OPEN").length,ambiguous:results.filter(x=>x.result==="AMBIGUOUS_SAME_BAR").length,invalid:results.filter(x=>x.result==="INVALID").length};
    return Response.json({ok:true,days,provider:"Twelve Data",method:"historical signal replay",summary,results});
  }catch(e){console.error("Signal backtest failed",e);return Response.json({error:e instanceof Error?e.message:"Backtest failed."},{status:500});}
}

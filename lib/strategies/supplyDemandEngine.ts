import type { MarketDataCandle } from "../market-data/twelvedata";

type Direction = "BUY" | "SELL" | "NO TRADE";
type Zone = { direction: "DEMAND" | "SUPPLY"; top: number; bottom: number; index: number; createdAt: string; fresh: boolean; intact: boolean; };

export type SupplyDemandResult = {
  source: "SUPPLY_DEMAND_DETERMINISTIC";
  state: "ENTRY READY" | "WAITING" | "NO TRADE";
  direction: Direction;
  entry: number | null;
  stopLoss: number | null;
  tp1: number | null;
  tp2: number | null;
  finalTp: number | null;
  riskReward: number | null;
  confidence: number;
  marketCondition: string;
  evidence: string[];
  missingConditions: string[];
  invalidation: string;
  zones: Zone[];
  activeZone: Zone | null;
  liquidityTarget: number | null;
};

const mean = (values: number[]) => values.length ? values.reduce((a,b)=>a+b,0)/values.length : 0;
const atr = (candles: MarketDataCandle[], length = 14) => {
  const sample = candles.slice(-(length + 1));
  if (sample.length < 3) return null;
  const ranges = sample.slice(1).map((c,i) => Math.max(c.high-c.low, Math.abs(c.high-sample[i].close), Math.abs(c.low-sample[i].close)));
  return mean(ranges);
};

function isPivot(c: MarketDataCandle[], i: number, n: number, side: "high"|"low") {
  if (i < n || i + n >= c.length) return false;
  const value = side === "high" ? c[i].high : c[i].low;
  for (let j=i-n;j<=i+n;j++) {
    if (j===i) continue;
    if (side==="high" ? c[j].high >= value : c[j].low <= value) return false;
  }
  return true;
}

/**
 * Deterministic Supply & Demand evaluator.
 * A zone is created only by a confirmed 5-bar pivot followed by displacement
 * that closes beyond the pivot candle's opposite extreme. A close through the
 * zone invalidates it; any subsequent overlap marks it mitigated (not fresh).
 * Entry requires a fresh retest, a sweep/reclaim and directional displacement.
 */
export function evaluateSupplyDemand(candles: MarketDataCandle[]): SupplyDemandResult {
  const empty = (missing: string[], zones: Zone[] = []): SupplyDemandResult => ({
    source:"SUPPLY_DEMAND_DETERMINISTIC", state:"NO TRADE", direction:"NO TRADE",
    entry:null, stopLoss:null, tp1:null, tp2:null, finalTp:null, riskReward:null,
    confidence:0, marketCondition:"Insufficient structure", evidence:[],
    missingConditions:missing, invalidation:"A zone is invalid after a confirmed close through its distal boundary.",
    zones, activeZone:null, liquidityTarget:null
  });
  if (candles.length < 40) return empty(["At least 40 candles are required to establish confirmed zones."]);
  const c = candles.slice(-500), n=5, zones:Zone[]=[];
  for (let i=n;i<c.length-n-3;i++) {
    if (isPivot(c,i,n,"low")) {
      const origin=c[i], avgLower=mean(c.slice(Math.max(0,i-4),i+1).map(x=>Math.max(0,Math.min(x.open,x.close)-x.low)));
      const bottom=origin.low, top=Math.min(origin.high, bottom+Math.max(avgLower,(origin.high-origin.low)*0.15));
      const follow=c.slice(i+1,Math.min(c.length,i+6));
      const displaced=follow.some(x=>x.close>origin.high && x.close>x.open);
      if (displaced) {
        let intact=true, fresh=true;
        for(let j=i+1;j<c.length;j++){
          if(c[j].close<bottom){intact=false;fresh=false;break;}
          if(c[j].low<=top && c[j].high>=bottom) fresh=false;
        }
        if(intact) zones.push({direction:"DEMAND",top,bottom,index:i,createdAt:c[i].datetime,fresh,intact});
      }
    }
    if (isPivot(c,i,n,"high")) {
      const origin=c[i], avgUpper=mean(c.slice(Math.max(0,i-4),i+1).map(x=>Math.max(0,x.high-Math.max(x.open,x.close))));
      const top=origin.high, bottom=Math.max(origin.low, top-Math.max(avgUpper,(origin.high-origin.low)*0.15));
      const follow=c.slice(i+1,Math.min(c.length,i+6));
      const displaced=follow.some(x=>x.close<origin.low && x.close<x.open);
      if (displaced) {
        let intact=true, fresh=true;
        for(let j=i+1;j<c.length;j++){
          if(c[j].close>top){intact=false;fresh=false;break;}
          if(c[j].high>=bottom && c[j].low<=top) fresh=false;
        }
        if(intact) zones.push({direction:"SUPPLY",top,bottom,index:i,createdAt:c[i].datetime,fresh,intact});
      }
    }
  }
  const last=c.at(-1)!, prev=c.at(-2)!, volatility=atr(c);
  const demand=zones.filter(z=>z.direction==="DEMAND"&&z.fresh).sort((a,b)=>b.index-a.index)[0]??null;
  const supply=zones.filter(z=>z.direction==="SUPPLY"&&z.fresh).sort((a,b)=>b.index-a.index)[0]??null;
  const recentHighs:number[]=[], recentLows:number[]=[];
  for(let i=Math.max(n,c.length-150);i<c.length-n;i++){if(isPivot(c,i,n,"high"))recentHighs.push(c[i].high);if(isPivot(c,i,n,"low"))recentLows.push(c[i].low);}
  const demandTarget=recentHighs.filter(x=>x>last.close).sort((a,b)=>a-b)[0]??null;
  const supplyTarget=recentLows.filter(x=>x<last.close).sort((a,b)=>b-a)[0]??null;
  const demandTouched=!!demand&&last.low<=demand.top&&last.high>=demand.bottom;
  const supplyTouched=!!supply&&last.high>=supply.bottom&&last.low<=supply.top;
  const bullSweep=last.low<prev.low&&last.close>prev.low;
  const bearSweep=last.high>prev.high&&last.close<prev.high;
  const bullDisplacement=!!volatility&&last.close>last.open&&(last.close-last.open)>=volatility*0.45&&last.close>prev.high;
  const bearDisplacement=!!volatility&&last.close<last.open&&(last.open-last.close)>=volatility*0.45&&last.close<prev.low;
  const buyReady=!!demand&&demandTouched&&bullSweep&&bullDisplacement&&demandTarget!==null;
  const sellReady=!!supply&&supplyTouched&&bearSweep&&bearDisplacement&&supplyTarget!==null;
  const chooseBuy=buyReady&&(!sellReady||demand!.index>supply!.index);
  const chooseSell=sellReady&&!chooseBuy;
  const zone=chooseBuy?demand:chooseSell?supply:null;
  const direction:Direction=chooseBuy?"BUY":chooseSell?"SELL":"NO TRADE";
  const entry=direction==="NO TRADE"?null:last.close;
  const buffer=volatility?volatility*0.1:0;
  const stopLoss=chooseBuy?demand!.bottom-buffer:chooseSell?supply!.top+buffer:null;
  const target=chooseBuy?demandTarget:chooseSell?supplyTarget:null;
  const risk=entry!==null&&stopLoss!==null?Math.abs(entry-stopLoss):null;
  const reward=entry!==null&&target!==null?Math.abs(target-entry):null;
  const rr=risk&&reward?reward/risk:null;
  const evidence:string[]=[];
  if(demand)evidence.push(`Fresh demand zone ${demand.bottom}–${demand.top} formed after bullish displacement.`);
  if(supply)evidence.push(`Fresh supply zone ${supply.bottom}–${supply.top} formed after bearish displacement.`);
  if(demandTouched)evidence.push("Price retested the fresh demand zone.");
  if(supplyTouched)evidence.push("Price retested the fresh supply zone.");
  if(bullSweep)evidence.push("Sell-side liquidity sweep/reclaim detected on the latest candle.");
  if(bearSweep)evidence.push("Buy-side liquidity sweep/rejection detected on the latest candle.");
  if(bullDisplacement)evidence.push("Bullish displacement closed above the previous candle high.");
  if(bearDisplacement)evidence.push("Bearish displacement closed below the previous candle low.");
  if(target!==null)evidence.push(`Opposing structural liquidity objective: ${target}.`);
  const missing:string[]=[];
  if(!demand&&!supply)missing.push("No fresh, intact supply/demand zone formed by confirmed structure and displacement is currently available.");
  if((demand||supply)&&!demandTouched&&!supplyTouched)missing.push("Waiting for price to return to a fresh zone; proximity alone is not an entry.");
  if((demandTouched||supplyTouched)&&!bullSweep&&!bearSweep)missing.push("A liquidity sweep and reclaim/rejection is still required.");
  if((demandTouched||supplyTouched)&&!bullDisplacement&&!bearDisplacement)missing.push("A confirmed directional displacement/structure break is still required.");
  if((demandTouched||supplyTouched)&&!demandTarget&&!supplyTarget)missing.push("No valid opposing structural liquidity target is available.");
  const marketCondition=last.close>prev.close?"Short-term bullish":last.close<prev.close?"Short-term bearish":"Balanced";
  return {
    source:"SUPPLY_DEMAND_DETERMINISTIC",state:direction==="NO TRADE"?(zones.length?"WAITING":"NO TRADE"):"ENTRY READY",
    direction,entry,stopLoss,tp1:target,tp2:null,finalTp:target,riskReward:rr,
    confidence:direction==="NO TRADE"?Math.min(65,35+evidence.length*5):Math.min(95,75+evidence.length*3),
    marketCondition,evidence,missingConditions:missing,
    invalidation:zone?(chooseBuy?`Demand invalidation: a candle close below ${zone.bottom}.`:`Supply invalidation: a candle close above ${zone.top}.`):"A close through a zone's distal boundary invalidates that zone.",
    zones:zones.slice(-12),activeZone:zone,liquidityTarget:target
  };
}

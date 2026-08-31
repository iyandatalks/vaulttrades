import type { Candle } from '../types';
import { getTwelveDataTimeSeries, resolveTwelveDataSymbol } from '../market-data/twelvedata';
import { vaultFibSignal } from '../strategies/vaultFib';
import { latestUTBot } from '../strategies/utBot';

export type VaultAutoFibResult={side:'BUY'|'SELL';entry:number;stopLoss:number;takeProfit:number;tp1:number;tp2:number;tp3:number;confidence:number;quality:string;reason:string[];timeframe:'M5'|'M15'};

function strategySignal(c:Candle[],confirmation:Candle[],dxy:Candle[],offset:number):VaultAutoFibResult|null{
  if(c.length<60)return null;
  const fib=vaultFibSignal(c,{confirmation,dxy,confirmationOffsetMs:offset});
  if(!fib)return null;
  const ut=latestUTBot(c,1,10);
  if(!ut)return null;
  const aligned=fib.side==='BUY'?ut.buy:fib.side==='SELL'?ut.sell:false;
  if(!aligned)return null;
  return {side:fib.side,entry:fib.entry,stopLoss:fib.stopLoss,takeProfit:fib.takeProfit,tp1:fib.tp1,tp2:fib.tp2,tp3:fib.tp3,confidence:fib.confidence,quality:fib.quality,reason:[...fib.reason,'UT Bot confirmation',`UT Bot ${fib.side}`],timeframe:'M5'};
}

export async function scanVaultAutoFib():Promise<VaultAutoFibResult[]>{
  const [m5,m15,dxy5,dxy15]=await Promise.all([
    getTwelveDataTimeSeries({symbol:'XAU/USD',timeframe:'5m',outputsize:2500}),
    getTwelveDataTimeSeries({symbol:'XAU/USD',timeframe:'15m',outputsize:1000}),
    getTwelveDataTimeSeries({symbol:await resolveTwelveDataSymbol('INDICES','DXY'),timeframe:'5m',outputsize:2500}),
    getTwelveDataTimeSeries({symbol:await resolveTwelveDataSymbol('INDICES','DXY'),timeframe:'15m',outputsize:1000}),
  ]);
  const cv=(x:{datetime:string;open:number;high:number;low:number;close:number;volume:number|null}):Candle=>({time:Date.parse(x.datetime),open:x.open,high:x.high,low:x.low,close:x.close,volume:x.volume??0});
  const a=m5.candles.map(cv),b=m15.candles.map(cv),dx5=dxy5.candles.map(cv),dx15=dxy15.candles.map(cv);
  const out:VaultAutoFibResult[]=[];
  const s5=strategySignal(a,a,dx5,5*60*1000-1); if(s5){s5.timeframe='M5';out.push(s5);}
  const fib15=vaultFibSignal(b,{confirmation:a,dxy:dx15,confirmationOffsetMs:15*60*1000-1});
  if(fib15){const ut=latestUTBot(b,1,10);const aligned=ut&&(fib15.side==='BUY'?ut.buy:ut.sell);if(aligned)out.push({side:fib15.side,entry:fib15.entry,stopLoss:fib15.stopLoss,takeProfit:fib15.takeProfit,tp1:fib15.tp1,tp2:fib15.tp2,tp3:fib15.tp3,confidence:fib15.confidence,quality:fib15.quality,reason:[...fib15.reason,'UT Bot confirmation',`UT Bot ${fib15.side}`],timeframe:'M15'});}
  return out;
}

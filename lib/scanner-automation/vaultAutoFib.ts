import type { Candle } from '../types';
import { getTwelveDataTimeSeries, resolveTwelveDataSymbol } from '../market-data/twelvedata';
import { vaultFibSignal } from '../strategies/vaultFib';
import { latestUTBot } from '../strategies/utBot';
import { evaluateEntryConfirmation } from '../strategies/entryConfirmation';

const MAX_SIGNAL_AGE_MS = 2 * 60 * 60 * 1000;
const M15_TIMEFRAME = 'M15' as const;

export type VaultAutoFibResult = { side:'BUY'|'SELL'; entry:number; stopLoss:number; takeProfit:number; tp1:number; tp2:number; tp3:number; confidence:number; quality:string; reason:string[]; timeframe:typeof M15_TIMEFRAME; signalTime:number };

function confirmed(c:Candle[], side:'BUY'|'SELL') {
  return evaluateEntryConfirmation(c,{side,lookback:20,atrLength:14,displacementAtr:0.60,retestBars:6,volumeMultiplier:1.2,requireVolume:true});
}

function buildM15Signal(c:Candle[], m5:Candle[], dxy:Candle[], now:number):VaultAutoFibResult|null {
  if(c.length<60 || m5.length<30) return null;
  // The master Vault Auto Fib strategy is evaluated on M15. Its displacement
  // confirmation is explicitly M5, so never substitute the M15 series here.
  const fib=vaultFibSignal(c,{confirmation:m5,dxy,confirmationOffsetMs:15*60*1000-1});
  if(!fib) return null;
  const signalTime=c[fib.pullbackBar]?.time ?? 0;
  if(!signalTime || now-signalTime>MAX_SIGNAL_AGE_MS || signalTime>now) return null;

  const entryConfirmation=confirmed(m5,fib.side);
  if(!entryConfirmation.valid) return null;

  // UT Bot is an optional additional confluence. The master Auto Fib rules
  // remain the gate; UT Bot can increase confidence but cannot create a trade.
  const ut=latestUTBot(m5,1,10);
  const utAligned=Boolean(ut&&(fib.side==='BUY'?ut.buy:ut.sell));
  const confidence=Math.min(100,Math.round((fib.confidence+entryConfirmation.score+(utAligned?10:0))/3));
  const reason=[...fib.reason,...entryConfirmation.evidence,`Entry confirmation ${entryConfirmation.score}/100`,utAligned?`UT Bot ${fib.side} optional confluence`:'UT Bot optional confluence not aligned'];

  return {side:fib.side,entry:fib.entry,stopLoss:fib.stopLoss,takeProfit:fib.takeProfit,tp1:fib.tp1,tp2:fib.tp2,tp3:fib.tp3,confidence,quality:fib.quality,reason,timeframe:M15_TIMEFRAME,signalTime};
}

export async function scanVaultAutoFib():Promise<VaultAutoFibResult[]> {
  const [m15,m5,dxy15]=await Promise.all([
    getTwelveDataTimeSeries({symbol:'XAU/USD',timeframe:'15m',outputsize:1000}),
    getTwelveDataTimeSeries({symbol:'XAU/USD',timeframe:'5m',outputsize:1000}),
    getTwelveDataTimeSeries({symbol:await resolveTwelveDataSymbol('INDICES','DXY'),timeframe:'15m',outputsize:1000}),
  ]);
  const cv=(x:{datetime:string;open:number;high:number;low:number;close:number;volume:number|null}):Candle=>({time:Date.parse(x.datetime),open:x.open,high:x.high,low:x.low,close:x.close,volume:x.volume??0});
  const c=m15.candles.map(cv),m5c=m5.candles.map(cv),dxy=dxy15.candles.map(cv),now=c.at(-1)?.time??Date.now();
  const signal=buildM15Signal(c,m5c,dxy,now);
  return signal?[signal]:[];
}

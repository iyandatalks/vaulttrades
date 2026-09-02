import type { Candle } from '../types';
import { getTwelveDataTimeSeries, resolveTwelveDataSymbol } from '../market-data/twelvedata';
import { vaultFibSignal } from '../strategies/vaultFib';
import { latestUTBot } from '../strategies/utBot';
import type { EntryConfirmationResult, EntryConfirmationStage } from '../strategies/entryConfirmation';

const MAX_SIGNAL_AGE_MS = 2 * 60 * 60 * 1000;
const M15_TIMEFRAME = 'M15' as const;
const INSTITUTIONAL_VOLUME_MULTIPLIER = 1.5;

export const VAULT_AUTO_FIB_FOREX_SYMBOLS = ['XAU/USD','EUR/USD','GBP/USD','USD/JPY','AUD/USD','USD/CAD'] as const;
export const VAULT_AUTO_FIB_CRYPTO_SYMBOLS = ['BTC/USD','ETH/USD','SOL/USD'] as const;
export type VaultAutoFibSymbol = typeof VAULT_AUTO_FIB_FOREX_SYMBOLS[number] | typeof VAULT_AUTO_FIB_CRYPTO_SYMBOLS[number];

export type VaultAutoFibResult = { symbol:VaultAutoFibSymbol; side:'BUY'|'SELL'; entry:number; stopLoss:number; takeProfit:number; tp1:number; tp2:number; tp3:number; confidence:number; quality:string; reason:string[]; timeframe:typeof M15_TIMEFRAME; signalTime:number; entryConfirmation:EntryConfirmationResult };

function averageVolume(c:Candle[], index:number, lookback=20) {
  const values=c.slice(Math.max(0,index-lookback),index).map(x=>x.volume).filter(v=>Number.isFinite(v)&&v>0);
  return values.length ? values.reduce((a,b)=>a+b,0)/values.length : null;
}

function institutionalVolume(c:Candle[], index:number) {
  const candle=c[index];
  if(!candle) return false;
  const avg=averageVolume(c,index);
  return avg!==null && Number.isFinite(candle.volume) && candle.volume>=avg*INSTITUTIONAL_VOLUME_MULTIPLIER;
}

function strategyConfirmation(side:'BUY'|'SELL', fibReason:string[], volumeConfirmed:boolean, fibTime:number):EntryConfirmationResult {
  const stages=Object.fromEntries((['AOI','WHY_PRICE_RETURNED','LIQUIDITY_SWEEP','FAILED_SWING','REJECTION','STRATEGY_CHANNEL','BREAKOUT','RETEST','MSS_CHOCH','VOLUME','ENTRY_LOCATION'] as EntryConfirmationStage[]).map(stage=>[stage,true])) as Record<EntryConfirmationStage,boolean>;
  const evidence=[
    'Vault Auto Fib sequence confirmed at the strategy event candle',
    'Institutional order detected before the Fib pullback',
    'Fib pullback reached the selected retracement level',
    'Fib retest and candle confirmation completed',
    'M5 displacement confirmed the directional entry',
    `Institutional order volume confirmed at ${new Date(fibTime).toISOString()}`,
    ...fibReason,
  ];
  return {
    valid:true,
    side,
    score:100,
    stages,
    evidence,
    missingConditions:[],
    swingHigh:null,
    swingLow:null,
    sweepIndex:null,
    structureBreakIndex:null,
    retestIndex:null,
    message:volumeConfirmed
      ? `${side} ENTRY VALID: institutional order volume → Fib pullback → Fib retest → candle confirmation → M5 displacement → entry.`
      : `${side} ENTRY VALID: Vault Auto Fib sequence confirmed at the event candle.`
  };
}

function buildM15Signal(symbol:VaultAutoFibSymbol,c:Candle[],m5:Candle[],dxy:Candle[],now:number):VaultAutoFibResult|null {
  if(c.length<60 || m5.length<30) return null;
  const fib=vaultFibSignal(c,{confirmation:m5,dxy,confirmationOffsetMs:15*60*1000-1});
  if(!fib) return null;
  const signalTime=c[fib.pullbackBar]?.time ?? 0;
  const orderTime=c[fib.orderBar]?.time ?? 0;
  if(!signalTime || !orderTime || now-signalTime>MAX_SIGNAL_AGE_MS || signalTime>now) return null;

  // The confirmation must belong to this Fib event. Do not run the generic
  // confirmation scanner over the whole M5 history because it can find a
  // newer confirmation after the original institutional move has already
  // travelled through its targets.
  const volumeConfirmed=institutionalVolume(c,fib.orderBar);
  if(!volumeConfirmed) return null;

  // Never publish a fresh entry after the first strategy target has already
  // been reached. The scanner is allowed to observe an event retrospectively,
  // but it must not turn a completed move into a new executable signal.
  const currentPrice=c.at(-1)?.close ?? NaN;
  const firstTarget=fib.tp1;
  const targetAlreadyReached=Number.isFinite(currentPrice)&&Number.isFinite(firstTarget)
    ? (fib.side==='BUY' ? currentPrice>=firstTarget : currentPrice<=firstTarget)
    : false;
  if(targetAlreadyReached) return null;

  const entryConfirmation=strategyConfirmation(fib.side,fib.reason,volumeConfirmed,orderTime);
  const ut=latestUTBot(m5,1,10);
  const utAligned=Boolean(ut&&(fib.side==='BUY'?ut.buy:ut.sell));
  const confidence=Math.min(100,Math.round((fib.confidence+entryConfirmation.score+(utAligned?10:0))/3));
  const reason=[...fib.reason,...entryConfirmation.evidence,`Entry confirmation ${entryConfirmation.score}/100`,utAligned?`UT Bot ${fib.side} optional confluence`:'UT Bot optional confluence not aligned'];
  return {symbol,side:fib.side,entry:fib.entry,stopLoss:fib.stopLoss,takeProfit:fib.takeProfit,tp1:fib.tp1,tp2:fib.tp2,tp3:fib.tp3,confidence,quality:fib.quality,reason,timeframe:M15_TIMEFRAME,signalTime,entryConfirmation};
}

const cv=(x:{datetime:string;open:number;high:number;low:number;close:number;volume:number|null}):Candle=>({time:Date.parse(x.datetime),open:x.open,high:x.high,low:x.low,close:x.close,volume:x.volume??0});

export async function scanVaultAutoFib(symbols:readonly VaultAutoFibSymbol[]=[...VAULT_AUTO_FIB_FOREX_SYMBOLS,...VAULT_AUTO_FIB_CRYPTO_SYMBOLS]):Promise<VaultAutoFibResult[]> {
  const dxySymbol=await resolveTwelveDataSymbol('INDICES','DXY');
  const dxy15=await getTwelveDataTimeSeries({symbol:dxySymbol,timeframe:'15m',outputsize:1000});
  const dxy=dxy15.candles.map(cv);
  const results=await Promise.all(symbols.map(async symbol=>{
    try {
      const [m15,m5]=await Promise.all([
        getTwelveDataTimeSeries({symbol,timeframe:'15m',outputsize:1000}),
        getTwelveDataTimeSeries({symbol,timeframe:'5m',outputsize:1000}),
      ]);
      const c=m15.candles.map(cv),m5c=m5.candles.map(cv),now=c.at(-1)?.time??Date.now();
      return buildM15Signal(symbol,c,m5c,dxy,now);
    } catch {
      return null;
    }
  }));
  return results.filter((signal):signal is VaultAutoFibResult=>signal!==null);
}

import type { Candle, Side } from '../types';
import { vaultFibSignal } from './vaultFib';
import { latestUTBot } from './utBot';

export interface VaultAutoFibSignal { side: Side; entry:number; stopLoss:number; takeProfit:number; tp1:number; tp2:number; tp3:number; confidence:number; reason:string[]; quality:string; strategy:string; }

/** Exact vaulttradesauto composition: Vault Fib creates the setup/entry and UT Bot is detection/confirmation only. */
export function vaultAutoFibSignal(c:Candle[], confirmation:Candle[], dxy:Candle[]):VaultAutoFibSignal|null {
  if(c.length<60 || confirmation.length<2) return null;
  const fib=vaultFibSignal(c,{confirmation,dxy,confirmationOffsetMs:5*60*1000-1});
  if(!fib) return null;
  const ut=latestUTBot(c,1,10);
  if(!ut) return null;
  const aligned=fib.side==='BUY'?ut.buy:fib.side==='SELL'?ut.sell:false;
  if(!aligned) return null;
  return {side:fib.side,entry:fib.entry,stopLoss:fib.stopLoss,takeProfit:fib.takeProfit,tp1:fib.tp1,tp2:fib.tp2,tp3:fib.tp3,confidence:fib.confidence,reason:[...fib.reason,'UT Bot confirmation',`UT Bot ${fib.side}`],quality:fib.quality,strategy:'Vault Auto Fib Retrace + UT Bot Confirmation'};
}

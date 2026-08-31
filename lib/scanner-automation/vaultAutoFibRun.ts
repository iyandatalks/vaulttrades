import { createServiceClient } from '../supabase/service';
import { publishAutomatedScannerSignal } from '../signals/publishAutomatedScannerSignal';
import { scanVaultAutoFib } from './vaultAutoFib';

export async function runScheduledVaultAutoFib(){
  const supabase=createServiceClient();
  const {data:configs,error}=await supabase.schema('scanner_automation').from('configs').select('auth_user_id,enabled,forex_enabled,observe_mode').eq('enabled',true);
  if(error) throw new Error(`Unable to load scanner automation configuration: ${error.message}`);
  const users=(configs??[]).filter((x)=>x.forex_enabled);
  if(!users.length) return {status:'SKIPPED',reason:'no_enabled_forex_automation_configs'};
  const signals=await scanVaultAutoFib();
  let published=0,duplicates=0;const errors:string[]=[];
  const runKey=`VAULT-FIB-${new Date().toISOString().slice(0,16).replace(/[-:T]/g,'')}`;
  for(const signal of signals){
    for(const user of users){
      const result=await publishAutomatedScannerSignal({
        authUserId:user.auth_user_id,runKey,marketType:'FOREX',symbol:'XAU/USD',timeframe:signal.timeframe,strategyId:'autoFibRetrace',
        scanner:{projectedDirection:signal.side,analysisState:'CONFIRMED',isExecutable:true,actualEntry:signal.entry,stopLoss:signal.stopLoss,tp1:signal.tp1,tp2:signal.tp2,tp3:signal.tp3,tp4:signal.takeProfit,projectedProbability:signal.confidence,confirmations:signal.reason,tradeReason:'Automated Vault Auto Fib Retrace + UT Bot Confirmation signal. No Analyzer action is required.',rr:signal.stopLoss!==signal.entry?Math.abs(signal.tp1-signal.entry)/Math.abs(signal.entry-signal.stopLoss):null},
        analysis:{source:'vaulttradesauto',sourceStrategy:'Vault Auto Fib Retrace + UT Bot Confirmation',authoritative:true,observeMode:user.observe_mode,timeframe:signal.timeframe,automation:'AUTOMATED'}
      });
      if(result.published)published++;if(result.duplicate)duplicates++;if(result.error)errors.push(`${user.auth_user_id}: ${result.error}`);
    }
  }
  return {status:'COMPLETED',signalsDetected:signals.length,signalsPublished:published,duplicates,errors};
}

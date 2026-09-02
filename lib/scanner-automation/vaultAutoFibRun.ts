import { createServiceClient } from '../supabase/service';
import { publishAutomatedScannerSignal } from '../signals/publishAutomatedScannerSignal';
import { scanVaultAutoFib, VAULT_AUTO_FIB_CRYPTO_SYMBOLS, VAULT_AUTO_FIB_FOREX_SYMBOLS, type VaultAutoFibSymbol } from './vaultAutoFib';

const CRYPTO_SET = new Set<string>(VAULT_AUTO_FIB_CRYPTO_SYMBOLS);
const marketType = (symbol:string) => CRYPTO_SET.has(symbol) ? 'CRYPTO' : 'FOREX';

export async function runScheduledVaultAutoFib(){
  const supabase=createServiceClient();
  const {data:configs,error}=await supabase.schema('scanner_automation').from('configs').select('auth_user_id,enabled,forex_enabled,crypto_enabled,observe_mode,enabled_strategies').eq('enabled',true);
  if(error) throw new Error(`Unable to load scanner automation configuration: ${error.message}`);
  const users=(configs??[]).filter((x)=>Array.isArray(x.enabled_strategies)&&x.enabled_strategies.includes('autoFibRetrace')&&(x.forex_enabled||x.crypto_enabled));
  if(!users.length) return {status:'SKIPPED',reason:'no_enabled_auto_fib_automation_configs'};

  const configuredSymbols=new Set<VaultAutoFibSymbol>();
  for(const user of users){
    if(user.forex_enabled) VAULT_AUTO_FIB_FOREX_SYMBOLS.forEach(symbol=>configuredSymbols.add(symbol));
    if(user.crypto_enabled) VAULT_AUTO_FIB_CRYPTO_SYMBOLS.forEach(symbol=>configuredSymbols.add(symbol));
  }
  const symbols=[...configuredSymbols];
  const signals=await scanVaultAutoFib(symbols);
  let published=0,duplicates=0;const errors:string[]=[];
  const runKey=`VAULT-FIB-M15-${new Date().toISOString().slice(0,16).replace(/[-:T]/g,'')}`;

  for(const signal of signals){
    const category=marketType(signal.symbol);
    for(const user of users){
      if(category==='FOREX'&&!user.forex_enabled) continue;
      if(category==='CRYPTO'&&!user.crypto_enabled) continue;
      const result=await publishAutomatedScannerSignal({
        authUserId:user.auth_user_id,runKey,marketType:category,symbol:signal.symbol,timeframe:'15m',strategyId:'autoFibRetrace',
        scanner:{projectedDirection:signal.side,analysisState:'CONFIRMED',isExecutable:true,actualEntry:signal.entry,stopLoss:signal.stopLoss,tp1:signal.tp1,tp2:signal.tp2,tp3:signal.tp3,tp4:signal.takeProfit,projectedProbability:signal.confidence,confirmations:signal.reason,tradeReason:`Fresh M15 Vault Auto Fib master-strategy confirmation for ${signal.symbol}. UT Bot is optional additional confluence.`,rr:signal.stopLoss!==signal.entry?Math.abs(signal.tp1-signal.entry)/Math.abs(signal.entry-signal.stopLoss):null},
        analysis:{source:'vaulttradesauto',sourceStrategy:'Vault Auto Fib Retrace + UT Bot optional confluence',authoritative:true,observeMode:user.observe_mode,timeframe:'M15',automation:'AUTOMATED',signalTime:signal.signalTime,marketType:category,entryConfirmation:signal.entryConfirmation,confirmationBar:signal.entryConfirmation.retestIndex!=null?String(signal.entryConfirmation.retestIndex):undefined}
      });
      if(result.published) published++;
      if(result.duplicate) duplicates++;
      if(result.error) errors.push(`${user.auth_user_id}/${signal.symbol}: ${result.error}`);
    }
  }
  return {status:'COMPLETED',timeframe:'M15',symbolsScanned:symbols,signalsDetected:signals.length,signalsPublished:published,duplicates,errors};
}

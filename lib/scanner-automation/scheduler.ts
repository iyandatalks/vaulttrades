import { createServiceClient } from "../supabase/service";
import { getTwelveDataTimeSeries } from "../market-data/twelvedata";
import { DEFAULT_ADAPTIVE_AUTOMATED_CONFIG, evaluateAdaptiveAutomated } from "../strategies/adaptiveAutomated";
import { runEmaAutomatedEngine } from "../strategies/emaAutomatedEngine";
import { publishAutomatedScannerSignal } from "../signals/publishAutomatedScannerSignal";
import { startScannerRun, finishScannerRun } from "./runs";

const TIMEZONE = "Africa/Johannesburg";
const CANDLE_COUNT = 250;
const EMA_START = 1 * 60 + 30;
const EMA_END = 8 * 60 + 45;
const FOREX_SYMBOLS = ["XAU/USD", "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD"] as const;
const CRYPTO_SYMBOLS = ["BTC/USD", "ETH/USD", "SOL/USD"] as const;
const CRYPTO_SET = new Set<string>(CRYPTO_SYMBOLS);
const SUPPORTED_STRATEGIES = new Set(["emaAutomated", "adaptiveAutomated"]);

type ScannerConfig = { auth_user_id: string; enabled: boolean; observe_mode: boolean; forex_enabled: boolean; crypto_enabled: boolean; enabled_strategies: string[] };
type Job = "ADAPTIVE_M5" | "ADAPTIVE_M15" | "EMA";

function localClock(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")), hour: Number(get("hour")), minute: Number(get("minute")) };
}

export function isWithinEmaAutomationWindow(date = new Date()) {
  const clock = localClock(date); const minutes = clock.hour * 60 + clock.minute;
  return minutes >= EMA_START && minutes <= EMA_END;
}
function makeRunKey(job: Job, date = new Date()) {
  const clock = localClock(date); const minute = Math.floor(clock.minute / 5) * 5;
  return `${job}-${clock.year}${String(clock.month).padStart(2, "0")}${String(clock.day).padStart(2, "0")}-${String(clock.hour).padStart(2, "0")}${String(minute).padStart(2, "0")}`;
}
function enabledSymbols(configs: ScannerConfig[]) {
  const symbols = new Set<string>();
  for (const config of configs) { if (config.forex_enabled) FOREX_SYMBOLS.forEach((symbol) => symbols.add(symbol)); if (config.crypto_enabled) CRYPTO_SYMBOLS.forEach((symbol) => symbols.add(symbol)); }
  return [...symbols];
}
function marketType(symbol: string) { return CRYPTO_SET.has(symbol) ? "CRYPTO" : "FOREX"; }

export async function runScheduledScanner(job: Job) {
  if (job === "EMA" && !isWithinEmaAutomationWindow()) return { status: "SKIPPED", reason: "outside_ema_automation_window", runKey: makeRunKey(job) };
  const supabase = createServiceClient();
  const { data: rows, error: configError } = await supabase.schema("scanner_automation").from("configs").select("auth_user_id,enabled,observe_mode,forex_enabled,crypto_enabled,enabled_strategies").eq("enabled", true);
  if (configError) throw new Error(`Unable to load scanner automation configuration: ${configError.message}`);
  const configs = (rows ?? []) as ScannerConfig[];
  if (!configs.length) return { status: "SKIPPED", reason: "no_enabled_scanner_configs", runKey: makeRunKey(job) };
  const runKey = makeRunKey(job); const run = await startScannerRun(runKey, { timezone: TIMEZONE, job, executionMode: "OBSERVE_ONLY" });
  if (run.duplicate) return { status: "DUPLICATE", runKey }; if (run.error) throw new Error(run.error);
  let marketsEvaluated = 0, strategiesEvaluated = 0, signalsDetected = 0, signalsPublished = 0, duplicateSignals = 0; const errors: string[] = [];
  try {
    for (const symbol of enabledSymbols(configs)) {
      const category = marketType(symbol);
      const strategyId = job === "EMA" ? "emaAutomated" : "adaptiveAutomated";
      const eligibleUsers = configs.filter((config) => config.enabled_strategies.includes(strategyId) && SUPPORTED_STRATEGIES.has(strategyId) && (category === "CRYPTO" ? config.crypto_enabled : config.forex_enabled));
      if (!eligibleUsers.length) continue; marketsEvaluated += 1;
      try {
        if (job === "EMA") {
          const snapshot = await getTwelveDataTimeSeries({ symbol, timeframe: "5m", outputsize: CANDLE_COUNT });
          const latest = runEmaAutomatedEngine(snapshot.candles).at(-1);
          if (!latest || (!latest.newLong && !latest.newShort)) continue;
          const direction = latest.newLong ? "BUY" : "SELL"; signalsDetected += 1;
          for (const config of eligibleUsers) {
            strategiesEvaluated += 1;
            const result = await publishAutomatedScannerSignal({
              authUserId: config.auth_user_id, runKey, marketType: category, symbol, timeframe: "5m", strategyId: "emaAutomated",
              scanner: {
                projectedDirection: direction, analysisState: "CONFIRMED", isExecutable: true,
                actualEntry: latest.newLong ? latest.longEntry : latest.shortEntry,
                stopLoss: latest.newLong ? latest.longSL : latest.shortSL,
                tp1: latest.newLong ? latest.longTP : latest.shortTP, tp2: latest.newLong ? latest.longTP : latest.shortTP,
                tp3: latest.newLong ? latest.longTP : latest.shortTP, tp4: latest.newLong ? latest.longTP : latest.shortTP,
                confirmations: ["EMA20 structure", "EMA20 rejection break", "UT Bot OR SMI confirmation"],
                tradeReason: "EMA Automated independently produced a new signal transition on M5.", rr: 1.81,
              },
              analysis: { source: "EMA Automated", sourceStrategy: "EMA20 Pullback Morning Engine", authoritative: true, observeMode: config.observe_mode, timeframe: "5m", marketType: category },
            });
            if (result.error) errors.push(`${config.auth_user_id}/${symbol}: ${result.error}`); if (result.published) signalsPublished += 1; if (result.duplicate) duplicateSignals += 1;
          }
        } else {
          const timeframe = job === "ADAPTIVE_M5" ? "5m" : "15m";
          const snapshot = await getTwelveDataTimeSeries({ symbol, timeframe, outputsize: CANDLE_COUNT });
          const candles = snapshot.candles.map((c) => ({ open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume ?? null }));
          const current = evaluateAdaptiveAutomated(candles, DEFAULT_ADAPTIVE_AUTOMATED_CONFIG); const previous = evaluateAdaptiveAutomated(candles.slice(0, -1), DEFAULT_ADAPTIVE_AUTOMATED_CONFIG);
          const isNew = current.confirmed && current.direction !== previous.direction;
          if (!isNew || !current.entry || !current.stopLoss || !current.tp1) continue; signalsDetected += 1;
          for (const config of eligibleUsers) {
            strategiesEvaluated += 1;
            const result = await publishAutomatedScannerSignal({
              authUserId: config.auth_user_id, runKey, marketType: category, symbol, timeframe, strategyId: "adaptiveAutomated",
              scanner: {
                projectedDirection: current.direction, analysisState: "CONFIRMED", isExecutable: true,
                actualEntry: current.entry, stopLoss: current.stopLoss, tp1: current.tp1, tp2: current.tp2, tp3: current.tp3, tp4: current.tp4,
                projectedProbability: current.score,
                confirmations: [`Entry Confirmation: YES — ${timeframe.toUpperCase()} independently confirmed ${current.direction}.`, `Adaptive score ${current.score}/100.`],
                tradeReason: `${timeframe.toUpperCase()} independently satisfied the Adaptive Automated Entry Confirmation rule.`,
                rr: current.risk && current.tp1 ? Math.abs(current.tp1 - current.entry) / current.risk : null,
              },
              analysis: { source: "Adaptive Automated", sourceStrategy: "Adaptive Execution Engine", authoritative: true, selectedTimeframe: timeframe.toUpperCase(), observeMode: config.observe_mode, result: current },
            });
            if (result.error) errors.push(`${config.auth_user_id}/${symbol}: ${result.error}`); if (result.published) signalsPublished += 1; if (result.duplicate) duplicateSignals += 1;
          }
        }
      } catch (error) { errors.push(`${symbol}: ${error instanceof Error ? error.message : String(error)}`); }
    }
    await finishScannerRun(runKey, { status: "COMPLETED", marketsEvaluated, strategiesEvaluated, signalsDetected, signalsPublished, duplicateSignals, observeOnly: configs.every((config) => config.observe_mode), errorMessage: errors.length ? errors.slice(0, 10).join(" | ") : null, metadata: { errors: errors.slice(0, 25), job, timezone: TIMEZONE, strategies: ["adaptiveAutomated", "emaAutomated"] } });
    return { status: "COMPLETED", runKey, job, marketsEvaluated, strategiesEvaluated, signalsDetected, signalsPublished, duplicateSignals, errors };
  } catch (error) {
    await finishScannerRun(runKey, { status: "FAILED", marketsEvaluated, strategiesEvaluated, signalsDetected, signalsPublished, duplicateSignals, observeOnly: configs.every((config) => config.observe_mode), errorMessage: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

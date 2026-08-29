import { createServiceClient } from "../supabase/service";
import { getTwelveDataTimeSeries } from "../market-data/twelvedata";
import { runEma20Engine } from "../strategies/ema20Engine";
import { publishAutomatedScannerSignal } from "../signals/publishAutomatedScannerSignal";
import { startScannerRun, finishScannerRun } from "./runs";

const TIMEZONE = "Africa/Johannesburg";
const TIMEFRAME = "5m";
const CANDLE_COUNT = 250;
const AUTOMATION_START = 1 * 60 + 30;
const AUTOMATION_END = 8 * 60 + 45;

const FOREX_SYMBOLS = ["XAU/USD", "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD"] as const;
const CRYPTO_SYMBOLS = ["BTC/USD", "ETH/USD", "SOL/USD"] as const;
const SUPPORTED_STRATEGIES = new Set(["ema20"]);

type ScannerConfig = {
  auth_user_id: string;
  enabled: boolean;
  observe_mode: boolean;
  forex_enabled: boolean;
  crypto_enabled: boolean;
  enabled_strategies: string[];
  trade_time_start: string;
  trade_time_end: string;
  timezone: string;
};

function localClock(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "00";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

export function isWithinEmaAutomationWindow(date = new Date()) {
  const clock = localClock(date);
  const minutes = clock.hour * 60 + clock.minute;
  return minutes >= AUTOMATION_START && minutes <= AUTOMATION_END;
}

function makeRunKey(date = new Date()) {
  const clock = localClock(date);
  const minute = Math.floor(clock.minute / 5) * 5;
  return `EMA-AUTO-${clock.year}${String(clock.month).padStart(2, "0")}${String(clock.day).padStart(2, "0")}-${String(clock.hour).padStart(2, "0")}${String(minute).padStart(2, "0")}`;
}

function enabledSymbols(configs: ScannerConfig[]) {
  const symbols = new Set<string>();
  for (const config of configs) {
    if (config.forex_enabled) FOREX_SYMBOLS.forEach(symbol => symbols.add(symbol));
    if (config.crypto_enabled) CRYPTO_SYMBOLS.forEach(symbol => symbols.add(symbol));
  }
  return [...symbols];
}

function marketType(symbol: string) {
  return symbol.includes("/") && ["BTC/USD", "ETH/USD", "SOL/USD"].includes(symbol) ? "CRYPTO" : "FOREX";
}

export async function runScheduledScanner() {
  const now = new Date();
  const runKey = makeRunKey(now);

  if (!isWithinEmaAutomationWindow(now)) {
    return { status: "SKIPPED", reason: "outside_ema_automation_window", runKey };
  }

  const supabase = createServiceClient();
  const { data: rows, error: configError } = await supabase
    .schema("scanner_automation")
    .from("configs")
    .select("auth_user_id,enabled,observe_mode,forex_enabled,crypto_enabled,enabled_strategies,trade_time_start,trade_time_end,timezone")
    .eq("enabled", true);

  if (configError) throw new Error(`Unable to load scanner automation configuration: ${configError.message}`);
  const configs = (rows ?? []) as ScannerConfig[];
  if (!configs.length) return { status: "SKIPPED", reason: "no_enabled_scanner_configs", runKey };

  const run = await startScannerRun(runKey, {
    timezone: TIMEZONE,
    timeframe: TIMEFRAME,
    window: "01:30-08:45",
    enabledUsers: configs.length,
    executionMode: "OBSERVE_ONLY",
  });
  if (run.duplicate) return { status: "DUPLICATE", runKey };
  if (run.error) throw new Error(run.error);

  let marketsEvaluated = 0;
  let strategiesEvaluated = 0;
  let signalsDetected = 0;
  let signalsPublished = 0;
  let duplicateSignals = 0;
  const errors: string[] = [];

  try {
    const symbols = enabledSymbols(configs);
    for (const symbol of symbols) {
      marketsEvaluated += 1;
      let snapshot;
      try {
        snapshot = await getTwelveDataTimeSeries({ symbol, timeframe: TIMEFRAME, outputsize: CANDLE_COUNT });
      } catch (error) {
        errors.push(`${symbol}: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }

      const bars = runEma20Engine(snapshot.candles);
      const latest = bars.at(-1);
      if (!latest) continue;

      const direction = latest.newLong ? "BUY" : latest.newShort ? "SELL" : null;
      if (!direction) continue;
      signalsDetected += 1;

      const eligibleUsers = configs.filter(config => {
        const strategyEnabled = config.enabled_strategies.some(strategy => SUPPORTED_STRATEGIES.has(strategy));
        const marketEnabled = marketType(symbol) === "CRYPTO" ? config.crypto_enabled : config.forex_enabled;
        return strategyEnabled && marketEnabled;
      });

      for (const config of eligibleUsers) {
        if (!config.enabled_strategies.includes("ema20")) continue;
        strategiesEvaluated += 1;

        const result = await publishAutomatedScannerSignal({
          authUserId: config.auth_user_id,
          runKey,
          marketType: marketType(symbol),
          symbol,
          timeframe: TIMEFRAME,
          strategyId: "ema20",
          scanner: {
            projectedDirection: direction,
            analysisState: "CONFIRMED",
            isExecutable: true,
            actualEntry: direction === "BUY" ? latest.longEntry : latest.shortEntry,
            stopLoss: direction === "BUY" ? latest.longSL : latest.shortSL,
            tp1: direction === "BUY" ? latest.longTP : latest.shortTP,
            confirmations: direction === "BUY"
              ? ["EMA20 structure", "EMA20 rejection break", "UT Bot OR SMI confirmation"]
              : ["EMA20 structure", "EMA20 rejection break", "UT Bot OR SMI confirmation"],
            tradeReason: "Automated EMA20 engine produced a new signal transition on the 5-minute execution timeframe.",
            rr: 1.81,
          },
          analysis: {
            source: "EMA20 Pullback Morning Engine",
            candle: latest,
            observeMode: config.observe_mode,
            marketType: marketType(symbol),
            timeframe: TIMEFRAME,
          },
        });

        if (result.error) errors.push(`${config.auth_user_id}/${symbol}: ${result.error}`);
        if (result.published) signalsPublished += 1;
        if (result.duplicate) duplicateSignals += 1;
      }
    }

    await finishScannerRun(runKey, {
      status: "COMPLETED",
      marketsEvaluated,
      strategiesEvaluated,
      signalsDetected,
      signalsPublished,
      duplicateSignals,
      observeOnly: configs.every(config => config.observe_mode),
      errorMessage: errors.length ? errors.slice(0, 10).join(" | ") : null,
      metadata: { errors: errors.slice(0, 25), timeframe: TIMEFRAME, timezone: TIMEZONE },
    });

    return { status: "COMPLETED", runKey, marketsEvaluated, strategiesEvaluated, signalsDetected, signalsPublished, duplicateSignals, errors };
  } catch (error) {
    await finishScannerRun(runKey, {
      status: "FAILED",
      marketsEvaluated,
      strategiesEvaluated,
      signalsDetected,
      signalsPublished,
      duplicateSignals,
      observeOnly: configs.every(config => config.observe_mode),
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

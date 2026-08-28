import { ANALYZER_STRATEGY_MAP } from "../strategies/analyzerProfiles";
import { isPreferredTradeTimeframe } from "../strategies/adaptiveExecution";

export type ScannerSignalPublication = {
  marketType: string;
  symbol: string;
  timeframe: string;
  strategyId: string;
  strategyName?: string | null;
  scanner: {
    projectedDirection?: "BUY" | "SELL" | "NO TRADE";
    analysisState?: string;
    isExecutable?: boolean;
    actualEntry?: number | null;
    stopLoss?: number | null;
    tp1?: number | null;
    tp2?: number | null;
    tp3?: number | null;
    tp4?: number | null;
    projectedTp1?: number | null;
    projectedTp2?: number | null;
    projectedTp3?: number | null;
    projectedTp4?: number | null;
    projectedStopLoss?: number | null;
    projectedProbability?: number;
    confirmations?: string[];
    waitReason?: string;
    tradeReason?: string;
    rr?: number | null;
  };
  analysis?: Record<string, unknown>;
};

export async function publishScannerSignal(input: ScannerSignalPublication): Promise<{ published: boolean; duplicate?: boolean; error?: string }> {
  const scanner = input.scanner;
  const direction = scanner.projectedDirection;
  const selectedStrategy = ANALYZER_STRATEGY_MAP[input.strategyId];

  // A signal may only be published for a strategy that actually exists in the
  // Analyzer registry. The selected strategy remains the source of truth.
  if (!selectedStrategy) {
    return { published: false, error: `Unknown strategy '${input.strategyId}'. Signal publication rejected.` };
  }

  // If a strategy name is supplied, it must agree with the canonical registry.
  if (input.strategyName && input.strategyName !== selectedStrategy.name) {
    return { published: false, error: "Strategy identity mismatch. Signal publication rejected." };
  }

  // The execution-facing Scanner is intentionally restricted to the two
  // preferred trading timeframes. Other timeframes remain context/analysis
  // only and must not enter the Phase 1 signal ledger.
  if (!isPreferredTradeTimeframe(input.timeframe)) {
    return { published: false };
  }

  if (!scanner.isExecutable || (direction !== "BUY" && direction !== "SELL") || scanner.actualEntry == null) {
    return { published: false };
  }

  // Adaptive Execution Engine has an explicit M5/M15 confirmation/execution
  // contract. Never publish it from another timeframe.
  if (input.strategyId === "adaptiveExecution" && !["5m", "15m", "M5", "M15"].includes(input.timeframe)) {
    return { published: false, error: "Adaptive Execution Engine signals require M5 or M15." };
  }

  const response = await fetch("/api/signals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      market_category: input.marketType,
      canonical_symbol: input.symbol,
      direction,
      strategy_id: selectedStrategy.id,
      strategy_name: selectedStrategy.name,
      timeframe: input.timeframe.toUpperCase(),
      entry: scanner.actualEntry,
      stop_loss: scanner.stopLoss ?? scanner.projectedStopLoss ?? null,
      tp1: scanner.tp1 ?? scanner.projectedTp1 ?? null,
      tp2: scanner.tp2 ?? scanner.projectedTp2 ?? null,
      tp3: scanner.tp3 ?? scanner.projectedTp3 ?? null,
      tp4: scanner.tp4 ?? scanner.projectedTp4 ?? null,
      confidence: scanner.projectedProbability ?? null,
      rr: scanner.rr ?? null,
      status: "CONFIRMED",
      confirmation_conditions: scanner.confirmations ?? [],
      missing_conditions: [],
      source_snapshot: {
        source: "AI_SCANNER",
        strategy_id: selectedStrategy.id,
        strategy_name: selectedStrategy.name,
        analysisState: scanner.analysisState,
        isExecutable: scanner.isExecutable,
        waitReason: scanner.waitReason,
        tradeReason: scanner.tradeReason,
        analysis: input.analysis ?? {},
      },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) return { published: false, error: data.error || "Unable to publish Scanner signal." };
  return { published: true, duplicate: data.duplicate === true };
}

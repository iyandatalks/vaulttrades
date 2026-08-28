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
  if (!scanner.isExecutable || (direction !== "BUY" && direction !== "SELL") || scanner.actualEntry == null) {
    return { published: false };
  }

  const response = await fetch("/api/signals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      market_category: input.marketType,
      canonical_symbol: input.symbol,
      direction,
      strategy_id: input.strategyId,
      strategy_name: input.strategyName ?? input.strategyId,
      timeframe: input.timeframe,
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

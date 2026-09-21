export type VaultAutoFibSymbol =
  | "XAU/USD"
  | "EUR/USD"
  | "GBP/USD"
  | "USD/JPY"
  | "AUD/USD"
  | "USD/CAD"
  | "BTC/USD"
  | "ETH/USD"
  | "SOL/USD";

export type VaultAutoFibRunResult = {
  status: "SKIPPED" | "COMPLETED";
  reason: string | null;
  timeframe: "M15" | null;
  symbolsScanned: VaultAutoFibSymbol[];
  signalsDetected: number;
  signalsPublished: number;
  duplicates: number;
  errors: string[];
};

export type SupervisionStatus = "RECEIVED" | "SUCCESS" | "REJECTED" | "FAILED" | "DUPLICATE" | "NO_ACCOUNT";

export type TradingViewWebhookEvent = {
  id: string;
  received_at: string;
  stage: string;
  status: string;
  symbol: string | null;
  direction: string | null;
  timeframe: string | null;
  strategy_id: string | null;
  execution_mode: string | null;
  signal_id: string | null;
  queue_id: string | null;
  error_code: string | null;
  error_message: string | null;
};

export type SupervisedSignal = {
  id: string;
  trade_id: string;
  canonical_symbol: string;
  direction: "BUY" | "SELL";
  strategy_id: string;
  timeframe: string;
  status: string;
  fired_at: string;
  execution_payload: Record<string, unknown> | null;
};

export type SupervisedQueueRow = {
  id: string;
  signal_id: string | null;
  strategy_id: string;
  canonical_symbol: string;
  direction: "BUY" | "SELL";
  timeframe: string;
  status: "queued" | "claimed" | "executed" | "cancelled" | "failed" | string;
  execution_mode: "OBSERVE" | "LIVE" | string;
  created_at: string;
  claimed_at: string | null;
  executed_at: string | null;
};

export type SupervisedScannerRun = {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  reason: string | null;
  signals_detected: number | null;
  signals_published: number | null;
  duplicates: number | null;
  error_message: string | null;
  details: Record<string, unknown> | null;
};

export type SupervisionResponse = {
  ok: true;
  supervisionWindowHours: number;
  tradingView: {
    received: number;
    persisted: number;
    rejected: number;
    failed: number;
    duplicates: number;
    latestEvent: TradingViewWebhookEvent | null;
    latestSignal: SupervisedSignal | null;
    events: TradingViewWebhookEvent[];
    signals: SupervisedSignal[];
  };
  executionQueue: {
    total: number;
    queued: number;
    claimed: number;
    executed: number;
    failed: number;
    rows: SupervisedQueueRow[];
  };
  scannerEngine: {
    latestRun: SupervisedScannerRun | null;
    runs: SupervisedScannerRun[];
  };
  health: {
    webhookReceiving: boolean;
    signalPersisting: boolean;
    queueAvailable: boolean;
    scannerRunObserved: boolean;
    lastActivityAt: string | null;
  };
  errors: {
    events: string | null;
    signals: string | null;
    queue: string | null;
    runs: string | null;
  };
};

export type SupervisionApiError = {
  error: string;
};

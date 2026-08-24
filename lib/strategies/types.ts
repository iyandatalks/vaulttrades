/** VaultTrades shared strategy contract. */
export type StrategyId =
  | "volatilityBreakout"
  | "killZone"
  | "ema20"
  | "continuation"
  | "supplyDemand"
  | "714Observing"
  | "sweepEngulfing"
  | "swingDeveloping"
  | "autoFibRetrace"
  | "institutional";

export type StrategySignal = "BUY" | "SELL" | "NONE";
export type StrategyState = "WAITING" | "DEVELOPING" | "ENTRY_READY" | "BUY" | "SELL" | "NO_TRADE";

export interface StrategyRuleSet {
  id: StrategyId;
  name: string;
  description: string;
  source: "PINE_SCRIPT" | "VAULTTRADES_RULES";
  timeframes: readonly string[];
  sequence: readonly string[];
  mandatoryRules: readonly string[];
  optionalConfluence: readonly string[];
  invalidationRules: readonly string[];
  executionRules: readonly string[];
  riskRules: readonly string[];
  aiInstructions: readonly string[];
}

export interface StrategyAnalysis {
  strategyId: StrategyId;
  strategyName: string;
  state: StrategyState;
  signal: StrategySignal;
  confidence: number | null;
  entry: number | null;
  stopLoss: number | null;
  tp1: number | null;
  tp2: number | null;
  finalTp: number | null;
  riskReward: number | null;
  evidence: string[];
  missingConditions: string[];
  invalidation: string[];
  confluence: string[];
  timeframe: string | null;
  message: string;
}

export interface StrategyDefinition {
  rules: StrategyRuleSet;
}

export const AI_COACH_RULES = [
  "The selected strategy engine is the source of truth.",
  "Do not manufacture or override BUY, SELL, entry, SL, TP or RR.",
  "Explain the actual state, completed conditions and missing conditions.",
  "Keep optional confluence separate from the primary strategy.",
  "If evidence is incomplete, use WAITING or DEVELOPING.",
  "Never revive an invalidated setup without a new valid sequence.",
] as const;

export function createStrategyDefinition(rules: StrategyRuleSet): StrategyDefinition {
  return { rules };
}

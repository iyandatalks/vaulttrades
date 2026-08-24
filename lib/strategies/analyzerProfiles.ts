import type { StrategyId } from "./types";

/**
 * Analyzer-facing strategy registry.
 *
 * IMPORTANT: sourceIds are internal implementation mappings. They are never
 * exposed to customers. The Analyzer uses these mappings to resolve the
 * proprietary Strategy Library source-of-truth before asking AI to interpret
 * chart evidence.
 */
export type AnalyzerCategory = "MY CUSTOM STRATEGIES" | "ADVANCED";
export type IndicatorName = "SMA" | "EMA" | "Ichimoku" | "Bollinger Bands" | "ATR" | "VWAP" | "Supertrend" | "SAR" | "RSI" | "MACD" | "KST" | "Stochastic" | "ADX" | "Percent B" | "MFI" | "DPO" | "RVOL" | "A/D";

export interface AnalyzerStrategyProfile {
  id: string;
  name: string;
  category: AnalyzerCategory;
  /** Internal source-of-truth strategy modules. Never expose to the UI. */
  sourceIds: StrategyId[];
  defaultIndicators: IndicatorName[];
  focus: string[];
  rules: string[];
}

/**
 * CUSTOMER STRATEGY LIST -> PROPRIETARY SOURCE-OF-TRUTH MAPPING
 *
 * 1. Institutional Execution Pipeline
 *    -> composite of Sweep & Engulfing + Supply & Demand + Continuation
 *
 * 2. Swing & Engulfing
 *    -> Sweep & Engulfing source module
 *
 * 3. FIB Retracement
 *    -> Vault Auto Fib Retrace + TP Ladder source module
 *
 * 4. 714 Method
 *    -> 714 Observation / Clean Core source module
 *
 * Do not add a customer-selectable strategy without an internal sourceIds
 * mapping. A missing source is a configuration error, not NO TRADE.
 */
export const ANALYZER_STRATEGIES: readonly AnalyzerStrategyProfile[] = [
  {
    id: "institutionalExecution",
    name: "Institutional Execution Pipeline",
    category: "MY CUSTOM STRATEGIES",
    sourceIds: ["sweepEngulfing", "supplyDemand", "continuation"],
    defaultIndicators: ["VWAP", "EMA", "ATR"],
    focus: ["institutional positioning", "market structure", "liquidity", "displacement", "premium/discount", "execution zones"],
    rules: [
      "Resolve the selected institutional framework from its internal source-of-truth modules.",
      "Market structure and liquidity have priority over standalone indicators.",
      "Require a coherent execution zone and confirmation sequence before a trade verdict.",
      "AI may explain the evidence but may not replace or override the source strategy rules."
    ]
  },
  {
    id: "swingEngulfing",
    name: "Swing & Engulfing",
    category: "MY CUSTOM STRATEGIES",
    sourceIds: ["sweepEngulfing"],
    defaultIndicators: ["EMA", "ATR", "VWAP"],
    focus: ["liquidity sweep", "market structure", "displacement", "engulfing confirmation", "trend context", "risk structure"],
    rules: [
      "The internal Sweep & Engulfing source is the strategy authority.",
      "A liquidity event and valid engulfing/displacement confirmation must be respected.",
      "Do not create a signal from an indicator alone."
    ]
  },
  {
    id: "fibRetracement",
    name: "FIB Retracement",
    category: "ADVANCED",
    sourceIds: ["autoFibRetrace"],
    defaultIndicators: ["EMA", "ATR", "RSI"],
    focus: ["validated swing/session anchors", "retracement depth", "flip levels", "confluence", "target structure", "risk/reward"],
    rules: [
      "The internal Vault Auto Fib Retrace source is the strategy authority.",
      "A Fib range is not automatically an entry.",
      "Only coherent retracement structure and source-defined confirmation may produce a verdict."
    ]
  },
  {
    id: "714Method",
    name: "714 Method",
    category: "MY CUSTOM STRATEGIES",
    sourceIds: ["714Observing"],
    defaultIndicators: ["EMA", "ATR", "RSI"],
    focus: ["13:00 SAST observation", "locked bias", "active support/resistance", "liquidity event", "rejection", "displacement", "confirmation"],
    rules: [
      "The internal 714 source is the strategy authority.",
      "Observation, bias lock, execution level and qualification remain separate states.",
      "The Analyzer must preserve the source-defined direction mapping and event sequence."
    ]
  }
];

export const ANALYZER_STRATEGY_MAP = Object.fromEntries(ANALYZER_STRATEGIES.map(s => [s.id, s])) as Record<string, AnalyzerStrategyProfile>;
export const ANALYZER_CATEGORIES: readonly AnalyzerCategory[] = ["MY CUSTOM STRATEGIES", "ADVANCED"];

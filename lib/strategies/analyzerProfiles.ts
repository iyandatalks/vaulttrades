import type { StrategyId } from "./types";

/**
 * Analyzer-facing strategy registry.
 *
 * sourceIds are internal implementation mappings and are never exposed to
 * customers. The Analyzer resolves the selected customer strategy to these
 * authoritative VaultTrades source modules before AI interprets chart evidence.
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
 * CUSTOMER STRATEGY -> AUTHORITATIVE INTERNAL SOURCE
 *
 * Every customer-selectable strategy must resolve to one or more authoritative
 * source modules. AI interprets the chart through those rules; it is not the
 * source of the strategy itself.
 */
export const ANALYZER_STRATEGIES: readonly AnalyzerStrategyProfile[] = [
  {
    id: "volatilityBreakout",
    name: "Volatility & Breakout",
    category: "MY CUSTOM STRATEGIES",
    sourceIds: ["volatilityBreakout"],
    defaultIndicators: ["EMA", "ATR", "RVOL"],
    focus: ["directional structure", "20/20 channel", "breakout", "location safety", "momentum", "order-block confirmation", "trade lifecycle"],
    rules: [
      "Use the supplied Volatility & Breakout source as the primary authority.",
      "A channel break alone is not a trade; location, momentum and confirmation must qualify the setup.",
      "Respect the source continuation and W/M reversal paths.",
      "Respect source-defined entry, invalidation, SL and TP lifecycle logic.",
      "AI may explain visible evidence but may not replace or override the source engine."
    ]
  },
  {
    id: "institutional",
    name: "Institutional",
    category: "MY CUSTOM STRATEGIES",
    sourceIds: ["institutional"],
    defaultIndicators: ["VWAP", "EMA", "ATR"],
    focus: ["market structure", "BOS/CHoCH", "liquidity", "order block", "FVG", "displacement", "session confluence", "risk validation"],
    rules: [
      "Use the authoritative Institutional source contract supplied by the developer.",
      "Score BOS, CHoCH, Order Block, FVG, Liquidity Sweep and Displacement from visible evidence.",
      "Require at least two SMC components scoring 7/10 or higher for a new directional trade.",
      "Validate session context, entry proximity, SL/TP geometry and R:R >= 1:2.",
      "Active and historical setup lifecycle must be communicated separately from a new trade verdict.",
      "AI must not invent an institutional setup when source evidence is absent."
    ]
  },
  {
    id: "swingEngulfing",
    name: "Swing / Engulfing",
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
    id: "continuation",
    name: "Continuation",
    category: "MY CUSTOM STRATEGIES",
    sourceIds: ["continuation"],
    defaultIndicators: ["EMA", "ATR", "VWAP"],
    focus: ["expansion", "correction", "structural hold", "recovery", "confirmed continuation", "entry event"],
    rules: [
      "Use the internal Continuation source as the sole primary authority.",
      "Expansion, correction, structural hold, recovery and confirmed break must remain separate states.",
      "Do not turn every breakout into continuation.",
      "Do not shift a source-defined locked entry or fabricate structural risk levels."
    ]
  },
  {
    id: "proprietaryFlow",
    name: "Proprietary Flow",
    category: "MY CUSTOM STRATEGIES",
    sourceIds: ["714Observing"],
    defaultIndicators: ["EMA", "ATR", "RSI"],
    focus: ["observation window", "locked directional bias", "support/resistance", "liquidity event", "rejection", "displacement", "confirmation"],
    rules: [
      "Use the mapped proprietary observation source as the strategy authority.",
      "Observation, bias lock, execution level and qualification remain separate states.",
      "The Analyzer must preserve the source-defined direction mapping and event sequence.",
      "The internal source implementation name must never be exposed in customer-facing analysis."
    ]
  }
];

export const ANALYZER_STRATEGY_MAP = Object.fromEntries(ANALYZER_STRATEGIES.map(s => [s.id, s])) as Record<string, AnalyzerStrategyProfile>;
export const ANALYZER_CATEGORIES: readonly AnalyzerCategory[] = ["MY CUSTOM STRATEGIES", "ADVANCED"];

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
      "Use the authoritative Volatility & Breakout source as the primary decision engine.",
      "Translate its state machine into customer-facing states: direction, channel, breakout, reversal, ready, active, target progress, completion or invalidation.",
      "A channel break alone is not a trade; location, momentum, confirmation and the source qualification path must agree.",
      "When a current trade is visible, report its lifecycle instead of treating the absence of a new signal as an empty result.",
      "When no new trade exists, identify the most recent source-consistent footprint and the next source-defined event required for a new opportunity.",
      "Projected entry, SL and TP values must be derived from the source execution rules and visible levels; never manufacture them."
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
      "Use the authoritative Institutional source contract as the primary decision engine.",
      "Score BOS, CHoCH, Order Block, FVG, Liquidity Sweep and Displacement from visible evidence on a 1-10 scale.",
      "Require at least two SMC components scoring 7/10 or higher for a new directional trade.",
      "Evaluate market structure first, then SMC confluence, then session/context, then entry/invalidation/targets.",
      "Apply the source session rules: London/New York overlap is preferred; Asian setups require exceptional confluence under the source rules.",
      "Validate entry proximity, SL/TP geometry and R:R mathematically before returning a new trade.",
      "Confidence must reflect confluence completeness and evidence quality, not the model's optimism or probability of profit.",
      "A completed prior setup, an active setup, and a new setup are separate lifecycle states and must never be collapsed into one verdict.",
      "AI may explain the institutional evidence but may not invent BOS, CHoCH, OB, FVG, sweep or displacement when they are not visible."
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
      "Preserve the source lifecycle: prior setup, current state, confirmation, active trade and next setup.",
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
      "Only coherent retracement structure and source-defined confirmation may produce a verdict.",
      "Report prior Fib setups and their visible outcome when the chart history supports them."
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
      "Do not shift a source-defined locked entry or fabricate structural risk levels.",
      "Translate an existing continuation trade and its target progress before considering a new entry."
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

import type { StrategyId } from "./types";

export type AnalyzerCategory = "MY CUSTOM STRATEGIES" | "ADVANCED" | "SCALPING" | "SWING";
export type IndicatorName = "SMA" | "EMA" | "Ichimoku" | "Bollinger Bands" | "ATR" | "VWAP" | "Supertrend" | "SAR" | "RSI" | "MACD" | "KST" | "Stochastic" | "ADX" | "Percent B" | "MFI" | "DPO" | "RVOL" | "A/D";

export interface AnalyzerStrategyProfile {
  id: string;
  name: string;
  category: AnalyzerCategory;
  sourceIds: StrategyId[];
  defaultIndicators: IndicatorName[];
  focus: string[];
  rules: string[];
}

export const ANALYZER_STRATEGIES: readonly AnalyzerStrategyProfile[] = [
  {
    id: "institutionalExecution",
    name: "Institutional Execution Pipeline",
    category: "MY CUSTOM STRATEGIES",
    sourceIds: ["sweepEngulfing", "supplyDemand", "continuation"],
    defaultIndicators: ["VWAP", "EMA", "ATR"],
    focus: ["institutional positioning", "market structure", "liquidity", "displacement", "premium/discount", "execution zones"],
    rules: ["Use market structure and liquidity first.", "Require a coherent execution zone and confirmation sequence.", "Use indicators only as confirmation, never as the trade trigger."]
  },
  {
    id: "smc",
    name: "Smart Money Concepts (SMC)",
    category: "ADVANCED",
    sourceIds: ["sweepEngulfing", "supplyDemand"],
    defaultIndicators: ["EMA", "VWAP", "ATR"],
    focus: ["BOS", "CHOCH", "liquidity", "order blocks", "FVG where identifiable", "displacement", "premium/discount"],
    rules: ["Price-action structure has priority over indicators.", "Do not call a trade from an indicator alone."]
  },
  {
    id: "liquiditySweep",
    name: "Liquidity Sweep",
    category: "ADVANCED",
    sourceIds: ["sweepEngulfing"],
    defaultIndicators: ["ATR", "VWAP", "RSI"],
    focus: ["previous highs/lows", "equal highs/lows", "liquidity pools", "sweeps", "stop-run behavior", "rejection", "displacement"],
    rules: ["Distinguish a sweep-and-reject event from an ordinary breakout.", "Require confirmation before an entry verdict."]
  },
  {
    id: "pullbackRetracement",
    name: "Pullback Retracement",
    category: "ADVANCED",
    sourceIds: ["ema20"],
    defaultIndicators: ["EMA", "ATR", "RSI"],
    focus: ["established trend", "impulse", "retracement", "dynamic support/resistance", "pullback depth", "rejection", "continuation"],
    rules: ["Do not identify a pullback when trend structure is unclear."]
  },
  {
    id: "scalpingEma",
    name: "Scalping EMA",
    category: "SCALPING",
    sourceIds: ["ema20"],
    defaultIndicators: ["EMA", "VWAP", "ATR"],
    focus: ["EMA alignment", "EMA slope", "price relative to EMA", "VWAP position", "short-term trend", "volatility", "momentum"],
    rules: ["Avoid signals when EMA structure is flat and price is congested."]
  },
  {
    id: "volatilityBreakout",
    name: "Volatility Breakout",
    category: "SCALPING",
    sourceIds: [],
    defaultIndicators: ["Bollinger Bands", "ATR", "RVOL"],
    focus: ["compression", "range formation", "band contraction", "band expansion", "breakout direction", "relative volume", "ATR expansion", "false breakout risk"],
    rules: ["Prefer confirmation from volatility and reliable visible volume when available."]
  },
  {
    id: "breakoutRetest",
    name: "Breakout Retest",
    category: "SCALPING",
    sourceIds: ["continuation"],
    defaultIndicators: ["EMA", "ATR", "Bollinger Bands"],
    focus: ["original breakout", "broken level", "retest", "rejection/acceptance", "trend confirmation", "volatility"],
    rules: ["Do not call breakout-retest without a reasonably identifiable original breakout level."]
  },
  {
    id: "squeezeMomentum",
    name: "Squeeze Momentum",
    category: "SCALPING",
    sourceIds: [],
    defaultIndicators: ["Bollinger Bands", "ATR", "MACD"],
    focus: ["compression", "volatility contraction", "momentum", "expansion", "breakout direction"],
    rules: ["Primary pattern is compression → expansion → momentum."]
  },
  {
    id: "meanReversion",
    name: "Mean Reversion",
    category: "SCALPING",
    sourceIds: [],
    defaultIndicators: ["Bollinger Bands", "RSI", "ATR"],
    focus: ["range conditions", "deviation from mean", "band extremes", "RSI extremes", "rejection", "return toward mean"],
    rules: ["Do not use mean reversion blindly during a strong directional trend."]
  },
  {
    id: "momentumSwing",
    name: "Momentum Swing",
    category: "SWING",
    sourceIds: ["swingDeveloping"],
    defaultIndicators: ["EMA", "RSI", "ATR"],
    focus: ["trend", "momentum", "swing structure", "pullback", "continuation", "volatility"],
    rules: ["Require trend and momentum alignment before a swing verdict."]
  },
  {
    id: "trendFollowing",
    name: "Trend Following",
    category: "SWING",
    sourceIds: ["swingDeveloping"],
    defaultIndicators: ["EMA", "ADX", "ATR"],
    focus: ["trend direction", "EMA alignment", "EMA slope", "trend strength", "ADX", "volatility", "continuation"],
    rules: ["Do not classify a sideways market as a strong trend."]
  },
  {
    id: "trendReversal",
    name: "Trend Reversal",
    category: "SWING",
    sourceIds: ["sweepEngulfing"],
    defaultIndicators: ["RSI", "MACD", "ATR"],
    focus: ["existing trend", "exhaustion", "momentum change", "divergence", "RSI behavior", "MACD transition", "reversal structure"],
    rules: ["Overbought/oversold alone is never sufficient for a reversal verdict."]
  },
  {
    id: "divergencePlay",
    name: "Divergence Play",
    category: "SWING",
    sourceIds: [],
    defaultIndicators: ["RSI", "MACD", "ATR"],
    focus: ["price highs/lows", "indicator highs/lows", "bullish divergence", "bearish divergence", "hidden divergence", "trend context"],
    rules: ["Require reliable price and indicator swing comparisons."]
  },
  {
    id: "continuationPattern",
    name: "Continuation Pattern",
    category: "SWING",
    sourceIds: ["continuation"],
    defaultIndicators: ["EMA", "MACD", "ATR"],
    focus: ["existing trend", "consolidation", "continuation structure", "breakout", "momentum", "volatility expansion"],
    rules: ["A breakout is not automatically a continuation pattern."]
  },
  {
    id: "rangeBound",
    name: "Range Bound",
    category: "SWING",
    sourceIds: [],
    defaultIndicators: ["Bollinger Bands", "RSI", "ATR"],
    focus: ["range high", "range low", "midpoint", "support", "resistance", "band extremes", "RSI extremes", "rejection"],
    rules: ["Do not use range logic when a strong directional breakout is evident."]
  },
  {
    id: "fibRetracement",
    name: "FIB Retracement",
    category: "ADVANCED",
    sourceIds: ["autoFibRetrace"],
    defaultIndicators: ["EMA", "ATR", "RSI"],
    focus: ["validated swing anchors", "retracement depth", "confluence", "target structure", "risk/reward"],
    rules: ["A Fib range is not automatically an entry zone.", "Only use visible and coherent retracement structure."]
  }
];

export const ANALYZER_STRATEGY_MAP = Object.fromEntries(ANALYZER_STRATEGIES.map(s => [s.id, s])) as Record<string, AnalyzerStrategyProfile>;
export const ANALYZER_CATEGORIES: readonly AnalyzerCategory[] = ["MY CUSTOM STRATEGIES", "ADVANCED", "SCALPING", "SWING"];

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
 * These rules are universal Analyzer rules. They do not replace a strategy's
 * source state machine. They are the final analytical/risk gate applied to
 * every customer strategy.
 */
const UNIVERSAL_ANALYZER_RULES = [
  "VISUAL CHART ANALYSIS: Always describe market structure as Uptrend, Downtrend, Ranging or Choppy; identify key support/resistance and recent price-action context before issuing a verdict.",
  "CHOPPY MARKET RULE: More than 5 consecutive inside bars OR conflicting signals across 3 or more timeframes means NO TRADE due to choppy/insufficient clarity.",
  "SMC OBSERVATION: Score BOS, CHoCH, Order Block, Fair Value Gap, Liquidity Sweep and Displacement from 1-10 when visible. Explain the evidence for every score. SMC observations must not replace the selected strategy's authoritative source sequence.",
  "SMC CONFLUENCE: For strategies whose source explicitly requires SMC confluence, at least 2 SMC signals scored 7 or higher are required for a valid directional setup. For other strategies, report the SMC scores as contextual evidence without replacing source-native qualification.",
  "SESSION & CONFLUENCE: Identify London, New York or Asian session when the chart/time information permits; note higher-timeframe alignment, visible news/fundamental context, and risk-on/risk-off sentiment without inventing unavailable news.",
  "SESSION RULES: Asian-session trades require confluence >=9/10 and a major news event; London/NY overlap is preferred; pre-London 07:00-08:00 GMT is acceptable only for an exceptional setup.",
  "UNIVERSAL PRICE VALIDATION: For every BUY or SELL candidate, SL must be at least 0.1% from entry, entry must be within 0.5% of current price when current price is visible/derivable, and TP must be at least 2x the SL distance.",
  "RISK MANAGEMENT: Maximum risk per trade is 1.5% of account equity. Do not claim this is satisfied unless position size/account-risk information supports the calculation; otherwise mark risk sizing as unverified and do not present it as validated.",
  "RR VALIDATION: R:R must be mathematically validated at >=1:2. BUY risk = entry - SL and target distance = TP - entry. SELL risk = SL - entry and target distance = entry - TP. Never infer a valid RR from labels alone.",
  "SIGNAL TYPES: BUY means all bullish source conditions plus universal validations passed. SELL means all bearish source conditions plus universal validations passed. NO TRADE means a required condition or universal validation failed.",
  "CONFIDENCE: 90-100 multiple strong confluences/perfect setup; 80-89 strong with 2-3 solid confirmations; 70-79 decent with minor issues; 60-69 marginal/wait; 50-59 weak/high failure risk; 30-49 poor/avoid; 10-29 very poor or image quality too low. Confidence must match evidence strength and may not be inflated merely because a source state exists.",
  "QUALITY CHECK: Before finalizing, validate R:R math, SL/TP geometric direction, the 0.1% minimum SL distance, the 0.5% entry proximity when measurable, risk sizing when measurable, confidence versus confluence, and logical consistency between structure, price action, liquidity, momentum and the selected source lifecycle.",
  "NO GENERIC FILLER: Do not output generic statements such as 'Ranging with no sustained higher highs or lower lows', 'Consolidation within defined horizontal range, no breakout', or 'Insufficient signals from EMA, ATR, RVOL for breakout' unless those facts are actually visible and relevant to the selected strategy. Explain the selected strategy's current state and the exact missing condition instead.",
  "NO TRADE IS A DECISION, NOT AN EMPTY ANALYSIS: Even when the verdict is NO TRADE, describe the actual market state, source-specific setup state, confirmed conditions, missing conditions, invalidation, and the next actionable event/zone when visible."
];

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
      ...UNIVERSAL_ANALYZER_RULES,
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
    defaultIndicators: ["EMA", "ATR", "RVOL"],
    focus: ["MMA EMA context", "session ranges", "institutional volume control", "liquidity sweeps", "session/swing liquidity targets", "bounce/rejection zones", "4H target context", "signal lifecycle"],
    rules: [
      ...UNIVERSAL_ANALYZER_RULES,
      "Use the supplied Pine-derived Institutional source as the primary decision engine; do not replace it with a generic SMC template.",
      "Interpret MMA EMAs, session ranges, institutional volume/direction, liquidity sweeps, liquidity targets and bounce/rejection zones as source-native evidence.",
      "Preserve BUY NOW, SELL NOW, BUY SETUP, SELL SETUP, BUY BOUNCE, SELL BOUNCE and rejection states when visible.",
      "A liquidity level, EMA or volume reading alone is not a trade; the source combined-signal logic must qualify the state.",
      "Read historical chart evidence to reconstruct prior source footprints before declaring that no setup is traceable.",
      "When a current trade is visible, report its lifecycle rather than treating the absence of a new signal as an empty result.",
      "Projected entry, SL and TP values must be derived from visible source levels and universal Analyzer risk validation; never manufacture them.",
      "The source is Pine-derived and therefore its source-native logic takes precedence over generic AI indicator heuristics."
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
      ...UNIVERSAL_ANALYZER_RULES,
      "The internal Sweep & Engulfing source is the strategy authority.",
      "A liquidity event and valid engulfing/displacement confirmation must be respected.",
      "Preserve the source lifecycle: prior setup, current state, confirmation, active trade and next setup.",
      "Do not create a signal from an indicator alone."
    ]
  },
  {
    id: "sweepDeveloping",
    name: "Sweep Developing",
    category: "MY CUSTOM STRATEGIES",
    sourceIds: ["swingDeveloping"],
    defaultIndicators: ["EMA", "RSI"],
    focus: ["H1 direction", "M15 alignment", "EMA 9/15 pullback", "EMA 9 recovery", "M15 SMI confirmation", "developing setup lifecycle"],
    rules: [
      ...UNIVERSAL_ANALYZER_RULES,
      "Sweep Developing is a separate strategy from Swing / Engulfing and must never resolve to sweepEngulfing.",
      "Use the authoritative swingDeveloping source module as the strategy engine; the internal module name is not customer-facing.",
      "Follow the source sequence: H1 direction -> M15 alignment -> M15 EMA 9/15 pullback -> recovery through EMA 9 -> M15 SMI confirmation -> new BUY/SELL transition.",
      "DIRECTION, PULLBACK and ENTRY READY are developing/non-entry states and must not be promoted to BUY or SELL.",
      "A prior pullback is required by the source entry transition; do not infer an entry from EMA alignment alone.",
      "Preserve the source lifecycle so historical Sweep Developing setups can be identified as developing, entry-ready, entered or completed where chart evidence permits.",
      "The source Pine strategy defines no SL/TP/RR; do not invent strategy-native risk levels. Universal Analyzer risk validation may reject an otherwise executable signal if required risk geometry is unavailable.",
      "When no new entry exists, report the current developing state and the most recent traceable source footprint instead of saying there is no setup without checking history."
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
      ...UNIVERSAL_ANALYZER_RULES,
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
      ...UNIVERSAL_ANALYZER_RULES,
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
      ...UNIVERSAL_ANALYZER_RULES,
      "Use the mapped proprietary observation source as the strategy authority.",
      "Observation, bias lock, execution level and qualification remain separate states.",
      "The Analyzer must preserve the source-defined direction mapping and event sequence.",
      "The internal source implementation name must never be exposed in customer-facing analysis."
    ]
  }
];

export const ANALYZER_STRATEGY_MAP = Object.fromEntries(ANALYZER_STRATEGIES.map(s => [s.id, s])) as Record<string, AnalyzerStrategyProfile>;
export const ANALYZER_CATEGORIES: readonly AnalyzerCategory[] = ["MY CUSTOM STRATEGIES", "ADVANCED"];

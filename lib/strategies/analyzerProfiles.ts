import type { StrategyId } from "./types";

/**
 * Analyzer-facing strategy registry.
 *
 * The profile describes HOW the Analyzer should interpret the selected
 * strategy. It does not replace the authoritative source state machine.
 */
export type AnalyzerCategory = "MY CUSTOM STRATEGIES" | "ADVANCED";
export type IndicatorName = "SMA" | "EMA" | "Ichimoku" | "Bollinger Bands" | "ATR" | "VWAP" | "Supertrend" | "SAR" | "RSI" | "MACD" | "KST" | "Stochastic" | "ADX" | "Percent B" | "MFI" | "DPO" | "RVOL" | "A/D" | "SMI";

export interface AnalyzerStrategyProfile {
  id: string;
  name: string;
  category: AnalyzerCategory;
  sourceIds: StrategyId[];
  /** Strategy-relevant indicator candidates. This is not a 3-indicator cap. */
  defaultIndicators: IndicatorName[];
  focus: string[];
  rules: string[];
}

const UNIVERSAL_ANALYZER_RULES = [
  "RULE 1 — VISUAL CHART ANALYSIS: First describe market structure as Uptrend, Downtrend, Ranging or Choppy; identify visible support/resistance and recent price-action context. Do not substitute generic filler for actual chart evidence.",
  "RULE 1 — CHOPPY MARKET RULE: More than 5 consecutive inside bars OR materially conflicting signals across 3 or more visible timeframes means NO TRADE due to choppy/insufficient clarity.",
  "RULE 2 — SMC DETECTION: Score BOS, CHoCH, Order Block, Fair Value Gap, Liquidity Sweep and Displacement from 1–10 when visible. Explain the evidence behind each score. These observations supplement the selected strategy's source lifecycle.",
  "RULE 2 — SMC CONFLUENCE GATE: A NEW BUY or SELL requires at least 2 SMC signals scored >=7. If fewer than two SMC scores are >=7, the final decision MUST be NO TRADE.",
  "RULE 3 — SESSION & CONFLUENCE: Identify London, New York or Asian session when time information permits; state higher-timeframe alignment, visible news/fundamental context and risk-on/risk-off sentiment without inventing unavailable news.",
  "RULE 3 — SESSION GATES: Asian-session trades require confluence >=9/10 AND a visible/known major news event; London/NY overlap is preferred; pre-London 07:00–08:00 GMT is acceptable only for an exceptional setup.",
  "RULE 4 — PRICE LEVEL VALIDATION: Entry must be within 0.5% of current price when current price is visible. SL must be at least 0.1% from entry. TP must be at least 2x the SL distance. Validate direction geometrically.",
  "RULE 4 — R:R MATH: BUY risk = Entry - SL and reward = TP - Entry. SELL risk = SL - Entry and reward = Entry - TP. R:R = reward / risk and must be >=2.0. Never trust a displayed RR label without recalculating it.",
  "RULE 4 — RISK: Maximum account risk is 1.5%. If account equity/position-size inputs are unavailable, explicitly mark sizing as unverified rather than claiming that the 1.5% limit has been validated.",
  "RULE 4 — SIGNAL TYPES: BUY/SELL means the strategy lifecycle AND all applicable universal gates passed. NO TRADE means a required source condition or universal gate failed. DEVELOPING/WAITING states are not confirmed entries.",
  "RULE 5 — CONFIDENCE: 90–100 multiple strong confluences/perfect setup; 80–89 strong with 2–3 solid confirmations; 70–79 decent with minor issues; 60–69 marginal/wait; 50–59 weak; 30–49 poor/avoid; 10–29 very poor or image quality too low. Confidence measures evidence completeness, not profitability.",
  "RULE 6 — QUALITY CHECK: Before finalizing, validate R:R math, SL/TP geometry, minimum SL distance, entry proximity, risk sizing when measurable, SMC confluence, confidence versus evidence and logical consistency between structure, price action, liquidity, momentum, volatility and the selected lifecycle.",
  "RULE 6 — COMMUNICATION: Never output generic market filler when strategy-specific evidence is available. Explain what is confirmed, what is missing, what state the setup is in, what invalidates it and the exact next event/zone required.",
  "RULE 6 — NO TRADE IS INFORMATIVE: NO TRADE must still communicate market state, strategy state, confirmed evidence, failed/missing conditions, invalidation and next actionable event when visible.",
];

export const ANALYZER_STRATEGIES: readonly AnalyzerStrategyProfile[] = [
  {
    id: "volatilityBreakout",
    name: "Volatility & Breakout",
    category: "MY CUSTOM STRATEGIES",
    sourceIds: ["volatilityBreakout"],
    defaultIndicators: ["EMA", "ATR", "ADX", "RVOL", "VWAP"],
    focus: ["directional structure", "20/20 channel", "breakout", "location safety", "momentum", "order-block confirmation", "trade lifecycle"],
    rules: [
      ...UNIVERSAL_ANALYZER_RULES,
      "Use the authoritative Volatility & Breakout source as the primary decision engine.",
      "Translate its state machine into direction, channel, breakout, reversal, ready, active, target progress, completion or invalidation.",
      "A channel break alone is not a trade; location, momentum, confirmation and the source qualification path must agree.",
      "Use ATR/ADX/RVOL/VWAP only as evidence when their visible readings are actually available and relevant; indicators never replace the source event sequence.",
    ],
  },
  {
    id: "institutional",
    name: "Institutional",
    category: "MY CUSTOM STRATEGIES",
    sourceIds: ["institutional"],
    defaultIndicators: ["EMA", "ATR", "ADX", "RVOL", "VWAP"],
    focus: ["MMA EMA context", "session ranges", "institutional volume control", "liquidity sweeps", "session/swing liquidity targets", "bounce/rejection zones", "4H target context", "signal lifecycle"],
    rules: [
      ...UNIVERSAL_ANALYZER_RULES,
      "Use the supplied Pine-derived Institutional source as the primary decision engine; do not replace it with a generic SMC template.",
      "Interpret EMA context, session ranges, institutional volume/direction, liquidity sweeps, liquidity targets and bounce/rejection zones as source-native evidence.",
      "Preserve BUY NOW, SELL NOW, BUY SETUP, SELL SETUP, BUY BOUNCE, SELL BOUNCE and rejection states when visible, but only classify a NEW TRADE after universal validation passes.",
      "A liquidity level, EMA or volume reading alone is not a trade; the source combined-signal logic must qualify the state.",
      "Read historical chart evidence to reconstruct prior source footprints before declaring that no setup is traceable.",
    ],
  },
  {
    id: "swingEngulfing",
    name: "Swing / Engulfing",
    category: "MY CUSTOM STRATEGIES",
    sourceIds: ["sweepEngulfing"],
    defaultIndicators: ["EMA", "ATR", "ADX", "VWAP"],
    focus: ["liquidity sweep", "market structure", "displacement", "engulfing confirmation", "trend context", "risk structure"],
    rules: [
      ...UNIVERSAL_ANALYZER_RULES,
      "The internal Sweep & Engulfing source is the strategy authority.",
      "Respect the source sequence: meaningful liquidity event -> reaction/structure shift -> engulfing/displacement confirmation -> entry lifecycle.",
      "Preserve prior setup, current state, confirmation, active trade and next setup as separate states.",
      "Do not create a signal from an indicator alone.",
    ],
  },
  {
    id: "sweepDeveloping",
    name: "Sweep Developing",
    category: "MY CUSTOM STRATEGIES",
    sourceIds: ["swingDeveloping"],
    defaultIndicators: ["EMA", "SMI", "ATR", "ADX"],
    focus: ["H1 direction", "M15 alignment", "EMA 9/15 pullback", "EMA 9 recovery", "M15 SMI confirmation", "developing setup lifecycle"],
    rules: [
      ...UNIVERSAL_ANALYZER_RULES,
      "Sweep Developing is a separate strategy from Swing / Engulfing and must never resolve to sweepEngulfing.",
      "Use the authoritative swingDeveloping source module as the strategy engine.",
      "Follow the source lifecycle: H1 direction -> M15 alignment -> M15 EMA 9/15 pullback -> recovery through EMA 9 -> M15 SMI confirmation -> new BUY/SELL transition.",
      "DIRECTION, PULLBACK and ENTRY READY are developing/non-entry states and must not be promoted to BUY or SELL.",
      "A prior pullback is required by the source entry transition; EMA alignment alone is insufficient.",
      "The source Pine strategy defines no native SL/TP/RR. Do not invent source-native risk levels; universal validation may reject a signal when valid trade geometry cannot be established from visible structure.",
    ],
  },
  {
    id: "fibRetracement",
    name: "FIB Retracement",
    category: "ADVANCED",
    sourceIds: ["autoFibRetrace"],
    defaultIndicators: ["EMA", "ATR", "RSI", "VWAP"],
    focus: ["validated swing/session anchors", "retracement depth", "flip levels", "confluence", "target structure", "risk/reward"],
    rules: [
      ...UNIVERSAL_ANALYZER_RULES,
      "The internal Vault Auto Fib Retrace source is the strategy authority.",
      "A Fib range is not automatically an entry; coherent retracement structure and source-defined confirmation are required.",
      "Report prior Fib setups and their visible outcome when the chart history supports them.",
    ],
  },
  {
    id: "continuation",
    name: "Continuation",
    category: "MY CUSTOM STRATEGIES",
    sourceIds: ["continuation"],
    defaultIndicators: ["EMA", "ATR", "ADX", "VWAP"],
    focus: ["expansion", "correction", "structural hold", "recovery", "confirmed continuation", "entry event"],
    rules: [
      ...UNIVERSAL_ANALYZER_RULES,
      "Use the internal Continuation source as the sole primary authority.",
      "Expansion, correction, structural hold, recovery and confirmed break must remain separate states.",
      "Do not turn every breakout into continuation.",
      "Do not shift a source-defined locked entry or fabricate structural risk levels.",
    ],
  },
  {
    id: "proprietaryFlow",
    name: "Proprietary Flow",
    category: "MY CUSTOM STRATEGIES",
    sourceIds: ["714Observing"],
    defaultIndicators: ["EMA", "ATR", "RSI", "ADX"],
    focus: ["observation window", "locked directional bias", "support/resistance", "liquidity event", "rejection", "displacement", "confirmation"],
    rules: [
      ...UNIVERSAL_ANALYZER_RULES,
      "Use the mapped proprietary observation source as the strategy authority.",
      "Observation, bias lock, execution level and qualification remain separate states.",
      "The Analyzer must preserve the source-defined direction mapping and event sequence.",
    ],
  },
];

export const ANALYZER_STRATEGY_MAP = Object.fromEntries(ANALYZER_STRATEGIES.map((s) => [s.id, s])) as Record<string, AnalyzerStrategyProfile>;
export const ANALYZER_CATEGORIES: readonly AnalyzerCategory[] = ["MY CUSTOM STRATEGIES", "ADVANCED"];

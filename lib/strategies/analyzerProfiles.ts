import type { StrategyId, StrategyIndicatorRequirement } from "./types";

/**
 * Analyzer-facing strategy registry.
 *
 * IMPORTANT: indicator selection is SOURCE-FIRST. The selected strategy's
 * source contract is inspected first; only indicators explicitly required by
 * that source are calculated/selected. There is no generic indicator quota.
 */
export type AnalyzerCategory = "MY CUSTOM STRATEGIES" | "ADVANCED";
export type IndicatorName = string;

export interface AnalyzerStrategyProfile {
  id: string;
  name: string;
  category: AnalyzerCategory;
  sourceIds: StrategyId[];
  /** Human-readable names derived from sourceRequirements. */
  defaultIndicators: IndicatorName[];
  /** Exact source indicator/component definitions, including parameters. */
  sourceRequirements: StrategyIndicatorRequirement[];
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
  "RULE 5 — CONFIDENCE: 90–100 multiple strong confluences/perfect setup; 80–89 strong with 2–3 solid confirmations; 70–79 decent with minor issues; 60–69 marginal/wait; 50–59 weak; 30–49 poor; 10–29 very poor or image quality too low. Confidence measures evidence completeness, not profitability.",
  "RULE 6 — QUALITY CHECK: Before finalizing, validate R:R math, SL/TP geometry, minimum SL distance, entry proximity, risk sizing when measurable, SMC confluence, confidence versus evidence and logical consistency between structure, price action, liquidity, momentum, volatility and the selected lifecycle.",
  "RULE 6 — COMMUNICATION: Never output generic market filler when strategy-specific evidence is available. Explain what is confirmed, what is missing, what state the setup is in, what invalidates it and the exact next event/zone required.",
  "RULE 6 — NO TRADE IS INFORMATIVE: NO TRADE must still communicate market state, strategy state, confirmed evidence, failed/missing conditions, invalidation and next actionable event when visible.",
  "SOURCE-FIRST INDICATOR RULE: Read the selected strategy source contract before selecting any indicator. Calculate the exact source-required indicator, formula/role and parameters first. Never add EMA/ATR/ADX/RVOL/VWAP merely because they are common indicators.",
  "SOURCE PARAMETER RULE: Display/use the source's exact length, multiplier, smoothing, MA type and other inputs when the source declares them. If the source does not declare a parameter in the authoritative module, mark it unresolved instead of inventing a default.",
  "PRIMARY COMPONENT RULE: A channel, session engine, Fibonacci engine, liquidity engine, S/R engine or other structural component can be the primary strategy engine even when it is not a conventional indicator. Do not replace it with a generic indicator.",
];

const req = (
  name: string,
  role: StrategyIndicatorRequirement["role"],
  source: string,
  parameters: Record<string, number | string | boolean>
): StrategyIndicatorRequirement => ({ name, role, source, parameters });

const profiles: AnalyzerStrategyProfile[] = [
  {
    id: "volatilityBreakout",
    name: "Volatility & Breakout",
    category: "MY CUSTOM STRATEGIES",
    sourceIds: ["volatilityBreakout"],
    sourceRequirements: [
      req("Moving Average Channel", "PRIMARY", "20/20 channel over candle highs and lows", { length: 20, maType: "EMA", upperInput: "high", lowerInput: "low" }),
      req("ATR", "REQUIRED", "source ATR volatility/breakout distance", { length: 14 }),
      req("Volume", "REQUIRED", "volume expansion confirmation", { movingAverageLength: 20, expansionMultiplier: 1.2 }),
    ],
    defaultIndicators: ["Moving Average Channel", "ATR", "Volume"],
    focus: ["20/20 moving-average channel", "channel breakout", "location", "ATR displacement", "volume expansion", "order-block context", "continuation/W-M lifecycle"],
    rules: [
      ...UNIVERSAL_ANALYZER_RULES,
      "The 20/20 Moving Average Channel is the PRIMARY calculated indicator for Volatility & Breakout.",
      "Do not display EMA, ADX, RVOL or VWAP as automatically selected indicators unless a future source revision explicitly adds them.",
      "A channel break alone is not a trade; source location, momentum, confirmation and lifecycle must qualify it.",
    ],
  },
  {
    id: "institutional",
    name: "Institutional",
    category: "MY CUSTOM STRATEGIES",
    sourceIds: ["institutional"],
    sourceRequirements: [
      req("EMA", "PRIMARY", "six source MMA EMAs", { lengths: "4,21,72,89,200,233" }),
      req("ATR", "REQUIRED", "source volatility/displacement", { length: 14 }),
      req("Volume", "REQUIRED", "institutional volume and relative-volume calculation", { movingAverageLength: 20, highVolumeThreshold: 1.2, displacementThresholdATR: 0.9 }),
    ],
    defaultIndicators: ["EMA", "ATR", "Volume"],
    focus: ["MMA EMA context", "session ranges", "institutional volume", "liquidity sweeps", "liquidity targets", "bounce/rejection zones", "4H targets", "signal lifecycle"],
    rules: [
      ...UNIVERSAL_ANALYZER_RULES,
      "AUTO indicators are source-derived: six MMA EMAs (4/21/72/89/200/233), ATR(14), and Volume SMA(20)/relative-volume logic.",
      "Session ranges, liquidity sweeps, displacement, buyer/seller control and zones are structural source components, not generic indicator substitutions.",
      "Do not add ADX, VWAP or generic SMC indicators as required indicators unless the source is changed.",
      "Preserve BUY NOW, SELL NOW, BUY SETUP, SELL SETUP, BUY BOUNCE, SELL BOUNCE and rejection states when visible.",
    ],
  },
  {
    id: "swingEngulfing",
    name: "Swing / Engulfing",
    category: "MY CUSTOM STRATEGIES",
    sourceIds: ["sweepEngulfing"],
    sourceRequirements: [
      req("EMA", "REQUIRED", "trend filter", { length: 200 }),
      req("ATR", "REQUIRED", "stop/displacement geometry", { length: 14, atrMultiplier: 1.8, engulfATRMultiplier: 0.5 }),
      req("Volume", "REQUIRED", "volume-strength calculation", { movingAverageLength: 20, spikeMultiplier: 1.5, confirmationRequired: false }),
    ],
    defaultIndicators: ["EMA", "ATR", "Volume"],
    focus: ["liquidity sweep", "BOS/CHoCH", "engulfing/displacement", "EMA 200 filter", "volume", "opposing liquidity", "risk structure"],
    rules: [
      ...UNIVERSAL_ANALYZER_RULES,
      "The Sweep & Engulfing source is authoritative.",
      "Required source parameters include EMA(200), ATR(14), ATR stop multiplier 1.8, engulfing ATR threshold 0.5, volume SMA(20), spike multiplier 1.5 and 2 confirmation candles.",
      "The source also defines external swing length 10, internal swing length 3, BOS lookback 50, sweep validity 3 bars and engulf body multiplier 1.2.",
      "Do not replace this sequence with generic EMA/ATR/ADX/RVOL/VWAP logic.",
    ],
  },
  {
    id: "sweepDeveloping",
    name: "Sweep Developing",
    category: "MY CUSTOM STRATEGIES",
    sourceIds: ["swingDeveloping"],
    sourceRequirements: [
      req("EMA", "PRIMARY", "H1/M15 direction and recovery", { lengths: "9,15,100" }),
      req("SMI", "REQUIRED", "M15 momentum gate", { length: 7, smooth1: 2, smooth2: 2, overbought: 40, oversold: -40 }),
      req("ATR", "REQUIRED", "source swing trade geometry", { length: 14, stopBuffer: 0.25 }),
    ],
    defaultIndicators: ["EMA", "SMI", "ATR"],
    focus: ["H1 direction", "M15 alignment", "EMA 9/15 pullback", "EMA 9 recovery", "SMI 7-2-2", "developing lifecycle"],
    rules: [
      ...UNIVERSAL_ANALYZER_RULES,
      "Sweep Developing is separate from Swing / Engulfing.",
      "Use EMA 9/15 for direction, EMA 100 as the optional direction filter, and SMI 7-2-2 with +40/-40 thresholds for M15 momentum.",
      "The source Pine trade engine uses ATR(14) with a 0.25 ATR structural stop buffer.",
      "DIRECTION, PULLBACK and ENTRY READY are not confirmed entries.",
    ],
  },
  {
    id: "ema20",
    name: "EMA20 Pullback Morning Engine",
    category: "MY CUSTOM STRATEGIES",
    sourceIds: ["ema20"],
    sourceRequirements: [
      req("EMA", "PRIMARY", "EMA20 entry engine and EMA105 context", { lengths: "20,105" }),
      req("ATR", "REQUIRED", "touch tolerance and risk geometry", { length: 14, touchToleranceATR: 0.2 }),
      req("SMI", "REQUIRED", "alternative confirmation", { length: 7, smooth1: 2, smooth2: 2 }),
      req("UT Bot", "REQUIRED", "alternative confirmation", { sensitivity: 1.0, atrLength: 10, minimumConfirmations: 1 }),
    ],
    defaultIndicators: ["EMA", "ATR", "SMI", "UT Bot"],
    focus: ["EMA20 touch", "rejection", "rejection break", "UT Bot OR SMI", "entry transition"],
    rules: [
      ...UNIVERSAL_ANALYZER_RULES,
      "EMA20 is the primary engine; EMA105 is context only.",
      "Use ATR(14) and 0.20 ATR touch tolerance exactly as source-defined.",
      "Confirmation is UT Bot OR SMI 7-2-2; there is no generic volume requirement.",
    ],
  },
  {
    id: "continuation",
    name: "Continuation",
    category: "MY CUSTOM STRATEGIES",
    sourceIds: ["continuation"],
    sourceRequirements: [
      req("ATR", "REQUIRED", "expansion/correction/movement filters", { correctionThresholdATR: 0.25, srToleranceATR: 0.1, movementFilterATR: 0.2 }),
    ],
    defaultIndicators: ["ATR"],
    focus: ["expansion", "correction", "structural hold", "recovery", "confirmed M15 break", "entry event"],
    rules: [
      ...UNIVERSAL_ANALYZER_RULES,
      "The Continuation source explicitly uses ATR-normalized movement thresholds of 0.25, 0.10 and 0.20 ATR.",
      "Do not add ADX, VWAP or EMA as required indicators when they are not source-defined.",
      "Expansion, correction, structural hold and recovery remain separate states.",
    ],
  },
  {
    id: "killZone",
    name: "Killer Zone",
    category: "MY CUSTOM STRATEGIES",
    sourceIds: ["killZone"],
    sourceRequirements: [],
    defaultIndicators: [],
    focus: ["Asian high/low", "London liquidity sweep", "MSS", "FVG", "FVG retracement", "50% FVG"],
    rules: [
      ...UNIVERSAL_ANALYZER_RULES,
      "The source does not require a conventional technical indicator. Its primary engine is session liquidity + MSS + FVG sequence.",
      "Therefore AUTO indicators must be empty rather than populated with generic EMA/ATR/ADX/RVOL/VWAP substitutes.",
    ],
  },
  {
    id: "supplyDemand",
    name: "Supply & Demand Zones",
    category: "MY CUSTOM STRATEGIES",
    sourceIds: ["supplyDemand"],
    sourceRequirements: [],
    defaultIndicators: [],
    focus: ["pivot swing period 30", "wick-based supply/demand zones", "reach", "reaction", "zone hold", "zone break/flip"],
    rules: [
      ...UNIVERSAL_ANALYZER_RULES,
      "The source is a structural zone engine and does not require generic technical indicators.",
      "Swing period is 30, lookback 2000 and average wick length 5; these are source parameters, not generic indicators.",
      "AUTO indicators must be empty unless the source is changed.",
    ],
  },
  {
    id: "proprietaryFlow",
    name: "Proprietary Flow",
    category: "MY CUSTOM STRATEGIES",
    sourceIds: ["714Observing"],
    sourceRequirements: [
      req("EMA", "PRIMARY", "EMA20 confirmation and bias scoring", { length: 20 }),
      req("ATR", "REQUIRED", "observation displacement, S/R tolerance and qualification", { biasObservation: "source-defined", pivotLength: 5, executionToleranceATR: 0.15, displacementATR: 0.4 }),
    ],
    defaultIndicators: ["EMA", "ATR"],
    focus: ["13:00 SAST observation", "bias lock after 30 minutes", "one active support/resistance pair", "sweep/touch", "rejection", "displacement", "EMA20 confirmation"],
    rules: [
      ...UNIVERSAL_ANALYZER_RULES,
      "714 source uses EMA20 and ATR-normalized observation/SR/qualification logic; bullish bias deliberately maps to SELL and bearish bias to BUY.",
      "Do not add RSI/ADX/VWAP unless the source is changed.",
    ],
  },
  {
    id: "fibRetracement",
    name: "FIB Retracement",
    category: "ADVANCED",
    sourceIds: ["autoFibRetrace"],
    sourceRequirements: [
      req("EMA", "CONTEXT", "DXY MA context", { length: 50, maType: "EMA", touchPct: 0.15 }),
      req("ATR", "REQUIRED", "zone confirmation, order block and projection", { confirmationMultiplier: 0.6, orderBlockLength: 14, projectionLength: 14, maxProjectionDistanceATR: 2 }),
      req("Volume", "REQUIRED", "order-block and DXY volume-spike context", { orderBlockLength: 20, orderBlockFactor: 1.5, dxySpikeMultiplier: 1.5 }),
    ],
    defaultIndicators: ["EMA", "ATR", "Volume"],
    focus: ["session/liquidity anchors", "Fib ladder", "flip levels", "DXY context", "order blocks", "M5 confirmation", "MTF structure"],
    rules: [
      ...UNIVERSAL_ANALYZER_RULES,
      "The Fib engine itself is the primary structural calculation; conventional indicators are only the source-declared DXY/OB/projection components.",
      "Source defaults include pivot length 5, DXY EMA50, OB ATR14, OB volume20 factor1.5 and projection ATR14/max distance2.",
      "Do not invent standalone BUY/SELL from a Fib flip because the source is an indicator rather than strategy.entry().",
    ],
  },
];

export const ANALYZER_STRATEGIES: readonly AnalyzerStrategyProfile[] = profiles.map((profile) => ({
  ...profile,
  defaultIndicators: profile.sourceRequirements.map((item) => item.name),
}));

export const ANALYZER_STRATEGY_MAP = Object.fromEntries(ANALYZER_STRATEGIES.map((s) => [s.id, s])) as Record<string, AnalyzerStrategyProfile>;
export const ANALYZER_CATEGORIES: readonly AnalyzerCategory[] = ["MY CUSTOM STRATEGIES", "ADVANCED"];

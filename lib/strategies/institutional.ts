import type { StrategyRuleSet } from "./types";

/**
 * VaultTrades — Institutional source contract.
 *
 * This is the customer-safe implementation of the institutional-grade
 * decision framework supplied by the developer. It is a source contract for
 * the Analyzer; the internal name/module is never exposed to customers.
 */
export const institutionalRules: StrategyRuleSet = {
  id: "institutional",
  name: "Institutional",
  description:
    "Institutional-grade structure and Smart Money Concepts evaluation using market structure, liquidity, displacement and execution-risk validation.",
  source: "VAULTTRADES_RULES",
  timeframes: ["M15", "M5", "M1"],
  sequence: [
    "Visual market structure",
    "Key support/resistance and recent price action",
    "BOS / CHoCH / Order Block / FVG / Liquidity Sweep / Displacement evaluation",
    "Session and higher-timeframe confluence",
    "Price-level and risk validation",
    "Confluence threshold",
    "BUY / SELL / NO TRADE verdict",
    "Active-trade and prior-footprint lifecycle",
  ],
  mandatoryRules: [
    "Describe market structure as uptrend, downtrend, ranging or choppy/transitional before issuing a verdict.",
    "Identify visible support, resistance and recent price-action context.",
    "Score BOS, CHoCH, Order Block, FVG, Liquidity Sweep and Displacement from 1 to 10 when the evidence is visible.",
    "At least two SMC components with scores of 7 or higher are required for a valid directional setup.",
    "Asian session requires exceptional confluence of at least 9/10 plus a major visible/news catalyst before a new trade is accepted.",
    "London/New York overlap is the preferred execution window; pre-London exceptional setups may qualify.",
    "Validate entry proximity, stop distance, target distance and mathematical risk/reward before a new trade is accepted.",
    "R:R must be at least 1:2 for a new trade verdict.",
    "Do not convert a visible active trade into a new entry; distinguish ACTIVE from NEW TRADE.",
    "A completed prior setup must remain part of the historical footprint and must not be replaced by a generic no-trade statement.",
  ],
  optionalConfluence: [
    "Session sentiment and visible fundamental/news context.",
    "Higher-timeframe alignment when more than one timeframe is supplied.",
    "Additional SMC components beyond the two required high-quality confirmations.",
  ],
  invalidationRules: [
    "More than five consecutive inside bars or conflicting structure across three or more visible timeframes is choppy/insufficient clarity and returns NO TRADE for a new entry.",
    "Fewer than two SMC components scoring at least 7/10 blocks a new trade.",
    "R:R below 1:2 blocks a new trade.",
    "A structurally invalidated setup cannot be revived without a new qualifying sequence.",
  ],
  executionRules: [
    "BUY requires all bullish validations to pass; SELL requires all bearish validations to pass.",
    "NO TRADE means no new position should be opened now; it does not mean that the market has no active or historical setup.",
    "If a trade is already active, report its direction, entry, SL, target ladder and lifecycle progress instead of presenting an empty result.",
    "If a pullback/retest is required, identify the price zone or structural level that must be revisited; never say only 'waiting for a pullback'.",
  ],
  riskRules: [
    "Validate SL and TP geometry before displaying them as executable levels.",
    "Target distance must support at least 1:2 R:R for a new trade.",
    "Never fabricate a price level that cannot be reliably read or derived from visible chart evidence.",
  ],
  aiInstructions: [
    "The institutional source contract is authoritative; do not substitute a generic AI trading template.",
    "Use the SMC scoring framework supplied by the developer and show the evidence supporting each high-quality score.",
    "Translate the source state into customer-facing language without exposing private implementation details.",
    "Always distinguish current active lifecycle, prior completed footprint and next anticipated setup.",
    "If evidence is insufficient, explain exactly what condition is missing rather than returning a cold generic response.",
  ],
};

export default institutionalRules;

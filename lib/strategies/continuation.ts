import type { StrategyRuleSet } from "./types";

/** Continuation — independent M15 market-structure strategy. */
export const continuationRules: StrategyRuleSet = {
  id: "continuation",
  name: "Continuation",
  description: "Expansion → correction → structural hold → recovery → confirmed continuation → entry.",
  source: "VAULTTRADES_RULES",
  timeframes: ["M15"],
  sequence: ["Expansion", "Correction", "Support/Resistance", "Recovery", "Confirmed break", "ENTRY"],
  mandatoryRules: [
    "Continuation is an actual market event, not a prediction.",
    "Bullish and bearish structure must use actual M15 structural levels.",
    "Minimum correction movement is 0.25 × ATR.",
    "Support/resistance interaction tolerance is 0.10 × ATR.",
    "Continuation movement filter is 0.20 × ATR.",
    "Bullish continuation requires bullish directive, expansion, correction, structural support, recovery and a confirmed M15 close above the previous M15 high.",
    "Bearish continuation requires bearish directive, expansion, correction, structural resistance, recovery and a confirmed M15 close below the previous M15 low.",
    "The confirmation break must occur after the correction.",
    "Never enter directly at support/resistance or chase the expansion extreme.",
    "Entry is locked to the confirmation candle close and is created only on a new signal event.",
  ],
  optionalConfluence: ["Supply & Demand is optional confluence only."],
  invalidationRules: ["Bullish structural support breaks", "Bearish structural resistance breaks", "Expansion extreme is already consumed before a fresh entry", "Insufficient structural evidence"],
  executionRules: ["If the only available entry is at the expansion extreme, return WAITING/NO TRADE.", "Do not shift the locked entry."],
  riskRules: ["Long SL below confirmed continuation support/structural invalidation.", "Short SL above confirmed continuation resistance/structural invalidation.", "Targets use valid opposing liquidity/structure; no arbitrary fixed RR."],
  aiInstructions: ["Do not turn every breakout into continuation.", "Explain expansion, correction, structural hold and confirmation separately.", "If structural invalidation cannot be established, do not invent SL or entry."],
};

export default continuationRules;

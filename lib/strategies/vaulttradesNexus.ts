import type { StrategyRuleSet } from "./types";

const vaultTradesNexusRules: StrategyRuleSet = {
  id: "vaulttradesNexus",
  name: "VaultTrades Nexus",
  description: "MA High/Low and ATR-based daily trade identification with a fixed 1.5R target.",
  source: "PINE_SCRIPT",
  timeframes: ["M1", "M5", "M10", "M15", "M30", "H1", "H4", "D1"],
  sequence: ["Completed candle close", "SMA High and SMA Low", "Daily signal control", "ATR stop and fixed risk/reward target", "Trade lifecycle"],
  mandatoryRules: [
    "SMA(high, 20) and SMA(low, 20) are calculated independently.",
    "BUY when the completed candle closes above both moving averages.",
    "SELL when the completed candle closes below both moving averages.",
    "ATR(14) defines stop distance using a 2.0 multiplier.",
    "Take profit is 1.5 times the initial stop distance.",
    "Only one new signal is permitted per SAST calendar day for the selected symbol and timeframe.",
  ],
  optionalConfluence: [],
  invalidationRules: [
    "An open trade remains active until its stop loss or take profit is reached on a completed candle.",
    "If stop loss and take profit are both touched by the same candle, record the stop loss first.",
  ],
  executionRules: [
    "Use the signal candle close as the entry price.",
    "Do not add an entry retest requirement or any additional SMC, order-block, EMA, volume or confirmation filter.",
    "The preferred 06:00/07:00 SAST trading period is informational only and must never block a valid signal outside that period.",
  ],
  riskRules: [
    "Position sizing is calculated in the existing Risk Manager using the trader's selected account and account-specific settings.",
    "A strategy signal or accepted risk calculation does not place a broker order.",
  ],
  aiInstructions: [
    "This deterministic strategy engine is authoritative; do not rewrite its direction or price levels.",
    "Keep customer-facing output concise: WAITING FOR TRADE, NO TRADE, BUY, SELL, TRADE ACTIVE, TAKE PROFIT HIT or STOP LOSS HIT.",
    "Never expose internal calculation sequences or missing-condition explanations to the customer.",
  ],
};

export default vaultTradesNexusRules;

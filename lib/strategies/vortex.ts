import type { StrategyRuleSet } from "./types";

const rules: StrategyRuleSet = {
  id: "vortex",
  name: "VaultTrades Vortex",
  description: "Independent Fibonacci retracement and institutional order-block strategy with M1 execution and M5 displacement confirmation.",
  source: "PINE_SCRIPT",
  timeframes: ["M1 execution", "M5 confirmation"],
  sequence: [
    "Use the active session wick range unless a confirmed liquidity sweep and CHOCH establish a structural impulse.",
    "Detect a directional institutional order inside the source-defined New York Silver Bullet window.",
    "Wait for the first retracement touch in priority order: 68.1%, 78.6%, then 88.0%.",
    "Require the M1 retest and directional candle confirmation.",
    "Require a completed M5 displacement candle with body >= 0.60 x M5 ATR(14) and a close beyond the previous M5 high/low.",
    "Require directional external liquidity, the matching target order block, valid stop geometry and confluence >= 60.",
    "Enter at the selected Fib level; use the opposing target-OB wick for the stop and preserve the five-target ladder.",
  ],
  mandatoryRules: [
    "M1 is the execution timeframe; M5 is the independent confirmation timeframe.",
    "Fib entry priority is 68.1% preferred, 78.6% secondary, 88.0% last resort.",
    "The institutional order, pullback, retest and candle confirmation sequence must complete within 8 M1 bars and within an active Silver Bullet window.",
    "M5 confirmation uses ATR(14) calculated from M5 OHLC, not M1 ATR.",
    "Require a valid opposing target OB and directional liquidity alignment.",
    "Minimum normalized confluence score is 60/100.",
  ],
  optionalConfluence: [
    "Inverse XAGUSD flow, Silver structure, 50-period Silver MA and direction-aligned Silver volume contribute only when data is available.",
    "Unavailable optional Silver data is removed from the confluence denominator; it is not treated as a failed signal.",
  ],
  invalidationRules: [
    "An incomplete setup expires after 8 M1 bars.",
    "An incomplete sequence is cleared when the active Silver Bullet window closes.",
    "The target OB is invalidated by a close through its far wick boundary.",
  ],
  executionRules: [
    "Entry is the selected 68.1%, 78.6% or 88.0% Fib level.",
    "TP1, TP2 and TP3 use the 38.2%, 0% and -23.6% Fib levels.",
    "TP4 is 1.50% from entry and TP5 is 1.81% from entry.",
    "Default lot size is 0.05. At 0.05 or greater, distribute the position across five progressive targets (20% each).",
    "Lot sizes from 0.01 to 0.04 close fully at TP1; Analyzer does not override the trader's selected lot size.",
    "Do not add a generic SMC gate, generic 2R gate, or unrelated indicator confirmation.",
  ],
  riskRules: [
    "BUY stop is one tick below the bullish target-OB bottom; SELL stop is one tick above the bearish target-OB top.",
    "Reject a setup when the OB-based stop distance exceeds the Pine maximum stop-risk cap of 2.0%; do not cap or move the stop to force validity.",
    "Risk/reward is calculated from the actual OB stop and TP5; do not move the source-defined stop or targets to force a preferred R:R.",
    "Risk Manager remains the shared account-risk and position-sizing tool.",
  ],
  aiInstructions: [
    "The deterministic Vortex engine is authoritative. AI may explain its evidence but may not create or override a signal, entry, stop, target or Fib level.",
    "Keep the M1 setup sequence and M5 confirmation evidence separate.",
    "Display all five targets and their hit states when a trade is active.",
  ],
};
export default rules;

import type { StrategyRuleSet } from "./types";

const adaptiveExecutionRules: StrategyRuleSet = {
  id: "adaptiveExecution",
  name: "Adaptive Execution Engine",
  description: "Weighted adaptive execution model translated from the VaultTrades Pine reference strategy, with M15 confirmation and M5 preferred execution.",
  source: "PINE_SCRIPT",
  timeframes: ["M15", "M5"],
  sequence: [
    "M15 establishes directional confirmation.",
    "M5 provides the preferred execution confirmation.",
    "Require directional agreement before publishing a confirmed execution signal.",
    "Entry is the confirmed execution price.",
    "TP1 is the actual simulated lifecycle target; TP2-TP4 are reference targets.",
  ],
  mandatoryRules: [
    "Trend: EMA20 > EMA50 > EMA100 and price > EMA200 for BUY; inverse for SELL.",
    "Momentum: RSI14 above 50 and MACD12/26/9 bullish for BUY; inverse for SELL.",
    "Strength: ADX14 >= 20 with +DI > -DI for BUY; inverse for SELL.",
    "Structure: close breaks the previous five-bar high/low.",
    "ATR adaptive trigger contributes 15 points when direction is confirmed.",
    "Confirmation threshold is 70/100.",
    "M15 confirmation and M5 execution must agree directionally for a preferred execution signal.",
  ],
  optionalConfluence: [
    "Session context",
    "Volume/institutional activity",
    "Higher-timeframe context above M15",
  ],
  invalidationRules: [
    "M15 and M5 directional disagreement",
    "Score falls below confirmation threshold before a new execution event",
    "Price reaches the active ATR stop",
  ],
  executionRules: [
    "Preferred execution timeframe is M5.",
    "M15 is the confirmation timeframe.",
    "BUY entry uses close with SL at 1.5 ATR below entry.",
    "SELL entry uses close with SL at 1.5 ATR above entry.",
    "TP1 = 2R.",
    "TP2 = 3R, TP3 = 4R and TP4 = 5R are reference projections only.",
  ],
  riskRules: [
    "Risk is defined as the distance between entry and the 1.5 ATR stop.",
    "TP1 is the actual simulated trade completion target.",
    "Position sizing is not embedded in the signal engine.",
  ],
  aiInstructions: [
    "Do not manufacture a BUY/SELL when M15 confirmation and M5 execution are not aligned.",
    "Display M15 as confirmation and M5 as preferred execution.",
    "Keep TP2-TP4 clearly labelled as reference projections.",
    "Preserve the deterministic Entry/SL/TP mathematics from the source engine.",
  ],
};

export default adaptiveExecutionRules;

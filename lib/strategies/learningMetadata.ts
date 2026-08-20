import type { StrategyId } from "./types";

export interface StrategyLearningMetadata {
  shortExplanation: string;
  recommendedTradingTimes: string[];
}

export const STRATEGY_LEARNING_METADATA: Partial<Record<StrategyId, StrategyLearningMetadata>> = {
  autoFibRetrace: {
    shortExplanation:
      "Uses session/liquidity anchors to build Fibonacci retracement ranges, then evaluates preferred retracement levels, flips, liquidity, DXY confluence, order blocks, M5 confirmation and MTF structure. It is designed to explain where price is expected to react rather than force a trade.",
    recommendedTradingTimes: [
      "London session: 07:00–10:00 UTC",
      "New York session: 12:30–17:00 UTC",
      "Prioritize periods when session liquidity and the selected Fib anchors are established.",
    ],
  },
};

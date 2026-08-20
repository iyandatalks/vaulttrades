import type { StrategyId } from "./types";

export interface StrategyLearningMetadata {
  shortExplanation: string;
  recommendedTradingTimes: string[];
  learnerGuidance: string[];
}

/**
 * Presentation metadata only. Strategy modules remain the source of truth for
 * calculations, entries, risk and invalidation. These descriptions explain the
 * deterministic result to the learner; they do not create signals or prices.
 */
export const STRATEGY_LEARNING_METADATA: Partial<Record<StrategyId, StrategyLearningMetadata>> = {
  killZone: {
    shortExplanation:
      "Uses the London liquidity sweep → market structure shift → fair value gap → retracement sequence. The strategy waits for the complete sequence rather than treating a sweep or FVG alone as an entry.",
    recommendedTradingTimes: [
      "London Kill Zone: 02:00–05:00 New York time.",
      "Best used after the Asian High/Low has been established and London liquidity can be evaluated.",
    ],
    learnerGuidance: [
      "Liquidity sweep = the event that starts the setup, not the entry.",
      "FVG = the reaction area; entry requires the strategy's confirmation sequence.",
      "If the sequence is incomplete, explain exactly which stage is missing.",
    ],
  },
  ema20: {
    shortExplanation:
      "Uses market structure, an EMA20 pullback/touch, rejection, break of the rejection level and UT Bot OR SMI confirmation. The entry is locked to the qualifying confirmation candle.",
    recommendedTradingTimes: [
      "Use during the active market session represented by the selected chart timeframe.",
      "Prioritize periods with clear directional structure and sufficient liquidity for the EMA20 pullback to develop.",
    ],
    learnerGuidance: [
      "EMA20 touch is a setup condition, not an automatic entry.",
      "The rejection level must break and the required confirmation must be present before entry.",
      "EMA105 is context only and must not become an invented entry filter.",
    ],
  },
  continuation: {
    shortExplanation:
      "Identifies a real M15 continuation event: expansion → correction → structural support/resistance hold → recovery → confirmed break. It avoids chasing the expansion extreme.",
    recommendedTradingTimes: [
      "M15 during active London and New York market periods.",
      "Prefer periods with sufficient movement to produce a measurable expansion and correction.",
    ],
    learnerGuidance: [
      "Expansion shows the initial move; it is not itself the entry.",
      "Correction must return toward valid structure before continuation can qualify.",
      "Entry follows the confirmed M15 break; do not enter simply because price touched support/resistance.",
    ],
  },
  supplyDemand: {
    shortExplanation:
      "Builds supply and demand zones from confirmed swing structure and wick behaviour, then waits for price to reach the zone, react and hold before qualifying an entry.",
    recommendedTradingTimes: [
      "Use on the selected timeframe during active market sessions.",
      "Prioritize zones with clear structure, sufficient history and room to the opposing objective.",
    ],
    learnerGuidance: [
      "The zone is the area where price may react; it is not automatically the entry price.",
      "A valid zone must remain intact and price must reach it before a reaction can qualify.",
      "A broken or invalidated zone must not be presented as an active setup.",
    ],
  },
  "714Observing": {
    shortExplanation:
      "Observes the market from 13:00 SAST, locks a directional bias, identifies one relevant support and one resistance, then waits for a sweep/touch, rejection, displacement and EMA20 confirmation before a final signal.",
    recommendedTradingTimes: [
      "Observation reference: 13:00 SAST.",
      "Execution can be evaluated on M1, M5, M10, M15 and M30 after the observation/bias process has completed.",
    ],
    learnerGuidance: [
      "Observation and bias are not entries.",
      "The active support/resistance level is the execution area; the confirmation candle determines the final entry event.",
      "Bullish bias maps to SELL at resistance and bearish bias maps to BUY at support in this specific strategy.",
    ],
  },
  sweepEngulfing: {
    shortExplanation:
      "Combines liquidity sweep, market structure, engulfing/displacement, EMA and optional volume confirmation. A sweep alone never creates a trade.",
    recommendedTradingTimes: [
      "Use during active market sessions on the selected chart timeframe.",
      "Prioritize periods where meaningful external liquidity and opposing structure are visible.",
    ],
    learnerGuidance: [
      "The liquidity level is the event area, not automatically the entry.",
      "The engulfing/displacement confirmation must follow the valid sweep sequence.",
      "Targets must come from valid opposing liquidity/structure; do not invent them when unavailable.",
    ],
  },
  swingDeveloping: {
    shortExplanation:
      "A higher-timeframe swing model: H1 direction → M15 alignment → EMA9/15 pullback → recovery → M15 SMI 7-2-2 confirmation. Direction and pullback states are deliberately not treated as entries.",
    recommendedTradingTimes: [
      "Best evaluated during active London and New York sessions when H1/M15 structure is moving.",
      "Because this is a swing model, the setup may remain developing across multiple candles rather than requiring immediate execution.",
    ],
    learnerGuidance: [
      "DIRECTION means the market is aligned; it does not mean enter.",
      "PULLBACK means price is returning toward EMA9/15; wait for recovery.",
      "ENTRY READY means the remaining confirmation is known; only the final BUY/SELL transition is an entry event.",
      "The source strategy does not define SL/TP/RR, so the Analyzer must not invent them.",
    ],
  },
  autoFibRetrace: {
    shortExplanation:
      "Uses session/liquidity anchors to build Fibonacci retracement ranges, then evaluates preferred retracement levels, flips, liquidity, DXY confluence, order blocks, M5 confirmation and MTF structure. It explains where price is expected to react rather than force a trade.",
    recommendedTradingTimes: [
      "London session: 07:00–10:00 UTC.",
      "New York session: 12:30–17:00 UTC.",
      "Prioritize periods when session liquidity and the selected Fib anchors are established.",
    ],
    learnerGuidance: [
      "The Fib anchor range is not automatically the entry zone.",
      "The entry zone should be a supported retracement area; the expected entry is a specific level inside it.",
      "The stop belongs outside the entry zone and targets must be beyond the entry in the trade direction.",
      "If the strategy cannot establish a coherent zone → entry → invalidation → target structure, report WAIT/NO TRADE instead of inventing levels.",
    ],
  },
};

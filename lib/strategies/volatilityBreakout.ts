import type { StrategyRuleSet } from "./types";

/**
 * VaultTrades — Volatility & Breakout Engine
 *
 * Source of truth: the supplied Pine Script v6
 * "Synthetic Market Direction & Execution Engine | V75 | M15 | LOGICAL".
 */
export const VOLATILITY_BREAKOUT_ID = "volatilityBreakout" as const;
export const VOLATILITY_BREAKOUT_NAME = "Volatility & Breakout" as const;

export const volatilityBreakoutRules: StrategyRuleSet = {
  id: VOLATILITY_BREAKOUT_ID,
  name: VOLATILITY_BREAKOUT_NAME,
  description:
    "Directional structure, 20/20 channel breakout, location safety, momentum, volume, rejection, order-block confirmation and explicit trade lifecycle for M15 execution.",
  source: "PINE_SCRIPT",
  timeframes: ["M15"],
  indicatorRequirements: [
    {
      name: "Moving Average Channel",
      role: "PRIMARY",
      source: "20/20 channel over candle highs and lows",
      parameters: { length: 20, maType: "EMA", upperInput: "high", lowerInput: "low" },
    },
    {
      name: "ATR",
      role: "REQUIRED",
      source: "source ATR volatility and breakout-distance engine",
      parameters: { length: 14 },
    },
    {
      name: "Volume",
      role: "REQUIRED",
      source: "volume expansion confirmation when enabled",
      parameters: { movingAverageLength: 20, expansionMultiplier: 1.2 },
    },
  ],
  sequence: [
    "Daily direction reset / structural direction",
    "20/20 channel context",
    "Channel breakout or acceptance/recovery",
    "Location and room-to-level validation",
    "Momentum confirmation",
    "Volume/rejection confirmation",
    "Order-block context and confirmation",
    "Continuation or W/M reversal qualification",
    "Single new LONG/SHORT signal event",
    "Entry → SL → TP1/TP2/TP3 trade lifecycle",
  ],
  mandatoryRules: [
    "Use M15 as the execution timeframe.",
    "Maintain directional state from confirmed pivot structure; reset direction at a new day when the source setting is enabled.",
    "20/20 channel is built from the selected moving-average type over high and low; default channel type is EMA with length 20.",
    "A bullish breakout requires close above the upper channel, bullish candle body, and the configured minimum ATR breakout distance.",
    "A bearish breakout requires close below the lower channel, bearish candle body, and the configured minimum ATR breakout distance.",
    "A breakout can qualify through channel break, channel acceptance, or channel recovery depending on the final continuation rules.",
    "Breakout setup is invalidated when price crosses the opposite side of the channel by the configured invalidation ATR distance.",
    "Momentum requires ATR-sized candle bodies and directional closes across the configured confirmation window.",
    "When volume confirmation is enabled, directional confirmation requires volume expansion above the configured moving average multiplier.",
    "Location must provide minimum room toward the opposing level unless that opposing level has already been broken.",
    "Resistance blocks long continuation unless resistance is broken; support blocks short continuation unless support is broken.",
    "Reversal qualification requires W structure + bullish rejection + bullish recovery for long, or M structure + bearish rejection + bearish recovery for short.",
    "If order-block confirmation is enabled, the relevant order block must be present and confirmed before the final continuation/reversal qualification.",
    "Final long qualification is bullish continuation OR bullish reversal; final short qualification is bearish continuation OR bearish reversal.",
    "A signal is an event transition: longQualification and not longQualification[1], or shortQualification and not shortQualification[1].",
  ],
  optionalConfluence: [
    "Volume expansion can be disabled by source input.",
    "Order-block confirmation can be disabled by source input.",
    "W/M reversal structure provides a reversal path in addition to continuation.",
    "The channel moving-average type can be SMA, EMA, WMA or RMA.",
  ],
  invalidationRules: [
    "Bullish breakout invalidates below the lower channel minus the configured ATR invalidation buffer.",
    "Bearish breakout invalidates above the upper channel plus the configured ATR invalidation buffer.",
    "Bullish order block invalidates below its low by the configured ATR invalidation buffer.",
    "Bearish order block invalidates above its high by the configured ATR invalidation buffer.",
    "Insufficient confirmation score blocks the trade.",
    "Insufficient room to the opposing level blocks the trade unless that level has been broken.",
    "A setup that is already invalidated cannot produce a final signal until a new valid sequence is established.",
  ],
  executionRules: [
    "LONG entry is the close of the new long signal event.",
    "SHORT entry is the close of the new short signal event.",
    "Long reference is the active bullish order-block low when available, otherwise the lower channel/current low reference.",
    "Short reference is the active bearish order-block high when available, otherwise the upper channel/current high reference.",
    "Long stop is reference minus ATR × stop buffer; short stop is reference plus ATR × stop buffer.",
    "Only one active trade lifecycle is maintained at a time.",
    "TP1, TP2 and TP3 are derived from entry risk using the source RR inputs; defaults are 2R, 3R and 5R.",
    "Trade remains active until SL or TP3 is reached, then the lifecycle is completed and cleared.",
  ],
  riskRules: [
    "ATR length default is 14.",
    "Stop buffer default is 0.75 ATR.",
    "Default TP ladder is 2R / 3R / 5R.",
    "Never fabricate entry, stop or targets when the required source levels are not reliably observable.",
    "Risk calculations must preserve directional coherence: long SL below entry and targets above entry; short SL above entry and targets below entry.",
  ],
  aiInstructions: [
    "Treat this internal rule set as the authoritative source for the customer-facing Volatility & Breakout strategy.",
    "Evaluate structure, channel, breakout/acceptance, location, momentum, confirmation and order-block context before issuing a trade verdict.",
    "Distinguish BULLISH BREAKOUT, BEARISH BREAKOUT, W/M STRUCTURE, READY and ACTIVE states from a new execution signal.",
    "Do not turn a channel break by itself into a trade.",
    "Do not use generic indicators as a substitute for the source price-action sequence.",
    "The Moving Average Channel is the PRIMARY calculated indicator. EMA, ATR, ADX, RVOL and VWAP must not be auto-added unless the source explicitly requires them.",
    "Do not expose the internal source method name, Pine code, proprietary parameter recipes or internal module names to customers.",
    "If the market data does not contain enough evidence for the source rules, return NO TRADE or an appropriate waiting state rather than inventing evidence.",
  ],
};

export default volatilityBreakoutRules;

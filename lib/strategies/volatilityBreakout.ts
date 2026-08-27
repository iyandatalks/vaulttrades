import type { StrategyRuleSet } from "./types";

/**
 * VaultTrades — Volatility & Breakout Engine
 *
 * Source of truth: the supplied Pine Script v6. The source execution engine
 * remains the strategy authority; the AI Scanner adds the MTF confirmation
 * wrapper defined below without replacing the source price-action sequence.
 */

export const VOLATILITY_BREAKOUT_ID = "volatilityBreakout" as const;
export const VOLATILITY_BREAKOUT_NAME = "Volatility & Breakout" as const;

export const volatilityBreakoutRules: StrategyRuleSet = {
  id: VOLATILITY_BREAKOUT_ID,
  name: VOLATILITY_BREAKOUT_NAME,
  description:
    "Directional structure, 20/20 channel breakout, location safety, momentum, volume, rejection, order-block confirmation and MTF HTF→M15→M5→HTF confirmation with a TP1-only actual trade lifecycle.",
  source: "PINE_SCRIPT",
  timeframes: ["M15"],
  sequence: [
    "HTF strategy context and directional structure",
    "HTF setup detected",
    "Projected Entry + Projected SL + Projected TP1–TP4",
    "M15 confirmation",
    "M5 execution confirmation",
    "HTF final confirmation",
    "Actual / confirmed entry",
    "Active HTF trade",
    "TP1 or SL",
    "Cycle complete",
  ],
  mandatoryRules: [
    "Use the source M15 execution engine unchanged for the strategy-specific setup logic.",
    "For M30 and higher HTF analysis, the HTF strategy is the source of truth for setup direction and projected levels.",
    "Structure, breakout and confirmation lead directional interpretation; the broader regime is context and must not permanently lock the trade direction.",
    "A bullish breakout requires close above the upper channel, bullish candle body, and the configured minimum ATR breakout distance.",
    "A bearish breakout requires close below the lower channel, bearish candle body, and the configured minimum ATR breakout distance.",
    "A breakout can qualify through channel break, channel acceptance, or channel recovery depending on the final continuation rules.",
    "Location must provide minimum room toward the opposing level unless that opposing level has already been broken.",
    "Momentum requires ATR-sized candle bodies and directional closes across the configured confirmation window.",
    "When volume confirmation is enabled, directional confirmation requires volume expansion above the configured moving average multiplier.",
    "If order-block confirmation is enabled, the relevant order block must be present and confirmed before final continuation/reversal qualification.",
    "Final long qualification is bullish continuation OR bullish reversal; final short qualification is bearish continuation OR bearish reversal.",
    "A signal is an event transition: longQualification and not longQualification[1], or shortQualification and not shortQualification[1].",
    "For M30 and higher, M15 is stronger timeframe confirmation, M5 is execution confirmation, and HTF confirmation is the final authorization gate.",
    "M15 and M5 must confirm the HTF setup direction; they do not rewrite HTF projected Entry, SL or TP.",
    "Actual entry is created only after the complete HTF → M15 → M5 → HTF confirmation sequence. Once created, actual entry is fixed for that cycle.",
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
    "Insufficient confirmation blocks the trade.",
    "Insufficient room to the opposing level blocks the trade unless that level has been broken.",
    "A setup already invalidated cannot produce a final signal until a new valid sequence is established.",
    "A projected TP1 reached before actual confirmation expires the projected setup; it must not be treated as a retroactively entered trade.",
  ],
  executionRules: [
    "Projected Entry, Projected SL and Projected TP1–TP4 belong to the developing HTF setup.",
    "LONG actual entry is the confirmed entry event after M15 → M5 → HTF confirmation; SHORT is the bearish equivalent.",
    "Long stop is reference minus ATR × stop buffer; short stop is reference plus ATR × stop buffer.",
    "Only one active HTF trade lifecycle is maintained at a time.",
    "The AI Scanner may display projected TP1, TP2, TP3 and TP4, but the actual trade lifecycle uses TP1 only.",
    "TP1 is the only successful profit-completion event. TP2–TP4 are projection/reference targets and do not keep the active lifecycle open.",
    "The active trade remains active until TP1 or SL is reached, then the lifecycle is completed and cleared.",
  ],
  riskRules: [
    "ATR length default is 14.",
    "Stop buffer default is 0.75 ATR.",
    "Projected TP ladder may remain TP1–TP4 for AI Scanner planning, while actual lifecycle completion is TP1-only.",
    "Never fabricate entry, stop or targets when required source levels are not reliably observable.",
    "Risk calculations must preserve directional coherence: long SL below entry and targets above entry; short SL above entry and targets below entry.",
  ],
  aiInstructions: [
    "Treat this rule set as the authoritative Volatility & Breakout strategy contract.",
    "Evaluate structure, channel, breakout/acceptance, location, momentum, confirmation and order-block context before issuing a setup verdict.",
    "Regime is context only. Structure → breakout → confirmation determines the current directional candidate.",
    "For M30+, use HTF strategy → M15 confirmation → M5 execution confirmation → HTF final confirmation → actual entry.",
    "Keep projected levels separate from actual trade levels.",
    "The AI Scanner continues to show TP1–TP4 projections, but actual lifecycle success is TP1 only.",
    "Never present a projected setup as an actual entry merely because price later reached projected TP1.",
    "Do not expose Pine code, proprietary implementation details or internal module names to customers.",
  ],
};

export default volatilityBreakoutRules;

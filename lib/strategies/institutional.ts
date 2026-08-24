import type { StrategyRuleSet } from "./types";

/**
 * VaultTrades — Institutional source contract.
 *
 * Source of truth: the developer-supplied Pine Script v6
 * "Vault Session + Institutional Volume + Liquidity Engine v6".
 *
 * The customer-facing strategy name remains "Institutional". The Analyzer
 * must translate the source engine below; it must not replace it with a
 * generic ICT/SMC template.
 */
export const institutionalRules: StrategyRuleSet = {
  id: "institutional",
  name: "Institutional",
  description:
    "Session structure, MMA EMA context, institutional volume/direction, liquidity targets, bounce/rejection zones, higher-timeframe targets and combined BUY/SELL signal lifecycle.",
  source: "PINE_SCRIPT",
  timeframes: ["M15", "M5", "M1", "4H"],
  sequence: [
    "MMA EMA context",
    "Global session identification and session range memory",
    "Institutional volume and directional control",
    "Liquidity sweep detection",
    "Swing/session liquidity target selection",
    "Bounce / rejection zone creation and lifecycle",
    "Higher-timeframe pivot target context",
    "Combined BUY NOW / SELL NOW qualification",
    "BUY SETUP / SELL SETUP developing state",
    "Entry → SL → TP lifecycle and historical footprint",
  ],
  mandatoryRules: [
    "Preserve the six source MMA EMAs: trader 4, 21, 72, 89 and investor 200, 233.",
    "Use ATR length 14 as the source default for volatility context and displacement calculations.",
    "Track the source sessions: New York 08:30-15:00, London 01:00-06:30, Asia 19:00-00:00 and Business 12:00-14:00 in the chart/session timezone.",
    "Maintain session high/low ranges and historical range memory; session context is part of the strategy evidence.",
    "Institutional volume uses Volume SMA length 20, ATR length 14, Liquidity Lookback 20 and displacement threshold 0.9 ATR by default.",
    "Relative volume is volume divided by its volume SMA; session weighting defaults to NY 1.30, London 1.20, Business 1.10, Asia 1.05 and 1.00 outside those sessions.",
    "High institutional volume is volStrength > 1.2.",
    "Buy-side liquidity sweep is high above the prior liquidity high while closing back below that prior high.",
    "Sell-side liquidity sweep is low below the prior liquidity low while closing back above that prior low.",
    "Bullish displacement requires a bullish candle body greater than ATR × 0.9; bearish displacement requires a bearish candle body greater than ATR × 0.9.",
    "Buyer control score is bullish candle + close position above 0.65 + high volume + bullish displacement weighted 2 + sell-side liquidity sweep weighted 2.",
    "Seller control score is bearish candle + close position below 0.35 + high volume + bearish displacement weighted 2 + buy-side liquidity sweep weighted 2.",
    "Net institutional control is buy score minus sell score; default control threshold is 1.",
    "Liquidity targets prefer the active session high/low and otherwise use the most recently confirmed five-bar swing high/low.",
    "Bounce/rejection zones are created from high-volume directional displacement combined with the corresponding liquidity sweep.",
    "Buy zones expire by source age/touch/invalidation rules; sell zones follow the mirrored lifecycle.",
    "BUY BOUNCE requires a bullish zone with bullish control; SELL BOUNCE requires a bearish zone with seller control.",
    "Zone rejection must remain distinct from a bounce: a buy zone can reject on bearish/seller control below its midpoint, and a sell zone can reject on bullish/buyer control above its midpoint.",
    "The source also uses 4H pivot highs/lows as fallback higher-timeframe targets.",
    "BUY NOW requires buyer control plus either a BUY BOUNCE or a valid bullish relationship to the selected buy liquidity/HTF target.",
    "SELL NOW requires seller control plus either a SELL BOUNCE or a valid bearish relationship to the selected sell liquidity/HTF target.",
    "BUY SETUP is a developing bullish state without a current BUY NOW event; SELL SETUP is the mirrored bearish state.",
    "WAIT means neither a valid immediate signal nor a qualifying setup state exists.",
    "The Analyzer must preserve visible source labels such as BUY NOW, SELL NOW, BUY SETUP, SELL SETUP, BUY BOUNCE, SELL BOUNCE, BUY REJ and SELL REJ as first-class evidence when present on the chart.",
  ],
  optionalConfluence: [
    "Session range history and daily range memory.",
    "MMA EMA alignment and separation.",
    "Higher-timeframe 4H pivot target context.",
    "Visible session/news context may be described, but news is not a substitute for the source engine.",
  ],
  invalidationRules: [
    "A zone is removed after the configured maximum age or excessive touches.",
    "A bullish zone invalidates when price closes materially below its lower boundary by the source ATR buffer.",
    "A bearish zone invalidates when price closes materially above its upper boundary by the source ATR buffer.",
    "A liquidity target is not an entry by itself; directional control and the combined signal conditions must still qualify.",
    "Conflicting buyer/seller control blocks a directional execution state.",
    "A rejected or invalidated zone cannot be treated as a fresh setup without a new source-qualified zone/sweep sequence.",
    "A visible completed prior trade must not be relabeled as WAIT or NO TRADE simply because there is no current signal.",
  ],
  executionRules: [
    "BUY NOW and SELL NOW are source signal states, not permission to invent a different entry model.",
    "When a source BUY/SELL label or dashboard provides an exact entry/target reference, preserve that visible level rather than substituting a generic indicator price.",
    "If executable SL/TP levels are not explicitly visible or derivable from the source state, do not fabricate them.",
    "For any proposed BUY, SL must be below entry and TP targets must be above entry; for SELL, SL must be above entry and targets below entry.",
    "The Analyzer must separate current signal state, active trade lifecycle, completed prior footprint and next developing setup.",
  ],
  riskRules: [
    "Universal Analyzer validation applies to every strategy: SL distance must be at least 0.1% from entry unless the instrument's source mechanics make that rule inapplicable and the exception is explicitly explained.",
    "Universal Analyzer validation requires TP distance of at least 2× SL distance for a new executable trade.",
    "Universal Analyzer validation requires the proposed entry to be within 0.5% of current price for a new executable trade.",
    "Maximum modeled account risk is 1.5% per trade; the Analyzer must not recommend a larger risk allocation.",
    "R:R must be validated mathematically and must be at least 1:2 for a new executable trade.",
    "Validate SL/TP geometric direction before displaying executable levels.",
    "If the source chart does not provide enough evidence to derive valid levels, return NO TRADE for a new entry while still reporting the source state and historical footprint.",
  ],
  aiInstructions: [
    "This Pine-derived rule set is authoritative for the Institutional customer strategy.",
    "Do not replace the source with a generic ICT/SMC strategy. The source's own volume, session, liquidity, zone and combined-signal logic comes first.",
    "SMC language such as liquidity sweep, displacement or market structure may be used only when it describes visible evidence that corresponds to the source logic.",
    "Do not invent BOS, CHoCH, Order Block or FVG scores merely because the strategy is called Institutional. Those are not source-native conditions in this Pine script.",
    "Read the chart from the oldest visible candle forward so the Analyzer can reconstruct prior source footprints before deciding the current state.",
    "A prior footprint is valid when visible source labels, dashboard states, liquidity/zone markers, price action and source rules support it. Do not ask the customer to upload proprietary indicator data or previous analysis.",
    "If the prior setup reached its target, report it as COMPLETED/TP HIT. If it was stopped or invalidated, report that outcome. If it is still running, report ACTIVE and its progress.",
    "NO TRADE means no new entry now. It does not mean no historical setup, no market state or no developing setup.",
    "When no current setup exists after a completed prior setup, describe whether the source is developing a new zone/sweep, in directional control, neutral, or consolidating based on visible source evidence.",
    "Confidence must reflect source-condition completeness and evidence quality, not generic AI optimism.",
    "Never fabricate a historical entry, SL, TP or outcome. Use approximate timing and null price fields when exact levels are not visible.",
    "Do not expose Pine code, internal module names or proprietary implementation details in customer-facing analysis.",
  ],
};

export default institutionalRules;

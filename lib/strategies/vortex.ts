import type { StrategyRuleSet } from "./types";

const rules: StrategyRuleSet = {
  id: "vortex",
  name: "VaultTrades Vortex",
  description: "Institutional liquidity targeting and historical causal Order Block detection. Fibonacci, VWAP, confirmation and execution are separate downstream components.",
  source: "PINE_SCRIPT",
  timeframes: ["Independent M1, M5 and M15 structural detection", "Selected timeframe trade lifecycle"],
  sequence: [
    "Detect the nearest untaken confirmed external buy-side and sell-side liquidity objectives independently on each timeframe.",
    "Detect the historical opposing-candle Order Block linked to the displacement that closes through confirmed market structure.",
    "Preserve the originating Order Block's exact wick boundaries, formation time and displacement time; track mitigation and invalidation without silently replacing it.",
    "Only after the liquidity and Order Block structure is identified, measure the retracement with wick-to-wick Fibonacci at 68.1%, 78.6% or 88.0%.",
    "Apply retest, directional candle confirmation, displacement confirmation, confluence and any configured session eligibility as separate downstream trading conditions.",
    "Execute only after all downstream conditions qualify, using the originating Order Block wick for structural risk placement.",
  ],
  mandatoryRules: [
    "The strategy is institutional liquidity targeting plus Order Block detection. Fibonacci, VWAP, confirmation, confluence and execution are not strategies.",
    "Run independent M1, M5 and M15 structural detection on every Vortex analysis request, plus the selected timeframe if it differs. Never return only the selected timeframe's detection.",
    "Buy-side liquidity is the nearest untaken confirmed external swing high above price. Sell-side liquidity is the nearest untaken confirmed external swing low below price.",
    "A bullish Order Block is the historical bearish origin candle preceding bullish displacement that closes through a confirmed swing high. A bearish Order Block is the historical bullish origin candle preceding bearish displacement that closes through a confirmed swing low.",
    "Preserve exact wick boundaries, origin time and displacement time. Do not select an unrelated candle beyond the liquidity target or replace the originating footprint with a newly formed candle after the move.",
    "Detection and lifecycle reporting must continue independently when a later retest, confirmation, H4/H1 gate, confluence or execution condition is not satisfied.",
    "Fibonacci only measures the retracement after the structure is identified. Preferred retracement levels are 68.1%, 78.6%, then 88.0%.",
    "VWAP describes volume-weighted price context only. It cannot create or invalidate the strategy's liquidity or Order Block detection and cannot act as an independent entry trigger.",
    "Retest, directional candle confirmation, displacement confirmation, confluence and session eligibility remain separate downstream trading conditions.",
    "M5 confirmation uses ATR(14) calculated from M5 OHLC, not M1 ATR.",
    "The originating Order Block wick is the structural reference for the stop. Do not substitute an Order Block selected beyond a liquidity objective.",
  ],
  optionalConfluence: [
    "Inverse XAGUSD flow, Silver structure, 50-period Silver MA and direction-aligned Silver volume contribute only when data is available.",
    "VWAP may describe volume-weighted context or contribute optional confluence only; it is not a strategy or entry trigger.",
    "Unavailable optional Silver data is removed from the confluence denominator; it is not treated as a failed signal.",
  ],
  invalidationRules: [
    "An incomplete setup expires after 8 bars according to the selected execution timeframe.",
    "Order Block invalidation requires a completed close beyond its far wick boundary.",
    "Mitigation is recorded separately from invalidation; a mitigated footprint is not silently relocated.",
  ],
  executionRules: [
    "Entry is the selected 68.1%, 78.6% or 88.0% Fib level after the structural detection stage.",
    "TP1, TP2 and TP3 use the 38.2%, 0% and -23.6% Fib levels.",
    "TP4 is 1.50% from entry and TP5 is 1.81% from entry.",
    "Default lot size is 0.05. All lot-size-specific execution behavior remains governed by the existing Vortex execution implementation.",
    "Do not add a generic SMC gate, generic 2R gate, or unrelated indicator confirmation.",
  ],
  riskRules: [
    "BUY stop is beyond the bullish originating Order Block bottom wick; SELL stop is beyond the bearish originating Order Block top wick.",
    "Do not move the originating Order Block or its stop to force a preferred risk/reward.",
    "Risk/reward is calculated from the actual entry and originating-OB stop; do not invent or relocate the stop.",
    "Risk Manager remains the shared account-risk and position-sizing tool.",
  ],
  aiInstructions: [
    "The deterministic Vortex engine is authoritative. AI may explain its evidence but may not create or override a signal, entry, stop, target or Fib level.",
    "Report M1, M5 and M15 liquidity and Order Block detection separately from the selected timeframe's trade lifecycle.",
    "Display each detected Order Block with its timeframe, origin candle time, displacement time and lifecycle state.",
    "Display all existing trade targets and their hit states when a trade is active.",
  ],
};
export default rules;

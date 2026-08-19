import type { StrategyRuleSet } from "./types";

/** Killer Zone rules migrated from the existing VaultTrades source of truth. */
export const killZoneRules: StrategyRuleSet = {
  id: "killZone",
  name: "Killer Zone",
  description: "London liquidity sweep → MSS → FVG → retracement → entry.",
  source: "VAULTTRADES_RULES",
  timeframes: ["chart timeframe"],
  sequence: ["Asian High/Low", "London liquidity sweep", "MSS", "FVG", "FVG retracement", "50% FVG / Consequent Encroachment", "ENTRY"],
  mandatoryRules: [
    "Timezone is America/New_York.",
    "London Kill Zone is 02:00–05:00 New York time.",
    "Asian session is 19:00–02:00 New York time.",
    "Bullish setup requires price to trade below Asian Low during London.",
    "Bearish setup requires price to trade above Asian High during London.",
    "MSS length is 3 and must occur after the liquidity sweep.",
    "Bullish MSS requires a close above the relevant previous swing high.",
    "Bearish MSS requires a close below the relevant previous swing low.",
    "Bullish FVG: current low > high two candles earlier.",
    "Bearish FVG: current high < low two candles earlier.",
    "FVG must be created after MSS and remains valid for 5 bars.",
    "Retracement into the valid FVG is mandatory; do not chase price.",
    "Entry is only created when all mandatory conditions become true on the same event bar.",
  ],
  optionalConfluence: ["Supply & Demand may provide optional confluence only after Killer Zone independently qualifies."],
  invalidationRules: ["Structural invalidation", "FVG expiry", "Invalid setup sequence", "Lost entry opportunity"],
  executionRules: ["Long/short entry is the confirmation candle close and is locked.", "Maximum one completed Killer Zone trade per London session."],
  riskRules: ["Long SL below bullish sweep/setup structural invalidation.", "Short SL above bearish sweep/setup structural invalidation.", "Risk must be positive.", "TP1/TP2/final TP must use valid opposing liquidity or structural objectives; never manufacture a target."],
  aiInstructions: ["Never output BUY/SELL from a sweep alone.", "Explain which sequence stage is complete and what is missing.", "Use WAITING/DEVELOPING/NO TRADE when the sequence is incomplete or invalidated."],
};

export default killZoneRules;

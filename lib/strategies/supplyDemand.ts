import type { StrategyRuleSet } from "./types";

/** Supply & Demand — independent zone strategy. */
export const supplyDemandRules: StrategyRuleSet = {
  id: "supplyDemand",
  name: "Supply & Demand Zones",
  description: "Swing High/Low → wick-based zone → reach → reaction → zone holds → entry.",
  source: "VAULTTRADES_RULES",
  timeframes: ["M1", "M5", "M10", "M15", "M30", "H1", "H4", "D"],
  sequence: ["Valid zone", "Price reaches zone", "Reaction/rejection", "Zone holds", "ENTRY"],
  mandatoryRules: [
    "Swing period is 30 using confirmed pivot highs/lows.",
    "Lookback is 2000 bars; average wick is 5 bars.",
    "Supply top is pivot high; supply bottom is pivot high minus average upper wick.",
    "Demand bottom is pivot low; demand top is pivot low plus average lower wick.",
    "A supply breakout is a close above the supply top; a demand breakout is a close below the demand bottom.",
    "A confirmed breakout invalidates the original zone direction; a broken zone may flip to the opposite direction.",
    "Demand BUY requires valid demand, reach/tolerance, zone intact, bullish reaction and positive risk.",
    "Supply SELL requires valid supply, reach/tolerance, zone intact, bearish reaction and positive risk.",
    "Retest cooldown is 3 bars; hold statistics use a 10-bar hold window.",
    "Zone ranking may be STRONGEST or NEAREST when configured; do not arbitrarily select a zone.",
  ],
  optionalConfluence: ["S/D can be optional confluence for another independently validated strategy."],
  invalidationRules: ["Zone breaks", "Zone becomes inactive/outside lookback", "Reaction fails", "Non-positive risk", "No valid objective"],
  executionRules: ["Entry is locked once the confirmed setup event occurs.", "Selected timeframe is the S/D source of truth unless explicit MTF confluence is enabled."],
  riskRules: ["BUY SL below demand zone bottom with minimal configured buffer.", "SELL SL above supply zone top with minimal configured buffer.", "TP1/TP2/final TP use valid opposing supply/demand or liquidity objectives ahead of entry; never manufacture a target."],
  aiInstructions: ["A nearby zone alone is not an entry.", "Explain zone validity, reach, reaction and hold separately.", "Broken zones must not be presented as active in their old direction."],
};

export default supplyDemandRules;

import type { StrategyRuleSet } from "./types";

/**
 * Supply & Demand — independent zone strategy.
 *
 * The strategy owns its complete quality/execution sequence. The Analyzer
 * must consume this strategy state; it must not replace it with a generic
 * SMC/RR gate.
 */
export const supplyDemandRules: StrategyRuleSet = {
  id: "supplyDemand",
  name: "Supply & Demand Zones",
  description:
    "Market Structure → HTF Direction → Pro/Counter Trend → Zone Identification → Zone Break History → Liquidity Interaction → Premium/Discount → Mitigation Chain → Extreme/MSS Origin → Freshness → Zone Quality → Return → Liquidity Sweep → M5 MSS/CHOCH → Displacement → Entry → Structural SL/TP.",
  source: "VAULTTRADES_RULES",
  timeframes: ["M1", "M5", "M10", "M15", "M30", "H1", "H4", "D"],
  sequence: [
    "Market structure",
    "HTF direction",
    "Pro-trend or counter-trend classification",
    "Zone identification",
    "Determine whether the zone broke another zone",
    "Liquidity interaction",
    "Premium / discount",
    "Mitigation chain",
    "Extreme / MSS origin",
    "Freshness",
    "Zone quality score",
    "Price returns to the zone",
    "Liquidity sweep",
    "M5 MSS / CHOCH",
    "Displacement",
    "ENTRY",
    "Structural SL / TP",
  ],
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
    "The quality sequence must be evaluated in order; a nearby zone alone is never an entry.",
    "HTF direction and pro/counter-trend classification belong to Supply & Demand and must not be replaced by a universal Analyzer bias.",
    "Liquidity interaction, premium/discount, mitigation, MSS-origin and freshness are strategy-state inputs to zone quality.",
    "A price return alone does not create an entry; the return must progress through the strategy's liquidity sweep, M5 MSS/CHOCH and displacement conditions.",
  ],
  optionalConfluence: ["S/D can be optional confluence for another independently validated strategy."],
  invalidationRules: [
    "Zone breaks",
    "Zone becomes inactive/outside lookback",
    "Reaction fails",
    "Non-positive risk",
    "No valid objective",
    "A later structure/zone event invalidates the prior setup state",
  ],
  executionRules: [
    "Entry is locked once the confirmed strategy setup event occurs.",
    "Selected timeframe is the S/D source of truth unless explicit MTF confluence is enabled.",
    "Structural SL/TP are derived from the valid Supply/Demand structure and opposing objectives; targets must not be manufactured by a universal RR rule.",
  ],
  riskRules: [
    "BUY SL below demand zone bottom with minimal configured buffer.",
    "SELL SL above supply zone top with minimal configured buffer.",
    "TP1/TP2/final TP use valid opposing supply/demand or liquidity objectives ahead of entry; never manufacture a target.",
  ],
  aiInstructions: [
    "A nearby zone alone is not an entry.",
    "Explain zone validity, reach, reaction and hold separately.",
    "Broken zones must not be presented as active in their old direction.",
    "Do not replace the Supply & Demand quality sequence with a generic SMC score.",
    "Do not reject or alter a valid Supply & Demand setup solely because another strategy's RR/SL convention is different.",
  ],
};

export default supplyDemandRules;

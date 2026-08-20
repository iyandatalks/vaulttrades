import type { StrategyRuleSet } from "./types";

/** EMA20 Pullback Morning Engine — source-of-truth rules. */
export const ema20Rules: StrategyRuleSet = {
  id: "ema20",
  name: "EMA20 Pullback Morning Engine",
  description: "Structure → EMA20 touch → rejection → break → UT Bot OR SMI confirmation → entry.",
  source: "VAULTTRADES_RULES",
  timeframes: ["chart timeframe"],
  sequence: ["Bullish/Bearish structure", "EMA20 touch", "Rejection", "Rejection active", "Break of rejection level", "UT Bot OR SMI confirmation", "ENTRY"],
  mandatoryRules: [
    "EMA20 length 20; EMA105 length 105 is context only.",
    "ATR length 14; EMA20 touch tolerance is 0.20 × ATR.",
    "Confirmed pivot structure uses pivot length 3.",
    "Bullish structure requires HH or HL, EMA20 rising and close > EMA20.",
    "Bearish structure requires LH or LL, EMA20 falling and close < EMA20.",
    "Bullish touch requires the candle low to interact with EMA20 within tolerance.",
    "Bearish touch requires the candle high to interact with EMA20 within tolerance.",
    "Bullish rejection requires bullish structure + touch + bullish close + close > EMA20.",
    "Bearish rejection requires bearish structure + touch + bearish close + close < EMA20.",
    "Rejection remains active for 3 bars and is invalidated by a close through its rejection low/high.",
    "Bullish break is a close above the stored bullish rejection high; bearish break is a close below the stored bearish rejection low.",
    "UT Bot and SMI are alternative confirmations; minimum confirmation score is 1.",
    "SMI is 7-2-2. UT Bot sensitivity is 1.0 with ATR 10.",
    "Entry occurs only on the new signal transition and the entry price is locked to the confirmation candle close.",
  ],
  optionalConfluence: ["Supply & Demand is optional confluence and cannot create an EMA trade."],
  invalidationRules: ["Rejection expires after 3 bars", "Close through rejection invalidation", "Break occurs without required confirmation", "Non-positive risk"],
  executionRules: ["Do not shift historical entry after the signal candle.", "06:00 SAST bias is display-only and must never block a valid EMA trade."],
  riskRules: ["Long SL = bullish rejection low − minimum tick.", "Short SL = bearish rejection high + minimum tick.", "Risk must be positive.", "RR is 1:2 from the locked entry price."],
  aiInstructions: ["Do not call BUY/SELL from EMA position alone.", "Explain the missing stage of the required sequence.", "EMA105 is context only, not an invented entry filter."],
};

export default ema20Rules;

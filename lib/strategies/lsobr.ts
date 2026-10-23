import type { StrategyRuleSet } from "./types";

const rules: StrategyRuleSet = {
  id: "lsobr",
  name: "VaultTrades LSOBR",
  description: "Liquidity sweep, fixed pre-existing order-block rejection, market structure shift and confirmed order-block exit.",
  source: "VAULTTRADES_RULES",
  timeframes: ["selected Analyzer timeframe"],
  sequence: [
    "Identify confirmed buy-side or sell-side liquidity from completed swing pivots.",
    "Require price to sweep that liquidity and close back through the swept level.",
    "Locate a valid order block formed before the sweep; its wick boundaries are immutable.",
    "Wait for price to revisit and reject that order block without closing through the rejection extreme.",
    "Require a confirmed MSS close through the last opposing confirmed swing.",
    "Require a later completed candle to close out of the order block in the trade direction.",
    "Accept the entry only when the confirmed exit close lies between the fixed OB and swept liquidity.",
    "Place stop beyond the fixed OB/rejection extreme and target the next valid opposing swing liquidity pool.",
    "If the entry location or opposing target cannot be validated, do not chase or invent levels."
  ],
  mandatoryRules: [
    "SELL: sweep buy-side liquidity -> revisit a pre-existing bearish OB above swept liquidity -> rejection without a close through the rejection high -> bearish MSS -> confirmed close below the OB -> entry below the OB and above swept liquidity.",
    "BUY: sweep sell-side liquidity -> revisit a pre-existing bullish OB below swept liquidity -> rejection without a close through the rejection low -> bullish MSS -> confirmed close above the OB -> entry above the OB and below swept liquidity.",
    "The OB must predate the sweep and remain at its original wick-to-wick coordinates. Never shift a zone to fit an entry.",
    "A liquidity sweep, OB touch, rejection or MSS alone is not an entry.",
    "Only use completed candle closes for sweep, MSS and OB-exit confirmation.",
    "Use the next valid opposing liquidity pool as target. Do not invent a target if none is identifiable.",
    "Optional DXY confluence requires DXY touching its own 61.8% Fib and moving opposite to Gold; optional Silver confluence requires Silver touching its own 61.8% Fib and moving with Gold. If those feeds are unavailable, report them as unavailable, not confirmed.",
    "Keep Analyzer universal Rules 1–6 as the validation layer; never replace LSOBR source conditions with SRB opening-range conditions."
  ],
  optionalConfluence: [
    "DXY own 61.8% Fib touch and opposite directional movement to Gold",
    "Silver own 61.8% Fib touch and same directional movement as Gold",
    "Higher-timeframe structure context when available"
  ],
  invalidationRules: [
    "Invalidate a pending setup if a completed candle closes through the rejection extreme before MSS and confirmed OB exit.",
    "Invalidate the sequence if the confirmed OB exit closes outside the valid zone between the fixed OB and swept liquidity.",
    "Do not move an invalidated order block or reuse a completed sweep sequence to create a new entry."
  ],
  executionRules: [
    "Entry is the confirmed close out of the fixed OB only when that close is between the OB and swept liquidity.",
    "Stop loss is beyond the OB/rejection extreme.",
    "Target the next valid opposing liquidity pool; intervening opposing order blocks must be considered before accepting the target.",
    "Display validated OBs as fixed zones, not vertical connector lines; hide invalidated zones.",
    "Distinguish WAITING/SETUP from ENTRY READY. Do not label an unconfirmed setup as a trade."
  ],
  riskRules: [
    "Validate direction, stop geometry, target geometry and minimum 2R universal Analyzer requirement.",
    "Do not claim position sizing is verified without account equity, risk percentage and contract specifications.",
    "No trade is guaranteed."
  ],
  aiInstructions: [
    "The dedicated LSOBR deterministic engine is authoritative for its setup state and levels.",
    "Never use configured SRB session windows, range breakouts or SRB Fib-retest logic for LSOBR.",
    "Explain the exact missing LSOBR event: sweep, pre-existing OB, revisit/rejection, MSS, confirmed OB exit, valid entry location or opposing liquidity target.",
    "Never manufacture BUY/SELL, entry, stop, target, DXY or Silver confluence."
  ]
};
export default rules;

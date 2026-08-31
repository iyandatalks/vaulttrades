import type { StrategyRuleSet } from "./types";

const rules: StrategyRuleSet = {
  id: "m15DualEngine",
  name: "Vault M15 Dual Strategy Engine",
  description: "Canonical M15 decision engine combining Synthetic Market Direction & Execution with Vault Auto Fib Retrace + TP Ladder.",
  source: "VAULTTRADES_RULES",
  timeframes: ["M15"],
  sequence: [
    "Read M15 market direction and structure",
    "Evaluate momentum, strength and trigger",
    "Resolve the active M15 Fib range",
    "Observe 61.8% and prioritize 68.1%, then 78.6%, then 88%",
    "Require M15 pullback/retest and displacement",
    "Compare both strategy directions",
    "Block contradictory confirmed directions",
    "Publish normalized M15 Entry / SL / TP signal",
  ],
  mandatoryRules: [
    "M15 is the canonical decision timeframe.",
    "No M5 confirmation is required for an M15 signal.",
    "Strategy 1 must use its existing score/structure engine.",
    "Strategy 2 must respect the Fib hierarchy.",
    "Do not manufacture a trade when evidence is incomplete.",
    "A confirmed contradiction produces NO TRADE.",
  ],
  optionalConfluence: [
    "DXY direction and MA reaction",
    "PDH / PDL / PWH / PWL liquidity sweeps",
    "Session liquidity",
    "Order blocks",
    "Volume displacement",
  ],
  invalidationRules: [
    "M15 structure invalidation",
    "Active stop-loss breach",
    "Conflicting confirmed strategy directions",
  ],
  executionRules: [
    "Only M15 produces the canonical executable signal.",
    "Signal state must distinguish WAITING, DEVELOPING, BUY, SELL and NO_TRADE.",
    "Entry, SL and TP values come from the engine; the UI must not recalculate them.",
  ],
  riskRules: [
    "Risk is measured from the engine's Entry to Stop Loss.",
    "TP levels must remain directionally valid relative to Entry and Stop Loss.",
    "Do not publish a signal with invalid or non-finite price values.",
  ],
  aiInstructions: [
    "Treat this M15 engine as the source of truth for scanner signals.",
    "Explain completed conditions and missing conditions without inventing confirmations.",
    "Keep optional confluence separate from mandatory strategy conditions.",
    "Do not downgrade or upgrade a signal merely to increase trade frequency.",
  ],
};

export default rules;

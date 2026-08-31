/** VaultTrades strategy registry. */
import type { StrategyDefinition, StrategyId, StrategyRuleSet } from "./types";
import volatilityBreakoutRules from "./volatilityBreakout";
import killZoneRules from "./killZone";
import ema20Rules from "./ema20";
import emaAutomatedRules from "./emaAutomated";
import continuationRules from "./continuation";
import supplyDemandRules from "./supplyDemand";
import observing714Rules from "./714Observing";
import sweepEngulfingStrategy from "./sweepEngulfing";
import swingDevelopingStrategy from "./swingDeveloping";
import autoFibRetraceStrategy from "./autoFibRetrace";
import institutionalRules from "./institutional";
import adaptiveExecutionRules from "./adaptiveExecutionRules";
import adaptiveAutomatedRules from "./adaptiveAutomated";
import m15DualRules from "./m15DualRules";

export const STRATEGIES: Readonly<Record<StrategyId, StrategyDefinition>> = {
  volatilityBreakout: { rules: volatilityBreakoutRules },
  killZone: { rules: killZoneRules },
  ema20: { rules: ema20Rules },
  emaAutomated: { rules: emaAutomatedRules },
  continuation: { rules: continuationRules },
  supplyDemand: { rules: supplyDemandRules },
  "714Observing": { rules: observing714Rules },
  sweepEngulfing: { rules: sweepEngulfingStrategy.rules },
  swingDeveloping: { rules: swingDevelopingStrategy.rules },
  autoFibRetrace: autoFibRetraceStrategy,
  institutional: { rules: institutionalRules },
  adaptiveExecution: { rules: adaptiveExecutionRules },
  adaptiveAutomated: { rules: adaptiveAutomatedRules },
  m15DualEngine: { rules: m15DualRules },
};

export const STRATEGY_LIST: readonly StrategyDefinition[] = [
  STRATEGIES.volatilityBreakout,
  STRATEGIES.continuation,
  STRATEGIES.sweepEngulfing,
  STRATEGIES.autoFibRetrace,
  STRATEGIES["714Observing"],
  STRATEGIES.swingDeveloping,
  STRATEGIES.killZone,
  STRATEGIES.ema20,
  STRATEGIES.emaAutomated,
  STRATEGIES.supplyDemand,
  STRATEGIES.institutional,
  STRATEGIES.adaptiveExecution,
  STRATEGIES.adaptiveAutomated,
  STRATEGIES.m15DualEngine,
];

export function getStrategy(strategyId: StrategyId): StrategyDefinition { return STRATEGIES[strategyId]; }
export function getStrategyRules(strategyId: StrategyId): StrategyRuleSet { return getStrategy(strategyId).rules; }
export type { StrategyDefinition, StrategyId, StrategyRuleSet } from "./types";
export { AI_COACH_RULES } from "./types";
export { default as volatilityBreakoutRules } from "./volatilityBreakout";
export { default as killZoneRules } from "./killZone";
export { default as ema20Rules } from "./ema20";
export { default as emaAutomatedRules } from "./emaAutomated";
export { default as continuationRules } from "./continuation";
export { default as supplyDemandRules } from "./supplyDemand";
export { default as observing714Rules } from "./714Observing";
export { default as sweepEngulfingStrategy } from "./sweepEngulfing";
export { default as swingDevelopingStrategy } from "./swingDeveloping";
export { default as autoFibRetraceStrategy } from "./autoFibRetrace";
export { default as institutionalRules } from "./institutional";
export { default as adaptiveExecutionRules } from "./adaptiveExecutionRules";
export { default as adaptiveAutomatedRules } from "./adaptiveAutomated";
export { default as m15DualRules } from "./m15DualRules";
export { evaluateM15DualEngine } from "./m15DualEngine";
export type { M15DualConfig, M15DualResult, M15FibResult, M15Signal, M15State } from "./m15DualEngine";

import type { StrategyRuleSet } from "./types";

/**
 * 714 Method | Clean Core Engine
 * Source: supplied Pine Script v6.
 *
 * Observation → Bias → S/R → Relevant Level → Sweep/Touch → Rejection
 * → Displacement → EMA20 confirmation → Final BUY/SELL.
 */
export const observing714Rules: StrategyRuleSet = {
  id: "714Observing",
  name: "714 Method | Clean Core Engine",
  description: "13:00 SAST observation engine with locked bias, one active support/resistance pair and event-driven qualification.",
  source: "PINE_SCRIPT",
  timeframes: ["M1", "M5", "M10", "M15", "M30"],
  sequence: [
    "13:00 SAST observation",
    "Bias observation",
    "Bias lock",
    "One active support + one active resistance",
    "Relevant execution level",
    "Liquidity sweep or touch",
    "Rejection",
    "Displacement",
    "EMA20 confirmation",
    "Confirmed candle",
    "Final BUY/SELL",
  ],
  mandatoryRules: [
    "Timezone is Africa/Johannesburg.",
    "Reference time is 13:00 SAST.",
    "Supported timeframes are M1, M5, M10, M15 and M30.",
    "Observation starts at 13:00 and records the opening price, highest high and lowest low.",
    "Bias locks after 30 elapsed observation minutes by default.",
    "Bias score uses observation displacement > ATR, EMA20 position, observation extreme, strong candle body and momentum.",
    "Minimum bias score is 4 by default.",
    "Bullish bias is represented by +1; bearish bias by -1; neutral by 0.",
    "Trade direction is deliberately opposite the market bias: bullish bias → SELL at resistance; bearish bias → BUY at support.",
    "Only one active support and one active resistance are maintained; irrelevant historical levels are discarded.",
    "Pivot length is 5 by default. Nearby pivots within 0.30 × ATR merge into the active level and increase touches.",
    "A level flips only after a confirmed candle close beyond the 0.15 × ATR break buffer; a wick alone does not flip it.",
    "Relevant support must be below price and relevant resistance must be above price; minimum touches is 1 by default.",
    "Execution tolerance is 0.15 × ATR by default.",
    "By default a liquidity sweep is required; BUY sweeps below support and SELL sweeps above resistance.",
    "After the execution event the qualification level is frozen; it must not move with later S/R changes.",
    "Qualification requires rejection, minimum body 60%, displacement 0.40 × ATR, EMA20 confirmation and a confirmed candle by default.",
    "A new final signal is event-based and can be limited to one signal per setup.",
    "Entry defaults to the confirmation candle close; otherwise the frozen execution price is used.",
  ],
  optionalConfluence: ["No external strategy is required; S/R strength and flip status are contextual outputs of the 714 engine itself."],
  invalidationRules: [
    "Daily reset starts a new observation cycle.",
    "Execution state resets at the next 13:00 reference bar.",
    "No valid relevant support/resistance means no execution level.",
    "Qualification cannot proceed without the required rejection/displacement/EMA/candle conditions.",
    "One-signal-per-setup prevents repeated signals from the same execution event.",
  ],
  executionRules: [
    "BUY is a bearish-bias setup executed at support.",
    "SELL is a bullish-bias setup executed at resistance.",
    "The execution level is frozen when first touched/swept.",
    "Final signal is generated only after the full qualification chain and, by default, confirmed candle close.",
    "Webhook payload includes system, event, symbol, timeframe, side, direction, entry, execution level, support/resistance, strength, flip status and bias.",
  ],
  riskRules: [
    "The supplied 714 Pine source does not define a stop-loss, take-profit or RR engine.",
    "Do not invent SL/TP/RR in the strategy module; the Analyzer must report those as unavailable until a separate risk model is explicitly supplied.",
  ],
  aiInstructions: [
    "Preserve the exact 714 progression; do not turn a bias into an immediate trade.",
    "Clearly distinguish OBSERVING, LOCKED, EXECUTION LEVEL, QUALIFICATION and FINAL SIGNAL.",
    "Remember that bullish market bias maps to SELL and bearish market bias maps to BUY in this strategy.",
    "Never treat a wick through S/R as a confirmed flip.",
    "Never use historical irrelevant levels as active levels.",
    "Do not manufacture SL, TP or RR because the supplied Pine source does not define them.",
  ],
};

export default observing714Rules;

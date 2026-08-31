import type { StrategyId } from "./types";

export interface SourceIndicatorSpec { name: string; purpose: string; parameters: string; required: boolean; }

export const SOURCE_INDICATORS: Record<StrategyId, readonly SourceIndicatorSpec[]> = {
  volatilityBreakout: [
    { name: "Moving Average Channel", purpose: "20/20 channel used to define breakout and acceptance/recovery", parameters: "MA type input (default EMA), length 20; applied to high and low", required: true },
    { name: "ATR", purpose: "Breakout displacement, invalidation, momentum and trade geometry", parameters: "Length 14; source stop buffer 0.75 ATR", required: true },
    { name: "Volume", purpose: "Directional participation confirmation when source volume confirmation is enabled", parameters: "Source volume expansion versus configured moving average/multiplier", required: false },
  ],
  institutional: [
    { name: "EMA", purpose: "Six source MMA EMAs for trader/investor context", parameters: "4, 21, 72, 89, 200, 233", required: true },
    { name: "ATR", purpose: "Volatility and displacement calculations", parameters: "Length 14", required: true },
    { name: "RVOL", purpose: "Institutional volume strength and directional control", parameters: "Volume SMA length 20; session weighting; high volume when volStrength > 1.2", required: true },
  ],
  sweepEngulfing: [
    { name: "EMA", purpose: "Trend filter", parameters: "Length 200; source EMA filter enabled by default", required: true },
    { name: "ATR", purpose: "Sweep/engulfing displacement and stop geometry", parameters: "Length 14; ATR stop multiplier 1.8 by default", required: true },
    { name: "RVOL", purpose: "Volume-strength calculation and optional volume confirmation", parameters: "Volume SMA length 20; spike multiplier 1.5; confirmation disabled by default", required: false },
  ],
  swingDeveloping: [
    { name: "EMA", purpose: "H1/M15 direction plus EMA 9/15 pullback and recovery", parameters: "EMA 9, EMA 15, EMA 100", required: true },
    { name: "SMI", purpose: "M15 momentum confirmation", parameters: "Length 7, smooth 1 = 2, smooth 2 = 2; long >= 40, short <= -40", required: true },
    { name: "ATR", purpose: "Trade-risk geometry and structural stop buffer", parameters: "Length 14; source buffer 0.25 ATR", required: true },
  ],
  ema20: [
    { name: "EMA", purpose: "EMA20 pullback engine and EMA105 context", parameters: "EMA 20; EMA 105 context only", required: true },
    { name: "ATR", purpose: "EMA20 touch tolerance and risk geometry", parameters: "Length 14; touch tolerance 0.20 ATR", required: true },
    { name: "SMI", purpose: "Alternative confirmation path", parameters: "7-2-2", required: false },
    { name: "UT Bot", purpose: "Alternative confirmation path", parameters: "Sensitivity 1.0; ATR 10", required: false },
  ],
  continuation: [
    { name: "ATR", purpose: "Correction, interaction and continuation movement thresholds", parameters: "Source ATR; correction 0.25 ATR, S/R tolerance 0.10 ATR, movement filter 0.20 ATR", required: true },
  ],
  killZone: [],
  supplyDemand: [],
  "714Observing": [
    { name: "ATR", purpose: "Observation displacement, S/R merging, execution tolerance and displacement", parameters: "Source ATR; multiple thresholds including 0.30, 0.15, 0.40 ATR", required: true },
    { name: "EMA", purpose: "EMA20 confirmation and bias context", parameters: "EMA 20", required: true },
  ],
  autoFibRetrace: [
    { name: "EMA", purpose: "DXY moving-average confluence", parameters: "DXY MA enabled by default; EMA type default, length 50", required: false },
    { name: "ATR", purpose: "Order-block/projection confirmation and distance constraints", parameters: "OB ATR length 14; projection ATR length 14", required: true },
    { name: "Volume", purpose: "Order-block institutional-volume confirmation and DXY volume spike", parameters: "OB volume length 20; volume factor 1.5", required: false },
  ],
  adaptiveExecution: [
    { name: "EMA", purpose: "Trend hierarchy", parameters: "EMA 20, 50, 100, 200", required: true },
    { name: "RSI", purpose: "Momentum confirmation", parameters: "Length 14; bullish >50, bearish <50", required: true },
    { name: "MACD", purpose: "Momentum confirmation", parameters: "12, 26, 9", required: true },
    { name: "ADX", purpose: "Trend-strength confirmation", parameters: "Length 14; minimum 20; DI direction required", required: true },
    { name: "ATR", purpose: "Adaptive trigger and stop/target geometry", parameters: "Length 14; trigger 1.5 ATR; stop 1.5 ATR", required: true },
  ],
  emaAutomated: [
    { name: "EMA", purpose: "EMA20 pullback structure and EMA105 context", parameters: "EMA 20; EMA 105 context only", required: true },
    { name: "ATR", purpose: "EMA20 touch tolerance and SL geometry", parameters: "Length 14; touch tolerance 0.20 ATR; stop multiplier 2.23", required: true },
    { name: "UT Bot", purpose: "Alternative entry confirmation", parameters: "Sensitivity 1.0; ATR 10", required: false },
    { name: "SMI", purpose: "Alternative entry confirmation", parameters: "7-2-2", required: false },
  ],
  adaptiveAutomated: [
    { name: "EMA", purpose: "Trend hierarchy", parameters: "EMA 20, 50, 100, 200", required: true },
    { name: "RSI", purpose: "Momentum confirmation", parameters: "Length 14; bullish >50, bearish <50", required: true },
    { name: "MACD", purpose: "Momentum confirmation", parameters: "12, 26, 9", required: true },
    { name: "ADX", purpose: "Trend-strength confirmation", parameters: "Length 14; minimum 20; DI direction required", required: true },
    { name: "ATR", purpose: "Adaptive trigger and stop/target geometry", parameters: "Length 14; trigger 1.5 ATR; stop 1.5 ATR", required: true },
  ],
  m15DualEngine: [
    { name: "Adaptive Execution", purpose: "Primary M15 market direction, momentum, strength, structure and trigger scoring", parameters: "Existing Adaptive Execution configuration; default confirmation threshold 70", required: true },
    { name: "ATR", purpose: "M15 Auto Fib displacement and stop geometry", parameters: "Length 14; displacement threshold 0.6 ATR", required: true },
    { name: "Fibonacci Retracement", purpose: "M15 retracement hierarchy and Fib anchor range", parameters: "Preferred 68.1%; secondary 78.6%; last resort 88%; stop 125%", required: true },
  ],
};

export function getSourceIndicators(strategyId: StrategyId): readonly SourceIndicatorSpec[] { return SOURCE_INDICATORS[strategyId] ?? []; }
export function getRequiredSourceIndicators(strategyId: StrategyId): readonly SourceIndicatorSpec[] { return getSourceIndicators(strategyId).filter((indicator) => indicator.required); }

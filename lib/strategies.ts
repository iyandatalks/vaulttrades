export type StrategyId = "killZone" | "ema" | "continuation";

export const STRATEGY_RULES: Record<StrategyId, string> = {
  killZone: `
KILLER ZONE — INDEPENDENT STRATEGY

Timezone:
America/New_York

London Kill Zone:
02:00–05:00 New York time.

Asian session:
19:00–02:00 New York time.

Primary sequence:

Asian High / Asian Low
→ London liquidity sweep
→ MSS
→ FVG
→ 50% FVG / CE retracement
→ Entry

LIQUIDITY SWEEP

Bullish setup:
Price trades below Asian Low during London Kill Zone.

Bearish setup:
Price trades above Asian High during London Kill Zone.

MSS

Bullish:
After sell-side sweep, price closes above the relevant previous swing high.

Bearish:
After buy-side sweep, price closes below the relevant previous swing low.

MSS swing length:
3.

FVG

Bullish:
Current low > high from two candles earlier.

Bearish:
Current high < low from two candles earlier.

FVG validity:
Maximum 5 bars.

ENTRY

Do not enter merely because a sweep occurred.

Do not enter merely because MSS occurred.

After valid MSS + FVG, wait for price to retrace into the FVG.

Preferred entry:
50% FVG / Consequent Encroachment.

If the setup is incomplete:
BUY DEVELOPING
SELL DEVELOPING
WAITING
or NO TRADE.

Only one completed trade per London session.

STOP LOSS

BUY:
Below the bullish setup's structural/sweep invalidation area.

SELL:
Above the bearish setup's structural/sweep invalidation area.

TAKE PROFIT

Provide TP1, TP2 and FINAL TP.

For BUY:
Final TP should target a valid previous meaningful high / Previous Day High liquidity objective when it is ahead of price.

For SELL:
Final TP should target a valid previous meaningful low / Previous Day Low liquidity objective when it is below price.

If that objective has already been taken, use the next valid structural/liquidity objective.

Never place a target behind the entry.
Never force a trade.
`,

  ema: `
EMA — INDEPENDENT STRATEGY

This strategy operates independently from Killer Zone and Continuation.

The model can operate throughout the day.

HIGHER TIMEFRAME

Timeframe:
30 minutes.

EMA20 and EMA105.

Bullish HTF:
EMA20 > EMA105.

Bearish HTF:
EMA20 < EMA105.

Strong bullish:
EMA20 > EMA105 and EMA20 rising.

Strong bearish:
EMA20 < EMA105 and EMA20 falling.

PRIMARY TREND

EMA:
20.

ATR:
14.

Bullish:
EMA20 rising and price above EMA20.

Bearish:
EMA20 falling and price below EMA20.

MOMENTUM

Volume average:
20.

Minimum candle body:
0.80 × ATR.

Bullish momentum:
Bullish trend + strong bullish candle + volume above 20-period average.

Bearish momentum:
Bearish trend + strong bearish candle + volume above 20-period average.

EMA TOUCH

Tolerance:
0.20 × ATR.

Bullish touch:
Price low enters EMA20 tolerance zone.

Bearish touch:
Price high enters EMA20 tolerance zone.

REJECTION

Bullish:
Bullish trend + EMA20 touch + bullish candle + close above EMA20.

Bearish:
Bearish trend + EMA20 touch + bearish candle + close below EMA20.

CONFIRMATION

Bullish:
Later candle trades above bullish rejection candle high.

Bearish:
Later candle trades below bearish rejection candle low.

ENTRY

BUY requires:
Bullish momentum + bullish confirmation.

SELL requires:
Bearish momentum + bearish confirmation.

Do not generate a trade from EMA position alone.

Required sequence:

TREND
→ EMA TOUCH
→ REJECTION
→ MOMENTUM
→ CONFIRMATION
→ ENTRY

STOP LOSS

BUY:
Below bullish rejection candle low.

SELL:
Above bearish rejection candle high.

TAKE PROFIT

The source model uses RR 1:2.

Also identify the previous meaningful high/low liquidity objective.

BUY:
Prefer a valid previous high / PDH liquidity target ahead of entry.

SELL:
Prefer a valid previous low / PDL liquidity target below entry.

If unavailable or already taken, use the valid calculated RR target.

Never force an entry.
`,

  continuation: `
CONTINUATION — INDEPENDENT STRATEGY

Primary timeframe:
M15.

Continuation is an actual market event.

Do not predict continuation before it happens.

Do not combine this strategy with Killer Zone or EMA.

DIRECTIVE

M15 structural state provides:

BULLISH
BEARISH
or WAITING.

STRUCTURE

Bullish:
Actual M15 structural low acts as support.

Bearish:
Actual M15 structural high acts as resistance.

EXPANSION

Identify the actual M15 expansion.

Bullish:
Expansion moves upward.

Bearish:
Expansion moves downward.

CORRECTION

Bullish:
M15 bullish expansion high
→ actual retracement
→ M15 support.

Bearish:
M15 bearish expansion low
→ actual retracement
→ M15 resistance.

Correction ATR filter:
0.25 × ATR.

Support/resistance tolerance:
0.10 × ATR.

INVALIDATION

Bullish:
If structural support is decisively broken by close, invalidate bullish continuation.

Bearish:
If structural resistance is decisively broken by close, invalidate bearish continuation.

CONFIRMATION

Bullish continuation requires:

1. Bullish directive.
2. Valid bullish correction.
3. Support remains valid.
4. Confirmed M15 close above previous M15 high.
5. Movement away satisfies continuation ATR filter.

Bearish continuation requires:

1. Bearish directive.
2. Valid bearish correction.
3. Resistance remains valid.
4. Confirmed M15 close below previous M15 low.
5. Movement away satisfies continuation ATR filter.

Continuation ATR filter:
0.20 × ATR.

ENTRY

Bullish:
Expansion high
→ correction
→ support
→ recovery
→ confirmed continuation
→ BUY.

Bearish:
Expansion low
→ correction
→ resistance
→ recovery
→ confirmed continuation
→ SELL.

Do NOT place a bullish entry directly at resistance/expansion high.

Do NOT place a bearish entry directly at support/expansion low.

The entry must be inside the structural continuation area.

If continuation has not actually confirmed:
BUY DEVELOPING
SELL DEVELOPING
WAITING
or NO TRADE.

INVALIDATION

If bullish price reaches/exceeds the expansion extreme before a valid fresh entry, invalidate the fresh bullish entry.

If bearish price reaches/falls below the expansion extreme before a valid fresh entry, invalidate the fresh bearish entry.

TAKE PROFIT

The source Continuation model does not define a TP formula.

For VaultTrades AI:

BUY:
Final TP should target a valid previous meaningful high / PDH liquidity objective when ahead of price.

SELL:
Final TP should target a valid previous meaningful low / PDL liquidity objective when below price.

If that objective has already been taken, use the next valid structural/liquidity objective.

Never manufacture a future target.
Never force a trade.
`,
};

export function getStrategyRules(strategy: StrategyId): string {
  return STRATEGY_RULES[strategy];
}

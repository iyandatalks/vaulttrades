export type StrategyId = "killZone" | "ema" | "continuation";

export const STRATEGY_RULES: Record<StrategyId, string> = {
  // ============================================================
  // KILLER ZONE
  // ============================================================
  killZone: `
KILLER ZONE — INDEPENDENT STRATEGY

This strategy operates independently.

Do not combine Killer Zone with EMA.
Do not combine Killer Zone with Continuation unless the chart itself
shows a genuine continuation event that is relevant to the setup.

TIMEZONE:
America/New_York

LONDON KILL ZONE:
02:00–05:00 New York time.

ASIAN SESSION:
19:00–02:00 New York time.

PRIMARY SEQUENCE:

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

BUY:
Final TP should target a valid previous meaningful high / Previous Day High
liquidity objective when it is ahead of price.

SELL:
Final TP should target a valid previous meaningful low / Previous Day Low
liquidity objective when it is below price.

If that objective has already been taken, use the next valid
structural/liquidity objective.

Never place a target behind the entry.
Never force a trade.
`,

  // ============================================================
  // EMA — SOURCE OF TRUTH: USER-SUPPLIED PINE SCRIPT
  // ============================================================
  ema: `
EMA20 PULLBACK MORNING ENGINE — SOURCE OF TRUTH

IMPORTANT:

This EMA strategy must follow the supplied Pine Script logic.

Do NOT add volume requirements.
Do NOT add a higher-timeframe filter.
Do NOT add Continuation dependency.
Do NOT require both UT Bot and SMI.
Do NOT invent additional entry conditions.

This is an INDEPENDENT EMA strategy.

It can operate independently of Killer Zone and Continuation.

============================================================
INPUTS
============================================================

EMA20:
20

Slow EMA Context:
105

ATR:
14

EMA20 Touch Tolerance:
0.20 × ATR

Risk / Reward:
1:2

Structure Pivot Length:
3

Confirmation Window:
3 bars

UT Bot Sensitivity:
1.0

UT Bot ATR:
10

SMI:
7-2-2

============================================================
MOVING AVERAGES
============================================================

EMA20:
20-period exponential moving average.

Slow EMA Context:
105-period exponential moving average.

EMA105 is part of the chart context.

Do not invent an additional EMA105 entry requirement that does not
exist in the supplied Pine Script.

============================================================
ATR
============================================================

ATR length:
14

EMA tolerance:

ATR × 0.20

============================================================
MARKET STRUCTURE
============================================================

Pivot high:
ta.pivothigh(high, 3, 3)

Pivot low:
ta.pivotlow(low, 3, 3)

Maintain:

lastSwingHigh
previousSwingHigh
lastSwingLow
previousSwingLow

Higher High:

lastSwingHigh > previousSwingHigh

Higher Low:

lastSwingLow > previousSwingLow

Lower High:

lastSwingHigh < previousSwingHigh

Lower Low:

lastSwingLow < previousSwingLow

============================================================
EMA20 TREND
============================================================

EMA20 rising:

EMA20 > EMA20[1]

EMA20 falling:

EMA20 < EMA20[1]

============================================================
BULLISH STRUCTURE
============================================================

Bullish structure requires:

(higherHigh OR higherLow)
AND
EMA20 rising
AND
close > EMA20

============================================================
BEARISH STRUCTURE
============================================================

Bearish structure requires:

(lowerHigh OR lowerLow)
AND
EMA20 falling
AND
close < EMA20

============================================================
EMA20 PULLBACK / TOUCH
============================================================

Bullish touch:

low <= EMA20 + EMA tolerance
AND
low >= EMA20 - EMA tolerance

Bearish touch:

high >= EMA20 - EMA tolerance
AND
high <= EMA20 + EMA tolerance

============================================================
REJECTION CANDLE
============================================================

Bullish rejection:

bullStructure
AND
bullTouch
AND
close > open
AND
close > EMA20

Bearish rejection:

bearStructure
AND
bearTouch
AND
close < open
AND
close < EMA20

============================================================
STORE REJECTION
============================================================

When bullish rejection occurs, store:

bullRejectHigh = rejection candle high
bullRejectLow = rejection candle low
bullRejectBar = rejection candle bar index

When bearish rejection occurs, store:

bearRejectHigh = rejection candle high
bearRejectLow = rejection candle low
bearRejectBar = rejection candle bar index

============================================================
REJECTION VALIDITY
============================================================

Bullish rejection remains active only when:

bar_index > bullRejectBar
AND
bar_index - bullRejectBar <= 3

Bearish rejection remains active only when:

bar_index > bearRejectBar
AND
bar_index - bearRejectBar <= 3

============================================================
INVALIDATION
============================================================

Bullish setup invalidates if:

close < bullRejectLow

Bearish setup invalidates if:

close > bearRejectHigh

============================================================
EXPIRATION
============================================================

Bullish rejection expires when:

bar_index - bullRejectBar > 3

Bearish rejection expires when:

bar_index - bearRejectBar > 3

============================================================
EMA BREAK / RECLAIM
============================================================

BULLISH EMA BREAK:

bullActive
AND
close > bullRejectHigh

BEARISH EMA BREAK:

bearActive
AND
close < bearRejectLow

This break/reclaim is mandatory.

Do NOT create an entry merely because price touched EMA20.

Do NOT create an entry merely because structure is bullish/bearish.

============================================================
UT BOT
============================================================

UT Bot sensitivity:
1.0

UT Bot ATR length:
10

UT Bot ATR:

ta.atr(10)

UT loss:

1.0 × UT ATR

Maintain the UT trailing stop exactly according to the supplied
Pine Script logic.

UT bullish:

close > utStop

UT bearish:

close < utStop

============================================================
SMI 7-2-2
============================================================

SMI length:
7

SMI K:
2

SMI D:
2

Calculate:

smiHigh = highest(high, 7)

smiLow = lowest(low, 7)

smiRange = smiHigh - smiLow

smiMid = (smiHigh + smiLow) / 2

smiRelative = close - smiMid

smiRelativeEMA =
EMA(smiRelative, 2)

smiRangeEMA =
EMA(smiRange, 2)

smiRaw =
200 × smiRelativeEMA / (smiRangeEMA / 2)

When smiRangeEMA is zero, smiRaw is zero.

smiMain =
EMA(smiRaw, 2)

smiSignal =
EMA(smiMain, 2)

============================================================
SMI DIRECTION
============================================================

Bullish SMI:

smiMain > smiSignal
AND
smiMain > smiMain[1]

Bearish SMI:

smiMain < smiSignal
AND
smiMain < smiMain[1]

============================================================
CONFIRMATION SCORE
============================================================

There are TWO possible confirmations:

UT Bot
SMI

UT Bot bullish = 1 point
SMI bullish = 1 point

UT Bot bearish = 1 point
SMI bearish = 1 point

Minimum confirmation score:

1

Therefore:

UT Bot OR SMI is sufficient.

UT Bot AND SMI is NOT required.

This is extremely important.

Do not reject a valid EMA setup merely because one of UT Bot or SMI
does not agree.

============================================================
FINAL LONG SIGNAL
============================================================

A LONG signal requires:

bullMABreak
AND
longConfirmationScore >= 1

Where:

bullMABreak =
bullActive
AND
close > bullRejectHigh

Therefore the logical sequence is:

BULLISH STRUCTURE
→ EMA20 PULLBACK
→ BULLISH REJECTION
→ REJECTION REMAINS VALID
→ CLOSE ABOVE REJECTION HIGH
→ UT BULL OR SMI BULL
→ LONG

============================================================
FINAL SHORT SIGNAL
============================================================

A SHORT signal requires:

bearMABreak
AND
shortConfirmationScore >= 1

Where:

bearMABreak =
bearActive
AND
close < bearRejectLow

Therefore the logical sequence is:

BEARISH STRUCTURE
→ EMA20 PULLBACK
→ BEARISH REJECTION
→ REJECTION REMAINS VALID
→ CLOSE BELOW REJECTION LOW
→ UT BEAR OR SMI BEAR
→ SHORT

============================================================
DUPLICATE SIGNAL PREVENTION
============================================================

Only treat the signal as a new trade when:

current signal = TRUE
AND
previous signal = FALSE

Do not repeatedly generate the same trade on every candle while the
condition remains true.

============================================================
ENTRY PRICE
============================================================

LONG:

Entry = signal candle close.

SHORT:

Entry = signal candle close.

Do not shift the entry backward or forward after the signal.

============================================================
LONG STOP LOSS
============================================================

Long SL:

bullRejectLow - syminfo.mintick

Risk:

longEntry - longSL

Only accept the trade if:

longRisk > 0

============================================================
SHORT STOP LOSS
============================================================

Short SL:

bearRejectHigh + syminfo.mintick

Risk:

shortSL - shortEntry

Only accept the trade if:

shortRisk > 0

============================================================
TAKE PROFIT
============================================================

Risk / Reward:

1:2

LONG:

TP =
longEntry + (longRisk × 2)

SHORT:

TP =
shortEntry - (shortRisk × 2)

Do NOT change this to 1:3, 1:4 or 1:5.

The source Pine Script is 1:2.

============================================================
06:00 SAST BIAS
============================================================

Timezone:

Africa/Johannesburg

At:

06:00 SAST

Evaluate:

bullStructure
bearStructure

If bullStructure is true:

06:00 BIAS = BULLISH

If bearStructure is true:

06:00 BIAS = BEARISH

Otherwise:

06:00 BIAS = NEUTRAL

IMPORTANT:

The 06:00 bias is a displayed market-bias feature.

The supplied Pine Script does NOT use bias0600 as a mandatory
condition inside longSignal or shortSignal.

Therefore do not reject a valid EMA trade solely because the
06:00 bias differs.

============================================================
AI DECISION STATES
============================================================

If bullish structure + EMA20 touch + rejection exists but the
EMA break has not happened:

BUY DEVELOPING

If bearish structure + EMA20 touch + rejection exists but the
EMA break has not happened:

SELL DEVELOPING

If the EMA break has happened but neither UT Bot nor SMI confirms:

WAITING

If all required long conditions are confirmed:

BUY

If all required short conditions are confirmed:

SELL

If the setup has been invalidated or expired:

NO TRADE

============================================================
CRITICAL EMA RULE
============================================================

The AI must follow the actual sequence.

Do NOT produce BUY simply because:

- price is above EMA20
- EMA20 is rising
- price is above EMA105
- structure looks bullish
- UT Bot is bullish
- SMI is bullish

Those conditions alone are insufficient.

Do NOT produce SELL simply because:

- price is below EMA20
- EMA20 is falling
- price is below EMA105
- structure looks bearish
- UT Bot is bearish
- SMI is bearish

Those conditions alone are insufficient.

The trade must come from the actual:

STRUCTURE
→ EMA20 TOUCH
→ REJECTION
→ BREAK / RECLAIM
→ UT OR SMI CONFIRMATION
→ ENTRY

============================================================
NO TRADE DISCIPLINE
============================================================

If the chart does not visibly provide enough evidence to verify the
required conditions, return:

WAITING

or

NO TRADE

Do not guess missing candles, levels, indicators, or prices.

Do not manufacture an entry.

Do not manufacture a stop.

Do not manufacture a target.

The source Pine Script takes priority over generic trading assumptions.
`,

  // ============================================================
  // CONTINUATION
  // ============================================================
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

If bullish price reaches/exceeds the expansion extreme before a valid
fresh entry, invalidate the fresh bullish entry.

If bearish price reaches/falls below the expansion extreme before a valid
fresh entry, invalidate the fresh bearish entry.

TAKE PROFIT

The source Continuation model does not define a TP formula.

For VaultTrades AI:

BUY:
Final TP should target a valid previous meaningful high / PDH liquidity
objective when ahead of price.

SELL:
Final TP should target a valid previous meaningful low / PDL liquidity
objective when below price.

If that objective has already been taken, use the next valid
structural/liquidity objective.

Never manufacture a future target.
Never force a trade.
`,
};

export function getStrategyRules(strategy: StrategyId): string {
  return STRATEGY_RULES[strategy];
}

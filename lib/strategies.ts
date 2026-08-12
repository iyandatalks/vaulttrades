export type StrategyId = "killZone" | "ema" | "continuation";

export const STRATEGY_RULES: Record<StrategyId, string> = {
  // ============================================================
  // KILLER ZONE
  // ============================================================
  killZone: `
KILLER ZONE — INDEPENDENT STRATEGY

IMPORTANT STRATEGY ISOLATION:

This strategy operates completely independently.

Evaluate ONLY the Killer Zone rules below.

DO NOT use EMA strategy conditions.
DO NOT use Continuation strategy conditions.
DO NOT require EMA20.
DO NOT require EMA105.
DO NOT require UT Bot.
DO NOT require SMI.
DO NOT require Continuation expansion/correction logic.

The existence or absence of an EMA or Continuation setup must NEVER
confirm, reject, delay, or invalidate a Killer Zone setup.

============================================================
TIME
============================================================

Timezone:
America/New_York

London Kill Zone:
02:00–05:00 New York time.

Asian Session:
19:00–02:00 New York time.

============================================================
PRIMARY SEQUENCE
============================================================

Asian High / Asian Low
→ London liquidity sweep
→ MSS
→ FVG
→ 50% FVG / Consequent Encroachment retracement
→ Entry
→ SL
→ TP1
→ TP2
→ Final TP

============================================================
ASIAN RANGE
============================================================

Identify the Asian session High and Low.

Asian High:
Highest relevant price established during the Asian session.

Asian Low:
Lowest relevant price established during the Asian session.

Do not invent Asian High or Asian Low.

If the Asian range cannot be reliably identified from the chart:

WAITING

============================================================
LIQUIDITY SWEEP
============================================================

BULLISH SETUP:

Price must trade below the Asian Low during the London Kill Zone.

This represents a sell-side liquidity sweep.

BEARISH SETUP:

Price must trade above the Asian High during the London Kill Zone.

This represents a buy-side liquidity sweep.

A sweep alone is NOT an entry.

============================================================
MSS
============================================================

After a bullish sell-side sweep:

Price must close above the relevant previous swing high.

After a bearish buy-side sweep:

Price must close below the relevant previous swing low.

MSS swing length:
3.

MSS must occur after the relevant liquidity sweep.

Do not manufacture MSS.

============================================================
FVG
============================================================

Bullish FVG:

Current low > high from two candles earlier.

Bearish FVG:

Current high < low from two candles earlier.

FVG must occur after the valid MSS.

FVG validity window:
Maximum 5 bars.

A sweep without MSS + FVG is NOT a confirmed trade.

============================================================
ENTRY
============================================================

After:

Liquidity Sweep
→ MSS
→ Valid FVG

wait for price to retrace into the FVG.

Preferred entry:
50% FVG / Consequent Encroachment.

Do NOT enter simply because:

- Asian liquidity was swept
- MSS occurred
- an FVG formed
- price is moving strongly
- price is near the FVG

The actual retracement into the FVG is required.

If the setup is forming but entry has not occurred:

BUY DEVELOPING

or

SELL DEVELOPING

If no valid setup is forming:

WAITING

or

NO TRADE

============================================================
STOP LOSS
============================================================

BULLISH:

SL must be below the bullish setup's structural/sweep invalidation
area.

BEARISH:

SL must be above the bearish setup's structural/sweep invalidation
area.

The stop must be derived from the Killer Zone setup.

Do NOT use EMA levels to determine the stop.

Do NOT use Continuation support/resistance to determine the stop.

Do NOT invent a round-number stop.

If a valid structural stop cannot be identified:

STOP LOSS:
WAIT

============================================================
TAKE PROFIT
============================================================

Killer Zone must provide:

TP1
TP2
FINAL TP

Targets must be logically ahead of the entry.

BULLISH:

TP1:
First valid upside structural/liquidity objective.

TP2:
Next valid upside structural/liquidity objective.

FINAL TP:
Valid previous meaningful high / Previous Day High / upside liquidity
objective when ahead of price.

BEARISH:

TP1:
First valid downside structural/liquidity objective.

TP2:
Next valid downside structural/liquidity objective.

FINAL TP:
Valid previous meaningful low / Previous Day Low / downside liquidity
objective when below price.

If the first objective has already been taken, use the next valid
structural/liquidity objective.

Never place a target behind the entry.

Never invent a target.

If a valid final target cannot be identified:

FINAL TP:
WAIT

============================================================
SESSION TRADE LIMIT
============================================================

Only one completed Killer Zone trade per London session.

============================================================
KILLER ZONE STATES
============================================================

Sweep without MSS:

BUY DEVELOPING
or
SELL DEVELOPING

Sweep + MSS without valid FVG:

BUY DEVELOPING
or
SELL DEVELOPING

Sweep + MSS + FVG without 50% FVG retracement:

BUY DEVELOPING
or
SELL DEVELOPING

Complete sequence + valid entry + valid SL:

BUY
or
SELL

Invalidated/expired setup:

NO TRADE

============================================================
STRICT INDEPENDENCE
============================================================

Do not use another strategy to confirm this strategy.

Killer Zone must stand alone.
`,

  // ============================================================
  // EMA
  // ============================================================
  ema: `
EMA20 PULLBACK MORNING ENGINE — SOURCE OF TRUTH

IMPORTANT:

This EMA strategy follows the supplied Pine Script logic.

This is an INDEPENDENT strategy.

Do NOT use Killer Zone conditions.

Do NOT use Continuation conditions.

Do NOT require:

- Asian liquidity
- London Kill Zone
- MSS from Killer Zone
- FVG from Killer Zone
- Continuation expansion
- Continuation correction
- Continuation support/resistance

Do NOT add volume requirements.

Do NOT add a higher-timeframe filter.

Do NOT require both UT Bot and SMI.

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
EMA
============================================================

EMA20:
20-period exponential moving average.

EMA105:
105-period exponential moving average.

EMA105 is chart context.

Do NOT create an additional EMA105 entry requirement.

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
EMA20 DIRECTION
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
EMA20 TOUCH
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
REJECTION
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
REJECTION STORAGE
============================================================

Bullish rejection stores:

bullRejectHigh
bullRejectLow
bullRejectBar

Bearish rejection stores:

bearRejectHigh
bearRejectLow
bearRejectBar

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

Bullish EMA break:

bullActive
AND
close > bullRejectHigh

Bearish EMA break:

bearActive
AND
close < bearRejectLow

This break/reclaim is mandatory.

============================================================
UT BOT
============================================================

UT Bot sensitivity:
1.0

UT Bot ATR:
10

UT ATR:

ta.atr(10)

UT loss:

1.0 × UT ATR

Maintain the UT trailing stop according to the supplied Pine Script.

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

smiRelativeEMA = EMA(smiRelative, 2)

smiRangeEMA = EMA(smiRange, 2)

smiRaw =
200 × smiRelativeEMA / (smiRangeEMA / 2)

If smiRangeEMA is zero:

smiRaw = 0

smiMain = EMA(smiRaw, 2)

smiSignal = EMA(smiMain, 2)

Bullish SMI:

smiMain > smiSignal
AND
smiMain > smiMain[1]

Bearish SMI:

smiMain < smiSignal
AND
smiMain < smiMain[1]

============================================================
CONFIRMATION
============================================================

UT Bot = 1 confirmation point.

SMI = 1 confirmation point.

Minimum confirmation score:

1

Therefore:

UT Bot OR SMI is sufficient.

UT Bot AND SMI is NOT required.

============================================================
LONG
============================================================

A LONG requires:

bullMABreak
AND
longConfirmationScore >= 1

Logical sequence:

BULLISH STRUCTURE
→ EMA20 PULLBACK
→ BULLISH REJECTION
→ REJECTION VALID
→ CLOSE ABOVE REJECTION HIGH
→ UT BULL OR SMI BULL
→ LONG

============================================================
SHORT
============================================================

A SHORT requires:

bearMABreak
AND
shortConfirmationScore >= 1

Logical sequence:

BEARISH STRUCTURE
→ EMA20 PULLBACK
→ BEARISH REJECTION
→ REJECTION VALID
→ CLOSE BELOW REJECTION LOW
→ UT BEAR OR SMI BEAR
→ SHORT

============================================================
DUPLICATE SIGNAL PROTECTION
============================================================

Only treat a signal as a new trade when:

current signal = TRUE
AND
previous signal = FALSE

Do not repeatedly generate the same trade on every candle.

============================================================
ENTRY
============================================================

LONG:

Entry = signal candle close.

SHORT:

Entry = signal candle close.

Do not move the entry backward or forward.

============================================================
STOP LOSS
============================================================

LONG:

longSL =
bullRejectLow - syminfo.mintick

Risk:

longRisk =
longEntry - longSL

Require:

longRisk > 0

SHORT:

shortSL =
bearRejectHigh + syminfo.mintick

Risk:

shortRisk =
shortSL - shortEntry

Require:

shortRisk > 0

============================================================
TAKE PROFIT
============================================================

The supplied EMA Pine Script uses:

Risk / Reward = 1:2

LONG:

TP =
longEntry + (longRisk × 2)

SHORT:

TP =
shortEntry - (shortRisk × 2)

Do NOT change this to 1:3, 1:4 or 1:5.

Do NOT replace the Pine Script TP calculation with a generic
previous-high/previous-low target.

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

Bull structure:

06:00 BIAS = BULLISH

Bear structure:

06:00 BIAS = BEARISH

Otherwise:

06:00 BIAS = NEUTRAL

The 06:00 bias is informational.

It is NOT a mandatory condition for longSignal or shortSignal.

Do not reject a valid EMA trade because 06:00 bias differs.

============================================================
EMA TRADE STATES
============================================================

Bullish structure + EMA20 touch + rejection but no EMA break:

BUY DEVELOPING

Bearish structure + EMA20 touch + rejection but no EMA break:

SELL DEVELOPING

EMA break occurred but neither UT Bot nor SMI confirms:

WAITING

All long conditions confirmed:

BUY

All short conditions confirmed:

SELL

Setup invalidated or expired:

NO TRADE

============================================================
STRICT ENTRY PROTECTION
============================================================

Do NOT produce BUY merely because:

- price is above EMA20
- EMA20 is rising
- price is above EMA105
- structure looks bullish
- UT Bot is bullish
- SMI is bullish

Do NOT produce SELL merely because:

- price is below EMA20
- EMA20 is falling
- price is below EMA105
- structure looks bearish
- UT Bot is bearish
- SMI is bearish

The complete sequence is mandatory.

============================================================
STRICT INDEPENDENCE
============================================================

EMA must stand alone.

Do not use Killer Zone to confirm EMA.

Do not use Continuation to confirm EMA.

Do not reject EMA because Killer Zone conditions are absent.

Do not reject EMA because Continuation conditions are absent.
`,

  // ============================================================
  // CONTINUATION
  // ============================================================
  continuation: `
CONTINUATION — INDEPENDENT STRATEGY

IMPORTANT STRATEGY ISOLATION:

Continuation operates completely independently.

Evaluate ONLY the Continuation rules below.

DO NOT use Killer Zone conditions.

DO NOT use EMA conditions.

DO NOT require:

- Asian High
- Asian Low
- London Kill Zone
- liquidity sweep
- EMA20
- EMA105
- UT Bot
- SMI
- EMA rejection

The absence of a Killer Zone or EMA setup must NEVER prevent a valid
Continuation trade.

============================================================
PRIMARY TIMEFRAME
============================================================

M15.

Continuation is an actual market event.

Do not predict continuation before it happens.

============================================================
STRUCTURAL DIRECTIVE
============================================================

M15 structural state must be:

BULLISH
BEARISH
or
WAITING.

============================================================
BULLISH STRUCTURE
============================================================

An actual M15 structural low acts as support.

The support must be identifiable from the chart.

Do not invent support.

============================================================
BEARISH STRUCTURE
============================================================

An actual M15 structural high acts as resistance.

The resistance must be identifiable from the chart.

Do not invent resistance.

============================================================
EXPANSION
============================================================

Identify the actual M15 expansion.

BULLISH:

Expansion moves upward.

BEARISH:

Expansion moves downward.

The expansion must be visible on the chart.

============================================================
CORRECTION
============================================================

BULLISH:

M15 bullish expansion high
→ actual retracement
→ M15 support.

BEARISH:

M15 bearish expansion low
→ actual retracement
→ M15 resistance.

Correction ATR filter:

0.25 × ATR.

Support/resistance tolerance:

0.10 × ATR.

============================================================
INVALIDATION
============================================================

BULLISH:

If structural support is decisively broken by close,
invalidate bullish continuation.

BEARISH:

If structural resistance is decisively broken by close,
invalidate bearish continuation.

============================================================
CONTINUATION CONFIRMATION
============================================================

BULLISH continuation requires:

1. Bullish directive.
2. Valid bullish correction.
3. Support remains valid.
4. Confirmed M15 close above previous M15 high.
5. Movement away satisfies continuation ATR filter.

BEARISH continuation requires:

1. Bearish directive.
2. Valid bearish correction.
3. Resistance remains valid.
4. Confirmed M15 close below previous M15 low.
5. Movement away satisfies continuation ATR filter.

Continuation ATR filter:

0.20 × ATR.

============================================================
ENTRY
============================================================

BULLISH sequence:

Expansion high
→ correction
→ support
→ recovery
→ confirmed continuation
→ BUY.

BEARISH sequence:

Expansion low
→ correction
→ resistance
→ recovery
→ confirmed continuation
→ SELL.

A valid Continuation setup CAN produce an independent BUY or SELL.

Do NOT require EMA confirmation.

Do NOT require Killer Zone confirmation.

============================================================
ENTRY LOCATION
============================================================

Do NOT place a bullish entry directly at resistance/expansion high.

Do NOT place a bearish entry directly at support/expansion low.

The entry must be associated with the confirmed structural
continuation area.

If the continuation event has not confirmed:

BUY DEVELOPING
SELL DEVELOPING
WAITING
or
NO TRADE.

============================================================
CONTINUATION STOP LOSS
============================================================

Continuation SL must come from the Continuation setup itself.

BULLISH:

SL must be below the valid structural support / correction
invalidation area.

BEARISH:

SL must be above the valid structural resistance / correction
invalidation area.

Do NOT use:

- EMA20
- EMA105
- EMA rejection low/high
- Asian High/Low
- Killer Zone sweep levels

to manufacture the Continuation SL.

The SL must be structurally connected to the Continuation setup.

If a valid structural SL cannot be identified:

STOP LOSS:
WAIT

============================================================
CONTINUATION RISK
============================================================

For BUY:

Risk =
Entry - Stop Loss

Risk must be positive.

For SELL:

Risk =
Stop Loss - Entry

Risk must be positive.

Never report negative risk.

============================================================
CONTINUATION TAKE PROFIT
============================================================

Continuation must independently provide:

TP1
TP2
FINAL TP

The Continuation source model does not specify a fixed RR formula.

Therefore targets must be derived from visible structural/liquidity
objectives.

============================================================
BULLISH TARGETS
============================================================

TP1:

First valid upside structural/liquidity objective ahead of entry.

TP2:

Next valid upside structural/liquidity objective ahead of entry.

FINAL TP:

Valid previous meaningful high / Previous Day High / upside liquidity
objective ahead of entry.

If that target has already been taken, use the next valid structural
or liquidity objective.

============================================================
BEARISH TARGETS
============================================================

TP1:

First valid downside structural/liquidity objective below entry.

TP2:

Next valid downside structural/liquidity objective below entry.

FINAL TP:

Valid previous meaningful low / Previous Day Low / downside liquidity
objective below entry.

If that target has already been taken, use the next valid structural
or liquidity objective.

============================================================
TARGET PROTECTION
============================================================

Never place:

- TP above a BUY entry without structural justification
- TP below a SELL entry without structural justification
- a FINAL TP behind the entry
- a target at an already-consumed liquidity level unless the strategy
  explicitly requires that level

Never manufacture a previous high.

Never manufacture a previous low.

Never manufacture PDH.

Never manufacture PDL.

If a valid target cannot be identified:

TP1:
WAIT

TP2:
WAIT

FINAL TP:
WAIT

============================================================
INVALIDATION BEFORE ENTRY
============================================================

If bullish price reaches/exceeds the expansion extreme before a valid
fresh entry, invalidate the fresh bullish entry.

If bearish price reaches/falls below the expansion extreme before a valid
fresh entry, invalidate the fresh bearish entry.

============================================================
CONTINUATION TRADE STATES
============================================================

Expansion + correction visible but continuation not confirmed:

BUY DEVELOPING
or
SELL DEVELOPING

Structural continuation confirmation incomplete:

WAITING

Continuation confirmation complete + valid entry + valid SL:

BUY
or
SELL

Setup invalidated:

NO TRADE

============================================================
STRICT INDEPENDENCE
============================================================

Continuation must stand alone.

Do not use Killer Zone to confirm Continuation.

Do not use EMA to confirm Continuation.

Do not reject a valid Continuation setup because:

- there was no Asian liquidity sweep
- there was no London Kill Zone setup
- EMA20 is not aligned
- EMA105 is not aligned
- UT Bot disagrees
- SMI disagrees

Continuation is allowed to produce its own independent trade.

============================================================
FINAL RULE
============================================================

The selected strategy is the ONLY strategy being evaluated.

Never combine strategy conditions.

Never use another strategy's entry logic.

Never use another strategy's stop-loss logic.

Never use another strategy's confirmation logic.

Only the selected strategy determines whether a trade exists.
`,
};

export function getStrategyRules(strategy: StrategyId): string {
  return STRATEGY_RULES[strategy];
}

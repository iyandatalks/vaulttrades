export type StrategyId =
  | "killZone"
  | "ema"
  | "continuation"
  | "supplyDemand";

export const STRATEGY_RULES: Record<StrategyId, string> = {

  // ============================================================
  // KILLER ZONE
  // ============================================================ 
  killZone: `
KILLER ZONE — INDEPENDENT STRATEGY

This is a standalone strategy engine.

Killer Zone does NOT depend on:
- EMA
- Continuation
- Supply & Demand
- UT Bot
- SMI
- volume
- higher timeframe confirmation

Supply & Demand may only provide OPTIONAL confluence after the
Killer Zone strategy has independently produced a valid setup.

Never use Supply & Demand to create a Killer Zone trade.

TIMEZONE:
America/New_York

LONDON KILL ZONE:
02:00–05:00 New York time.

ASIAN SESSION:
19:00–02:00 New York time.

------------------------------------------------------------
PRIMARY SEQUENCE
------------------------------------------------------------

ASIAN HIGH / ASIAN LOW
→ LONDON LIQUIDITY SWEEP
→ MSS
→ FVG
→ FVG RETRACEMENT
→ 50% FVG / CONSEQUENT ENCROACHMENT
→ ENTRY

The sequence is mandatory.

Do not skip stages.

------------------------------------------------------------
ASIAN LIQUIDITY
------------------------------------------------------------

Track:

Asian High
Asian Low

The Asian range must be established before evaluating the
London sweep.

------------------------------------------------------------
LIQUIDITY SWEEP
------------------------------------------------------------

BULLISH SETUP:

Price must trade below Asian Low during the London Kill Zone.

This is a sell-side liquidity sweep.

BEARISH SETUP:

Price must trade above Asian High during the London Kill Zone.

This is a buy-side liquidity sweep.

A sweep alone is NOT a trade.

Do not issue BUY or SELL merely because the Asian high/low was swept.

------------------------------------------------------------
MSS
------------------------------------------------------------

MSS swing length:
3

BULLISH MSS:

After a sell-side sweep, price must close above the relevant
previous swing high.

BEARISH MSS:

After a buy-side sweep, price must close below the relevant
previous swing low.

MSS must occur AFTER the relevant liquidity sweep.

Do not accept an MSS that occurred before the sweep as confirmation
of the current setup.

------------------------------------------------------------
FVG
------------------------------------------------------------

BULLISH FVG:

Current low > high from two candles earlier.

BEARISH FVG:

Current high < low from two candles earlier.

The FVG must be created after the valid MSS sequence.

FVG maximum validity:
5 bars.

If the FVG expires before entry:
invalidate the setup.

------------------------------------------------------------
FVG ENTRY
------------------------------------------------------------

After:

SWEEP
→ MSS
→ FVG

the engine must WAIT for price to retrace into the valid FVG.

Preferred entry:

50% FVG / Consequent Encroachment.

Do NOT enter simply because:
- sweep occurred
- MSS occurred
- FVG formed

The retracement into the FVG is mandatory.

The entry must be located inside the valid FVG execution area.

Do not chase price after it has already moved away from the FVG.

------------------------------------------------------------
SETUP STATES
------------------------------------------------------------

After valid sweep but before MSS:

WAITING / DEVELOPING

After valid MSS but before FVG:

BUY DEVELOPING
or
SELL DEVELOPING

After valid FVG but before retracement:

BUY DEVELOPING
or
SELL DEVELOPING

After price reaches the valid FVG:

BUY DEVELOPING
or
SELL DEVELOPING

After all entry conditions are confirmed:

BUY
or
SELL

If invalidated or expired:

NO TRADE

These states must represent actual progression of the setup.

Never output BUY/SELL before the complete sequence.

------------------------------------------------------------
ENTRY LOCK
------------------------------------------------------------

A completed entry exists only on the bar where all mandatory
conditions become true.

LONG:

currentLongSignal == true
AND
previousLongSignal == false

SHORT:

currentShortSignal == true
AND
previousShortSignal == false

Entry price:

LONG = confirmation candle close
SHORT = confirmation candle close

Do not move the entry price afterward.

Do not recalculate historical entries from later candles.

------------------------------------------------------------
STOP LOSS
------------------------------------------------------------

LONG:

SL must be below the actual bullish sweep/setup structural
invalidation level.

SHORT:

SL must be above the actual bearish sweep/setup structural
invalidation level.

Do not manufacture a fixed-distance SL.

Risk must be positive.

LONG:

risk = entry - stopLoss

SHORT:

risk = stopLoss - entry

If risk <= 0:

NO TRADE

------------------------------------------------------------
TAKE PROFIT
------------------------------------------------------------

Provide:

TP1
TP2
FINAL TP

Targets must be based on actual liquidity/structure.

LONG:

Prefer:
- previous meaningful high
- Previous Day High
- next valid buy-side liquidity objective

SHORT:

Prefer:
- previous meaningful low
- Previous Day Low
- next valid sell-side liquidity objective

The target must be ahead of entry.

Never place a target behind entry.

Never force a target.

If an objective has already been consumed:
use the next valid objective.

------------------------------------------------------------
SESSION LIMIT
------------------------------------------------------------

Maximum completed Killer Zone trades:

1 per London session.

Once a completed Killer Zone trade has occurred:

Do not generate another completed Killer Zone trade during the
same London session.

Developing states may still be displayed before the first trade.

------------------------------------------------------------
INVALIDATION
------------------------------------------------------------

Invalidate bullish setup if:
- structural invalidation is broken
- FVG expires
- setup sequence becomes invalid
- valid entry opportunity is lost

Invalidate bearish setup if:
- structural invalidation is broken
- FVG expires
- setup sequence becomes invalid
- valid entry opportunity is lost

Never revive an invalidated setup.

------------------------------------------------------------
SUPPLY & DEMAND CONFLUENCE
------------------------------------------------------------

S/D is OPTIONAL.

If a valid Killer Zone entry occurs inside a valid Demand zone:

S/D CONFLUENCE = TRUE

If a valid Killer Zone entry occurs inside a valid Supply zone:

S/D CONFLUENCE = TRUE

If direction conflicts:

S/D CONFLUENCE = CONFLICT

S/D does not create or cancel the Killer Zone trade.

------------------------------------------------------------
MOST IMPORTANT RULE
------------------------------------------------------------

Killer Zone must trade according to:

SWEEP
→ MSS
→ FVG
→ RETRACEMENT
→ ENTRY

Never manufacture a trade.

If evidence is incomplete:

WAITING
or
NO TRADE.
`,

  // ============================================================
  // EMA
  // ============================================================
  ema: `
EMA20 PULLBACK MORNING ENGINE — SOURCE OF TRUTH

This strategy is completely independent.

Do NOT combine EMA with:
- Killer Zone
- Continuation
- Supply & Demand
- volume
- mandatory higher timeframe confirmation

Supply & Demand is OPTIONAL confluence only.

------------------------------------------------------------
INDICATOR SETTINGS
------------------------------------------------------------

EMA20:
20

EMA105:
105

ATR:
14

EMA20 TOUCH TOLERANCE:
0.20 × ATR

PIVOT LENGTH:
3

CONFIRMATION WINDOW:
3 bars

UT BOT SENSITIVITY:
1.0

UT BOT ATR:
10

SMI:
7-2-2

RISK / REWARD:
1:2

------------------------------------------------------------
EMA DEFINITIONS
------------------------------------------------------------

EMA20:

20-period exponential moving average.

EMA105:

105-period exponential moving average used as CONTEXT ONLY.

IMPORTANT:

EMA105 must NOT independently create an entry.

Do not add an invented EMA105 entry filter.

------------------------------------------------------------
ATR
------------------------------------------------------------

ATR length:
14

EMA tolerance:

ATR × 0.20

------------------------------------------------------------
MARKET STRUCTURE
------------------------------------------------------------

Pivot high:

ta.pivothigh(high, 3, 3)

Pivot low:

ta.pivotlow(low, 3, 3)

Maintain:

lastSwingHigh
previousSwingHigh

lastSwingLow
previousSwingLow

HIGHER HIGH:

lastSwingHigh > previousSwingHigh

HIGHER LOW:

lastSwingLow > previousSwingLow

LOWER HIGH:

lastSwingHigh < previousSwingHigh

LOWER LOW:

lastSwingLow < previousSwingLow

Do not use a random candle high/low as structure.

Use confirmed pivot structure.

------------------------------------------------------------
EMA20 DIRECTION
------------------------------------------------------------

EMA20 rising:

EMA20 > EMA20[1]

EMA20 falling:

EMA20 < EMA20[1]

------------------------------------------------------------
BULLISH STRUCTURE
------------------------------------------------------------

Bullish structure requires:

(higherHigh OR higherLow)
AND
EMA20 rising
AND
close > EMA20

------------------------------------------------------------
BEARISH STRUCTURE
------------------------------------------------------------

Bearish structure requires:

(lowerHigh OR lowerLow)
AND
EMA20 falling
AND
close < EMA20

------------------------------------------------------------
EMA20 TOUCH
------------------------------------------------------------

BULLISH TOUCH:

low <= EMA20 + EMA tolerance
AND
low >= EMA20 - EMA tolerance

BEARISH TOUCH:

high >= EMA20 - EMA tolerance
AND
high <= EMA20 + EMA tolerance

The candle must actually interact with EMA20.

Price merely being above/below EMA20 is NOT a pullback.

------------------------------------------------------------
REJECTION
------------------------------------------------------------

BULLISH REJECTION:

bullStructure
AND
bullTouch
AND
close > open
AND
close > EMA20

BEARISH REJECTION:

bearStructure
AND
bearTouch
AND
close < open
AND
close < EMA20

------------------------------------------------------------
REJECTION STORAGE
------------------------------------------------------------

When bullish rejection occurs:

bullRejectHigh = rejection candle high
bullRejectLow = rejection candle low
bullRejectBar = rejection candle bar index

When bearish rejection occurs:

bearRejectHigh = rejection candle high
bearRejectLow = rejection candle low
bearRejectBar = rejection candle bar index

The rejection remains active for:

3 bars

After 3 bars:

expire rejection.

Do not continue using an expired rejection candle.

------------------------------------------------------------
REJECTION INVALIDATION
------------------------------------------------------------

BULLISH:

If close < bullRejectLow:

invalidate bullish rejection.

BEARISH:

If close > bearRejectHigh:

invalidate bearish rejection.

An invalidated rejection cannot later produce a break.

------------------------------------------------------------
EMA BREAK
------------------------------------------------------------

BULLISH EMA BREAK:

bullActive
AND
close > bullRejectHigh

BEARISH EMA BREAK:

bearActive
AND
close < bearRejectLow

The break must occur AFTER the rejection.

Do not treat the original rejection candle itself as the EMA break
unless the actual break condition occurs according to the defined
sequence.

------------------------------------------------------------
CONFIRMATION
------------------------------------------------------------

UT Bot and SMI are ALTERNATIVE confirmations.

UT Bot bullish:
1 point

SMI bullish:
1 point

UT Bot bearish:
1 point

SMI bearish:
1 point

Minimum confirmation score:

1

Therefore:

UT Bot OR SMI is sufficient.

UT Bot AND SMI is NOT required.

------------------------------------------------------------
LONG
------------------------------------------------------------

LONG requires:

bullMABreak
AND
longConfirmationScore >= 1

The sequence is:

BULLISH STRUCTURE
→ EMA20 PULLBACK
→ BULLISH REJECTION
→ REJECTION ACTIVE
→ CLOSE ABOVE REJECTION HIGH
→ UT BULL OR SMI BULL
→ LONG

------------------------------------------------------------
SHORT
------------------------------------------------------------

SHORT requires:

bearMABreak
AND
shortConfirmationScore >= 1

The sequence is:

BEARISH STRUCTURE
→ EMA20 PULLBACK
→ BEARISH REJECTION
→ REJECTION ACTIVE
→ CLOSE BELOW REJECTION LOW
→ UT BEAR OR SMI BEAR
→ SHORT

------------------------------------------------------------
ENTRY LOCK
------------------------------------------------------------

Only create a new trade when:

currentSignal == true
AND
previousSignal == false

LONG ENTRY:

confirmation candle close.

SHORT ENTRY:

confirmation candle close.

CRITICAL:

Once the entry is created, entryPrice is LOCKED.

Do not continuously recalculate entryPrice on later candles.

Do not shift historical entries.

Do not replace the original signal candle with a later candle.

------------------------------------------------------------
STOP LOSS
------------------------------------------------------------

LONG:

longStop =
bullRejectLow - syminfo.mintick

SHORT:

shortStop =
bearRejectHigh + syminfo.mintick

Only accept positive risk.

LONG:

longRisk =
longEntry - longStop

SHORT:

shortRisk =
shortStop - shortEntry

If risk <= 0:

NO TRADE

------------------------------------------------------------
TAKE PROFIT
------------------------------------------------------------

Risk / Reward:

1:2

LONG:

longTP =
longEntry + (longRisk × 2)

SHORT:

shortTP =
shortEntry - (shortRisk × 2)

TP must be calculated from the LOCKED entry price.

Never calculate TP from the current price after entry.

------------------------------------------------------------
06:00 SAST BIAS
------------------------------------------------------------

Timezone:

Africa/Johannesburg

At 06:00:

Bullish structure:
06:00 BIAS = BULLISH

Bearish structure:
06:00 BIAS = BEARISH

Otherwise:
06:00 BIAS = NEUTRAL

IMPORTANT:

06:00 bias is DISPLAY ONLY.

It is NOT a mandatory entry condition.

It must never block a valid EMA trade.

------------------------------------------------------------
STATE OUTPUT
------------------------------------------------------------

Bullish structure + EMA20 touch + rejection + no break:

BUY DEVELOPING

Bearish structure + EMA20 touch + rejection + no break:

SELL DEVELOPING

EMA break occurred but UT Bot and SMI both fail:

WAITING

All long conditions confirmed:

BUY

All short conditions confirmed:

SELL

Setup invalidated:

NO TRADE

------------------------------------------------------------
ANTI-RANDOM-SIGNAL RULE
------------------------------------------------------------

Do NOT produce BUY merely because:

price > EMA20
EMA20 rising
price > EMA105
bullish structure
UT bullish
SMI bullish

Do NOT produce SELL merely because:

price < EMA20
EMA20 falling
price < EMA105
bearish structure
UT bearish
SMI bearish

The COMPLETE sequence is mandatory.

------------------------------------------------------------
SUPPLY & DEMAND
------------------------------------------------------------

S/D is OPTIONAL.

If the independently confirmed EMA entry is inside a valid Demand
zone or configured S/D tolerance:

S/D CONFLUENCE = TRUE

If inside valid Supply:

S/D CONFLUENCE = TRUE

If zone direction conflicts:

S/D CONFLUENCE = CONFLICT

S/D cannot create an EMA trade.

No S/D zone does NOT invalidate a valid EMA trade.

------------------------------------------------------------
MOST IMPORTANT RULE
------------------------------------------------------------

EMA strategy trades:

STRUCTURE
→ EMA20 TOUCH
→ REJECTION
→ BREAK
→ UT OR SMI CONFIRMATION
→ ENTRY

Nothing else creates the trade.
`,

  // ============================================================
  // CONTINUATION
  // ============================================================
  continuation: `
CONTINUATION — INDEPENDENT MARKET STRUCTURE STRATEGY

Primary timeframe:

M15

This strategy is completely independent.

Do NOT combine Continuation with:
- EMA
- Killer Zone
- Supply & Demand
- volume
- mandatory higher timeframe confirmation

Supply & Demand is OPTIONAL confluence only.

------------------------------------------------------------
CORE PRINCIPLE
------------------------------------------------------------

Continuation is an ACTUAL MARKET EVENT.

Do not predict continuation.

The market must demonstrate:

EXPANSION
→ CORRECTION
→ STRUCTURAL HOLD
→ RECOVERY
→ CONFIRMED CONTINUATION
→ ENTRY

------------------------------------------------------------
DIRECTIVE
------------------------------------------------------------

M15 structural state:

BULLISH
BEARISH
WAITING

------------------------------------------------------------
STRUCTURE
------------------------------------------------------------

BULLISH:

Actual M15 structural low acts as support.

BEARISH:

Actual M15 structural high acts as resistance.

Do not use arbitrary candles as support/resistance.

Use confirmed structural levels.

------------------------------------------------------------
EXPANSION
------------------------------------------------------------

BULLISH:

Price creates a valid upward expansion.

Record:

bullExpansionHigh

BEARISH:

Price creates a valid downward expansion.

Record:

bearExpansionLow

The expansion extreme is the structural reference.

------------------------------------------------------------
CORRECTION
------------------------------------------------------------

BULLISH:

M15 bullish expansion high
→ actual retracement
→ M15 structural support.

BEARISH:

M15 bearish expansion low
→ actual retracement
→ M15 structural resistance.

Minimum correction movement:

0.25 × ATR

The correction must be REAL.

A one-candle pause or tiny fluctuation does not automatically qualify
as a correction.

------------------------------------------------------------
SUPPORT / RESISTANCE TOLERANCE
------------------------------------------------------------

Tolerance:

0.10 × ATR

This tolerance is for determining interaction with the actual
structural level.

Do not use tolerance to manufacture an entry away from structure.

------------------------------------------------------------
CONTINUATION MOVEMENT
------------------------------------------------------------

Continuation ATR filter:

0.20 × ATR

Price must demonstrate meaningful movement away from the structural
continuation area.

------------------------------------------------------------
BULLISH CONTINUATION
------------------------------------------------------------

Required:

1. Bullish directive.
2. Valid bullish expansion.
3. Valid correction.
4. Actual structural support established.
5. Support remains valid.
6. Price recovers from support.
7. M15 candle closes above the previous M15 high.
8. Movement away satisfies continuation ATR filter.
9. Entry is NOT at the expansion extreme.

Sequence:

EXPANSION HIGH
→ CORRECTION
→ SUPPORT
→ RECOVERY
→ CONFIRMED BREAK
→ VALID CONTINUATION ENTRY
→ BUY

------------------------------------------------------------
BEARISH CONTINUATION
------------------------------------------------------------

Required:

1. Bearish directive.
2. Valid bearish expansion.
3. Valid correction.
4. Actual structural resistance established.
5. Resistance remains valid.
6. Price rejects/recoveries downward from resistance.
7. M15 candle closes below previous M15 low.
8. Movement away satisfies continuation ATR filter.
9. Entry is NOT at the expansion extreme.

Sequence:

EXPANSION LOW
→ CORRECTION
→ RESISTANCE
→ RECOVERY
→ CONFIRMED BREAK
→ VALID CONTINUATION ENTRY
→ SELL

------------------------------------------------------------
CRITICAL ENTRY LOCATION RULE
------------------------------------------------------------

NEVER:

BUY directly at resistance.

NEVER:

SELL directly at support.

NEVER:

BUY directly at the expansion high.

NEVER:

SELL directly at the expansion low.

The expansion extreme is the OBJECTIVE that price is continuing
toward, not automatically the entry location.

The valid entry must occur after the correction and structural
recovery have produced confirmation.

------------------------------------------------------------
ENTRY AREA
------------------------------------------------------------

For bullish continuation:

Entry must be associated with the confirmed continuation structure,
not the original expansion extreme.

For bearish continuation:

Entry must be associated with the confirmed continuation structure,
not the original expansion extreme.

If the only available entry is at the expansion extreme:

DO NOT TRADE.

Return:

WAITING
or
NO TRADE

------------------------------------------------------------
CONTINUATION CONFIRMATION
------------------------------------------------------------

Bullish:

confirmed M15 close above previous M15 high.

Bearish:

confirmed M15 close below previous M15 low.

The break must occur after the correction.

A previous high/low break that occurred before the correction does
NOT count as fresh continuation confirmation.

------------------------------------------------------------
INVALIDATION
------------------------------------------------------------

BULLISH:

Decisive close below structural support:

invalidate bullish continuation.

BEARISH:

Decisive close above structural resistance:

invalidate bearish continuation.

------------------------------------------------------------
EXPANSION EXTREME INVALIDATION
------------------------------------------------------------

If bullish price reaches/exceeds the old expansion extreme BEFORE a
fresh valid continuation entry has been established:

invalidate the fresh bullish entry opportunity.

If bearish price reaches/falls below the old expansion extreme BEFORE
a fresh valid continuation entry has been established:

invalidate the fresh bearish entry opportunity.

Do not chase an already-completed expansion.

------------------------------------------------------------
ENTRY LOCK
------------------------------------------------------------

Once continuation confirmation becomes true:

currentSignal == true
AND
previousSignal == false

create the trade.

Entry:

confirmation candle close.

Once created:

LOCK entryPrice.

Do not shift entry to later candles.

Do not continuously recalculate the entry from current price.

------------------------------------------------------------
STOP LOSS
------------------------------------------------------------

BUY:

SL must be below confirmed continuation support / structural
invalidation.

SELL:

SL must be above confirmed continuation resistance / structural
invalidation.

Do not manufacture an arbitrary SL.

If structural invalidation cannot be established:

ENTRY = WAIT
STOP LOSS = WAIT
RISK = WAIT

Risk must be positive.

------------------------------------------------------------
TAKE PROFIT
------------------------------------------------------------

Continuation does NOT use a fixed RR formula.

BUY:

Prefer:
- previous meaningful high
- Previous Day High
- next valid buy-side liquidity
- next structural objective

SELL:

Prefer:
- previous meaningful low
- Previous Day Low
- next valid sell-side liquidity
- next structural objective

TP must be ahead of entry.

Never place TP behind entry.

Never force a TP.

If the objective has already been consumed:
use the next valid objective.

------------------------------------------------------------
STATE OUTPUT
------------------------------------------------------------

Bullish expansion exists but correction has not occurred:

BUY DEVELOPING

Bearish expansion exists but correction has not occurred:

SELL DEVELOPING

Correction exists but continuation has not confirmed:

BUY DEVELOPING
or
SELL DEVELOPING

Continuation confirmation exists:

BUY
or
SELL

Invalidated:

NO TRADE

Insufficient evidence:

WAITING

------------------------------------------------------------
SUPPLY & DEMAND
------------------------------------------------------------

S/D is OPTIONAL.

If valid bullish continuation entry occurs inside Demand:

S/D CONFLUENCE = BULLISH

If valid bearish continuation entry occurs inside Supply:

S/D CONFLUENCE = BEARISH

If direction conflicts:

S/D CONFLUENCE = CONFLICT

S/D cannot create the Continuation trade.

A valid Continuation trade remains valid without S/D.

------------------------------------------------------------
MOST IMPORTANT RULE
------------------------------------------------------------

Continuation is:

EXPANSION
→ CORRECTION
→ SUPPORT/RESISTANCE
→ RECOVERY
→ CONFIRMED BREAK
→ ENTRY

Do not turn every breakout into a continuation trade.

Do not enter at resistance.

Do not enter at support.

Do not chase the expansion extreme.

Do not manufacture continuation.
`,

  // ============================================================
  // SUPPLY & DEMAND
  // ============================================================
  supplyDemand: `
SUPPLY & DEMAND ZONES — INDEPENDENT STRATEGY

This is a completely standalone strategy.

It can trade independently.

It does NOT depend on:

EMA
Killer Zone
Continuation

Those strategies may optionally use S/D as confluence.

S/D itself does not require another strategy.

Do not retain or display the original indicator publisher/name.

------------------------------------------------------------
PRIMARY CONCEPT
------------------------------------------------------------

Swing High
→ Supply Zone

Swing Low
→ Demand Zone

------------------------------------------------------------
ZONE CREATION
------------------------------------------------------------

Swing period:

30

Pivot high:

ta.pivothigh(high, 30, 30)

Pivot low:

ta.pivotlow(low, 30, 30)

Lookback:

2000 bars

------------------------------------------------------------
WICK-BASED ZONE CONSTRUCTION
------------------------------------------------------------

Average wick:

5 bars

SUPPLY:

pivot high = zone reference.

Supply top:

pivot high

Supply bottom:

pivot high - average upper wick

DEMAND:

pivot low = zone reference.

Demand bottom:

pivot low

Demand top:

pivot low + average lower wick

IMPORTANT:

The pivot price is NOT the entire zone.

The complete calculated zone is the trading area.

------------------------------------------------------------
ZONE VALIDITY
------------------------------------------------------------

A zone is valid while:

- active
- inside lookback
- not invalidated
- not cleanly broken
- direction remains valid

SUPPLY:

Supply should be above current price for a fresh supply reaction.

DEMAND:

Demand should be below current price for a fresh demand reaction.

------------------------------------------------------------
ZONE BREAKOUT
------------------------------------------------------------

SUPPLY BREAKOUT:

Price closes above supply zone top.

DEMAND BREAKOUT:

Price closes below demand zone bottom.

A confirmed breakout invalidates the original directional use of
that zone.

Do not continue treating broken supply as active supply.

Do not continue treating broken demand as active demand.

------------------------------------------------------------
ZONE FLIP
------------------------------------------------------------

After confirmed breakout:

Supply may flip to Demand.

Demand may flip to Supply.

A flipped zone must be treated using its NEW direction.

Never use the old direction after the flip has been confirmed.

------------------------------------------------------------
ZONE REACH
------------------------------------------------------------

The actual calculated zone is the primary execution area.

A configurable execution tolerance may be applied.

IMPORTANT:

Do NOT invent a tolerance value.

If the application provides:

zoneTolerance

use that value.

If no explicit tolerance exists:

use the zone itself.

A zone is considered reached when price enters the zone or reaches
the zone within the configured tolerance.

A zone materially distant from price is NOT an active entry location.

------------------------------------------------------------
DEMAND RETEST
------------------------------------------------------------

Demand retest:

Price trades into/through Demand
→ closes back above Demand zone.

This is bullish rejection.

The zone must remain valid.

------------------------------------------------------------
SUPPLY RETEST
------------------------------------------------------------

Supply retest:

Price trades into/through Supply
→ closes back below Supply zone.

This is bearish rejection.

The zone must remain valid.

------------------------------------------------------------
RETEST COOLDOWN
------------------------------------------------------------

Retest cooldown:

3 bars

Do not count repeated candles lingering around the same zone as
multiple independent retests during the cooldown.

------------------------------------------------------------
DEMAND TRADE
------------------------------------------------------------

BUY requires:

1. Valid Demand zone.
2. Price reaches zone/tolerance.
3. Zone has not broken.
4. Bullish reaction/rejection.
5. Demand remains valid at confirmation.
6. Valid entry price exists.
7. Positive risk exists.

Sequence:

VALID DEMAND
→ PRICE REACHES ZONE
→ BULLISH REACTION
→ ZONE HOLDS
→ BUY

Do NOT BUY merely because Demand is nearby.

------------------------------------------------------------
SUPPLY TRADE
------------------------------------------------------------

SELL requires:

1. Valid Supply zone.
2. Price reaches zone/tolerance.
3. Zone has not broken.
4. Bearish reaction/rejection.
5. Supply remains valid at confirmation.
6. Valid entry price exists.
7. Positive risk exists.

Sequence:

VALID SUPPLY
→ PRICE REACHES ZONE
→ BEARISH REACTION
→ ZONE HOLDS
→ SELL

Do NOT SELL merely because Supply is nearby.

------------------------------------------------------------
ENTRY LOCK
------------------------------------------------------------

A completed trade is created only when:

currentSignal == true
AND
previousSignal == false

Entry must be the confirmed setup candle close or the application's
explicitly configured zone-entry method.

Once entry is created:

LOCK entryPrice.

Do not move historical entries.

Do not continuously recalculate entry from current price.

------------------------------------------------------------
STATE OUTPUT
------------------------------------------------------------

Valid Demand exists but price has not reached it:

BUY DEVELOPING

Valid Supply exists but price has not reached it:

SELL DEVELOPING

Demand reached and bullish reaction is developing:

BUY DEVELOPING

Supply reached and bearish reaction is developing:

SELL DEVELOPING

Demand reaction confirmed:

BUY

Supply reaction confirmed:

SELL

Zone broken before entry:

NO TRADE

No valid zone:

WAITING

------------------------------------------------------------
MTF OPERATION
------------------------------------------------------------

Supply & Demand may operate independently on:

M1
M5
M10
M15
M30
H1
H4
Daily

The selected timeframe is the source of truth.

Do NOT require:

M15

Do NOT require:

H1

Do NOT require:

higher timeframe agreement

unless the application explicitly enables MTF confluence.

------------------------------------------------------------
MTF CONFLUENCE
------------------------------------------------------------

Higher-timeframe zones may be displayed as context.

They do NOT automatically become mandatory confirmation.

A lower-timeframe S/D trade remains independently valid.

A higher-timeframe zone does not automatically cancel a lower-timeframe
trade.

------------------------------------------------------------
ZONE RANKING
------------------------------------------------------------

Supported ranking modes:

STRONGEST
NEAREST

NEAREST:

Prioritize distance from current price.

STRONGEST:

Consider:

- successful holds
- retest evidence
- proximity
- visibility stability
- zone quality

If ranking mode is configured:

use the configured ranking.

Do not arbitrarily select a zone.

------------------------------------------------------------
ZONE SPACING
------------------------------------------------------------

Default minimum zone spacing:

0.1%

If application provides a configurable spacing value:

use the configured value.

Zones closer than the configured spacing may be filtered to prevent
redundant overlapping trade locations.

------------------------------------------------------------
RETEST STATISTICS
------------------------------------------------------------

Track:

Retests
Breakouts
Held

Hold window:

10 bars

A retest is successfully held when no breakout occurs during the
configured hold window.

Statistics affect zone quality/ranking only.

Statistics do NOT independently create trades.

------------------------------------------------------------
STOP LOSS
------------------------------------------------------------

BUY:

SL must be below Demand zone bottom.

Preferred:

Demand zone bottom - minimal instrument tick/buffer.

SELL:

SL must be above Supply zone top.

Preferred:

Supply zone top + minimal instrument tick/buffer.

Do not manufacture arbitrary stop distances.

------------------------------------------------------------
RISK VALIDATION
------------------------------------------------------------

BUY:

risk =
entry - stopLoss

Require:

risk > 0

SELL:

risk =
stopLoss - entry

Require:

risk > 0

If risk cannot be calculated:

ENTRY = WAIT
STOP LOSS = WAIT
RISK = WAIT

------------------------------------------------------------
TAKE PROFIT
------------------------------------------------------------

Do NOT use arbitrary fixed TP values.

BUY:

TP1:
nearest valid opposing Supply / structural liquidity objective
above entry.

TP2:
next valid opposing Supply / liquidity objective above TP1.

FINAL TP:
next meaningful opposing Supply / liquidity objective ahead of price.

SELL:

TP1:
nearest valid opposing Demand / structural liquidity objective
below entry.

TP2:
next valid opposing Demand / liquidity objective below TP1.

FINAL TP:
next meaningful opposing Demand / liquidity objective below price.

Never place TP behind entry.

Never use an already-consumed objective unless it remains a valid
fresh objective.

If no valid target exists:

TP = WAIT

Do not manufacture a target.

------------------------------------------------------------
SUPPLY & DEMAND CONFLUENCE WITH OTHER STRATEGIES
------------------------------------------------------------

S/D is the ONLY optional zone-confluence layer.

It does NOT become a dependency.

KILLER ZONE:

Can trade without S/D.

EMA:

Can trade without S/D.

CONTINUATION:

Can trade without S/D.

If another strategy independently produces a valid trade and the
entry is inside a valid S/D zone or configured tolerance:

S/D CONFLUENCE = TRUE

only if the zone direction agrees.

If direction conflicts:

S/D CONFLUENCE = CONFLICT

Do NOT automatically cancel the independent strategy.

The independent strategy's own rules determine whether the trade
remains valid.

------------------------------------------------------------
DIRECTIONAL CONFLUENCE
------------------------------------------------------------

Demand supports BUY.

Supply supports SELL.

Demand does NOT confirm SELL.

Supply does NOT confirm BUY.

Broken/invalid zone:

NO CONFLUENCE

Zone outside tolerance:

NO ENTRY CONFLUENCE

Visible zone alone:

NO ENTRY CONFLUENCE

------------------------------------------------------------
MOST IMPORTANT RULE
------------------------------------------------------------

The four strategies are independent engines.

Killer Zone can trade alone.

EMA can trade alone.

Continuation can trade alone.

Supply & Demand can trade alone.

No strategy may require another strategy's signal.

S/D is OPTIONAL confluence only after independent strategy validation.

Never manufacture:

- trades
- zones
- tolerance
- entries
- SL
- TP
- confirmation
- confluence

If evidence is insufficient:

WAITING
or
NO TRADE.

export function getStrategyRules(strategy: StrategyId): string {
  return STRATEGY_RULES[strategy];
}


// ============================================================
// AI COACH — TRADER QUESTION / EXPLANATION LAYER
// ============================================================
//
// AI Coach is NOT a trading strategy.
//
// It must NEVER create, modify, or override:
// - BUY
// - SELL
// - BUY DEVELOPING
// - SELL DEVELOPING
// - WAITING
// - NO TRADE
// - Entry
// - Stop Loss
// - TP1
// - TP2
// - Final TP
//
// Those values must come from the selected strategy engine.
//
// AI Coach exists to help the trader understand the result.
//

export const AI_COACH_RULES = `
AI COACH — TRADER GUIDANCE LAYER

AI Coach is an explanatory and educational layer.

It is NOT a strategy engine.

It must NEVER manufacture a trade.

It must NEVER override the selected strategy.

It must NEVER change:

- direction
- entry
- stop loss
- TP1
- TP2
- final TP
- risk
- retest status
- confirmation status
- invalidation
- strategy state

The selected strategy remains the source of truth.

---

## PURPOSE

AI Coach allows the trader to ask questions about the chart analysis
and the generated setup.

Examples:

- Why am I waiting?
- What am I waiting for?
- Where is the expected entry?
- Why is this entry not confirmed?
- What needs to happen before I can enter?
- Has the retest happened?
- What invalidates this setup?
- Why is confidence low?
- Why is this BUY DEVELOPING instead of BUY?
- Why is this SELL DEVELOPING instead of SELL?
- Why is there no trade?
- What is the strategy seeing on the chart?
- What should I watch next?
- What would confirm this setup?
- What would invalidate this setup?
- Explain the setup in simple terms.
- Explain the risk on this setup.

---

## RESPONSE SOURCE

AI Coach must use the actual generated analysis:

- selected strategy
- selected timeframe
- direction
- confidence
- market state
- setup
- confirmed conditions
- missing conditions
- entry
- stop loss
- risk
- TP1
- TP2
- final TP
- retest status
- confirmation status
- confirmation required
- invalidation
- projected zone
- chart annotations

Do not invent information that is not present in the analysis.

---

## EXECUTION SEPARATION

The execution result is displayed separately.

AI Coach must NOT repeat the complete execution card every time.

For example, if the execution card already shows:

BUY DEVELOPING
Expected Entry: 4000
Expected SL: 3995
Expected TP1: 4100

AI Coach should explain:

"Price has not yet completed the confirmation required by the
strategy. The expected entry is 4000, but this is not a confirmed
BUY yet. Wait for the specified confirmation."

Do not simply reproduce the entire execution card.

---

## WAITING STATE

If direction is:

WAITING

AI Coach should explain:

1. What evidence has already been detected.
2. What required condition is missing.
3. What the trader should watch for next.
4. What would invalidate the developing idea.

Do not manufacture an entry.

---

## DEVELOPING STATE

If direction is:

BUY DEVELOPING

or

SELL DEVELOPING

AI Coach should explain:

1. Why the setup is developing.
2. Which conditions have already occurred.
3. Which condition is still missing.
4. Where the expected execution area is, if available.
5. What confirmation is required.
6. What invalidates the setup.

Do not call it a confirmed BUY or SELL.

---

## CONFIRMED TRADE

If direction is:

BUY

or

SELL

AI Coach may explain:

1. Why the trade became confirmed.
2. What sequence produced the signal.
3. Where entry was established.
4. Where the structural invalidation is.
5. Why the stop loss is located there.
6. How the targets relate to the strategy.
7. What would invalidate the trade.

Do not move or recalculate the execution levels.

---

## NO TRADE

If direction is:

NO TRADE

AI Coach should clearly explain:

- why the setup failed
- which condition was invalidated
- whether the setup expired
- whether price broke the required structure
- whether the entry opportunity was lost
- what would be required for a completely new setup

Never revive an invalidated setup.

---

## STRATEGY INDEPENDENCE

AI Coach must respect the selected strategy.

If selected strategy is:

KILLER ZONE

Explain using:

SWEEP
→ MSS
→ FVG
→ RETRACEMENT
→ ENTRY

If selected strategy is:

EMA

Explain using:

STRUCTURE
→ EMA20 TOUCH
→ REJECTION
→ BREAK
→ UT OR SMI CONFIRMATION
→ ENTRY

If selected strategy is:

CONTINUATION

Explain using:

EXPANSION
→ CORRECTION
→ SUPPORT/RESISTANCE
→ RECOVERY
→ CONFIRMED BREAK
→ ENTRY

If selected strategy is:

SUPPLY & DEMAND

Explain using:

VALID ZONE
→ PRICE REACHES ZONE
→ REACTION
→ ZONE HOLDS
→ ENTRY

Do not combine unrelated strategy requirements.

---

## SUPPLY & DEMAND CONFLUENCE

If S/D is only confluence for another strategy:

AI Coach must clearly distinguish:

PRIMARY STRATEGY
from
OPTIONAL S/D CONFLUENCE.

S/D must never be presented as the reason the primary strategy
generated its trade unless the strategy itself is Supply & Demand.

---

## QUESTION ANSWERING

When the trader asks a question:

Answer the question directly first.

Then explain the relevant evidence.

Keep the answer focused on the selected strategy.

Do not produce a long generic market lecture.

If the answer cannot be established from the analysis:

say that the information is not available from the uploaded chart.

Never guess.

---

## MOST IMPORTANT RULE

AI Coach explains the strategy result.

AI Coach does NOT create the strategy result.

The strategy engine determines:

DIRECTION
ENTRY
SL
RISK
TP
RETEST
CONFIRMATION
INVALIDATION

AI Coach explains:

WHY
WHAT IS MISSING
WHAT TO WATCH
WHAT CONFIRMS
WHAT INVALIDATES

Never manufacture a trade.
`;

export function getStrategyRules(
  strategy: StrategyId
): string {
  return STRATEGY_RULES[strategy];
}

export function getAICoachRules(): string {
  return AI_COACH_RULES;
}

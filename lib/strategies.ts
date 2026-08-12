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

This strategy operates independently.

Do NOT combine Killer Zone with EMA.
Do NOT combine Killer Zone with Continuation.
Do NOT require Supply & Demand for a Killer Zone trade.

Supply & Demand may be displayed as optional confluence only.
It must NEVER be required for the Killer Zone strategy to produce
its own valid trade.

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
→ 50% FVG / Consequent Encroachment
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
or
NO TRADE.

Only one completed trade per London session.

STOP LOSS

BUY:
Below the bullish setup structural/sweep invalidation area.

SELL:
Above the bearish setup structural/sweep invalidation area.

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

SUPPLY & DEMAND CONFLUENCE

If a valid Supply/Demand zone is present at the Killer Zone entry,
it may increase confidence.

However:

Supply/Demand confirmation is OPTIONAL.

Do not reject a valid Killer Zone trade because no Supply/Demand zone
is present.

Do not manufacture Supply/Demand confluence.
`,

// ============================================================
// EMA
// ============================================================
ema: `
EMA20 PULLBACK MORNING ENGINE — SOURCE OF TRUTH

IMPORTANT:

This EMA strategy must follow the supplied Pine Script logic.

This is an INDEPENDENT EMA strategy.

Do NOT add volume requirements.
Do NOT add a higher-timeframe filter.
Do NOT add Continuation dependency.
Do NOT require Supply/Demand.
Do NOT require both UT Bot and SMI.
Do NOT invent additional entry conditions.

Supply & Demand may be used as OPTIONAL confluence only.

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

EMA20:
20-period exponential moving average.

EMA105:
105-period EMA context only.

Do not invent an EMA105 entry condition.

ATR:
14

EMA tolerance:
ATR × 0.20

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

EMA20 rising:

EMA20 > EMA20[1]

EMA20 falling:

EMA20 < EMA20[1]

Bullish structure:

(higherHigh OR higherLow)
AND
EMA20 rising
AND
close > EMA20

Bearish structure:

(lowerHigh OR lowerLow)
AND
EMA20 falling
AND
close < EMA20

Bullish touch:

low <= EMA20 + EMA tolerance
AND
low >= EMA20 - EMA tolerance

Bearish touch:

high >= EMA20 - EMA tolerance
AND
high <= EMA20 + EMA tolerance

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

Store bullish rejection:

bullRejectHigh = rejection candle high
bullRejectLow = rejection candle low
bullRejectBar = rejection candle bar index

Store bearish rejection:

bearRejectHigh = rejection candle high
bearRejectLow = rejection candle low
bearRejectBar = rejection candle bar index

Rejection remains active only for 3 bars.

Bullish invalidation:

close < bullRejectLow

Bearish invalidation:

close > bearRejectHigh

BULLISH EMA BREAK:

bullActive
AND
close > bullRejectHigh

BEARISH EMA BREAK:

bearActive
AND
close < bearRejectLow

UT Bot and SMI are alternative confirmations.

UT Bot bullish = 1 point.
SMI bullish = 1 point.

UT Bot bearish = 1 point.
SMI bearish = 1 point.

Minimum confirmation score:
1.

Therefore:

UT Bot OR SMI is sufficient.

UT Bot AND SMI is NOT required.

LONG:

bullMABreak
AND
longConfirmationScore >= 1

SHORT:

bearMABreak
AND
shortConfirmationScore >= 1

SEQUENCE:

BULLISH STRUCTURE
→ EMA20 PULLBACK
→ BULLISH REJECTION
→ REJECTION ACTIVE
→ CLOSE ABOVE REJECTION HIGH
→ UT BULL OR SMI BULL
→ LONG

SHORT:

BEARISH STRUCTURE
→ EMA20 PULLBACK
→ BEARISH REJECTION
→ REJECTION ACTIVE
→ CLOSE BELOW REJECTION LOW
→ UT BEAR OR SMI BEAR
→ SHORT

Only create a new trade when:

current signal = TRUE
AND
previous signal = FALSE

LONG ENTRY:

Signal candle close.

SHORT ENTRY:

Signal candle close.

Do not shift entry.

LONG SL:

bullRejectLow - syminfo.mintick

SHORT SL:

bearRejectHigh + syminfo.mintick

Only accept positive risk.

Risk / Reward:
1:2.

LONG TP:

longEntry + (longRisk × 2)

SHORT TP:

shortEntry - (shortRisk × 2)

06:00 SAST BIAS:

Africa/Johannesburg.

Bullish structure:
06:00 BIAS = BULLISH

Bearish structure:
06:00 BIAS = BEARISH

Otherwise:
06:00 BIAS = NEUTRAL

06:00 bias is DISPLAY ONLY.

It is NOT a mandatory entry condition.

STATE OUTPUT:

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

Invalidated or expired:

NO TRADE

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

The actual sequence is mandatory.

SUPPLY & DEMAND CONFLUENCE:

Supply/Demand zones are OPTIONAL.

A valid EMA trade does NOT require a Supply/Demand zone.

If the EMA entry occurs inside or within the configured Supply/Demand
zone tolerance, mark:

S/D CONFLUENCE = TRUE

This may increase confidence.

It must NOT create an EMA trade by itself.

Do not reject a valid EMA setup merely because no Supply/Demand zone exists.

Do not manufacture Supply/Demand confluence.

If chart evidence is insufficient:

WAITING
or
NO TRADE.
`,

// ============================================================
// CONTINUATION
// ============================================================
continuation: `
CONTINUATION — INDEPENDENT STRATEGY

Primary timeframe:
M15.

This strategy is completely independent.

Do NOT combine Continuation with EMA.
Do NOT combine Continuation with Killer Zone.
Do NOT require Supply/Demand for Continuation.

Supply & Demand may be used as OPTIONAL confluence only.

Continuation is an actual market event.

Do not predict continuation before it happens.

DIRECTIVE

M15 structural state:

BULLISH
BEARISH
or
WAITING.

STRUCTURE

Bullish:
Actual M15 structural low acts as support.

Bearish:
Actual M15 structural high acts as resistance.

EXPANSION

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
Decisive close below structural support invalidates bullish continuation.

Bearish:
Decisive close above structural resistance invalidates bearish continuation.

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

CRITICAL:

Do NOT place a bullish entry directly at resistance/expansion high.

Do NOT place a bearish entry directly at support/expansion low.

The entry must be inside the structural continuation area.

If continuation has not confirmed:

BUY DEVELOPING
SELL DEVELOPING
WAITING
or
NO TRADE.

INVALIDATION

If bullish price reaches/exceeds the expansion extreme before a valid
fresh entry, invalidate the fresh bullish entry.

If bearish price reaches/falls below the expansion extreme before a valid
fresh entry, invalidate the fresh bearish entry.

STOP LOSS

For BUY:
SL must be below the confirmed continuation support / structural
invalidation level.

For SELL:
SL must be above the confirmed continuation resistance / structural
invalidation level.

Do not manufacture an SL when the structural invalidation level
cannot be established.

TAKE PROFIT

The Continuation model does not use a fixed RR formula.

BUY:

Final TP should target a valid previous meaningful high / PDH liquidity
objective ahead of price.

SELL:

Final TP should target a valid previous meaningful low / PDL liquidity
objective below price.

If that objective has already been taken, use the next valid
structural/liquidity objective.

Never place TP behind entry.

Never force a target.

SUPPLY & DEMAND CONFLUENCE:

Supply/Demand is OPTIONAL confluence.

If confirmed continuation entry occurs within a valid Demand zone or
within the configured zone tolerance:

S/D CONFLUENCE = BULLISH.

If confirmed continuation entry occurs within a valid Supply zone or
within the configured zone tolerance:

S/D CONFLUENCE = BEARISH.

This can increase confidence.

It does NOT become a mandatory Continuation condition.

A valid Continuation trade remains valid without S/D confluence.
`,

// ============================================================
// SUPPLY & DEMAND
// ============================================================
supplyDemand: `
SUPPLY & DEMAND ZONES — INDEPENDENT STRATEGY

This is a completely independent trading strategy.

It can be traded alone.

It does NOT depend on:

EMA
Killer Zone
Continuation

EMA, Killer Zone and Continuation may use Supply/Demand as optional
confluence, but Supply/Demand itself must never require any of those
strategies to produce a trade.

The strategy is based on the supplied Supply and Demand zone engine.

Do NOT retain or display the original indicator publisher/name.

PRIMARY CONCEPT:

Swing High
→ Supply Zone

Swing Low
→ Demand Zone

ZONE CREATION

Swing period:
30.

Pivot high:

ta.pivothigh(high, 30, 30)

Pivot low:

ta.pivotlow(low, 30, 30)

Lookback:
2000 bars.

WICK-BASED ZONE CONSTRUCTION

Average wick:
5 bars.

SUPPLY:

pivot high = zone reference.

Supply top:
pivot high.

Supply bottom:
pivot high - average upper wick.

DEMAND:

pivot low = zone reference.

Demand bottom:
pivot low.

Demand top:
pivot low + average lower wick.

Do not treat the pivot price alone as the entire zone.

The complete calculated zone is the trading area.

ZONE VALIDITY

A zone is valid while:

- active
- inside lookback
- not invalidated by a confirmed breakout
- price remains on the appropriate side of the zone unless a flip
  event is being processed.

SUPPLY:

Supply is above current price.

DEMAND:

Demand is below current price.

RETEST

SUPPLY RETEST:

Price trades into/through the supply zone and closes back below
the zone.

This is bearish rejection.

DEMAND RETEST:

Price trades into/through the demand zone and closes back above
the zone.

This is bullish rejection.

Retest cooldown:
3 bars.

Do not count repeated candles lingering around the same zone as
multiple independent retests inside the cooldown period.

BREAKOUT

SUPPLY BREAKOUT:

Price closes above supply zone top.

DEMAND BREAKOUT:

Price closes below demand zone bottom.

A clean breakout invalidates the original zone direction.

ZONE FLIP

After a confirmed breakout:

Supply can flip to Demand.

Demand can flip to Supply.

The flipped zone must be treated according to its new direction.

Do not continue treating a broken supply zone as valid supply.

Do not continue treating a broken demand zone as valid demand.

ZONE TOLERANCE

The zone itself is the primary tolerance area because the source
indicator constructs the zone using the pivot plus the average wick.

For trade execution, price must reach the calculated zone.

A configurable execution tolerance may be applied around the zone:

ZONE TOLERANCE = configured tolerance value.

The AI must NOT invent a tolerance value if the application provides
one.

If an explicit tolerance input is available, use that value.

A trade is considered to have reached the zone when price enters the
zone or reaches it within the configured tolerance.

Do NOT treat a zone that is materially distant from price as an
active entry location.

DEMAND TRADE

A BUY can be generated when:

1. Valid Demand zone exists.
2. Price reaches the Demand zone or configured tolerance.
3. Zone has not been broken.
4. Price demonstrates bullish reaction/rejection from the zone.
5. Demand remains valid at confirmation.
6. Entry is taken at the confirmed setup candle close or the
   application's configured zone-entry method.

Preferred sequence:

VALID DEMAND ZONE
→ PRICE REACHES ZONE / TOLERANCE
→ BULLISH REACTION
→ ZONE HOLDS
→ BUY

SUPPLY TRADE

A SELL can be generated when:

1. Valid Supply zone exists.
2. Price reaches the Supply zone or configured tolerance.
3. Zone has not been broken.
4. Price demonstrates bearish reaction/rejection from the zone.
5. Supply remains valid at confirmation.
6. Entry is taken at the confirmed setup candle close or the
   application's configured zone-entry method.

Preferred sequence:

VALID SUPPLY ZONE
→ PRICE REACHES ZONE / TOLERANCE
→ BEARISH REACTION
→ ZONE HOLDS
→ SELL

IMPORTANT:

Do NOT BUY merely because price is near Demand.

Do NOT SELL merely because price is near Supply.

The zone must actually be reached within the configured tolerance and
must produce a valid reaction.

STATE OUTPUT

Valid Demand zone exists but price has not reached it:

BUY DEVELOPING

Valid Supply zone exists but price has not reached it:

SELL DEVELOPING

Price reaches Demand tolerance and bullish reaction is developing:

BUY DEVELOPING

Price reaches Supply tolerance and bearish reaction is developing:

SELL DEVELOPING

Demand reaction confirmed:

BUY

Supply reaction confirmed:

SELL

Zone broken before entry:

NO TRADE

No valid zone:

WAITING

MTF OPERATION

Supply & Demand is allowed to operate independently on any selected
timeframe.

The engine must identify zones from the requested timeframe.

Examples:

M1
M5
M10
M15
M30
H1
H4
Daily

The selected timeframe is the source of truth for the zone structure.

Do NOT require M15.

Do NOT require H1.

Do NOT require another timeframe to agree.

MTF CONFLUENCE

Higher-timeframe Supply/Demand zones may be displayed as additional
context.

However:

A lower-timeframe Supply/Demand trade does not require higher-timeframe
confirmation.

A higher-timeframe zone does not automatically invalidate a valid
lower-timeframe zone trade.

If multiple timeframes contain zones:

- identify the active zone
- identify its direction
- measure distance from current price
- determine whether price is inside the configured tolerance
- prioritize the strongest/nearest valid zone according to the
  configured ranking logic.

ZONE RANKING

The source model supports:

Strongest
Nearest

Strongest ranking considers:

- successful holds
- retest evidence
- proximity to price
- incumbent visibility stability.

Nearest ranking considers:

- distance from current price.

Do not arbitrarily select a zone when the ranking mode is available.

ZONE SPACING

Default minimum zone spacing:

0.1%.

Zones closer than the configured minimum spacing can be filtered to
avoid overlapping/redundant trade locations.

RETEST STATISTICS

Track:

Retests
Breakouts
Held

Hold window:

10 bars.

A retest is considered successfully held when no breakout occurs
during the configured hold window.

These statistics are useful for zone quality/ranking.

They do NOT independently create a trade.

STOP LOSS

BUY:

SL must be below the Demand zone's structural invalidation boundary.

Preferred:

Demand zone bottom minus a minimal instrument tick/buffer.

SELL:

SL must be above the Supply zone's structural invalidation boundary.

Preferred:

Supply zone top plus a minimal instrument tick/buffer.

The SL must be based on the actual zone.

Do not manufacture an arbitrary SL distance.

RISK VALIDATION

BUY:

risk = entry - stopLoss

Only accept if:

risk > 0

SELL:

risk = stopLoss - entry

Only accept if:

risk > 0

If valid risk cannot be calculated:

ENTRY = WAIT
STOP LOSS = WAIT
RISK = WAIT

TAKE PROFIT

Supply & Demand does NOT use arbitrary TP values.

BUY:

TP1 should target the nearest valid opposing Supply / structural
liquidity objective above entry.

TP2 should target the next valid opposing Supply / structural
liquidity objective above TP1 when available.

FINAL TP should target the next meaningful opposing Supply / liquidity
objective ahead of price.

SELL:

TP1 should target the nearest valid opposing Demand / structural
liquidity objective below entry.

TP2 should target the next valid opposing Demand / structural
liquidity objective below TP1 when available.

FINAL TP should target the next meaningful opposing Demand / liquidity
objective below price.

Never place a TP behind entry.

Never use a target that has already been consumed unless it remains
a valid fresh objective.

If there is no valid opposing zone/liquidity objective:

Do not manufacture a target.

Return WAIT for the unavailable TP level.

CONFLUENCE WITH OTHER STRATEGIES

Supply & Demand is the ONLY strategy allowed to provide optional
zone confluence to the other three strategies.

This does NOT create dependency.

KILLER ZONE:

Killer Zone remains valid without Supply/Demand.

EMA:

EMA remains valid without Supply/Demand.

CONTINUATION:

Continuation remains valid without Supply/Demand.

When another strategy independently generates a valid trade and the
entry is inside a valid Supply/Demand zone or within configured zone
tolerance:

Mark:

S/D CONFLUENCE = TRUE

and increase contextual confidence only if the zone direction agrees.

If the zone direction conflicts:

Mark:

S/D CONFLUENCE = CONFLICT

Do NOT automatically cancel the independent strategy unless that
strategy's own rules invalidate the trade.

SUPPLY/DEMAND DIRECTIONAL CONFLUENCE

Demand supports BUY confluence.

Supply supports SELL confluence.

Demand does NOT confirm SELL.

Supply does NOT confirm BUY.

A broken or invalid zone provides NO confluence.

A zone merely visible on the chart but outside the configured
tolerance provides NO entry confluence.

MOST IMPORTANT RULE

The four strategies are independent engines.

Killer Zone can trade alone.

EMA can trade alone.

Continuation can trade alone.

Supply & Demand can trade alone.

No strategy may require another strategy's signal to become valid.

Supply & Demand is an OPTIONAL confluence layer only when another
strategy independently reaches its own valid entry.

Do not manufacture trades.

Do not manufacture zones.

Do not manufacture tolerance.

Do not manufacture SL.

Do not manufacture TP.

If the chart does not provide enough evidence:

WAITING
or
NO TRADE.
`,
};

export function getStrategyRules(strategy: StrategyId): string {
  return STRATEGY_RULES[strategy];
}

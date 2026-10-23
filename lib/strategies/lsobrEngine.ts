type Candle = { datetime: string; open: number; high: number; low: number; close: number; volume: number | null };
type Side = "BUY" | "SELL";
export type LSOBRResult = {
  source: "LSOBR_DETERMINISTIC";
  state: "WAITING" | "SETUP" | "ENTRY READY" | "TRADE OPEN" | "NO TRADE";
  direction: Side | "NO TRADE";
  entry: number | null;
  stopLoss: number | null;
  finalTp: number | null;
  sweptLiquidity: number | null;
  liquidityTarget: number | null;
  orderBlock: { direction: "BULLISH" | "BEARISH"; top: number; bottom: number; createdAt: string } | null;
  rejectionExtreme: number | null;
  sweepTime: string | null;
  mssTime: string | null;
  confirmationTime: string | null;
  evidence: string[];
  missingConditions: string[];
  invalidation: string;
  riskReward: number | null;
  trend: string;
};
const pivot = (c: Candle[], i: number, side: "HIGH" | "LOW", n = 3) => {
  if (i < n || i + n >= c.length) return false;
  for (let k = 1; k <= n; k++) {
    if (side === "HIGH" && (c[i].high <= c[i-k].high || c[i].high <= c[i+k].high)) return false;
    if (side === "LOW" && (c[i].low >= c[i-k].low || c[i].low >= c[i+k].low)) return false;
  }
  return true;
};
function structure(c: Candle[], side: "HIGH" | "LOW", end: number, lookback = 100) {
  const found: Array<{ price: number; index: number }> = [];
  for (let i = Math.max(3, end - lookback); i < end - 3; i++) if (pivot(c, i, side, 3)) found.push({ price: side === "HIGH" ? c[i].high : c[i].low, index: i });
  return found;
}
function findPriorOb(c: Candle[], side: Side, sweepIndex: number, liquidity: number) {
  // Only consider completed candles before the sweep. OB coordinates are immutable.
  for (let i = sweepIndex - 2; i >= Math.max(1, sweepIndex - 100); i--) {
    const base = c[i], impulse = c[i + 1];
    if (side === "SELL") {
      const bearishDisplacement = base.close > base.open && impulse.close < impulse.open && impulse.close < base.low;
      if (bearishDisplacement && base.low > liquidity) return { direction: "BEARISH" as const, top: base.high, bottom: base.low, createdAt: base.datetime, index: i };
    } else {
      const bullishDisplacement = base.close < base.open && impulse.close > impulse.open && impulse.close > base.high;
      if (bullishDisplacement && base.high < liquidity) return { direction: "BULLISH" as const, top: base.high, bottom: base.low, createdAt: base.datetime, index: i };
    }
  }
  return null;
}
export function evaluateLsObr(candles: Candle[]): LSOBRResult {
  const last = candles.at(-1);
  const noSetup = (state: LSOBRResult["state"], missing: string[], evidence: string[] = [], extras: Partial<LSOBRResult> = {}): LSOBRResult => ({
    source: "LSOBR_DETERMINISTIC", state, direction: "NO TRADE", entry: null, stopLoss: null, finalTp: null,
    sweptLiquidity: null, liquidityTarget: null, orderBlock: null, rejectionExtreme: null, sweepTime: null, mssTime: null, confirmationTime: null,
    evidence, missingConditions: missing, invalidation: "A setup is invalid if price closes through the fixed order-block rejection extreme before the required MSS and confirmed OB exit.", riskReward: null,
    trend: candles.length < 20 ? "Insufficient structure history" : (() => {
      const highs = structure(candles, "HIGH", candles.length - 1, 80).slice(-2);
      const lows = structure(candles, "LOW", candles.length - 1, 80).slice(-2);
      return highs.length === 2 && lows.length === 2 && highs[1].price < highs[0].price && lows[1].price < lows[0].price ? "Downtrend with confirmed lower highs and lower lows" :
        highs.length === 2 && lows.length === 2 && highs[1].price > highs[0].price && lows[1].price > lows[0].price ? "Uptrend with confirmed higher highs and higher lows" : "Mixed or unconfirmed swing structure";
    })(), ...extras
  });
  if (candles.length < 30) return noSetup("WAITING", ["Need at least 30 candles to confirm swing liquidity, a pre-existing order block and subsequent structure." ]);
  // Evaluate the most recent complete sequence only; no current candle is allowed to invent an OB.
  const highs = structure(candles, "HIGH", candles.length - 1, 100);
  const lows = structure(candles, "LOW", candles.length - 1, 100);
  const candidates: Array<{ side: Side; sweepIndex: number; swept: number }> = [];
  for (let i = Math.max(10, candles.length - 35); i < candles.length; i++) {
    const priorHigh = highs.filter(x => x.index < i).at(-1);
    const priorLow = lows.filter(x => x.index < i).at(-1);
    if (priorHigh && candles[i].high > priorHigh.price && candles[i].close < priorHigh.price) candidates.push({ side: "SELL", sweepIndex: i, swept: priorHigh.price });
    if (priorLow && candles[i].low < priorLow.price && candles[i].close > priorLow.price) candidates.push({ side: "BUY", sweepIndex: i, swept: priorLow.price });
  }
  for (const setup of candidates.reverse()) {
    const { side, sweepIndex, swept } = setup;
    const ob = findPriorOb(candles, side, sweepIndex, swept);
    if (!ob) return noSetup("SETUP", ["Liquidity sweep confirmed at " + swept + "; no valid pre-existing " + (side === "SELL" ? "bearish" : "bullish") + " order block was found on the correct side of swept liquidity. Do not substitute a newly forming or repositioned OB."], ["Liquidity sweep: " + side + " at " + candles[sweepIndex].datetime, "Waiting for a valid historical order block formed before the sweep."], { sweptLiquidity: swept, sweepTime: candles[sweepIndex].datetime });
    const postSweep = candles.slice(sweepIndex + 1);
    if (!postSweep.length) return noSetup("SETUP", ["Liquidity sweep detected; waiting for price to revisit a valid pre-existing order block."], ["Liquidity sweep: " + side + " setup", "Swept liquidity: " + swept], { sweptLiquidity: swept, sweepTime: candles[sweepIndex].datetime, orderBlock: { direction: ob.direction, top: ob.top, bottom: ob.bottom, createdAt: ob.createdAt } });
    let rejectionIndex = -1, rejectionExtreme = side === "SELL" ? -Infinity : Infinity;
    for (let j = sweepIndex + 1; j < candles.length; j++) {
      const bar = candles[j], touched = bar.low <= ob.top && bar.high >= ob.bottom;
      if (!touched) continue;
      if (side === "SELL" && bar.close <= ob.top && bar.close >= ob.bottom) { rejectionIndex = j; rejectionExtreme = Math.max(rejectionExtreme, bar.high); }
      if (side === "BUY" && bar.close >= ob.bottom && bar.close <= ob.top) { rejectionIndex = j; rejectionExtreme = Math.min(rejectionExtreme, bar.low); }
      if (rejectionIndex >= 0) break;
    }
    if (rejectionIndex < 0) return noSetup("SETUP", ["Price has not yet revisited and rejected the fixed pre-existing " + ob.direction.toLowerCase() + " order block."], ["Liquidity sweep confirmed at " + candles[sweepIndex].datetime, "Fixed order block: " + ob.bottom + "–" + ob.top], { sweptLiquidity: swept, sweepTime: candles[sweepIndex].datetime, orderBlock: { direction: ob.direction, top: ob.top, bottom: ob.bottom, createdAt: ob.createdAt } });
    const invalid = candles.slice(rejectionIndex + 1).some(b => side === "SELL" ? b.close > rejectionExtreme : b.close < rejectionExtreme);
    if (invalid) continue;
    const mssCandidates = side === "SELL" ? lows.filter(x => x.index < rejectionIndex) : highs.filter(x => x.index < rejectionIndex);
    const mssLevel = side === "SELL" ? mssCandidates.at(-1)?.price : mssCandidates.at(-1)?.price;
    let mssIndex = -1, exitIndex = -1;
    if (mssLevel != null) {
      for (let j = rejectionIndex + 1; j < candles.length; j++) {
        if (mssIndex < 0 && (side === "SELL" ? candles[j].close < mssLevel : candles[j].close > mssLevel)) mssIndex = j;
        if (mssIndex >= 0 && (side === "SELL" ? candles[j].close < ob.bottom : candles[j].close > ob.top)) { exitIndex = j; break; }
      }
    }
    if (mssIndex < 0) return noSetup("SETUP", ["Order-block rejection is present; waiting for a confirmed " + (side === "SELL" ? "bearish" : "bullish") + " market structure shift (MSS) close."], ["Liquidity sweep confirmed", "Price revisited the fixed " + ob.direction.toLowerCase() + " order block", "Rejection held without a close through its extreme"], { sweptLiquidity: swept, sweepTime: candles[sweepIndex].datetime, orderBlock: { direction: ob.direction, top: ob.top, bottom: ob.bottom, createdAt: ob.createdAt }, rejectionExtreme });
    if (exitIndex < 0) return noSetup("SETUP", ["MSS confirmed; waiting for a completed candle close " + (side === "SELL" ? "below the bearish order block" : "above the bullish order block") + ". The sweep or MSS alone is not an entry."], ["Liquidity sweep confirmed", "Fixed order-block rejection confirmed", "MSS close confirmed at " + candles[mssIndex].datetime], { sweptLiquidity: swept, sweepTime: candles[sweepIndex].datetime, mssTime: candles[mssIndex].datetime, orderBlock: { direction: ob.direction, top: ob.top, bottom: ob.bottom, createdAt: ob.createdAt }, rejectionExtreme });
    const signal = candles[exitIndex];
    const entry = signal.close;
    const validZone = side === "SELL" ? entry < ob.bottom && entry > swept : entry > ob.top && entry < swept;
    if (!validZone) return noSetup("NO TRADE", ["Confirmed OB exit occurred, but its close is not inside the valid zone between the fixed OB and swept liquidity; do not chase price. Wait for a new valid sweep sequence."], ["Liquidity sweep confirmed", "Order-block rejection confirmed", "MSS confirmed", "OB exit close confirmed but entry location failed"], { sweptLiquidity: swept, sweepTime: candles[sweepIndex].datetime, mssTime: candles[mssIndex].datetime, confirmationTime: signal.datetime, orderBlock: { direction: ob.direction, top: ob.top, bottom: ob.bottom, createdAt: ob.createdAt }, rejectionExtreme });
    const targetCandidates = side === "SELL" ? lows.filter(x => x.price < entry && x.index < exitIndex).map(x => x.price).sort((a,b)=>b-a) : highs.filter(x => x.price > entry && x.index < exitIndex).map(x => x.price).sort((a,b)=>a-b);
    const blockedByOpposingOb = (targetPrice: number) => {
      for (let k = Math.max(1, exitIndex - 100); k < exitIndex - 1; k++) {
        const base = candles[k], impulse = candles[k + 1];
        const opposingOb = side === "SELL"
          ? base.close < base.open && impulse.close > impulse.open && impulse.close > base.high
          : base.close > base.open && impulse.close < impulse.open && impulse.close < base.low;
        if (!opposingOb) continue;
        const zoneTop = base.high, zoneBottom = base.low;
        const pathTop = Math.max(entry, targetPrice), pathBottom = Math.min(entry, targetPrice);
        if (zoneTop >= pathBottom && zoneBottom <= pathTop) return true;
      }
      return false;
    };
    const target = targetCandidates.find(v => (side === "SELL" ? v < entry : v > entry) && !blockedByOpposingOb(v)) ?? null;
    if (target == null) return noSetup("NO TRADE", ["Entry sequence confirmed, but no valid opposing liquidity pool is identifiable from completed swings; target must not be invented."], ["Sweep, fixed OB rejection, MSS and confirmed OB exit are present"], { sweptLiquidity: swept, sweepTime: candles[sweepIndex].datetime, mssTime: candles[mssIndex].datetime, confirmationTime: signal.datetime, orderBlock: { direction: ob.direction, top: ob.top, bottom: ob.bottom, createdAt: ob.createdAt }, rejectionExtreme });
    const stop = side === "SELL" ? Math.max(ob.top, rejectionExtreme) : Math.min(ob.bottom, rejectionExtreme);
    const risk = side === "SELL" ? stop - entry : entry - stop;
    const reward = side === "SELL" ? entry - target : target - entry;
    const rr = risk > 0 ? reward / risk : null;
    if (risk <= 0 || reward <= 0) continue;
    return {
      source: "LSOBR_DETERMINISTIC", state: "ENTRY READY", direction: side, entry, stopLoss: stop, finalTp: target, sweptLiquidity: swept, liquidityTarget: target,
      orderBlock: { direction: ob.direction, top: ob.top, bottom: ob.bottom, createdAt: ob.createdAt }, rejectionExtreme, sweepTime: candles[sweepIndex].datetime, mssTime: candles[mssIndex].datetime, confirmationTime: signal.datetime,
      evidence: ["Liquidity sweep confirmed at " + swept, "Pre-existing " + ob.direction.toLowerCase() + " order block held at fixed boundaries " + ob.bottom + "–" + ob.top, "Rejection held without a close through " + rejectionExtreme, "MSS confirmed by close through " + mssLevel, "Confirmed close out of the order block at " + entry, "Entry is between the fixed order block and swept liquidity", "Next opposing liquidity target: " + target],
      missingConditions: [], invalidation: "Setup invalidates on a close through the fixed rejection extreme; trade risk is defined by the stop beyond the order block.", riskReward: rr, trend: side === "SELL" ? "Bearish LSOBR sequence confirmed" : "Bullish LSOBR sequence confirmed"
    };
  }
  return noSetup("WAITING", ["No complete LSOBR liquidity-sweep sequence is confirmed in the available candles. Need a sweep, revisit of a pre-existing fixed OB, rejection, MSS and confirmed close out of the OB before entry."], ["The selected engine is LSOBR; SRB opening-window rules are not used."]);
}

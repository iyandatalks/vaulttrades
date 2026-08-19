/**
 * VAULTTRADES
 * Swing Developing Strategy
 *
 * SOURCE OF TRUTH:
 *   "Swing Developing Strategy" - Pine Script v6
 *
 * Pine progression:
 *
 *   H1 DIRECTION
 *        ↓
 *   M15 ALIGNMENT
 *        ↓
 *   EMA 9/15 PULLBACK
 *        ↓
 *   PULLBACK WATCH
 *        ↓
 *   RECOVERY THROUGH EMA 9
 *        ↓
 *   M15 SMI CONFIRMATION
 *        ↓
 *   NEW BUY / SELL SIGNAL
 *
 * IMPORTANT:
 * The original Pine strategy does NOT define SL, TP or RR.
 * This module therefore does not invent them.
 */

export const SWING_DEVELOPING_ID = "swingDeveloping";
export const SWING_DEVELOPING_NAME = "Swing Developing Strategy";

export type SwingDirection = "LONG" | "SHORT" | "NEUTRAL";

export type SwingStage =
  | "WAIT"
  | "DIRECTION"
  | "PULLBACK"
  | "ENTRY_READY"
  | "ENTER_LONG"
  | "ENTER_SHORT";

export interface SwingCandle {
  time?: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface SwingDevelopingInput {
  /**
   * H1 candles in chronological order.
   * Oldest candle first, newest candle last.
   */
  h1: SwingCandle[];

  /**
   * M15 candles in chronological order.
   * Oldest candle first, newest candle last.
   */
  m15: SwingCandle[];

  /**
   * Optional current execution/chart candle.
   *
   * When supplied, its close is used as the current
   * market reference for the analyzer.
   */
  current?: SwingCandle;

  /**
   * Strategy inputs copied from the Pine source.
   */
  settings?: Partial<SwingDevelopingSettings>;
}

export interface SwingDevelopingSettings {
  emaFastLen: number;
  emaSlowLen: number;
  emaTrendLen: number;

  smiLength: number;
  smiSmooth1: number;
  smiSmooth2: number;

  smiOB: number;
  smiOS: number;

  requireEMA100: boolean;
  requirePullback: boolean;
}

export interface SwingTimeframeState {
  close: number;

  ema9: number;
  ema15: number;
  ema100: number;

  smi: number;

  bullish: boolean;
  bearish: boolean;

  above100: boolean;
  below100: boolean;

  longDirection: boolean;
  shortDirection: boolean;
}

export interface SwingDevelopingResult {
  strategyId: typeof SWING_DEVELOPING_ID;
  strategyName: typeof SWING_DEVELOPING_NAME;

  direction: SwingDirection;
  stage: SwingStage;

  signal: "BUY" | "SELL" | "NONE";

  /**
   * True only on the new signal transition,
   * matching Pine:
   *
   * longEntry and not longEntry[1]
   * shortEntry and not shortEntry[1]
   */
  isNewSignal: boolean;

  entryPrice: number | null;

  /**
   * The source strategy does not define SL/TP/RR.
   */
  stopLoss: number | null;
  takeProfit: number | null;
  riskReward: number | null;

  confidence: number;

  h1: SwingTimeframeState;
  m15: SwingTimeframeState;

  pullback: {
    long: boolean;
    short: boolean;
    active: boolean;
  };

  recovery: {
    long: boolean;
    short: boolean;
    longTrigger: boolean;
    shortTrigger: boolean;
  };

  momentum: {
    long: boolean;
    short: boolean;
    h1SMI: number;
    m15SMI: number;
  };

  states: {
    longSetupDeveloping: boolean;
    shortSetupDeveloping: boolean;

    longWatch: boolean;
    shortWatch: boolean;

    longEntryReady: boolean;
    shortEntryReady: boolean;

    longEntry: boolean;
    shortEntry: boolean;

    longSignal: boolean;
    shortSignal: boolean;
  };

  evidence: string[];

  invalidation: string[];

  message: string;
}

const DEFAULT_SETTINGS: SwingDevelopingSettings = {
  emaFastLen: 9,
  emaSlowLen: 15,
  emaTrendLen: 100,

  smiLength: 7,
  smiSmooth1: 2,
  smiSmooth2: 2,

  smiOB: 40,
  smiOS: -40,

  requireEMA100: true,
  requirePullback: true,
};

/**
 * Pine-compatible EMA.
 *
 * Pine's ta.ema uses:
 *
 * alpha = 2 / (length + 1)
 *
 * and recursively smooths the series.
 */
function ema(values: number[], length: number): number[] {
  if (length <= 0 || values.length === 0) {
    return [];
  }

  const output = new Array<number>(values.length);
  const alpha = 2 / (length + 1);

  output[0] = values[0];

  for (let i = 1; i < values.length; i += 1) {
    output[i] =
      alpha * values[i] +
      (1 - alpha) * output[i - 1];
  }

  return output;
}

function highest(values: number[], length: number): number[] {
  const result = new Array<number>(values.length);

  for (let i = 0; i < values.length; i += 1) {
    const start = Math.max(0, i - length + 1);

    let highestValue = -Infinity;

    for (let j = start; j <= i; j += 1) {
      highestValue = Math.max(highestValue, values[j]);
    }

    result[i] = highestValue;
  }

  return result;
}

function lowest(values: number[], length: number): number[] {
  const result = new Array<number>(values.length);

  for (let i = 0; i < values.length; i += 1) {
    const start = Math.max(0, i - length + 1);

    let lowestValue = Infinity;

    for (let j = start; j <= i; j += 1) {
      lowestValue = Math.min(lowestValue, values[j]);
    }

    result[i] = lowestValue;
  }

  return result;
}

/**
 * Exact conceptual conversion of the Pine f_smi() function:
 *
 * hh = ta.highest(high, length)
 * ll = ta.lowest(low, length)
 * midpoint = (hh + ll) / 2
 * distance = (hh - ll) / 2
 * relative = close - midpoint
 * relativeSmoothed = ema(ema(relative, smooth1), smooth2)
 * distanceSmoothed = ema(ema(distance, smooth1), smooth2)
 * SMI = 100 * relativeSmoothed / distanceSmoothed
 */
function calculateSMI(
  candles: SwingCandle[],
  length: number,
  smooth1: number,
  smooth2: number,
): number[] {
  if (candles.length === 0) {
    return [];
  }

  const highs = candles.map((candle) => candle.high);
  const lows = candles.map((candle) => candle.low);
  const closes = candles.map((candle) => candle.close);

  const hh = highest(highs, length);
  const ll = lowest(lows, length);

  const relative: number[] = [];
  const distance: number[] = [];

  for (let i = 0; i < candles.length; i += 1) {
    const midpoint = (hh[i] + ll[i]) / 2;
    const currentDistance = (hh[i] - ll[i]) / 2;

    relative.push(closes[i] - midpoint);
    distance.push(currentDistance);
  }

  const relativeSmoothed = ema(
    ema(relative, smooth1),
    smooth2,
  );

  const distanceSmoothed = ema(
    ema(distance, smooth1),
    smooth2,
  );

  return relativeSmoothed.map((value, index) => {
    const denominator = distanceSmoothed[index];

    if (denominator === 0 || !Number.isFinite(denominator)) {
      return 0;
    }

    return (100 * value) / denominator;
  });
}

function calculateTimeframeStates(
  candles: SwingCandle[],
  settings: SwingDevelopingSettings,
): SwingTimeframeState[] {
  if (candles.length === 0) {
    return [];
  }

  const closes = candles.map((candle) => candle.close);

  const ema9 = ema(closes, settings.emaFastLen);
  const ema15 = ema(closes, settings.emaSlowLen);
  const ema100 = ema(closes, settings.emaTrendLen);

  const smi = calculateSMI(
    candles,
    settings.smiLength,
    settings.smiSmooth1,
    settings.smiSmooth2,
  );

  return candles.map((candle, index) => {
    const currentEMA9 = ema9[index];
    const currentEMA15 = ema15[index];
    const currentEMA100 = ema100[index];
    const currentSMI = smi[index];

    const bullish = currentEMA9 > currentEMA15;
    const bearish = currentEMA9 < currentEMA15;

    const above100 = candle.close > currentEMA100;
    const below100 = candle.close < currentEMA100;

    const longDirection =
      bullish &&
      (!settings.requireEMA100 || above100);

    const shortDirection =
      bearish &&
      (!settings.requireEMA100 || below100);

    return {
      close: candle.close,

      ema9: currentEMA9,
      ema15: currentEMA15,
      ema100: currentEMA100,

      smi: currentSMI,

      bullish,
      bearish,

      above100,
      below100,

      longDirection,
      shortDirection,
    };
  });
}

function getLast<T>(values: T[]): T | undefined {
  return values.length > 0
    ? values[values.length - 1]
    : undefined;
}

function getPrevious<T>(values: T[]): T | undefined {
  return values.length > 1
    ? values[values.length - 2]
    : undefined;
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Main Swing Developing strategy evaluator.
 *
 * This mirrors the Pine state machine:
 *
 * 1. H1 primary swing direction
 * 2. M15 direction
 * 3. Full directional alignment
 * 4. M15 SMI momentum
 * 5. EMA 9/15 zone
 * 6. Pullback
 * 7. Pullback watch
 * 8. Recovery
 * 9. Final entry
 * 10. New-entry-only transition
 * 11. Entry Ready
 * 12. Setup Developing
 */
export function analyzeSwingDeveloping(
  input: SwingDevelopingInput,
): SwingDevelopingResult {
  const settings: SwingDevelopingSettings = {
    ...DEFAULT_SETTINGS,
    ...(input.settings ?? {}),
  };

  const h1States = calculateTimeframeStates(
    input.h1,
    settings,
  );

  const m15States = calculateTimeframeStates(
    input.m15,
    settings,
  );

  const h1 = getLast(h1States);
  const m15 = getLast(m15States);
  const previousM15 = getPrevious(m15States);

  if (!h1 || !m15) {
    return createInsufficientDataResult();
  }

  /*
   * ============================================================
   * 1. H1 PRIMARY SWING DIRECTION
   * ============================================================
   *
   * Pine:
   *
   * h1Bull = h1EMA9 > h1EMA15
   * h1Bear = h1EMA9 < h1EMA15
   *
   * h1LongDirection =
   *     h1Bull and
   *     (not requireEMA100 or h1Above100)
   *
   * h1ShortDirection =
   *     h1Bear and
   *     (not requireEMA100 or h1Below100)
   */
  const h1LongDirection = h1.longDirection;
  const h1ShortDirection = h1.shortDirection;

  /*
   * ============================================================
   * 2. M15 DIRECTION
   * ============================================================
   */
  const m15LongDirection = m15.longDirection;
  const m15ShortDirection = m15.shortDirection;

  /*
   * ============================================================
   * 3. FULL DIRECTIONAL ALIGNMENT
   * ============================================================
   */
  const longDirection =
    h1LongDirection &&
    m15LongDirection;

  const shortDirection =
    h1ShortDirection &&
    m15ShortDirection;

  /*
   * ============================================================
   * 4. SMI MOMENTUM
   * ============================================================
   *
   * Pine:
   *
   * m15LongMomentum = m15SMI >= 40
   * m15ShortMomentum = m15SMI <= -40
   */
  const m15LongMomentum =
    m15.smi >= settings.smiOB;

  const m15ShortMomentum =
    m15.smi <= settings.smiOS;

  /*
   * ============================================================
   * 5. EMA 9/15 PULLBACK ZONE
   * ============================================================
   */
  const emaZoneHigh = Math.max(
    m15.ema9,
    m15.ema15,
  );

  const emaZoneLow = Math.min(
    m15.ema9,
    m15.ema15,
  );

  /*
   * ============================================================
   * 6. PULLBACK DETECTION
   * ============================================================
   *
   * Pine:
   *
   * m15PullbackLong =
   *     m15Close <= m15EMA9 or
   *     m15Close <= m15EMA15
   *
   * m15PullbackShort =
   *     m15Close >= m15EMA9 or
   *     m15Close >= m15EMA15
   */
  const m15PullbackLong =
    m15.close <= m15.ema9 ||
    m15.close <= m15.ema15;

  const m15PullbackShort =
    m15.close >= m15.ema9 ||
    m15.close >= m15.ema15;

  /*
   * Respect the Pine input.
   *
   * If requirePullback is false, direction can progress
   * without requiring the pullback stage.
   */
  const longWatch =
    longDirection &&
    (
      settings.requirePullback
        ? m15PullbackLong
        : false
    );

  const shortWatch =
    shortDirection &&
    (
      settings.requirePullback
        ? m15PullbackShort
        : false
    );

  /*
   * ============================================================
   * 8. RECOVERY
   * ============================================================
   */
  const longRecovery =
    m15.close > m15.ema9;

  const shortRecovery =
    m15.close < m15.ema9;

  /*
   * Pine:
   *
   * longRecoveryTrigger =
   *     longWatch[1] and
   *     longRecovery
   *
   * shortRecoveryTrigger =
   *     shortWatch[1] and
   *     shortRecovery
   */
  const previousLongWatch =
    previousM15
      ? (
          previousM15.longDirection &&
          (
            previousM15.close <= previousM15.ema9 ||
            previousM15.close <= previousM15.ema15
          )
        )
      : false;

  const previousShortWatch =
    previousM15
      ? (
          previousM15.shortDirection &&
          (
            previousM15.close >= previousM15.ema9 ||
            previousM15.close >= previousM15.ema15
          )
        )
      : false;

  const longRecoveryTrigger =
    previousLongWatch &&
    longRecovery;

  const shortRecoveryTrigger =
    previousShortWatch &&
    shortRecovery;

  /*
   * ============================================================
   * 9. FINAL SWING ENTRY CONDITION
   * ============================================================
   *
   * Pine:
   *
   * longEntry =
   *     longDirection and
   *     longRecoveryTrigger and
   *     m15LongMomentum
   *
   * shortEntry =
   *     shortDirection and
   *     shortRecoveryTrigger and
   *     m15ShortMomentum
   */
  const longEntry =
    longDirection &&
    longRecoveryTrigger &&
    m15LongMomentum;

  const shortEntry =
    shortDirection &&
    shortRecoveryTrigger &&
    m15ShortMomentum;

  /*
   * ============================================================
   * 10. NEW ENTRY ONLY
   * ============================================================
   *
   * Pine:
   *
   * longSignal =
   *     longEntry and
   *     not longEntry[1]
   *
   * shortSignal =
   *     shortEntry and
   *     not shortEntry[1]
   *
   * In the analyzer, the same transition is represented by
   * requiring the previous M15 state not to have satisfied the
   * complete entry condition.
   */
  const previousLongEntry =
    previousM15
      ? (
          previousM15.longDirection &&
          previousLongWatch &&
          previousM15.close > previousM15.ema9 &&
          previousM15.smi >= settings.smiOB
        )
      : false;

  const previousShortEntry =
    previousM15
      ? (
          previousM15.shortDirection &&
          previousShortWatch &&
          previousM15.close < previousM15.ema9 &&
          previousM15.smi <= settings.smiOS
        )
      : false;

  const longSignal =
    longEntry &&
    !previousLongEntry;

  const shortSignal =
    shortEntry &&
    !previousShortEntry;

  /*
   * ============================================================
   * 11. ENTRY READY
   * ============================================================
   *
   * Pine:
   *
   * longEntryReady =
   *     longWatch and
   *     not longRecovery
   *
   * shortEntryReady =
   *     shortWatch and
   *     not shortRecovery
   */
  const longEntryReady =
    longWatch &&
    !longRecovery;

  const shortEntryReady =
    shortWatch &&
    !shortRecovery;

  /*
   * ============================================================
   * 12. SETUP DEVELOPING
   * ============================================================
   *
   * Pine:
   *
   * longSetupDeveloping =
   *     longDirection and
   *     not longWatch
   *
   * shortSetupDeveloping =
   *     shortDirection and
   *     not shortWatch
   */
  const longSetupDeveloping =
    longDirection &&
    !longWatch;

  const shortSetupDeveloping =
    shortDirection &&
    !shortWatch;

  /*
   * ============================================================
   * STATE PRIORITY
   * ============================================================
   *
   * This follows the Pine overallStatus priority:
   *
   * ENTER
   * ENTRY READY
   * PULLBACK
   * DIRECTION
   * WAIT
   */
  let stage: SwingStage = "WAIT";
  let direction: SwingDirection = "NEUTRAL";
  let signal: "BUY" | "SELL" | "NONE" = "NONE";

  if (longSignal) {
    direction = "LONG";
    stage = "ENTER_LONG";
    signal = "BUY";
  } else if (shortSignal) {
    direction = "SHORT";
    stage = "ENTER_SHORT";
    signal = "SELL";
  } else if (longEntryReady) {
    direction = "LONG";
    stage = "ENTRY_READY";
  } else if (shortEntryReady) {
    direction = "SHORT";
    stage = "ENTRY_READY";
  } else if (longWatch) {
    direction = "LONG";
    stage = "PULLBACK";
  } else if (shortWatch) {
    direction = "SHORT";
    stage = "PULLBACK";
  } else if (longSetupDeveloping) {
    direction = "LONG";
    stage = "DIRECTION";
  } else if (shortSetupDeveloping) {
    direction = "SHORT";
    stage = "DIRECTION";
  }

  /*
   * ============================================================
   * EVIDENCE
   * ============================================================
   *
   * This is deliberately structured so the AI Coach can explain
   * the strategy state without inventing a different strategy.
   */
  const evidence: string[] = [];
  const invalidation: string[] = [];

  if (h1LongDirection) {
    evidence.push(
      `H1 bullish: EMA ${settings.emaFastLen} is above EMA ${settings.emaSlowLen}.`,
    );
  }

  if (h1ShortDirection) {
    evidence.push(
      `H1 bearish: EMA ${settings.emaFastLen} is below EMA ${settings.emaSlowLen}.`,
    );
  }

  if (m15LongDirection) {
    evidence.push(
      `M15 bullish: EMA ${settings.emaFastLen} is above EMA ${settings.emaSlowLen}.`,
    );
  }

  if (m15ShortDirection) {
    evidence.push(
      `M15 bearish: EMA ${settings.emaFastLen} is below EMA ${settings.emaSlowLen}.`,
    );
  }

  if (settings.requireEMA100) {
    if (h1.above100) {
      evidence.push("H1 price is above EMA 100.");
    }

    if (h1.below100) {
      evidence.push("H1 price is below EMA 100.");
    }

    if (m15.above100) {
      evidence.push("M15 price is above EMA 100.");
    }

    if (m15.below100) {
      evidence.push("M15 price is below EMA 100.");
    }
  }

  if (m15LongMomentum) {
    evidence.push(
      `M15 SMI ${round(m15.smi, 1)} confirms bullish momentum (>= ${settings.smiOB}).`,
    );
  }

  if (m15ShortMomentum) {
    evidence.push(
      `M15 SMI ${round(m15.smi, 1)} confirms bearish momentum (<= ${settings.smiOS}).`,
    );
  }

  if (longWatch) {
    evidence.push(
      "M15 has entered the bullish EMA 9/15 pullback condition.",
    );
  }

  if (shortWatch) {
    evidence.push(
      "M15 has entered the bearish EMA 9/15 pullback condition.",
    );
  }

  if (longRecovery) {
    evidence.push(
      "M15 has recovered above EMA 9.",
    );
  }

  if (shortRecovery) {
    evidence.push(
      "M15 has recovered below EMA 9.",
    );
  }

  if (longSignal) {
    evidence.push(
      "NEW BUY transition: previous M15 state was a pullback and current M15 state recovered above EMA 9 with bullish SMI confirmation.",
    );
  }

  if (shortSignal) {
    evidence.push(
      "NEW SELL transition: previous M15 state was a pullback and current M15 state recovered below EMA 9 with bearish SMI confirmation.",
    );
  }

  /*
   * Invalidation / what must happen before entry.
   */
  if (longDirection && !longWatch) {
    invalidation.push(
      "Long direction is aligned, but the required M15 EMA 9/15 pullback has not occurred.",
    );
  }

  if (longEntryReady && !longSignal) {
    invalidation.push(
      "Long setup is ENTRY READY; wait for M15 recovery above EMA 9 with SMI >= 40.",
    );
  }

  if (shortDirection && !shortWatch) {
    invalidation.push(
      "Short direction is aligned, but the required M15 EMA 9/15 pullback has not occurred.",
    );
  }

  if (shortEntryReady && !shortSignal) {
    invalidation.push(
      "Short setup is ENTRY READY; wait for M15 recovery below EMA 9 with SMI <= -40.",
    );
  }

  if (!longDirection && !shortDirection) {
    invalidation.push(
      "H1 and M15 are not fully aligned; no swing direction is confirmed.",
    );
  }

  /*
   * ============================================================
   * CONFIDENCE
   * ============================================================
   *
   * The Pine source does NOT contain a confidence percentage.
   *
   * VaultTrades needs a confidence field for its existing
   * response structure, so this is a deterministic state score,
   * NOT a new trading rule.
   *
   * The actual BUY/SELL condition remains exactly the Pine
   * condition above.
   */
  const confidence = calculateStateConfidence({
    longDirection,
    shortDirection,
    longWatch,
    shortWatch,
    longRecovery,
    shortRecovery,
    m15LongMomentum,
    m15ShortMomentum,
    longSignal,
    shortSignal,
  });

  const entryPrice =
    longSignal || shortSignal
      ? (
          input.current?.close ??
          m15.close
        )
      : null;

  let message = "WAIT";

  if (longSignal) {
    message =
      "ENTER LONG — H1 + M15 bullish alignment, M15 pullback completed, recovery above EMA 9 confirmed, and M15 SMI is bullish.";
  } else if (shortSignal) {
    message =
      "ENTER SHORT — H1 + M15 bearish alignment, M15 pullback completed, recovery below EMA 9 confirmed, and M15 SMI is bearish.";
  } else if (longEntryReady) {
    message =
      "LONG ENTRY READY — bullish H1/M15 alignment and EMA 9/15 pullback detected. Wait for recovery above EMA 9 with M15 SMI confirmation.";
  } else if (shortEntryReady) {
    message =
      "SHORT ENTRY READY — bearish H1/M15 alignment and EMA 9/15 pullback detected. Wait for recovery below EMA 9 with M15 SMI confirmation.";
  } else if (longWatch) {
    message =
      "LONG PULLBACK — bullish H1/M15 direction is confirmed and price is in the EMA 9/15 pullback condition.";
  } else if (shortWatch) {
    message =
      "SHORT PULLBACK — bearish H1/M15 direction is confirmed and price is in the EMA 9/15 pullback condition.";
  } else if (longSetupDeveloping) {
    message =
      "LONG DIRECTION — H1 and M15 are aligned bullish. Wait for the M15 EMA 9/15 pullback.";
  } else if (shortSetupDeveloping) {
    message =
      "SHORT DIRECTION — H1 and M15 are aligned bearish. Wait for the M15 EMA 9/15 pullback.";
  }

  return {
    strategyId: SWING_DEVELOPING_ID,
    strategyName: SWING_DEVELOPING_NAME,

    direction,
    stage,

    signal,
    isNewSignal:
      longSignal ||
      shortSignal,

    entryPrice,

    // The Pine source does not define these.
    stopLoss: null,
    takeProfit: null,
    riskReward: null,

    confidence,

    h1,
    m15,

    pullback: {
      long: m15PullbackLong,
      short: m15PullbackShort,
      active:
        longWatch ||
        shortWatch,
    },

    recovery: {
      long: longRecovery,
      short: shortRecovery,
      longTrigger: longRecoveryTrigger,
      shortTrigger: shortRecoveryTrigger,
    },

    momentum: {
      long: m15LongMomentum,
      short: m15ShortMomentum,
      h1SMI: h1.smi,
      m15SMI: m15.smi,
    },

    states: {
      longSetupDeveloping,
      shortSetupDeveloping,

      longWatch,
      shortWatch,

      longEntryReady,
      shortEntryReady,

      longEntry,
      shortEntry,

      longSignal,
      shortSignal,
    },

    evidence,
    invalidation,

    message,
  };
}

function calculateStateConfidence(input: {
  longDirection: boolean;
  shortDirection: boolean;

  longWatch: boolean;
  shortWatch: boolean;

  longRecovery: boolean;
  shortRecovery: boolean;

  m15LongMomentum: boolean;
  m15ShortMomentum: boolean;

  longSignal: boolean;
  shortSignal: boolean;
}): number {
  /*
   * This is NOT Pine logic.
   *
   * The Pine script has no confidence percentage.
   *
   * It is only a deterministic presentation score for the
   * existing VaultTrades Analyzer contract.
   */

  if (input.longSignal || input.shortSignal) {
    return 100;
  }

  if (
    input.longDirection &&
    input.longWatch &&
    input.longRecovery &&
    input.m15LongMomentum
  ) {
    return 90;
  }

  if (
    input.shortDirection &&
    input.shortWatch &&
    input.shortRecovery &&
    input.m15ShortMomentum
  ) {
    return 90;
  }

  if (
    input.longDirection &&
    input.longWatch
  ) {
    return 75;
  }

  if (
    input.shortDirection &&
    input.shortWatch
  ) {
    return 75;
  }

  if (
    input.longDirection ||
    input.shortDirection
  ) {
    return 60;
  }

  return 0;
}

function createInsufficientDataResult(): SwingDevelopingResult {
  const emptyState: SwingTimeframeState = {
    close: 0,

    ema9: 0,
    ema15: 0,
    ema100: 0,

    smi: 0,

    bullish: false,
    bearish: false,

    above100: false,
    below100: false,

    longDirection: false,
    shortDirection: false,
  };

  return {
    strategyId: SWING_DEVELOPING_ID,
    strategyName: SWING_DEVELOPING_NAME,

    direction: "NEUTRAL",
    stage: "WAIT",

    signal: "NONE",
    isNewSignal: false,

    entryPrice: null,

    stopLoss: null,
    takeProfit: null,
    riskReward: null,

    confidence: 0,

    h1: emptyState,
    m15: emptyState,

    pullback: {
      long: false,
      short: false,
      active: false,
    },

    recovery: {
      long: false,
      short: false,
      longTrigger: false,
      shortTrigger: false,
    },

    momentum: {
      long: false,
      short: false,
      h1SMI: 0,
      m15SMI: 0,
    },

    states: {
      longSetupDeveloping: false,
      shortSetupDeveloping: false,

      longWatch: false,
      shortWatch: false,

      longEntryReady: false,
      shortEntryReady: false,

      longEntry: false,
      shortEntry: false,

      longSignal: false,
      shortSignal: false,
    },

    evidence: [
      "Insufficient H1 or M15 candle data to evaluate the Swing Developing Strategy.",
    ],

    invalidation: [
      "Provide sufficient H1 and M15 historical candles before evaluating the strategy.",
    ],

    message:
      "WAIT — insufficient H1/M15 data.",
  };
}

/**
 * Convenience export used by the VaultTrades strategy registry.
 *
 * This keeps the strategy self-contained while the shared
 * `types.ts` contract is being integrated.
 */
export const swingDevelopingStrategy = {
  id: SWING_DEVELOPING_ID,
  name: SWING_DEVELOPING_NAME,

  description:
    "H1 + M15 swing direction with EMA 9/15 pullback, recovery through EMA 9, and M15 SMI 7-2-2 confirmation.",

  timeframes: ["H1", "M15"] as const,

  analyze: analyzeSwingDeveloping,

  rules: {
    h1Direction:
      "H1 EMA 9 > EMA 15 with price above EMA 100 for long; opposite for short when EMA 100 direction is required.",

    m15Direction:
      "M15 EMA 9 > EMA 15 with price above EMA 100 for long; opposite for short when EMA 100 direction is required.",

    pullback:
      "M15 close must pull into/through the EMA 9/15 area.",

    recovery:
      "After the pullback, M15 must recover above EMA 9 for long or below EMA 9 for short.",

    momentum:
      "M15 SMI 7-2-2 must be >= 40 for long or <= -40 for short.",

    entry:
      "H1 + M15 alignment + previous M15 pullback + current recovery + M15 SMI confirmation.",

    signal:
      "Only the transition into the complete entry condition produces a new signal.",

    risk:
      "No SL, TP or RR is defined by the source Pine strategy.",
  },
};

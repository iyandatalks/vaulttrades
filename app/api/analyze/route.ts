import {
  getStrategyRules,
  StrategyId,
} from "../../../lib/strategies";

type Timeframe =
  | "M1"
  | "M5"
  | "M10"
  | "M15"
  | "M30"
  | "H1"
  | "H4"
  | "D1";

type Direction =
  | "BUY"
  | "SELL"
  | "BUY DEVELOPING"
  | "SELL DEVELOPING"
  | "WAITING"
  | "NO TRADE";

type AnnotationType =
  | "zone"
  | "entry"
  | "stopLoss"
  | "tp1"
  | "tp2"
  | "finalTp"
  | "retest"
  | "confirmation"
  | "structure";

type ChartPoint = {
  x: number;
  y: number;
};

type ChartAnnotation = {
  type: AnnotationType;
  label: string;
  price?: number | null;
  points?: ChartPoint[];
  color: "gold" | "green" | "red" | "white";
};

type StructuredAnalysis = {
  direction: Direction;
  confidence: number;

  strategy: string;
  timeframe: Timeframe;

  marketState: string;
  setup: string;

  confirmedConditions: string[];
  missingConditions: string[];

  entry: number | null;
  stopLoss: number | null;
  risk: number | null;

  tp1: number | null;
  tp2: number | null;
  finalTp: number | null;

  finalTpReason: string;
  invalidation: string;
  aiCoach: string;

  projection: {
    available: boolean;

    setupType:
      | "demand"
      | "supply"
      | "long"
      | "short"
      | "continuation"
      | "killZone"
      | "ema"
      | "none";

    zoneLow: number | null;
    zoneHigh: number | null;

    expectedEntry: number | null;
    expectedStopLoss: number | null;

    expectedTp1: number | null;
    expectedTp2: number | null;
    expectedFinalTp: number | null;

    retestRequired: boolean;
    retestStatus:
      | "WAITING"
      | "TESTED"
      | "CONFIRMED"
      | "NOT_REQUIRED";

    confirmationRequired: string;
    confirmationStatus:
      | "REQUIRED"
      | "PENDING"
      | "CONFIRMED"
      | "NOT_REQUIRED";
  };

  chartAnnotations: ChartAnnotation[];
};

const VALID_TIMEFRAMES: Timeframe[] = [
  "M1",
  "M5",
  "M10",
  "M15",
  "M30",
  "H1",
  "H4",
  "D1",
];

/* ============================================================
   HELPERS
============================================================ */

function isValidTimeframe(
  value: unknown
): value is Timeframe {
  return (
    typeof value === "string" &&
    VALID_TIMEFRAMES.includes(
      value as Timeframe
    )
  );
}

function cleanNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number =
    typeof value === "number"
      ? value
      : Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function cleanString(
  value: unknown,
  fallback = ""
): string {
  return typeof value === "string"
    ? value.trim()
    : fallback;
}

function cleanStringArray(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is string =>
        typeof item === "string"
    )
    .map((item) => item.trim())
    .filter(Boolean);
}

function clampCoordinate(
  value: unknown
): number {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(1000, number)
  );
}

function cleanPoints(
  value: unknown
): ChartPoint[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const points = value
    .filter(
      (point) =>
        point &&
        typeof point === "object"
    )
    .map((point: any) => ({
      x: clampCoordinate(point.x),
      y: clampCoordinate(point.y),
    }));

  return points.length > 0
    ? points
    : undefined;
}

function cleanAnnotations(
  value: unknown
): ChartAnnotation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const allowedTypes: AnnotationType[] = [
    "zone",
    "entry",
    "stopLoss",
    "tp1",
    "tp2",
    "finalTp",
    "retest",
    "confirmation",
    "structure",
  ];

  const allowedColors = [
    "gold",
    "green",
    "red",
    "white",
  ] as const;

  return value
    .filter(
      (item) =>
        item &&
        typeof item === "object"
    )
    .map((item: any) => {
      const type = allowedTypes.includes(
        item.type
      )
        ? item.type
        : "structure";

      const color =
        allowedColors.includes(item.color)
          ? item.color
          : "gold";

      const annotation: ChartAnnotation = {
        type,
        label: cleanString(
          item.label,
          "Market level"
        ),
        price: cleanNumber(item.price),
        color,
      };

      const points = cleanPoints(
        item.points
      );

      if (points) {
        annotation.points = points;
      }

      return annotation;
    });
}

function normalizeDirection(
  value: unknown
): Direction {
  const direction =
    cleanString(value)
      .toUpperCase()
      .trim();

  if (direction === "BUY") {
    return "BUY";
  }

  if (direction === "SELL") {
    return "SELL";
  }

  if (
    direction === "BUY DEVELOPING"
  ) {
    return "BUY DEVELOPING";
  }

  if (
    direction === "SELL DEVELOPING"
  ) {
    return "SELL DEVELOPING";
  }

  if (direction === "NO TRADE") {
    return "NO TRADE";
  }

  return "WAITING";
}

/* ============================================================
   BUILD HUMAN-READABLE ANALYSIS
============================================================ */

function buildAnalysisText(
  data: StructuredAnalysis
): string {
  const formatValue = (
    value: number | null
  ) =>
    value === null
      ? "WAIT"
      : String(value);

  return `
DIRECTION:
${data.direction}

CONFIDENCE:
${data.confidence}%

STRATEGY:
${data.strategy}

TIMEFRAME:
${data.timeframe}

MARKET STATE:
${data.marketState}

SETUP:
${data.setup}

CONFIRMED CONDITIONS:
${
  data.confirmedConditions.length
    ? data.confirmedConditions
        .map(
          (condition) =>
            `- ${condition}`
        )
        .join("\n")
    : "- None confirmed."
}

MISSING CONDITIONS:
${
  data.missingConditions.length
    ? data.missingConditions
        .map(
          (condition) =>
            `- ${condition}`
        )
        .join("\n")
    : "- None."
}

ENTRY:
${formatValue(data.entry)}

STOP LOSS:
${formatValue(data.stopLoss)}

RISK:
${formatValue(data.risk)}

TP1:
${formatValue(data.tp1)}

TP2:
${formatValue(data.tp2)}

FINAL TP:
${formatValue(data.finalTp)}

FINAL TP REASON:
${data.finalTpReason}

INVALIDATION:
${data.invalidation}

AI COACH:
${data.aiCoach}
`.trim();
}

/* ============================================================
   MAIN API
============================================================ */

export async function POST(
  request: Request
) {
  try {
    /* ========================================================
       FORM DATA
    ======================================================== */

    const formData =
      await request.formData();

    const image =
      formData.get("image");

    const strategy =
      formData.get("strategy");

    const timeframe =
      formData.get("timeframe");


    /* ========================================================
       VALIDATE IMAGE
    ======================================================== */

    if (!(image instanceof File)) {
      return Response.json(
        {
          error:
            "Chart image is required.",
        },
        { status: 400 }
      );
    }


    /* ========================================================
       VALIDATE STRATEGY
    ======================================================== */

    if (
      strategy !== "killZone" &&
      strategy !== "ema" &&
      strategy !== "continuation" &&
      strategy !== "supplyDemand"
    ) {
      return Response.json(
        {
          error:
            "Invalid strategy selected.",
        },
        { status: 400 }
      );
    }


    /* ========================================================
       VALIDATE TIMEFRAME
    ======================================================== */

    if (!isValidTimeframe(timeframe)) {
      return Response.json(
        {
          error:
            "A valid timeframe must be selected.",
        },
        { status: 400 }
      );
    }


    /* ========================================================
       API KEY
    ======================================================== */

    const apiKey =
      process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        {
          error:
            "OpenAI API key is not configured.",
        },
        { status: 500 }
      );
    }


    /* ========================================================
       IMAGE
    ======================================================== */

    const imageBuffer =
      await image.arrayBuffer();

    const base64Image =
      Buffer.from(
        imageBuffer
      ).toString("base64");

    const mimeType =
      image.type || "image/png";


    /* ========================================================
       LOAD EXACT STRATEGY RULES
    ======================================================== */

    const selectedStrategy =
      strategy as StrategyId;

    const selectedTimeframe =
      timeframe as Timeframe;

    const strategyRules =
      getStrategyRules(
        selectedStrategy
      );


    /* ========================================================
       MASTER ANALYSIS PROMPT
    ======================================================== */

    const systemPrompt = `
You are VaultTrades Analyzer.

You are a professional chart-analysis engine.

You are NOT a generic trading assistant.

Your primary responsibility is to analyze the uploaded TradingView
chart according to the SELECTED STRATEGY and the USER SELECTED
TIMEFRAME.

The strategy rules supplied below are authoritative.

Do not replace them with generic ICT, Smart Money Concepts,
forex, technical-analysis or trading assumptions.

Do not add conditions that are not contained in the selected strategy.

Do not remove mandatory conditions from the selected strategy.

Do not combine strategies.

============================================================
USER SELECTION
============================================================

SELECTED STRATEGY:
${selectedStrategy}

SELECTED TIMEFRAME:
${selectedTimeframe}

============================================================
EXACT STRATEGY RULES
============================================================

${strategyRules}

============================================================
TIMEFRAME RULE
============================================================

The user explicitly selected:

${selectedTimeframe}

Analyze the chart in the context of this timeframe.

The selected timeframe is authoritative.

Do not silently switch to another timeframe because the uploaded
image appears to contain information from another timeframe.

If the visible chart timeframe conflicts with the user's selected
timeframe, state that clearly in MARKET STATE and reduce confidence
where appropriate.

============================================================
CHART IS PRIMARY EVIDENCE
============================================================

The uploaded image is the primary evidence.

Read only information that is actually visible or can be reliably
inferred from the chart.

Inspect:

- Candlesticks
- Price
- Time
- Market structure
- Swing highs
- Swing lows
- EMA levels
- FVGs
- Order blocks
- Liquidity
- Sessions
- Indicators
- Previous highs/lows
- Visible support/resistance
- Volume when visible
- Supply zones
- Demand zones
- Retests
- Reactions
- Breakouts
- Structure shifts

Do not invent information.

If a condition cannot be reliably established from the uploaded
chart, say so.

============================================================
TRADE STATES
============================================================

You MUST distinguish between:

1. CONFIRMED BUY
2. CONFIRMED SELL
3. BUY DEVELOPING
4. SELL DEVELOPING
5. WAITING
6. NO TRADE

A developing setup is NOT a confirmed trade.

Never convert a developing setup into a confirmed trade merely because
price is moving in the expected direction.

Do not produce BUY or SELL simply because:

- price is rising
- price is falling
- an EMA is bullish/bearish
- one candle looks strong
- an indicator is bullish/bearish
- price is near support/resistance

The selected strategy sequence must be satisfied.

============================================================
IMPORTANT NEW REQUIREMENT:
DEVELOPING TRADE PROJECTION
============================================================

The application must be useful BEFORE a setup is confirmed.

If the selected strategy has enough visible evidence to establish
a potential trade location, identify the EXPECTED execution plan.

This is especially important for Supply & Demand.

For a developing setup, you may identify:

- Expected entry
- Expected stop loss
- Expected TP1
- Expected TP2
- Expected final TP
- Supply zone
- Demand zone
- Retest area
- Required confirmation
- Invalidation

However:

NEVER invent these values merely to fill the fields.

Only project levels when they can be derived from visible chart
structure AND the selected strategy rules.

If a valid projected level cannot be established:

return null for that level.

============================================================
SUPPLY & DEMAND PROJECTION
============================================================

When Supply & Demand is selected, specifically investigate whether
a valid supply or demand zone can be established according to the
strategy rules.

If a valid zone exists but price has not yet retested it:

DIRECTION may be:

BUY DEVELOPING

or

SELL DEVELOPING

and projection data may contain:

- zoneLow
- zoneHigh
- expectedEntry
- expectedStopLoss
- expectedTp1
- expectedTp2
- expectedFinalTp

The projected entry should represent the price where the strategy
expects execution/reaction, NOT simply the current market price.

The stop must derive from the zone/strategy invalidation logic.

Targets must be structurally logical and must not be placed on the
wrong side of the trade.

If the zone does not exist or cannot be reliably identified:

do NOT invent a projected entry.

Return:

WAITING

with projection.available = false.

============================================================
RETEST LOGIC
============================================================

Explicitly determine whether a retest is required.

Possible retestStatus:

WAITING
TESTED
CONFIRMED
NOT_REQUIRED

Examples:

Zone identified but price has not returned:

retestRequired = true
retestStatus = WAITING

Price has returned but confirmation is missing:

retestRequired = true
retestStatus = TESTED

Price has retested and the required reaction occurred:

retestRequired = true
retestStatus = CONFIRMED

============================================================
CONFIRMATION LOGIC
============================================================

For developing trades, clearly identify what confirmation is still
required.

Examples:

- Bullish reaction from demand
- Bearish rejection from supply
- MSS
- BOS
- FVG confirmation
- EMA rejection
- Strategy-specific confirmation

Do not say simply "wait".

Explain WHAT the trader is waiting for.

============================================================
EXPECTED LEVELS
============================================================

For a developing setup:

ENTRY may remain null if no reliable expected entry can be established.

If expected entry can be established, return it in:

projection.expectedEntry

The same applies to:

projection.expectedStopLoss
projection.expectedTp1
projection.expectedTp2
projection.expectedFinalTp

IMPORTANT:

Projected values are EXPECTED levels, not confirmed execution prices.

The application must label them accordingly.

============================================================
CONFIRMED TRADE
============================================================

If the complete strategy sequence has occurred:

DIRECTION must be:

BUY

or

SELL

Then return actual:

entry
stopLoss
risk
tp1
tp2
finalTp

============================================================
STOP LOSS
============================================================

The stop loss must be derived from the selected strategy.

Never choose an arbitrary round number.

For BUY:

Risk = Entry - Stop Loss

For SELL:

Risk = Stop Loss - Entry

Never report negative risk.

If the stop cannot be established:

stopLoss = null

============================================================
TAKE PROFIT
============================================================

Targets must be derived from the selected strategy and visible
market structure.

Look for:

- Previous meaningful highs
- Previous meaningful lows
- PDH
- PDL
- Structural highs
- Structural lows
- Liquidity objectives
- Opposing zones

For BUY:

targets must be above entry.

For SELL:

targets must be below entry.

Never invent a target.

If no valid target can be established:

return null.

============================================================
CONFIDENCE
============================================================

Confidence is NOT guaranteed profitability.

Confidence represents how completely the visible chart satisfies
the selected strategy.

Consider:

- Required conditions
- Structure clarity
- Entry confirmation
- Invalidation clarity
- Target clarity
- Missing information
- Projection quality

Critical missing conditions must keep confidence low.

============================================================
CHART ANNOTATIONS
============================================================

The frontend will use your annotation data to mark the uploaded
chart.

Return chartAnnotations only for levels or structures that can
actually be identified.

Coordinates MUST be normalized from 0 to 1000.

x = horizontal image position.
y = vertical image position.

0 = top/left edge.
1000 = bottom/right edge.

Do not invent coordinates.

Use approximate visible positions only when the relevant level or
zone is actually visible.

For a zone, provide points describing the visible rectangle:

top-left
top-right
bottom-right
bottom-left

For a horizontal price level, provide two points across the
relevant chart width.

For an entry/retest/confirmation point, provide a point at the
relevant location.

If a level is not visible or cannot be reliably located:

DO NOT create an annotation for it.

============================================================
ANNOTATION TYPES
============================================================

Allowed:

zone
entry
stopLoss
tp1
tp2
finalTp
retest
confirmation
structure

Allowed colors:

gold
green
red
white

Suggested meaning:

gold = projected/developing levels
green = BUY / bullish
red = SELL / bearish / invalidation
white = structure/information

============================================================
NO FAKE PROJECTIONS
============================================================

This is critical.

Do NOT return:

ENTRY = 4000
SL = 3995
TP = 4100

just because the fields exist.

Every number must be supported by visible chart evidence and the
selected strategy.

If the chart does not support it:

return null.

============================================================
OUTPUT
============================================================

Return ONLY valid JSON.

Do not use markdown.

Do not use code fences.

The JSON must follow this exact structure:

{
  "direction": "BUY | SELL | BUY DEVELOPING | SELL DEVELOPING | WAITING | NO TRADE",

  "confidence": 0,

  "strategy": "${selectedStrategy}",

  "timeframe": "${selectedTimeframe}",

  "marketState": "",

  "setup": "",

  "confirmedConditions": [],

  "missingConditions": [],

  "entry": null,

  "stopLoss": null,

  "risk": null,

  "tp1": null,

  "tp2": null,

  "finalTp": null,

  "finalTpReason": "",

  "invalidation": "",

  "aiCoach": "",

  "projection": {
    "available": false,

    "setupType": "none",

    "zoneLow": null,

    "zoneHigh": null,

    "expectedEntry": null,

    "expectedStopLoss": null,

    "expectedTp1": null,

    "expectedTp2": null,

    "expectedFinalTp": null,

    "retestRequired": false,

    "retestStatus": "NOT_REQUIRED",

    "confirmationRequired": "",

    "confirmationStatus": "NOT_REQUIRED"
  },

  "chartAnnotations": []
}

============================================================
FINAL RULE
============================================================

The chart, projection, trade signal and analysis must agree.

If there is no valid zone:

do not create a projected zone.

If there is a zone but no retest:

show DEVELOPING and explain the expected execution area.

If there is a retest but confirmation is missing:

show DEVELOPING and explain the required confirmation.

If all conditions are confirmed:

show BUY or SELL.

If the evidence is insufficient:

show WAITING or NO TRADE.

Never force a trade.
`;


    /* ========================================================
       OPENAI VISION REQUEST
    ======================================================== */

    const openAIResponse =
      await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${apiKey}`,
          },

          body: JSON.stringify({
            model: "gpt-4.1-mini",

            input: [
              {
                role: "user",

                content: [
                  {
                    type: "input_text",
                    text: systemPrompt,
                  },

                  {
                    type: "input_image",
                    image_url:
                      `data:${mimeType};base64,${base64Image}`,
                  },
                ],
              },
            ],

            max_output_tokens: 4000,

            text: {
              format: {
                type: "json_schema",

                name:
                  "vaulttrades_chart_analysis",

                strict: true,

                schema: {
                  type: "object",

                  additionalProperties:
                    false,

                  properties: {
                    direction: {
                      type: "string",
                      enum: [
                        "BUY",
                        "SELL",
                        "BUY DEVELOPING",
                        "SELL DEVELOPING",
                        "WAITING",
                        "NO TRADE",
                      ],
                    },

                    confidence: {
                      type: "number",
                      minimum: 0,
                      maximum: 100,
                    },

                    strategy: {
                      type: "string",
                    },

                    timeframe: {
                      type: "string",
                      enum: VALID_TIMEFRAMES,
                    },

                    marketState: {
                      type: "string",
                    },

                    setup: {
                      type: "string",
                    },

                    confirmedConditions: {
                      type: "array",
                      items: {
                        type: "string",
                      },
                    },

                    missingConditions: {
                      type: "array",
                      items: {
                        type: "string",
                      },
                    },

                    entry: {
                      type: [
                        "number",
                        "null",
                      ],
                    },

                    stopLoss: {
                      type: [
                        "number",
                        "null",
                      ],
                    },

                    risk: {
                      type: [
                        "number",
                        "null",
                      ],
                    },

                    tp1: {
                      type: [
                        "number",
                        "null",
                      ],
                    },

                    tp2: {
                      type: [
                        "number",
                        "null",
                      ],
                    },

                    finalTp: {
                      type: [
                        "number",
                        "null",
                      ],
                    },

                    finalTpReason: {
                      type: "string",
                    },

                    invalidation: {
                      type: "string",
                    },

                    aiCoach: {
                      type: "string",
                    },

                    projection: {
                      type: "object",

                      additionalProperties:
                        false,

                      properties: {
                        available: {
                          type: "boolean",
                        },

                        setupType: {
                          type: "string",
                          enum: [
                            "demand",
                            "supply",
                            "long",
                            "short",
                            "continuation",
                            "killZone",
                            "ema",
                            "none",
                          ],
                        },

                        zoneLow: {
                          type: [
                            "number",
                            "null",
                          ],
                        },

                        zoneHigh: {
                          type: [
                            "number",
                            "null",
                          ],
                        },

                        expectedEntry: {
                          type: [
                            "number",
                            "null",
                          ],
                        },

                        expectedStopLoss: {
                          type: [
                            "number",
                            "null",
                          ],
                        },

                        expectedTp1: {
                          type: [
                            "number",
                            "null",
                          ],
                        },

                        expectedTp2: {
                          type: [
                            "number",
                            "null",
                          ],
                        },

                        expectedFinalTp: {
                          type: [
                            "number",
                            "null",
                          ],
                        },

                        retestRequired: {
                          type: "boolean",
                        },

                        retestStatus: {
                          type: "string",
                          enum: [
                            "WAITING",
                            "TESTED",
                            "CONFIRMED",
                            "NOT_REQUIRED",
                          ],
                        },

                        confirmationRequired: {
                          type: "string",
                        },

                        confirmationStatus: {
                          type: "string",
                          enum: [
                            "REQUIRED",
                            "PENDING",
                            "CONFIRMED",
                            "NOT_REQUIRED",
                          ],
                        },
                      },

                      required: [
                        "available",
                        "setupType",
                        "zoneLow",
                        "zoneHigh",
                        "expectedEntry",
                        "expectedStopLoss",
                        "expectedTp1",
                        "expectedTp2",
                        "expectedFinalTp",
                        "retestRequired",
                        "retestStatus",
                        "confirmationRequired",
                        "confirmationStatus",
                      ],
                    },

                    chartAnnotations: {
                      type: "array",

                      items: {
                        type: "object",

                        additionalProperties:
                          false,

                        properties: {
                          type: {
                            type: "string",
                            enum: [
                              "zone",
                              "entry",
                              "stopLoss",
                              "tp1",
                              "tp2",
                              "finalTp",
                              "retest",
                              "confirmation",
                              "structure",
                            ],
                          },

                          label: {
                            type: "string",
                          },

                          price: {
                            type: [
                              "number",
                              "null",
                            ],
                          },

                          points: {
                            type: "array",

                            items: {
                              type: "object",

                              additionalProperties:
                                false,

                              properties: {
                                x: {
                                  type: "number",
                                  minimum: 0,
                                  maximum: 1000,
                                },

                                y: {
                                  type: "number",
                                  minimum: 0,
                                  maximum: 1000,
                                },
                              },

                              required: [
                                "x",
                                "y",
                              ],
                            },
                          },

                          color: {
                            type: "string",
                            enum: [
                              "gold",
                              "green",
                              "red",
                              "white",
                            ],
                          },
                        },

                        required: [
                          "type",
                          "label",
                          "price",
                          "points",
                          "color",
                        ],
                      },
                    },
                  },

                  required: [
                    "direction",
                    "confidence",
                    "strategy",
                    "timeframe",
                    "marketState",
                    "setup",
                    "confirmedConditions",
                    "missingConditions",
                    "entry",
                    "stopLoss",
                    "risk",
                    "tp1",
                    "tp2",
                    "finalTp",
                    "finalTpReason",
                    "invalidation",
                    "aiCoach",
                    "projection",
                    "chartAnnotations",
                  ],
                },
              },
            },
          }),
        }
      );


    /* ========================================================
       OPENAI ERROR
    ======================================================== */

    if (!openAIResponse.ok) {
      const errorText =
        await openAIResponse.text();

      console.error(
        "OpenAI API error:",
        errorText
      );

      return Response.json(
        {
          error:
            "OpenAI analysis failed.",
          details: errorText,
        },
        { status: 500 }
      );
    }


    /* ========================================================
       RESPONSE
    ======================================================== */

    const result =
      await openAIResponse.json();


    /* ========================================================
       EXTRACT STRUCTURED JSON
    ======================================================== */

    let parsed: any = null;

    try {
      const outputText =
        result.output
          ?.flatMap(
            (item: any) =>
              item.content ?? []
          )
          ?.filter(
            (content: any) =>
              content.type ===
              "output_text"
          )
          ?.map(
            (content: any) =>
              content.text
          )
          ?.join("")
          ?.trim() ?? "";

      if (!outputText) {
        throw new Error(
          "No structured analysis returned."
        );
      }

      parsed =
        JSON.parse(outputText);
    } catch (parseError) {
      console.error(
        "Failed to parse structured OpenAI response:",
        parseError
      );

      console.error(
        "Raw OpenAI result:",
        JSON.stringify(
          result,
          null,
          2
        )
      );

      return Response.json(
        {
          error:
            "The analyzer returned an invalid structured result.",
        },
        { status: 500 }
      );
    }


    /* ========================================================
       NORMALIZE RESULT
    ======================================================== */

    const normalizedDirection =
      normalizeDirection(
        parsed.direction
      );

    const confidenceRaw =
      Number(parsed.confidence);

    const confidence =
      Number.isFinite(
        confidenceRaw
      )
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(
                confidenceRaw
              )
            )
          )
        : 0;

    const projection =
      parsed.projection ?? {};

    const structuredAnalysis: StructuredAnalysis =
      {
        direction:
          normalizedDirection,

        confidence,

        strategy:
          selectedStrategy,

        timeframe:
          selectedTimeframe,

        marketState:
          cleanString(
            parsed.marketState,
            "Market state could not be established."
          ),

        setup:
          cleanString(
            parsed.setup,
            "No reliable setup established."
          ),

        confirmedConditions:
          cleanStringArray(
            parsed.confirmedConditions
          ),

        missingConditions:
          cleanStringArray(
            parsed.missingConditions
          ),

        entry:
          cleanNumber(
            parsed.entry
          ),

        stopLoss:
          cleanNumber(
            parsed.stopLoss
          ),

        risk:
          cleanNumber(
            parsed.risk
          ),

        tp1:
          cleanNumber(
            parsed.tp1
          ),

        tp2:
          cleanNumber(
            parsed.tp2
          ),

        finalTp:
          cleanNumber(
            parsed.finalTp
          ),

        finalTpReason:
          cleanString(
            parsed.finalTpReason,
            "No valid final target established."
          ),

        invalidation:
          cleanString(
            parsed.invalidation,
            "No clear invalidation established."
          ),

        aiCoach:
          cleanString(
            parsed.aiCoach,
            "Wait for the required strategy conditions."
          ),

        projection: {
          available:
            Boolean(
              projection.available
            ),

          setupType:
            [
              "demand",
              "supply",
              "long",
              "short",
              "continuation",
              "killZone",
              "ema",
              "none",
            ].includes(
              projection.setupType
            )
              ? projection.setupType
              : "none",

          zoneLow:
            cleanNumber(
              projection.zoneLow
            ),

          zoneHigh:
            cleanNumber(
              projection.zoneHigh
            ),

          expectedEntry:
            cleanNumber(
              projection.expectedEntry
            ),

          expectedStopLoss:
            cleanNumber(
              projection.expectedStopLoss
            ),

          expectedTp1:
            cleanNumber(
              projection.expectedTp1
            ),

          expectedTp2:
            cleanNumber(
              projection.expectedTp2
            ),

          expectedFinalTp:
            cleanNumber(
              projection.expectedFinalTp
            ),

          retestRequired:
            Boolean(
              projection.retestRequired
            ),

          retestStatus:
            [
              "WAITING",
              "TESTED",
              "CONFIRMED",
              "NOT_REQUIRED",
            ].includes(
              projection.retestStatus
            )
              ? projection.retestStatus
              : "NOT_REQUIRED",

          confirmationRequired:
            cleanString(
              projection.confirmationRequired
            ),

          confirmationStatus:
            [
              "REQUIRED",
              "PENDING",
              "CONFIRMED",
              "NOT_REQUIRED",
            ].includes(
              projection.confirmationStatus
            )
              ? projection.confirmationStatus
              : "NOT_REQUIRED",
        },

        chartAnnotations:
          cleanAnnotations(
            parsed.chartAnnotations
          ),
      };


    /* ========================================================
       SAFETY / CONSISTENCY CHECKS
    ======================================================== */

    /*
     * A developing trade can have projected levels,
     * but it must not accidentally be treated as confirmed.
     */

    if (
      normalizedDirection ===
        "BUY DEVELOPING" ||
      normalizedDirection ===
        "SELL DEVELOPING"
    ) {
      structuredAnalysis.entry =
        null;

      structuredAnalysis.stopLoss =
        null;

      structuredAnalysis.risk =
        null;

      structuredAnalysis.tp1 =
        null;

      structuredAnalysis.tp2 =
        null;

      structuredAnalysis.finalTp =
        null;
    }


    /*
     * WAITING / NO TRADE cannot contain an
     * accidental confirmed execution plan.
     */

    if (
      normalizedDirection ===
        "WAITING" ||
      normalizedDirection ===
        "NO TRADE"
    ) {
      structuredAnalysis.entry =
        null;

      structuredAnalysis.stopLoss =
        null;

      structuredAnalysis.risk =
        null;

      structuredAnalysis.tp1 =
        null;

      structuredAnalysis.tp2 =
        null;

      structuredAnalysis.finalTp =
        null;
    }


    /*
     * Calculate risk again on the server
     * when a confirmed trade has valid levels.
     */

    if (
      (
        normalizedDirection ===
          "BUY" ||
        normalizedDirection ===
          "SELL"
      ) &&
      structuredAnalysis.entry !==
        null &&
      structuredAnalysis.stopLoss !==
        null
    ) {
      const calculatedRisk =
        normalizedDirection ===
          "BUY"
          ? structuredAnalysis.entry -
            structuredAnalysis.stopLoss
          : structuredAnalysis.stopLoss -
            structuredAnalysis.entry;

      structuredAnalysis.risk =
        calculatedRisk > 0
          ? calculatedRisk
          : null;
    }


    /*
     * Remove impossible confirmed targets.
     */

    if (
      normalizedDirection ===
      "BUY"
    ) {
      if (
        structuredAnalysis.tp1 !==
          null &&
        structuredAnalysis.entry !==
          null &&
        structuredAnalysis.tp1 <=
          structuredAnalysis.entry
      ) {
        structuredAnalysis.tp1 =
          null;
      }

      if (
        structuredAnalysis.tp2 !==
          null &&
        structuredAnalysis.entry !==
          null &&
        structuredAnalysis.tp2 <=
          structuredAnalysis.entry
      ) {
        structuredAnalysis.tp2 =
          null;
      }

      if (
        structuredAnalysis.finalTp !==
          null &&
        structuredAnalysis.entry !==
          null &&
        structuredAnalysis.finalTp <=
          structuredAnalysis.entry
      ) {
        structuredAnalysis.finalTp =
          null;
      }
    }


    if (
      normalizedDirection ===
      "SELL"
    ) {
      if (
        structuredAnalysis.tp1 !==
          null &&
        structuredAnalysis.entry !==
          null &&
        structuredAnalysis.tp1 >=
          structuredAnalysis.entry
      ) {
        structuredAnalysis.tp1 =
          null;
      }

      if (
        structuredAnalysis.tp2 !==
          null &&
        structuredAnalysis.entry !==
          null &&
        structuredAnalysis.tp2 >=
          structuredAnalysis.entry
      ) {
        structuredAnalysis.tp2 =
          null;
      }

      if (
        structuredAnalysis.finalTp !==
          null &&
        structuredAnalysis.entry !==
          null &&
        structuredAnalysis.finalTp >=
          structuredAnalysis.entry
      ) {
        structuredAnalysis.finalTp =
          null;
      }
    }


    /* ========================================================
       HUMAN-READABLE ANALYSIS
    ======================================================== */

    const analysis =
      buildAnalysisText(
        structuredAnalysis
      );


    /* ========================================================
       SUCCESS
    ======================================================== */

    return Response.json({
      success: true,

      strategy:
        selectedStrategy,

      timeframe:
        selectedTimeframe,

      analysis,

      tradeSignal: {
        direction:
          structuredAnalysis.direction,

        confidence:
          structuredAnalysis.confidence,

        entry:
          structuredAnalysis.entry,

        stopLoss:
          structuredAnalysis.stopLoss,

        risk:
          structuredAnalysis.risk,

        tp1:
          structuredAnalysis.tp1,

        tp2:
          structuredAnalysis.tp2,

        finalTp:
          structuredAnalysis.finalTp,

        invalidation:
          structuredAnalysis.invalidation,
      },

      projection:
        structuredAnalysis.projection,

      chartAnnotations:
        structuredAnalysis.chartAnnotations,

      marketState:
        structuredAnalysis.marketState,

      setup:
        structuredAnalysis.setup,

      confirmedConditions:
        structuredAnalysis.confirmedConditions,

      missingConditions:
        structuredAnalysis.missingConditions,

      aiCoach:
        structuredAnalysis.aiCoach,
    });


  } catch (error) {

    console.error(
      "Chart analysis error:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to analyze the chart.",
      },
      { status: 500 }
    );
  }
}

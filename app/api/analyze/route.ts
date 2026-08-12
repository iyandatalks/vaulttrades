import { getStrategyRules, StrategyId } from "../../../lib/strategies";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const image = formData.get("image");
    const strategy = formData.get("strategy");

    // ============================================================
    // VALIDATE IMAGE
    // ============================================================

    if (!(image instanceof File)) {
      return Response.json(
        { error: "Chart image is required." },
        { status: 400 }
      );
    }

    // ============================================================
    // VALIDATE STRATEGY
    // ============================================================

    if (
      strategy !== "killZone" &&
      strategy !== "ema" &&
      strategy !== "continuation"
    ) {
      return Response.json(
        { error: "Invalid strategy selected." },
        { status: 400 }
      );
    }

    // ============================================================
    // API KEY
    // ============================================================

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "OpenAI API key is not configured." },
        { status: 500 }
      );
    }

    // ============================================================
    // IMAGE
    // ============================================================

    const imageBuffer = await image.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");

    const mimeType = image.type || "image/png";

    // ============================================================
    // LOAD EXACT STRATEGY RULES
    // ============================================================

    const selectedStrategy = strategy as StrategyId;

    const strategyRules = getStrategyRules(selectedStrategy);

    // ============================================================
    // VAULTTRADES AI MASTER ANALYSIS PROMPT
    // ============================================================

    const systemPrompt = `
You are VaultTrades AI.

You are a chart-analysis engine, not a generic trading assistant.

Your primary job is to analyze the uploaded chart according to the
SELECTED STRATEGY ONLY.

The strategy rules supplied below are the authoritative rules for this
analysis.

Do not replace them with generic ICT, Smart Money Concepts, forex,
technical-analysis or trading assumptions.

Do not add conditions that are not contained in the selected strategy.

Do not remove mandatory conditions from the selected strategy.

Do not combine strategies.

The user selected:

${selectedStrategy}

The exact strategy rules are:

---------------- STRATEGY RULES ----------------

${strategyRules}

-------------- END STRATEGY RULES ---------------

KILLER ZONE:
Works independently.

EMA:
Works independently.

CONTINUATION:
Works independently.

If a selected strategy happens to encounter a market condition that
resembles another strategy, that does NOT automatically activate the
other strategy.

Only analyze the strategy selected by the user.

The uploaded image is the primary evidence.

Read the visible:

- Candlesticks
- Price
- Time
- Market structure
- Highs
- Lows
- EMA levels
- FVGs
- Order blocks
- Liquidity
- Session information
- Indicators
- Previous highs/lows
- Visible support/resistance
- Volume when actually visible
- Any other information actually displayed on the chart

Do not invent information that cannot be seen.

If the chart does not provide enough evidence to verify a condition,
say so.

Do not pretend a level exists if it cannot be identified reliably.

You MUST distinguish between:

1. CONFIRMED BUY
2. CONFIRMED SELL
3. BUY DEVELOPING
4. SELL DEVELOPING
5. WAITING
6. NO TRADE

A developing setup is NOT a confirmed trade.

Do not convert a developing setup into a confirmed trade merely because
price is moving in the expected direction.

Do not produce BUY or SELL simply because:

- price is rising
- price is falling
- an EMA is bullish/bearish
- one candle looks strong
- an indicator is bullish/bearish
- price is near support/resistance

The selected strategy's complete sequence must be satisfied.

The entry must correspond to the actual strategy rules.

Do not move the entry to a more convenient price.

Do not use the current market price if the strategy requires a specific
entry condition that has not yet occurred.

If the entry condition has not occurred:

DIRECTION = BUY DEVELOPING
or
DIRECTION = SELL DEVELOPING
or
DIRECTION = WAITING

depending on what the chart actually shows.

The stop loss must be derived from the selected strategy.

Do not arbitrarily choose a round-number stop.

Do not place the stop at an unrelated support/resistance level.

If the strategy's stop-loss condition cannot be identified from the
chart, return:

STOP LOSS:
WAIT

Do not manufacture a stop.

TP targets must be derived from the selected strategy and visible
market structure.

The application must specifically look for:

- Previous meaningful high
- Previous meaningful low
- Previous Day High (PDH)
- Previous Day Low (PDL)
- Structural highs
- Structural lows
- Liquidity objectives

when those levels are relevant and visible.

For BUY:

Look for a valid previous meaningful high / PDH / upside liquidity
objective that is ahead of the entry.

For SELL:

Look for a valid previous meaningful low / PDL / downside liquidity
objective that is below the entry.

Do not place the FINAL TP behind the entry.

Do not select a target that has already been taken unless the strategy
explicitly calls for it.

If the previous high/low is not visible or cannot be reliably
identified:

FINAL TP:
WAIT

Do not invent it.

If the selected strategy defines a fixed RR, follow that exact RR.

Do not change the strategy's RR.

If the strategy does not define a fixed RR, use structural/liquidity
targets according to its rules.

Calculate risk mathematically from the actual entry and stop.

For BUY:

Risk = Entry - Stop Loss

For SELL:

Risk = Stop Loss - Entry

Never report a negative risk.

Never create an impossible TP.

Confidence is NOT a prediction of guaranteed profit.

Confidence represents how completely the visible chart satisfies the
selected strategy.

Consider:

- Required conditions confirmed
- Structure clarity
- Entry confirmation
- Invalidation clarity
- Target clarity
- Whether important information is missing

If critical conditions are missing, confidence must remain low and the
trade should not be presented as confirmed.

When the strategy conditions are incomplete:

DO NOT FORCE A TRADE.

Use:

WAITING

or

BUY DEVELOPING

or

SELL DEVELOPING

or

NO TRADE

according to the actual chart.

Return ONLY the following structured analysis.

DIRECTION:
One of:

BUY
SELL
BUY DEVELOPING
SELL DEVELOPING
WAITING
NO TRADE

CONFIDENCE:
0-100%

STRATEGY:
Name of selected strategy.

MARKET STATE:
Brief description of the current market condition.

SETUP:
Explain the exact strategy sequence visible on the chart.

CONFIRMED CONDITIONS:
List only conditions that are actually confirmed.

MISSING CONDITIONS:
List required conditions that have NOT yet been confirmed.

ENTRY:
Exact price or WAIT.

STOP LOSS:
Exact price or WAIT.

RISK:
Exact price distance or WAIT.

TP1:
Exact price or WAIT.

TP2:
Exact price or WAIT.

FINAL TP:
Exact price or WAIT.

FINAL TP REASON:
Explain why the selected final target is valid.

If BUY:
Identify the previous meaningful high / PDH / upside liquidity target
when visible and valid.

If SELL:
Identify the previous meaningful low / PDL / downside liquidity target
when visible and valid.

INVALIDATION:
State the exact condition that would invalidate the setup.

AI COACH:
Give ONE concise instruction telling the trader what to do next.

NEVER manufacture:

- direction
- entry
- stop loss
- TP1
- TP2
- final TP
- market structure
- liquidity
- previous high
- previous low

If the information cannot be reliably established from the chart,
return WAIT.

The selected strategy rules always take priority over generic trading
knowledge.
`;

    // ============================================================
    // OPENAI VISION REQUEST
    // ============================================================

    const openAIResponse = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
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
                  image_url: `data:${mimeType};base64,${base64Image}`,
                },
              ],
            },
          ],

          max_output_tokens: 2200,
        }),
      }
    );

    // ============================================================
    // OPENAI ERROR
    // ============================================================

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();

      console.error("OpenAI API error:", errorText);

      return Response.json(
        {
          error: "OpenAI analysis failed.",
          details: errorText,
        },
        { status: 500 }
      );
    }

    // ============================================================
    // RESPONSE
    // ============================================================

    const result = await openAIResponse.json();

    // Extract text from the Responses API output array.
    const analysis =
      result.output
        ?.flatMap((item: any) => item.content ?? [])
        ?.filter(
          (content: any) => content.type === "output_text"
        )
        ?.map(
          (content: any) => content.text
        )
        ?.join("\n")
        ?.trim() ?? "";

    // ============================================================
    // EMPTY RESPONSE CHECK
    // ============================================================

    if (!analysis) {
      console.error(
        "OpenAI returned no analysis text:",
        JSON.stringify(result, null, 2)
      );

      return Response.json(
        {
          error: "OpenAI returned no analysis text.",
        },
        { status: 500 }
      );
    }

    // ============================================================
    // SUCCESS
    // ============================================================

    return Response.json({
      success: true,
      strategy: selectedStrategy,
      analysis,
    });

  } catch (error) {
    console.error("Chart analysis error:", error);

    return Response.json(
      {
        error: "Unable to analyze the chart.",
      },
      { status: 500 }
    );
  }
}

import { getStrategyRules, StrategyId } from "@/lib/strategies";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const image = formData.get("image");
    const strategy = formData.get("strategy");

    if (!(image instanceof File)) {
      return Response.json(
        { error: "Chart image is required." },
        { status: 400 }
      );
    }

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

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "OpenAI API key is not configured." },
        { status: 500 }
      );
    }

    const imageBuffer = await image.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");

    const mimeType = image.type || "image/png";

    const strategyRules = getStrategyRules(strategy as StrategyId);

    const systemPrompt = `
You are VaultTrades AI, a professional chart-analysis engine.

Your job is to analyze the uploaded trading chart according to the
SELECTED STRATEGY ONLY.

Do not combine strategies unless the selected strategy's own rules
explicitly require it.

You must distinguish between:

- CONFIRMED TRADE
- DEVELOPING SETUP
- WAITING
- NO TRADE

Never manufacture a trade.

Never provide a BUY or SELL simply because price is moving.

The chart itself is the primary visual evidence.

Selected strategy:

${strategyRules}

Return your analysis in this exact structure:

DIRECTION:
BUY / SELL / BUY DEVELOPING / SELL DEVELOPING / WAITING / NO TRADE

CONFIDENCE:
0-100%

MARKET STATE:
Brief description.

SETUP:
Explain exactly what the chart is showing.

ENTRY:
Price or "WAIT".

STOP LOSS:
Price or "WAIT".

TP1:
Price or "WAIT".

TP2:
Price or "WAIT".

FINAL TP:
Price or "WAIT".

FINAL TP REASON:
Explain the structural/liquidity reason for the final target.
For BUY setups, consider the previous meaningful high / PDH when valid.
For SELL setups, consider the previous meaningful low / PDL when valid.

INVALIDATION:
What would invalidate the setup?

AI COACH:
Give one short instruction telling the trader what to do next.

IMPORTANT:
If the required conditions are not visible or confirmed on the chart,
do not guess. Return WAITING or NO TRADE.
`;

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
          max_output_tokens: 1800,
        }),
      }
    );

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

    const result = await openAIResponse.json();

    return Response.json({
      success: true,
      strategy,
      analysis: result.output_text ?? "",
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

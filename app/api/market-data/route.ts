import { getTwelveDataTimeSeries } from "../../../lib/market-data/twelvedata";
import { buildAnalyzerMarketContext } from "../../../lib/market-data/indicators";

export const runtime = "nodejs";

const DEFAULT_INDICATORS = ["EMA", "ATR", "ADX", "RVOL", "VWAP"];

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const symbol = url.searchParams.get("symbol") || "";
    const timeframe = url.searchParams.get("timeframe") || "";
    const outputsize = Number(url.searchParams.get("outputsize") || 120);
    const selectedIndicators = (url.searchParams.get("indicators") || DEFAULT_INDICATORS.join(","))
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (!symbol) return Response.json({ error: "symbol is required." }, { status: 400 });
    if (!timeframe) return Response.json({ error: "timeframe is required." }, { status: 400 });

    const data = await getTwelveDataTimeSeries({
      symbol,
      timeframe,
      outputsize: Number.isFinite(outputsize) ? outputsize : 120,
    });
    const analysis = buildAnalyzerMarketContext(
      data.candles,
      data.symbol,
      timeframe,
      selectedIndicators,
    );

    return Response.json({
      success: true,
      data,
      analysis,
      source: "Twelve Data",
      indicatorPolicy: "Strategy-specific; indicator count is not capped at three.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load market data.";
    console.error("Market data error", error);
    return Response.json({ error: message }, { status: 502 });
  }
}

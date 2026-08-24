import { getTwelveDataTimeSeries } from "../../../lib/market-data/twelvedata";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const symbol = url.searchParams.get("symbol") || "";
    const timeframe = url.searchParams.get("timeframe") || "";
    const outputsize = Number(url.searchParams.get("outputsize") || 120);

    if (!symbol) {
      return Response.json({ error: "symbol is required." }, { status: 400 });
    }

    if (!timeframe) {
      return Response.json({ error: "timeframe is required." }, { status: 400 });
    }

    const data = await getTwelveDataTimeSeries({
      symbol,
      timeframe,
      outputsize: Number.isFinite(outputsize) ? outputsize : 120,
    });

    return Response.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load market data.";
    console.error("Market data error", error);
    return Response.json({ error: message }, { status: 502 });
  }
}

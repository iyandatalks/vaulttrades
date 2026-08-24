import { getTwelveDataInstruments } from "../../../lib/market-data/twelvedata";

export const runtime = "nodejs";

const SUPPORTED = ["FOREX", "INDICES", "CRYPTO", "STOCKS"] as const;
type SupportedMarket = (typeof SUPPORTED)[number];

export async function GET(request: Request) {
  try {
    const market = new URL(request.url).searchParams.get("market")?.toUpperCase();
    if (!SUPPORTED.includes(market as SupportedMarket)) {
      return Response.json({ error: "Unsupported market selection." }, { status: 400 });
    }

    const instruments = await getTwelveDataInstruments(market as SupportedMarket);
    return Response.json({ instruments });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "Unable to load market instruments.",
    }, { status: 502 });
  }
}

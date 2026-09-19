import { createClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = Math.min(Math.max(Number(searchParams.get("days") || "5"), 1), 30);
    const strategy = searchParams.get("strategy");
    const timeframe = searchParams.get("timeframe");
    const symbol = searchParams.get("symbol");

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from("scanner_signals")
      .select("id,trade_id,market_category,canonical_symbol,direction,strategy_id,strategy_name,timeframe,entry,stop_loss,tp1,tp2,tp3,tp4,tp5,confirmation_timeframe,entry_quality,confidence,rr,status,confirmation_conditions,missing_conditions,execution_payload,source_snapshot,fired_at,created_at,updated_at,completed_at")
      .eq("auth_user_id", user.id)
      .gte("fired_at", cutoff)
      .order("fired_at", { ascending: false })
      .limit(1000);

    if (strategy) query = query.eq("strategy_id", strategy);
    if (timeframe) query = query.eq("timeframe", timeframe.toUpperCase());
    if (symbol) query = query.eq("canonical_symbol", symbol.toUpperCase().replace("/", ""));

    const { data, error } = await query;
    if (error) {
      console.error("Signal history query failed", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({
      ok: true,
      days,
      from: cutoff,
      to: new Date().toISOString(),
      count: data?.length ?? 0,
      signals: data ?? [],
    });
  } catch (error) {
    console.error("Signal history error", error);
    return Response.json({ error: "Unable to load signal history." }, { status: 500 });
  }
}

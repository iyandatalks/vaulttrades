import { createClient } from "../../../lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") || "").trim().toUpperCase();
  const strategy = (url.searchParams.get("strategy") || "").trim();

  let query = supabase.from("scanner_setup_history")
    .select("id,setup_key,strategy_id,strategy_name,market_category,canonical_symbol,timeframe,direction,projected_entry,projected_stop_loss,projected_tp1,projected_tp2,projected_tp3,projected_tp4,state,confirmation_conditions,missing_conditions,reason,first_seen_at,last_seen_at,confirmed_at,completed_at,outcome")
    .eq("auth_user_id", user.id)
    .order("last_seen_at", { ascending: false })
    .limit(100);

  if (symbol) query = query.eq("canonical_symbol", symbol);
  if (strategy) query = query.eq("strategy_id", strategy);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ setups: data ?? [] });
}

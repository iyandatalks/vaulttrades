import { createClient } from "../../../../lib/supabase/server";
import { createServiceClient } from "../../../../lib/supabase/service";

export const runtime = "nodejs";

const ALLOWED_STRATEGIES = new Set(["autoFibRetrace"]);
const SUPPORTED_STRATEGIES = [
  { id: "autoFibRetrace", name: "Vault Auto Fib Retrace + TP Ladder" },
] as const;

type ConfigPatch = { enabled?: boolean; observe_mode?: boolean; forex_enabled?: boolean; crypto_enabled?: boolean; enabled_strategies?: string[] };

export async function GET() {
  const auth = await createClient(); const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  const service = createServiceClient();
  const { data, error } = await service.schema("scanner_automation").from("configs").select("auth_user_id,enabled,observe_mode,forex_enabled,crypto_enabled,enabled_strategies,trade_time_start,trade_time_end,timezone,created_at,updated_at").eq("auth_user_id", user.id).maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({
    config: data ?? { auth_user_id: user.id, enabled: false, observe_mode: true, forex_enabled: true, crypto_enabled: false, enabled_strategies: ["autoFibRetrace"], trade_time_start: "00:00:00", trade_time_end: "23:59:59", timezone: "Africa/Johannesburg" },
    supportedStrategies: SUPPORTED_STRATEGIES,
  });
}

export async function PATCH(request: Request) {
  const auth = await createClient(); const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => null) as ConfigPatch | null;
  if (!body || typeof body !== "object") return Response.json({ error: "A configuration object is required." }, { status: 400 });
  const updates: Record<string, unknown> = {};
  for (const key of ["enabled", "observe_mode", "forex_enabled", "crypto_enabled"] as const) {
    if (body[key] !== undefined) { if (typeof body[key] !== "boolean") return Response.json({ error: `${key} must be boolean.` }, { status: 400 }); updates[key] = body[key]; }
  }
  if (body.enabled_strategies !== undefined) {
    if (!Array.isArray(body.enabled_strategies) || body.enabled_strategies.some((strategy) => typeof strategy !== "string" || !ALLOWED_STRATEGIES.has(strategy))) return Response.json({ error: "Only Vault Auto Fib Retrace + TP Ladder can currently be automated." }, { status: 400 });
    updates.enabled_strategies = [...new Set(body.enabled_strategies)];
  }
  if (!Object.keys(updates).length) return Response.json({ error: "No supported configuration changes were supplied." }, { status: 400 });
  const service = createServiceClient();
  const { data, error } = await service.schema("scanner_automation").from("configs").upsert({ auth_user_id: user.id, ...updates, trade_time_start: "00:00:00", trade_time_end: "23:59:59", timezone: "Africa/Johannesburg" }, { onConflict: "auth_user_id" }).select("auth_user_id,enabled,observe_mode,forex_enabled,crypto_enabled,enabled_strategies,trade_time_start,trade_time_end,timezone,created_at,updated_at").single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ config: data });
}

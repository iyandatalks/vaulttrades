import { createClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";

const AUTO_FIB_STRATEGY = "autoFibRetrace";
const SUPPORTED_STRATEGIES = [
  { id: AUTO_FIB_STRATEGY, name: "Vault Auto Fib Retrace + TP Ladder" },
] as const;

type ConfigPatch = { enabled?: boolean; observe_mode?: boolean; forex_enabled?: boolean; crypto_enabled?: boolean; enabled_strategies?: string[] };

export async function GET() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { data, error } = await auth.rpc("provision_scanner_automation_config", { p_auth_user_id: user.id });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const config = Array.isArray(data) ? data[0] : data;
  return Response.json({ config, supportedStrategies: SUPPORTED_STRATEGIES });
}

export async function PATCH(request: Request) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => null) as ConfigPatch | null;
  if (!body || typeof body !== "object") return Response.json({ error: "A configuration object is required." }, { status: 400 });

  const bool = (value: unknown, name: string) => {
    if (value !== undefined && typeof value !== "boolean") throw new Error(`${name} must be boolean.`);
  };
  try {
    bool(body.enabled, "enabled");
    bool(body.observe_mode, "observe_mode");
    bool(body.forex_enabled, "forex_enabled");
    bool(body.crypto_enabled, "crypto_enabled");
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }

  if (body.enabled_strategies !== undefined && (!Array.isArray(body.enabled_strategies) || body.enabled_strategies.some((strategy) => strategy !== AUTO_FIB_STRATEGY))) {
    return Response.json({ error: "Only Vault Auto Fib Retrace + TP Ladder can currently be automated." }, { status: 400 });
  }
  if (body.enabled === true && body.enabled_strategies !== undefined && body.enabled_strategies.length === 0) {
    return Response.json({ error: "At least one supported strategy must be enabled when scanner automation is enabled." }, { status: 400 });
  }
  if (body.enabled === true && body.forex_enabled === false && body.crypto_enabled === false) {
    return Response.json({ error: "Enable at least one market category before enabling scanner automation." }, { status: 400 });
  }

  const { data, error } = await auth.rpc("update_scanner_automation_config", {
    p_auth_user_id: user.id,
    p_enabled: body.enabled ?? null,
    p_observe_mode: body.observe_mode ?? null,
    p_forex_enabled: body.forex_enabled ?? null,
    p_crypto_enabled: body.crypto_enabled ?? null,
    p_enabled_strategies: body.enabled_strategies ?? null,
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const config = Array.isArray(data) ? data[0] : data;
  return Response.json({ config });
}

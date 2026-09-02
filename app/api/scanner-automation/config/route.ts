import { createClient } from "../../../../lib/supabase/server";
import { createServiceClient } from "../../../../lib/supabase/service";

export const runtime = "nodejs";

const AUTO_FIB_STRATEGY = "autoFibRetrace";
const ALLOWED_STRATEGIES = new Set([AUTO_FIB_STRATEGY]);
const SUPPORTED_STRATEGIES = [
  { id: AUTO_FIB_STRATEGY, name: "Vault Auto Fib Retrace + TP Ladder" },
] as const;

type ConfigPatch = { enabled?: boolean; observe_mode?: boolean; forex_enabled?: boolean; crypto_enabled?: boolean; enabled_strategies?: string[] };

const CONFIG_SELECT = "auth_user_id,enabled,observe_mode,forex_enabled,crypto_enabled,enabled_strategies,trade_time_start,trade_time_end,timezone,created_at,updated_at";

function defaultConfig(userId: string) {
  return {
    auth_user_id: userId,
    enabled: false,
    observe_mode: true,
    forex_enabled: true,
    crypto_enabled: false,
    enabled_strategies: [AUTO_FIB_STRATEGY],
    trade_time_start: "00:00:00",
    trade_time_end: "23:59:59",
    timezone: "Africa/Johannesburg",
  };
}

export async function GET() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const service = createServiceClient();
  const configs = service.schema("scanner_automation").from("configs");
  const { data, error } = await configs.select(CONFIG_SELECT).eq("auth_user_id", user.id).maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Provision the per-user scheduler configuration on first access. This keeps
  // the automation runner fully database-driven without silently enabling it.
  if (!data) {
    const { data: created, error: createError } = await configs
      .insert(defaultConfig(user.id))
      .select(CONFIG_SELECT)
      .single();

    if (!createError && created) {
      return Response.json({ config: created, supportedStrategies: SUPPORTED_STRATEGIES });
    }

    // Another request may have provisioned the row concurrently. Re-read it
    // rather than treating a harmless unique-key race as a configuration error.
    const { data: existing, error: rereadError } = await service
      .schema("scanner_automation")
      .from("configs")
      .select(CONFIG_SELECT)
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (rereadError || !existing) {
      return Response.json({ error: createError?.message ?? rereadError?.message ?? "Unable to provision scanner automation configuration." }, { status: 500 });
    }

    return Response.json({ config: existing, supportedStrategies: SUPPORTED_STRATEGIES });
  }

  return Response.json({ config: data, supportedStrategies: SUPPORTED_STRATEGIES });
}

export async function PATCH(request: Request) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => null) as ConfigPatch | null;
  if (!body || typeof body !== "object") return Response.json({ error: "A configuration object is required." }, { status: 400 });

  const updates: Record<string, unknown> = {};
  for (const key of ["enabled", "observe_mode", "forex_enabled", "crypto_enabled"] as const) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== "boolean") return Response.json({ error: `${key} must be boolean.` }, { status: 400 });
      updates[key] = body[key];
    }
  }

  if (body.enabled_strategies !== undefined) {
    if (!Array.isArray(body.enabled_strategies) || body.enabled_strategies.some((strategy) => typeof strategy !== "string" || !ALLOWED_STRATEGIES.has(strategy))) {
      return Response.json({ error: "Only Vault Auto Fib Retrace + TP Ladder can currently be automated." }, { status: 400 });
    }
    const strategies = [...new Set(body.enabled_strategies)];
    if (body.enabled === true && strategies.length === 0) return Response.json({ error: "At least one supported strategy must be enabled when scanner automation is enabled." }, { status: 400 });
    updates.enabled_strategies = strategies;
  } else if (body.enabled === true) {
    // A newly created enabled config must be schedulable immediately.
    updates.enabled_strategies = [AUTO_FIB_STRATEGY];
  }

  if (body.enabled === true && body.forex_enabled === false && body.crypto_enabled === false) {
    return Response.json({ error: "Enable at least one market category before enabling scanner automation." }, { status: 400 });
  }
  if (!Object.keys(updates).length) return Response.json({ error: "No supported configuration changes were supplied." }, { status: 400 });

  const service = createServiceClient();
  const { data, error } = await service.schema("scanner_automation").from("configs").upsert({
    auth_user_id: user.id,
    ...updates,
    trade_time_start: "00:00:00",
    trade_time_end: "23:59:59",
    timezone: "Africa/Johannesburg",
  }, { onConflict: "auth_user_id" }).select(CONFIG_SELECT).single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ config: data });
}

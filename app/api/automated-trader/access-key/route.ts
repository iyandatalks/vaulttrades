import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

function makeAccessKey() {
  return `VT-MT5-${randomBytes(24).toString("hex").toUpperCase()}`;
}

async function getUserContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: appUser, error: appUserError } = await admin
    .from("users")
    .select("id,role,is_active,license_expires_at")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (appUserError) throw appUserError;

  const [{ data: subscription, error: subscriptionError }, { data: feature, error: featureError }] = await Promise.all([
    admin
      .from("automated_trader_subscriptions")
      .select("status,current_period_end")
      .eq("auth_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("user_feature_access")
      .select("status,start_at,end_at")
      .eq("user_id", appUser?.id ?? "00000000-0000-0000-0000-000000000000")
      .eq("feature_code", "automation")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (subscriptionError) throw subscriptionError;
  if (featureError) throw featureError;

  const subscriptionActive = subscription?.status === "active" &&
    (!subscription.current_period_end || new Date(subscription.current_period_end).getTime() > Date.now());
  const featureActive = feature?.status === "active" &&
    (!feature.start_at || new Date(feature.start_at).getTime() <= Date.now()) &&
    (!feature.end_at || new Date(feature.end_at).getTime() > Date.now());
  const adminActive = appUser?.role === "admin" && appUser.is_active !== false;

  return { user, appUser, admin, subscriptionActive, featureActive, adminActive, subscription, feature };
}

export async function GET() {
  try {
    const context = await getUserContext();
    if (!context || !context.appUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!context.subscriptionActive && !context.featureActive && !context.adminActive) {
      return NextResponse.json({ error: "Automated Trader access is not active" }, { status: 403 });
    }

    const { data: license, error } = await context.admin
      .from("product_licenses")
      .select("id,status,start_at,end_at,access_key,platform,mt_login,broker_name,broker_server,purchased_product_code,entitlement_code,updated_at")
      .eq("user_id", context.appUser.id)
      .eq("entitlement_code", "automation")
      .eq("platform", "mt5")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({
      ok: true,
      active: Boolean(license && license.status === "active" && (!license.end_at || new Date(license.end_at).getTime() > Date.now())),
      license: license ?? null,
      access_source: context.adminActive ? "admin" : context.subscriptionActive ? "subscription" : "feature_grant"
    });
  } catch (error) {
    console.error("Automated Trader access-key GET error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load VaultTrades access key" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const context = await getUserContext();
    if (!context || !context.appUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!context.subscriptionActive && !context.featureActive && !context.adminActive) {
      return NextResponse.json({ error: "Automated Trader access is not active" }, { status: 403 });
    }

    const { data: account } = await context.admin
      .from("automated_trader_accounts")
      .select("mt_login,broker_name,broker_server,is_execution_account,status")
      .eq("auth_user_id", context.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const endAt = context.feature?.end_at ?? context.subscription?.current_period_end ?? context.appUser.license_expires_at ?? null;
    const accessKey = makeAccessKey();
    const { data: existing } = await context.admin
      .from("product_licenses")
      .select("id")
      .eq("user_id", context.appUser.id)
      .eq("entitlement_code", "automation")
      .eq("platform", "mt5")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const payload = {
      user_id: context.appUser.id,
      email: context.user.email ?? null,
      purchased_product_code: "automated_trader_m15",
      entitlement_code: "automation",
      status: "active",
      start_at: new Date().toISOString(),
      end_at: endAt,
      access_key: accessKey,
      platform: "mt5",
      mt_login: account?.mt_login ?? null,
      broker_name: account?.broker_name ?? null,
      broker_server: account?.broker_server ?? null,
      approved_by: "automated-trader-access",
      source_payment_snapshot: {
        source: context.adminActive ? "admin" : context.subscriptionActive ? "automated_trader_subscription" : "user_feature_access",
        account_status: account?.status ?? null,
        is_execution_account: account?.is_execution_account ?? false
      },
      updated_at: new Date().toISOString()
    };

    const result = existing
      ? await context.admin
          .from("product_licenses")
          .update(payload)
          .eq("id", existing.id)
          .select("id,status,start_at,end_at,access_key,platform,mt_login,broker_name,broker_server,purchased_product_code,entitlement_code,updated_at")
          .single()
      : await context.admin
          .from("product_licenses")
          .insert(payload)
          .select("id,status,start_at,end_at,access_key,platform,mt_login,broker_name,broker_server,purchased_product_code,entitlement_code,updated_at")
          .single();

    if (result.error) throw result.error;
    return NextResponse.json({ ok: true, regenerated: Boolean(existing), license: result.data });
  } catch (error) {
    console.error("Automated Trader access-key POST error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate VaultTrades access key" }, { status: 500 });
  }
}

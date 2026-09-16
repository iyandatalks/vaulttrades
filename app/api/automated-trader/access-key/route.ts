import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

function makeAccessKey() {
  return `VT-MT5-${randomBytes(24).toString("hex").toUpperCase()}`;
}

async function getAdminContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: appUser, error } = await admin
    .from("users")
    .select("id,email,role,is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!appUser || appUser.role !== "admin" || appUser.is_active === false) return null;
  return { user, appUser, admin };
}

export async function GET() {
  try {
    const context = await getAdminContext();
    if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: licenses, error } = await context.admin
      .from("product_licenses")
      .select("id,user_id,email,status,start_at,end_at,access_key,platform,mt_login,broker_name,broker_server,purchased_product_code,entitlement_code,updated_at,created_at")
      .eq("entitlement_code", "automation")
      .eq("platform", "mt5")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;

    return NextResponse.json({ ok: true, licenses: licenses ?? [] });
  } catch (error) {
    console.error("Admin MT5 access-key GET error", error);
    return NextResponse.json({ error: "Unable to load MT5 execution licenses." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const context = await getAdminContext();
    if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const userId = typeof body.user_id === "string" ? body.user_id : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!userId && !email) return NextResponse.json({ error: "Customer user_id or email is required." }, { status: 400 });

    let query = context.admin.from("users").select("id,email,auth_user_id,is_active");
    const { data: customer, error: customerError } = userId
      ? await query.eq("id", userId).maybeSingle()
      : await query.eq("email", email).maybeSingle();
    if (customerError) throw customerError;
    if (!customer) return NextResponse.json({ error: "Customer profile was not found." }, { status: 404 });

    const { data: account } = await context.admin
      .from("automated_trader_accounts")
      .select("mt_login,broker_name,broker_server,is_execution_account,status")
      .eq("auth_user_id", customer.auth_user_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: existing } = await context.admin
      .from("product_licenses")
      .select("id")
      .eq("user_id", customer.id)
      .eq("entitlement_code", "automation")
      .eq("platform", "mt5")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const accessKey = makeAccessKey();
    const now = new Date().toISOString();
    const payload = {
      user_id: customer.id,
      email: customer.email ?? null,
      purchased_product_code: "automated_trader_m15",
      entitlement_code: "automation",
      status: "active",
      start_at: now,
      access_key: accessKey,
      platform: "mt5",
      mt_login: account?.mt_login ?? null,
      broker_name: account?.broker_name ?? null,
      broker_server: account?.broker_server ?? null,
      approved_by: context.user.email ?? "admin",
      source_payment_snapshot: {
        source: "admin_mt5_provisioning",
        account_status: account?.status ?? null,
        is_execution_account: account?.is_execution_account ?? false
      },
      updated_at: now
    };

    const result = existing
      ? await context.admin.from("product_licenses").update(payload).eq("id", existing.id).select("id,user_id,email,status,start_at,end_at,access_key,platform,mt_login,broker_name,broker_server,purchased_product_code,entitlement_code,updated_at").single()
      : await context.admin.from("product_licenses").insert(payload).select("id,user_id,email,status,start_at,end_at,access_key,platform,mt_login,broker_name,broker_server,purchased_product_code,entitlement_code,updated_at").single();
    if (result.error) throw result.error;

    return NextResponse.json({ ok: true, regenerated: Boolean(existing), license: result.data });
  } catch (error) {
    console.error("Admin MT5 access-key POST error", error);
    return NextResponse.json({ error: "Unable to provision MT5 access key." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { revokeFollowerAccess } from "@/lib/copy-access";

export const runtime = "nodejs";

const PRODUCTS = {
  analyzer: { name: "Analyzer", productCode: "analyzer_monthly", platform: "web" },
  copy_trading: { name: "Copy Trading", productCode: "automated_trader_monthly", platform: "mt5" },
  founders_mentorship: { name: "Founders Mentorship", productCode: "founders_mentorship_once", platform: "web" },
} as const;

type ProductCode = keyof typeof PRODUCTS;

async function ensureAppUser(db: any, authAdmin: any, email: string) {
  const { data: existing } = await db.from("users").select("id,auth_user_id,email,role").eq("email", email).maybeSingle();
  if (existing) return existing;

  const { data: listed, error: authError } = await authAdmin.listUsers({ page: 1, perPage: 1000 });
  if (authError) throw new Error("AUTH_USER_LOOKUP_FAILED");
  const authUser = (listed?.users || []).find((u: any) => String(u.email || "").trim().toLowerCase() === email);
  if (!authUser) return null;

  const { data: created, error: createError } = await db
    .from("users")
    .insert({
      email,
      auth_user_id: authUser.id,
      role: "user",
      payment_method: "manual",
      is_active: true,
      created_at: new Date().toISOString(),
    })
    .select("id,auth_user_id,email,role")
    .single();

  if (!createError && created) return created;

  const { data: recovered } = await db.from("users").select("id,auth_user_id,email,role").eq("auth_user_id", authUser.id).maybeSingle();
  if (recovered) return recovered;
  throw new Error("APP_USER_PROFILE_CREATE_FAILED");
}

async function requireAdmin() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }) };
  const db = createServiceClient();
  const { data: profile } = await db.from("users").select("id,email,role").eq("auth_user_id", user.id).maybeSingle();
  if (profile?.role !== "admin") return { error: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
  return { user, profile, db };
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { db, user } = auth;
  const authAdmin = db.auth.admin;
  const url = new URL(request.url);
  const email = String(url.searchParams.get("email") || "").trim().toLowerCase();

  if (!email) return NextResponse.json({ users: [] });

  let { data: users, error } = await db
    .from("users")
    .select("id,auth_user_id,email,role")
    .ilike("email", `%${email}%`)
    .order("email")
    .limit(20);

  if (error) return NextResponse.json({ error: "USER_SEARCH_FAILED" }, { status: 500 });

  // Some legacy/auth-only customers predate creation of public.users.
  // Resolve the Auth user and backfill the application profile so admin
  // product access can be granted without manual database intervention.
  if (!(users || []).length) {
    const exactEmail = email;
    try {
      const recovered = await ensureAppUser(db, authAdmin, exactEmail);
      if (recovered) users = [recovered];
    } catch (e) {
      console.error("Unable to backfill missing VaultTrades user profile", e);
      return NextResponse.json({ error: "USER_PROFILE_SYNC_FAILED" }, { status: 500 });
    }
  }

  const ids = (users || []).map(u => u.id);
  const { data: licenses } = ids.length
    ? await db.from("product_licenses")
        .select("id,user_id,purchased_product_code,entitlement_code,status,start_at,end_at,mt_login,approved_by,updated_at,source_payment_snapshot")
        .in("user_id", ids)
        .order("updated_at", { ascending: false })
    : { data: [] };

  return NextResponse.json({
    users: (users || []).map(user => ({
      ...user,
      products: Object.fromEntries(
        Object.keys(PRODUCTS).map(code => {
          const rows = (licenses || []).filter(l => l.user_id === user.id && l.entitlement_code === code);
          const manual = rows.find(l => l.source_payment_snapshot?.source === "admin_manual_grant") || null;
          const automatic = rows.find(l => l.source_payment_snapshot?.source !== "admin_manual_grant") || null;
          return [code, { manual, automatic }];
        })
      ),
    })),
    productCatalog: PRODUCTS,
  });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { user, db } = auth;
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const product = String(body.product || "") as ProductCode;
  const action = String(body.action || "");
  const mt5Login = String(body.mt5Login || "").trim();
  const durationDays = Number(body.durationDays);

  if (!email || !(product in PRODUCTS) || !["grant", "deactivate"].includes(action)) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  let { data: target } = await db.from("users").select("id,auth_user_id,email").eq("email", email).maybeSingle();
  if (!target) {
    try {
      target = await ensureAppUser(db, authAdmin, email);
    } catch (e) {
      console.error("Unable to backfill missing VaultTrades user profile", e);
      return NextResponse.json({ error: "USER_PROFILE_SYNC_FAILED" }, { status: 500 });
    }
  }
  if (!target) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });

  const catalog = PRODUCTS[product];
  const now = new Date();
  const nowIso = now.toISOString();

  if (action === "deactivate") {
    const { data: manualLicenses } = await db.from("product_licenses")
      .select("id,start_at")
      .eq("user_id", target.id)
      .eq("entitlement_code", product)
      .eq("status", "active")
      .contains("source_payment_snapshot", { source: "admin_manual_grant" });

    if (manualLicenses?.length) {
      await db.from("product_licenses").update({
        status: "revoked",
        end_at: nowIso,
        approved_by: user.id,
        updated_at: nowIso,
      }).in("id", manualLicenses.map(x => x.id));

      for (const license of manualLicenses) {
        await db.from("user_feature_access").update({
          status: "revoked",
          end_at: nowIso,
          granted_by: user.id,
          grant_reason: "Manual admin deactivation",
          updated_at: nowIso,
        }).eq("user_id", target.id).eq("feature_code", product).eq("start_at", license.start_at);
      }
    }

    if (product === "copy_trading" && target.auth_user_id) {
      const { data: followers } = await db.from("copy_followers").select("id").eq("auth_user_id", target.auth_user_id);
      for (const follower of followers || []) await revokeFollowerAccess(follower.id, "disabled");
      await db.from("copy_pairing_codes").update({ revoked_at: nowIso }).eq("auth_user_id", target.auth_user_id).is("revoked_at", null);
    }

    return NextResponse.json({ ok: true, message: `${catalog.name} deactivated for ${email}.` });
  }

  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650) {
    return NextResponse.json({ error: "INVALID_DURATION_DAYS", message: "Manual access must be granted for 1 to 3650 days." }, { status: 400 });
  }

  if (product === "copy_trading" && !/^\d{4,12}$/.test(mt5Login)) {
    return NextResponse.json({ error: "MT5_LOGIN_REQUIRED" }, { status: 400 });
  }

  const end = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

  const { error: licenseError } = await db.from("product_licenses").insert({
    user_id: target.id,
    email: target.email,
    purchased_product_code: catalog.productCode,
    entitlement_code: product,
    status: "active",
    payment_reference: `admin:${user.id}:${crypto.randomUUID()}`,
    approved_at: nowIso,
    approved_by: user.id,
    start_at: nowIso,
    end_at: end,
    mt_login: product === "copy_trading" ? mt5Login : null,
    platform: catalog.platform,
    source_payment_snapshot: { source: "admin_manual_grant", granted_by: user.id, product: product, duration_days: durationDays },
    updated_at: nowIso,
  });

  if (licenseError) return NextResponse.json({ error: "LICENSE_GRANT_FAILED", details: licenseError.message }, { status: 500 });

  const { error: featureError } = await db.from("user_feature_access").insert({
    user_id: target.id,
    feature_code: product,
    status: "active",
    start_at: nowIso,
    end_at: end,
    granted_by: user.id,
    grant_reason: `Manual admin grant (${durationDays} days)`,
    updated_at: nowIso,
  });

  if (featureError) return NextResponse.json({ error: "FEATURE_ACCESS_GRANT_FAILED", details: featureError.message }, { status: 500 });

  return NextResponse.json({ ok: true, message: `${catalog.name} granted to ${email} for ${durationDays} days.`, accessUntil: end, durationDays });
}

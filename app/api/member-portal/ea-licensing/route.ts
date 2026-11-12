import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const codes = ["nexus", "vaulttrades_nexus", "nexus_plus", "vaulttrades_nexus_plus", "vortex", "vaulttrades_vortex"];

function active(row: any) {
  const now = Date.now();
  const start = row.start_at ? new Date(row.start_at).getTime() : 0;
  const end = row.end_at ? new Date(row.end_at).getTime() : Number.POSITIVE_INFINITY;
  return row.status === "active" && Number.isFinite(start) && start <= now && end > now;
}

function planFrom(rows: any[]) {
  const activeCodes = new Set(rows.filter(active).map(row => String(row.entitlement_code).toLowerCase()));
  if (activeCodes.has("vortex") || activeCodes.has("vaulttrades_vortex")) return "vortex";
  if (activeCodes.has("nexus_plus") || activeCodes.has("vaulttrades_nexus_plus")) return "nexus_plus";
  if (activeCodes.has("nexus") || activeCodes.has("vaulttrades_nexus")) return "nexus";
  return null;
}

export async function GET() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const db = createAdminClient();
  const { data: profile } = await db.from("users").select("id,role").eq("auth_user_id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "PROFILE_NOT_FOUND" }, { status: 404 });

  const { data: requests, error } = await db.from("member_ea_licensing_requests")
    .select("id,broker_name,broker_server,mt5_login,product_code,status,admin_notes,submitted_at,license_generated_at")
    .eq("user_id", profile.id)
    .order("submitted_at", { ascending: false });

  if (error) return NextResponse.json({ error: "REQUESTS_UNAVAILABLE" }, { status: 500 });
  return NextResponse.json({ requests: requests ?? [] });
}

export async function POST(request: Request) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const mt5Login = String(body.mt5Login ?? "").trim();
  const productCode = String(body.productCode ?? "").trim().toLowerCase();
  const brokerServer = String(body.brokerServer ?? "").trim().slice(0, 120);

  if (!/^\d{4,12}$/.test(mt5Login)) {
    return NextResponse.json({ error: "Enter a valid MT5 account number (4–12 digits)." }, { status: 400 });
  }
  if (!["nexus", "nexus_plus", "vortex"].includes(productCode)) {
    return NextResponse.json({ error: "Select a valid VaultTrades EA product." }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: profile } = await db.from("users").select("id,email,role").eq("auth_user_id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "PROFILE_NOT_FOUND" }, { status: 404 });

  const isAdmin = profile.role === "admin";
  let plan: string | null = isAdmin ? "vortex" : null;
  if (!isAdmin) {
    const { data: licenses } = await db.from("product_licenses")
      .select("entitlement_code,status,start_at,end_at")
      .eq("user_id", profile.id)
      .in("entitlement_code", codes)
      .eq("status", "active");
    plan = planFrom(licenses ?? []);
  }

  const allowed = plan === "vortex"
    ? ["nexus", "nexus_plus", "vortex"]
    : plan === "nexus_plus"
      ? ["nexus", "nexus_plus"]
      : plan === "nexus"
        ? ["nexus"]
        : [];

  if (!allowed.includes(productCode)) {
    return NextResponse.json({ error: "Your active membership does not include this EA product." }, { status: 403 });
  }

  const { data: created, error } = await db.from("member_ea_licensing_requests").insert({
    user_id: profile.id,
    auth_user_id: user.id,
    member_email: profile.email ?? user.email ?? "",
    broker_name: "XM",
    broker_server: brokerServer || null,
    mt5_login: mt5Login,
    product_code: productCode,
  }).select("id,broker_name,broker_server,mt5_login,product_code,status,admin_notes,submitted_at,license_generated_at").single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "A request for this EA, MT5 account and membership is already active." }, { status: 409 });
    console.error("EA licensing request insert failed:", error.message);
    return NextResponse.json({ error: "We could not submit your licensing request. Please try again." }, { status: 500 });
  }

  await db.from("admin_inbox_notifications").insert({
    event_type: "member_ea_licensing_submitted",
    title: "New MT5 licensing request",
    body: `${profile.email ?? user.email ?? "A member"} submitted MT5 account ${mt5Login} for ${productCode}.`,
    severity: "normal",
    auth_user_id: user.id,
    customer_email: profile.email ?? user.email ?? null,
    related_id: created.id,
    action_href: "/admin/ea-licensing",
    metadata: { product_code: productCode, mt5_login: mt5Login, broker_name: "XM" },
  });

  return NextResponse.json({
    ok: true,
    request: created,
    message: "Your MT5 number has been received. Allow 24–48 hours for the personalised EA licensing process.",
  }, { status: 201 });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const PRODUCT_CODES = ["nexus", "nexus_plus", "vortex"] as const;
type ProductCode = typeof PRODUCT_CODES[number];
const MEMBERSHIP_CODES = ["nexus", "vaulttrades_nexus", "nexus_plus", "vaulttrades_nexus_plus", "vortex", "vaulttrades_vortex"];

function validPayPalUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" &&
      !url.username && !url.password &&
      (host === "paypal.com" || host.endsWith(".paypal.com") || host === "paypal.me" || host.endsWith(".paypal.me")) &&
      url.pathname !== "/";
  } catch {
    return false;
  }
}

async function getMember() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }) };

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("users")
    .select("id,auth_user_id,email,role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error || !profile) return { error: NextResponse.json({ error: "PROFILE_NOT_FOUND" }, { status: 404 }) };

  if (profile.role !== "admin") {
    const { data: licenses } = await admin
      .from("product_licenses")
      .select("entitlement_code,status,start_at,end_at")
      .eq("user_id", profile.id)
      .in("entitlement_code", MEMBERSHIP_CODES)
      .eq("status", "active");
    const now = Date.now();
    const hasMembership = (licenses ?? []).some(row => {
      const start = row.start_at ? new Date(row.start_at).getTime() : 0;
      const end = row.end_at ? new Date(row.end_at).getTime() : Number.POSITIVE_INFINITY;
      return Number.isFinite(start) && start <= now && end > now;
    });
    if (!hasMembership) return { error: NextResponse.json({ error: "ACTIVE_RESELLER_MEMBERSHIP_REQUIRED" }, { status: 403 }) };
  }

  return { admin, profile, authUserId: user.id };
}

export async function GET() {
  const member = await getMember();
  if ("error" in member) return member.error;
  const { data, error } = await member.admin
    .from("reseller_payment_links")
    .select("product_code,payment_url,is_active,updated_at")
    .eq("auth_user_id", member.authUserId);
  if (error) {
    console.error("Reseller payment-link read failed:", error.message);
    return NextResponse.json({ error: "PAYMENT_LINKS_UNAVAILABLE" }, { status: 500 });
  }
  const links: Partial<Record<ProductCode, string>> = {};
  for (const row of data ?? []) {
    if (PRODUCT_CODES.includes(row.product_code as ProductCode) && row.is_active) {
      links[row.product_code as ProductCode] = row.payment_url;
    }
  }
  return NextResponse.json({ links });
}

export async function POST(request: Request) {
  const member = await getMember();
  if ("error" in member) return member.error;
  const body = await request.json().catch(() => ({}));
  const supplied = body?.links;
  if (!supplied || typeof supplied !== "object" || Array.isArray(supplied)) {
    return NextResponse.json({ error: "Provide the PayPal links for the selected membership products." }, { status: 400 });
  }

  const changes: { product_code: ProductCode; payment_url: string }[] = [];
  for (const code of PRODUCT_CODES) {
    if (!(code in supplied)) continue;
    const value = String(supplied[code] ?? "").trim();
    if (!value) continue;
    if (value.length > 2048 || !validPayPalUrl(value)) {
      return NextResponse.json({ error: "Each link must be a valid HTTPS PayPal checkout or PayPal.Me URL." }, { status: 400 });
    }
    changes.push({ product_code: code, payment_url: value });
  }

  if (!changes.length) {
    return NextResponse.json({ error: "Enter at least one PayPal payment link before saving." }, { status: 400 });
  }
  if (new Set(changes.map(row => row.payment_url)).size !== changes.length) {
    return NextResponse.json({ error: "Use a separate PayPal payment link for each membership product so the correct product is selected at checkout." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error } = await member.admin
    .from("reseller_payment_links")
    .upsert(changes.map(row => ({
      ...row,
      user_id: member.profile.id,
      auth_user_id: member.authUserId,
      is_active: true,
      updated_at: now,
    })), { onConflict: "auth_user_id,product_code" });

  if (error) {
    console.error("Reseller payment-link save failed:", error.message);
    return NextResponse.json({ error: "Unable to save your PayPal links. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, saved: changes.map(row => row.product_code) });
}

import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../../lib/supabase/admin";

function mask(value: string) {
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••••••${value.slice(-4)}`;
}

async function getAuthenticatedUser(request: Request) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const admin = createAdminClient();
    const { data: license, error } = await admin
      .from("product_licenses")
      .select("id,status,start_at,end_at,platform,mt_login,broker_name,broker_server,access_key")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!license) return NextResponse.json({ error: "No active VaultTrades license found" }, { status: 404 });
    if (license.end_at && new Date(license.end_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: "VaultTrades license has expired" }, { status: 403 });
    }
    if (!license.access_key) return NextResponse.json({ error: "No execution credential is provisioned for this license" }, { status: 404 });

    return NextResponse.json({
      ok: true,
      credential: {
        access_key_masked: mask(license.access_key),
        access_key: license.access_key,
        platform: license.platform,
        mt_login: license.mt_login,
        broker_name: license.broker_name,
        broker_server: license.broker_server,
        status: license.status,
        expires_at: license.end_at
      }
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Execution credentials error", error);
    return NextResponse.json({ error: "Unable to load execution credentials" }, { status: 500 });
  }
}

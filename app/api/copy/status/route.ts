import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const db = createServiceClient();
  const { data: follower } = await db.from("copy_followers").select("id,mt_login,broker_server,status,copy_enabled,last_heartbeat_at,ea_version").eq("auth_user_id", user.id).maybeSingle();
  if (!follower) return NextResponse.json({ connected:false, account:null });
  return NextResponse.json({ connected: follower.status === "online", account: follower });
}
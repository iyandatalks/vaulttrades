import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCopyAccess } from "@/lib/copy-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Customer-level pause/resume control. This changes only the existing
// copy_followers.copy_enabled flag consumed by the current MT5 heartbeat/poll flow.
export async function POST(req: Request) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const mt5Login = String(body.mt5Login || "").trim();
  const enabled = body.enabled;

  if (!/^\d{4,12}$/.test(mt5Login) || typeof enabled !== "boolean") {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const db = createServiceClient();
  const { data: follower, error: lookupError } = await db
    .from("copy_followers")
    .select("id,mt_login,status,copy_enabled,license_status")
    .eq("auth_user_id", user.id)
    .eq("mt_login", mt5Login)
    .maybeSingle();

  if (lookupError) return NextResponse.json({ error: "FOLLOWER_LOOKUP_FAILED" }, { status: 500 });
  if (!follower) return NextResponse.json({ error: "FOLLOWER_NOT_FOUND" }, { status: 404 });

  if (enabled) {
    const access = await getCopyAccess(user.id, mt5Login);
    if (!access.active || follower.status === "disabled" || follower.license_status !== "active") {
      return NextResponse.json({ error: "COPY_ACCESS_INACTIVE", message: "An active Copier license is required to resume copying." }, { status: 403 });
    }
  }

  const { error } = await db
    .from("copy_followers")
    .update({ copy_enabled: enabled, updated_at: new Date().toISOString() })
    .eq("id", follower.id)
    .eq("auth_user_id", user.id);

  if (error) return NextResponse.json({ error: "COPY_CONTROL_UPDATE_FAILED" }, { status: 500 });

  return NextResponse.json({
    ok: true,
    mt5Login,
    copyEnabled: enabled,
    status: enabled ? "enabled" : "stopped",
    message: enabled
      ? "Copying has been resumed. The MT5 Copier will receive new eligible events on its next poll."
      : "Copying has been stopped. The MT5 Copier will no longer receive new trade commands on its next poll.",
  });
}

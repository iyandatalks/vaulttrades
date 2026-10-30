import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const mt5Login = String(body.mt5Login || "").trim();
  if (!/^\\d{4,12}$/.test(mt5Login)) {
    return NextResponse.json({ error: "INVALID_MT5_LOGIN" }, { status: 400 });
  }

  const db = createServiceClient();
  const { data: follower, error } = await db.from("copy_followers")
    .select("id,auth_user_id,mt_login,api_token_hash,broker_server")
    .eq("auth_user_id", user.id)
    .eq("mt_login", mt5Login)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "FOLLOWER_LOOKUP_FAILED" }, { status: 500 });
  if (!follower) return NextResponse.json({ error: "COPIER_NOT_FOUND" }, { status: 404 });

  const now = new Date().toISOString();
  if (follower.api_token_hash) {
    const { error: revokeError } = await db.from("copy_revoked_tokens").upsert({
      token_hash: follower.api_token_hash,
      auth_user_id: user.id,
      follower_id: follower.id,
      revoked_at: now,
      reason: "unlinked",
    }, { onConflict: "token_hash" });
    if (revokeError) return NextResponse.json({ error: "TOKEN_REVOCATION_FAILED" }, { status: 500 });
  }

  const [followerUpdate, linkUpdate, pairingUpdate, queueUpdate, registrationDelete] = await Promise.all([
    db.from("copy_followers").update({
      status: "unlinked",
      copy_enabled: false,
      license_status: "revoked",
      api_token_hash: null,
      updated_at: now,
    }).eq("id", follower.id),
    db.from("copy_links").update({ status: "revoked", updated_at: now }).eq("follower_id", follower.id),
    db.from("copy_pairing_codes").update({ revoked_at: now }).eq("auth_user_id", user.id).eq("mt5_login", mt5Login).is("revoked_at", null),
    db.from("copy_trade_executions").update({ status: "cancelled", updated_at: now }).eq("follower_id", follower.id).eq("status", "pending"),
    db.from("copy_customer_registrations").delete().eq("auth_user_id", user.id).eq("mt5_login", mt5Login),
  ]);

  const failed = [followerUpdate, linkUpdate, pairingUpdate, queueUpdate, registrationDelete].find((result: any) => result.error);
  if (failed?.error) {
    return NextResponse.json({ error: "UNLINK_INCOMPLETE", message: "Some unlink steps could not be completed. Contact support before reconnecting." }, { status: 500 });
  }

  await db.from("admin_inbox_notifications").insert({
    event_type: "copier_unlinked",
    title: "Customer unlinked an MT5 Copier",
    body: `MT5 account ${mt5Login} (${follower.broker_server || "broker not specified"}) was unlinked by the customer.`,
    severity: "warning",
    auth_user_id: user.id,
    customer_email: user.email || null,
    related_id: follower.id,
    action_href: "/admin/inbox",
    metadata: { mt5_login: mt5Login, broker_server: follower.broker_server },
  });

  return NextResponse.json({
    ok: true,
    mt5Login,
    message: "Copier unlinked. Its old MT5 token and pairing code have been revoked, and the account has been removed from your active Copier list. Existing MT5 positions are not closed.",
  });
}

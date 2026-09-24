import { NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCopyAccess } from "@/lib/copy-access";

export const runtime = "nodejs";

export async function POST() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const access = await getCopyAccess(user.id);
  if (!access.active) {
    return NextResponse.json({
      error: "COPY_SUBSCRIPTION_REQUIRED",
      message: "An active VaultTrades Copy Trading subscription is required to create a pairing code.",
    }, { status: 403 });
  }

  const db = createServiceClient();
  const isAdmin = access.reason === "ADMIN";

  if (!isAdmin && access.startAt) {
    const { count } = await db
      .from("copy_pairing_codes")
      .select("id", { count: "exact", head: true })
      .eq("auth_user_id", user.id)
      .gte("created_at", access.startAt)
      .lt("created_at", access.endAt || new Date().toISOString())
      .is("revoked_at", null);

    if ((count || 0) > 0) {
      const { data: existing } = await db
        .from("copy_pairing_codes")
        .select("expires_at,redeemed_at,revoked_at")
        .eq("auth_user_id", user.id)
        .gte("created_at", access.startAt)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return NextResponse.json({
        error: "PAIRING_GENERATION_LIMIT_REACHED",
        message: existing?.redeemed_at
          ? "One Copier activation is allowed per subscription period. Contact VaultTrades Support if you need to replace the activated MT5 account."
          : "One pairing code is allowed per subscription period. If the code was not activated within 24 hours, contact VaultTrades Support for a reset.",
        expiresAt: existing?.expires_at || null,
        redeemed: !!existing?.redeemed_at,
      }, { status: 409 });
    }
  }

  const code = randomBytes(5).toString("hex").toUpperCase();
  const hash = createHash("sha256").update(code).digest("hex");
  const expiresAt = access.endAt
    ? new Date(Math.min(Date.now() + 24 * 60 * 60 * 1000, new Date(access.endAt).getTime())).toISOString()
    : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await db.from("copy_pairing_codes").update({ revoked_at: new Date().toISOString() }).eq("auth_user_id", user.id).is("redeemed_at", null).is("revoked_at", null);
  const { error } = await db.from("copy_pairing_codes").insert({
    auth_user_id: user.id,
    code_hash: hash,
    expires_at: expiresAt,
  });
  if (error) return NextResponse.json({ error:"PAIRING_CREATE_FAILED" }, { status:500 });
  const expiresInSeconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  return NextResponse.json({
    pairingCode: code,
    expiresInSeconds,
    expiresAt,
  });
}
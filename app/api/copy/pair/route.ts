import { NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function POST() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const code = randomBytes(5).toString("hex").toUpperCase();
  const hash = createHash("sha256").update(code).digest("hex");
  const db = createServiceClient();

  await db.from("copy_pairing_codes").update({ revoked_at: new Date().toISOString() }).eq("auth_user_id", user.id).is("redeemed_at", null).is("revoked_at", null);
  const { error } = await db.from("copy_pairing_codes").insert({ auth_user_id:user.id, code_hash:hash, expires_at:new Date(Date.now()+15*60*1000).toISOString() });
  if (error) return NextResponse.json({ error:"PAIRING_CREATE_FAILED" }, { status:500 });
  return NextResponse.json({ pairingCode:code, expiresInSeconds:900 });
}
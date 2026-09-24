import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const mt5Login = String(body.mt5Login || "").trim();

  if (!/^\d{4,12}$/.test(mt5Login)) {
    return NextResponse.json({
      error: "INVALID_MT5_ID",
      message: "Enter a valid MT5 account ID using digits only.",
    }, { status: 400 });
  }

  const email = String(user.email || "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({
      error: "EMAIL_REQUIRED",
      message: "Your VaultTrades account must have an email address before continuing.",
    }, { status: 400 });
  }

  const db = createServiceClient();
  const { error } = await db.from("copy_customer_registrations").upsert({
    auth_user_id: user.id,
    email,
    mt5_login: mt5Login,
    updated_at: new Date().toISOString(),
  }, { onConflict: "auth_user_id" });

  if (error) {
    return NextResponse.json({
      error: "MT5_REGISTRATION_FAILED",
      message: "Unable to save your MT5 account details. Please try again.",
    }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email, mt5Login });
}

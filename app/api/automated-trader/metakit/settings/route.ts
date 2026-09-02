import { NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server";
import { createAdminClient } from "../../../../../lib/supabase/admin";

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const metakitAccountId = Number(body.metakitAccountId);
    const enabledInstruments = Array.isArray(body.enabledInstruments)
      ? [...new Set(body.enabledInstruments.map((value: unknown) => String(value).trim().toUpperCase()).filter(Boolean))]
      : null;
    if (!Number.isInteger(metakitAccountId) || !enabledInstruments) {
      return NextResponse.json({ error: "A MetaKit account and instrument selection are required." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin.from("automated_trader_accounts")
      .update({ enabled_instruments: enabledInstruments, updated_at: new Date().toISOString() })
      .eq("auth_user_id", user.id)
      .eq("metakit_account_id", metakitAccountId)
      .select("metakit_account_id,enabled_instruments")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Connected MetaKit account was not found." }, { status: 404 });
    return NextResponse.json({ ok: true, account: data });
  } catch (error) {
    console.error("MetaKit settings error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save MetaKit settings." }, { status: 500 });
  }
}

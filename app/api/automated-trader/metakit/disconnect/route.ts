import { NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server";
import { createAdminClient } from "../../../../../lib/supabase/admin";
import { metakitRequest } from "../../../../../lib/metakit";

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const metakitAccountId = Number(body.metakitAccountId);
    if (!Number.isInteger(metakitAccountId)) return NextResponse.json({ error: "A valid MetaKit account is required." }, { status: 400 });

    const admin = createAdminClient();
    const { data: account } = await admin.from("automated_trader_accounts")
      .select("id,metakit_account_id")
      .eq("auth_user_id", user.id)
      .eq("metakit_account_id", metakitAccountId)
      .maybeSingle();
    if (!account) return NextResponse.json({ error: "Connected MetaKit account was not found." }, { status: 404 });

    await metakitRequest(`/v1/accounts/${metakitAccountId}`, { method: "DELETE" });
    await admin.from("automated_trader_accounts").delete().eq("id", account.id).eq("auth_user_id", user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("MetaKit disconnect error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to disconnect MetaKit account." }, { status: 500 });
  }
}

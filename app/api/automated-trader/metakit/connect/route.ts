import { NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server";
import { createAdminClient } from "../../../../../lib/supabase/admin";
import { metakitRequest } from "../../../../../lib/metakit";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const number = Number(body.number);
    const password = String(body.password || "");
    const brokerId = Number(body.brokerId);
    const server = String(body.server || "");
    const name = String(body.name || `VaultTrades ${number}`);
    if (!Number.isInteger(number) || !password || !Number.isInteger(brokerId) || !server) {
      return NextResponse.json({ error: "MT5 login, master password, broker ID and exact server name are required." }, { status: 400 });
    }

    const account = await metakitRequest("/v1/accounts", {
      method: "POST",
      body: JSON.stringify({ name, number, password, broker_id: brokerId, server, type: "full" })
    });

    const metakitAccountId = Number(account.id);
    if (!Number.isInteger(metakitAccountId)) return NextResponse.json({ error: "MetaKit did not return a valid account ID." }, { status: 502 });

    const admin = createAdminClient();
    await admin.from("automated_trader_accounts").upsert({
      auth_user_id: user.id,
      metakit_account_id: metakitAccountId,
      account_name: String(account.account_name || name),
      mt_login: String(number),
      broker_server: server,
      account_type: "full",
      status: String(account.status || "starting"),
      updated_at: new Date().toISOString()
    }, { onConflict: "metakit_account_id" });

    return NextResponse.json({ ok: true, account: { id: metakitAccountId, status: account.status || "starting", account_name: account.account_name || name } });
  } catch (error) {
    console.error("MetaKit connect error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to connect MT5 account to MetaKit." }, { status: 500 });
  }
}

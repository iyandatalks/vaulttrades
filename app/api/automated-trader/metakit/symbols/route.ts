import { NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server";
import { createAdminClient } from "../../../../../lib/supabase/admin";
import { metakitRequest } from "../../../../../lib/metakit";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const accountId = Number(new URL(request.url).searchParams.get("accountId"));
    if (!Number.isInteger(accountId)) return NextResponse.json({ error: "A valid MetaKit account is required." }, { status: 400 });

    const admin = createAdminClient();
    const { data: account } = await admin.from("automated_trader_accounts")
      .select("metakit_account_id")
      .eq("auth_user_id", user.id)
      .eq("metakit_account_id", accountId)
      .maybeSingle();
    if (!account) return NextResponse.json({ error: "Connected MetaKit account was not found." }, { status: 404 });

    const result = await metakitRequest(`/v1/accounts/${accountId}/symbols`);
    const symbols = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];
    return NextResponse.json({ symbols: symbols.map((symbol: unknown) => {
      if (typeof symbol === "string") return symbol;
      if (symbol && typeof symbol === "object" && "symbol" in symbol) return String((symbol as { symbol: unknown }).symbol);
      if (symbol && typeof symbol === "object" && "name" in symbol) return String((symbol as { name: unknown }).name);
      return "";
    }).filter(Boolean) });
  } catch (error) {
    console.error("MetaKit symbols error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load broker instruments." }, { status: 500 });
  }
}

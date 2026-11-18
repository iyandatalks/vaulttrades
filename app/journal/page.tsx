import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { getProductAccess } from "../../lib/product-access";
import JournalClient from "./JournalClient";

type JournalSearchParams = Record<string, string | string[] | undefined>;
const value = (params: JournalSearchParams, key: string) => { const item = params[key]; return Array.isArray(item) ? item[0] : item; };
const numeric = (params: JournalSearchParams, key: string) => { const item = value(params, key); return item != null && item.trim() !== "" && Number.isFinite(Number(item)) ? Number(item) : null; };

export default async function JournalPage({ searchParams }: { searchParams: Promise<JournalSearchParams> }) {
  const params = await searchParams;
  const draft = value(params, "draft") === "1" && numeric(params, "entry") != null && numeric(params, "sl") != null && numeric(params, "tp1") != null
    ? { symbol: value(params, "symbol") || "XAUUSD", strategy: value(params, "strategy") || "Analyzer", direction: (value(params, "direction") === "SELL" ? "SELL" : "BUY") as "BUY" | "SELL", entry: numeric(params, "entry")!, sl: numeric(params, "sl")!, tp1: numeric(params, "tp1")!, lotSize: numeric(params, "lot_size") ?? 0, riskAmount: numeric(params, "risk_amount") ?? 0, riskPercent: numeric(params, "risk_percent") ?? 0, timeframe: value(params, "timeframe") || "", accountType: (value(params, "account_type") === "Funded" ? "Funded" : "Personal") as "Personal" | "Funded", currency: (["ZAR","USD","EUR","GBP"].includes(value(params, "currency") || "USD") ? value(params, "currency") : "USD") as "ZAR" | "USD" | "EUR" | "GBP", fundedAccountId: value(params, "funded_account_id") || "", accountSize: numeric(params, "account_size") ?? 0, propFirm: value(params, "prop_firm") || "", programName: value(params, "program_name") || "", accountStage: value(params, "account_stage") || "", platform: value(params, "platform") || "", accountReference: value(params, "account_reference") || "" }
    : null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/journal");

  const access = await getProductAccess(user.id);
  if (!access.tools) redirect("/products");

  return <JournalClient initialDraft={draft} />;
}

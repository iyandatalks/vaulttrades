import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MembershipCheckoutClient from "./MembershipCheckoutClient";
import "./checkout.css";

const plans = {
  nexus: { name: "VaultTrades Nexus", eaName: "VaultTrades Nexus EA", price: 150, description: "The core VaultTrades membership." },
  nexus_plus: { name: "VaultTrades Nexus Plus", eaName: "VaultTrades Nexus Plus EA", price: 250, description: "Nexus plus Analyzer, Journal and additional tools." },
  vortex: { name: "VaultTrades Vortex", eaName: "VaultTrades Vortex EA", price: 550, description: "The complete membership with advanced risk resources and one-on-one mentorship." },
} as const;

export default async function MembershipCheckoutPage({ searchParams }: { searchParams: Promise<{ plan?: string; ref?: string; declaration?: string; token?: string; payment?: string }> }) {
  const params = await searchParams;
  const planCode = params.plan as keyof typeof plans;
  const resellerCode = String(params.ref ?? "VT-C4D867E2").trim().toUpperCase();
  const declarationId = String(params.declaration ?? "").trim();
  if (!planCode || !plans[planCode]) redirect("/plans");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const next = "/membership/checkout?plan=" + encodeURIComponent(planCode) + "&ref=" + encodeURIComponent(resellerCode) + (declarationId ? "&declaration=" + encodeURIComponent(declarationId) : "");
  const registrationHref = "/auth/register?next=" + encodeURIComponent(next) + "&ref=" + encodeURIComponent(resellerCode);

  return <MembershipCheckoutClient
    planCode={planCode}
    plan={plans[planCode]}
    email={user?.email ?? ""}
    resellerCode={resellerCode}
    declarationId={declarationId}
    isAuthenticated={Boolean(user)}
    registrationHref={registrationHref}
  />;
}

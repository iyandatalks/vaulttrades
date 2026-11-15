import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  const suppliedResellerCode = String(params.ref ?? "").trim().toUpperCase();
  const declarationId = String(params.declaration ?? "").trim();
  if (!planCode || !plans[planCode]) redirect("/plans");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = (forwardedHost || requestHeaders.get("host") || "").split(":")[0].toLowerCase();
  let domainResellerCode = "";\n  let assignedPartnerPaymentUrl = "";
  if (host.endsWith(".vaulttradesve.com") && host !== "www.vaulttradesve.com") {
    const db = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : supabase;
    const { data: site } = await db.from("member_website_requests")
      .select("auth_user_id,user_id,partner_paypal_nexus_url,partner_paypal_nexus_plus_url,partner_paypal_vortex_url")
      .ilike("assigned_domain", host)
      .eq("status", "ready")
      .maybeSingle();
    if (site) {\n      assignedPartnerPaymentUrl = String(planCode === "nexus" ? site.partner_paypal_nexus_url ?? "" : planCode === "nexus_plus" ? site.partner_paypal_nexus_plus_url ?? "" : site.partner_paypal_vortex_url ?? "").trim();\n    }\n    let partnerProfile = null as { referral_code: string | null } | null;
    if (site?.auth_user_id) {
      const { data } = await db.from("users").select("referral_code").eq("auth_user_id", site.auth_user_id).eq("is_active", true).maybeSingle();
      partnerProfile = data;
    } else if (site?.user_id) {
      const { data } = await db.from("users").select("referral_code").eq("id", site.user_id).eq("is_active", true).maybeSingle();
      partnerProfile = data;
    }
    domainResellerCode = String(partnerProfile?.referral_code ?? "").trim().toUpperCase();
  }
  // A domain owner takes precedence; a conflicting query code must not reassign the sale.
  if (domainResellerCode && suppliedResellerCode && suppliedResellerCode !== domainResellerCode) redirect("/start");
  const resellerCode = domainResellerCode || suppliedResellerCode;
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

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import MembershipCheckoutClient from "./MembershipCheckoutClient";
import "./checkout.css";

const plans = {
  nexus: { name: "VaultTrades Nexus", price: 150, description: "The core VaultTrades membership." },
  nexus_plus: { name: "VaultTrades Nexus Plus", price: 250, description: "Nexus plus Analyzer, Journal and additional tools." },
  vortex: { name: "VaultTrades Vortex", price: 550, description: "The complete membership with advanced risk resources and one-on-one mentorship." },
} as const;

export default async function MembershipCheckoutPage({ searchParams }: { searchParams: Promise<{ plan?: string; ref?: string; declaration?: string; token?: string; payment?: string }> }) {
  const params = await searchParams;
  const planCode = params.plan as keyof typeof plans;
  const resellerCode = String(params.ref ?? "").trim().toUpperCase();
  const declarationId = String(params.declaration ?? "").trim();
  const paypalToken = String(params.token ?? "").trim();
  const paymentStatus = String(params.payment ?? "");
  if (!planCode || !plans[planCode]) redirect("/plans");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const next = `/membership/checkout?plan=${encodeURIComponent(planCode)}&ref=${encodeURIComponent(resellerCode)}`;
    redirect(`/auth/register?next=${encodeURIComponent(next)}&ref=${encodeURIComponent(resellerCode)}`);
  }

  return <MembershipCheckoutClient planCode={planCode} plan={plans[planCode]} email={user.email ?? ""} resellerCode={resellerCode} declarationId={declarationId} paypalToken={paypalToken} paymentStatus={paymentStatus} />;
}

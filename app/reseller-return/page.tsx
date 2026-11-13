import { redirect } from "next/navigation";

const PLANS = new Set(["nexus", "nexus_plus", "vortex"]);

export default async function ResellerReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; plan?: string }>;
}) {
  const params = await searchParams;
  const resellerCode = String(params.ref ?? "").trim().toUpperCase();
  const plan = String(params.plan ?? "").trim().toLowerCase();
  if (!/^[A-Z0-9-]{4,32}$/.test(resellerCode) || !PLANS.has(plan)) {
    redirect("/plans?error=invalid_reseller_return");
  }
  redirect(`/membership/checkout?plan=${encodeURIComponent(plan)}&ref=${encodeURIComponent(resellerCode)}`);
}

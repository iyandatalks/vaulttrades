import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { createAdminClient } from "../../lib/supabase/admin";
import ReferralVaultClient from "./ReferralVaultClient";

function makeCode() {
  return `VT-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export default async function ReferralVaultPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/referral-vault");

  const admin = createAdminClient();
  const { data: profile } = await admin.from("users").select("id,email,role,license_status,referral_code,referred_by").eq("auth_user_id", user.id).maybeSingle();
  if (!profile) return <main style={{ padding: 40, color: "white", background: "#050812", minHeight: "100vh" }}>VaultTrades profile not found.</main>;

  const isAdmin = profile.role === "admin";
  const eligible = isAdmin || profile.license_status === "active";

  if (!eligible) {
    return <ReferralVaultClient locked />;
  }

  let code = profile.referral_code;
  if (!code) {
    code = makeCode();
    await admin.from("users").update({ referral_code: code }).eq("id", profile.id);
  }

  await admin.from("referral_profiles").upsert({
    user_id: user.id,
    referral_code: code,
    commission_rate: isAdmin ? 0 : 8,
    vault_level: isAdmin ? "Admin" : "Vault Core",
  }, { onConflict: "user_id" });

  const { count: qualifiedCount } = await admin.from("referral_relationships").select("id", { count: "exact", head: true }).eq("referrer_id", user.id).eq("qualification_status", "qualified");
  const { data: commissions } = await admin.from("referral_commissions").select("commission_amount_usd,status").eq("referrer_id", user.id).order("created_at", { ascending: false });

  const available = (commissions ?? []).filter(c => c.status === "available" || c.status === "approved" || c.status === "paid").reduce((s, c) => s + Number(c.commission_amount_usd || 0), 0);
  const pending = (commissions ?? []).filter(c => c.status === "pending").reduce((s, c) => s + Number(c.commission_amount_usd || 0), 0);
  const totalEarned = (commissions ?? []).filter(c => c.status !== "reversed").reduce((s, c) => s + Number(c.commission_amount_usd || 0), 0);

  let adminReferrals: { email: string; license_status: string | null; created_at: string | null }[] = [];
  if (isAdmin) {
    const { data } = await admin.from("users").select("email,license_status,created_at").eq("referred_by", code).order("created_at", { ascending: false });
    adminReferrals = data ?? [];
  }

  const base = process.env.NEXT_PUBLIC_APP_URL || "";
  const referralUrl = base ? `${base.replace(/\/$/, "")}/ref/${code}` : `/ref/${code}`;

  return <ReferralVaultClient
    code={code}
    referralUrl={referralUrl}
    isAdmin={isAdmin}
    qualifiedCount={qualifiedCount ?? 0}
    currentRate={isAdmin ? 0 : 8}
    totalEarned={totalEarned}
    available={available}
    pending={pending}
    adminReferrals={adminReferrals}
  />;
}

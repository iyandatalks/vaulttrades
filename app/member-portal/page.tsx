import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import MemberPortalClient from "./MemberPortalClient";
import "./member-portal.css";

export const metadata = {
  title: "Member Knowledge Base | VaultTrades",
  description: "Your VaultTrades member onboarding and learning workspace.",
};

const MEMBERSHIP_CODES = new Set([
  "nexus", "vaulttrades_nexus",
  "nexus_plus", "vaulttrades_nexus_plus",
  "vortex", "vaulttrades_vortex",
]);

function isCurrent(startAt: string | null, endAt: string | null) {
  const now = Date.now();
  const start = startAt ? new Date(startAt).getTime() : 0;
  const end = endAt ? new Date(endAt).getTime() : Number.POSITIVE_INFINITY;
  return Number.isFinite(start) && start <= now && end > now;
}

export default async function MemberPortalPage() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) redirect("/auth/login?next=/member-portal");

  const db = createAdminClient();
  const { data: profile } = await db
    .from("users")
    .select("id,email,role,referral_code")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile) {
    return (
      <main className="vt-member-shell">
        <section className="vt-member-empty">
          <span className="vt-member-kicker">VAULTTRADES MEMBER ACCESS</span>
          <h1>Your member profile is not ready yet.</h1>
          <p>Please contact VaultTrades support so your account can be checked.</p>
          <Link href="/profile" className="vt-member-button">Open profile</Link>
        </section>
      </main>
    );
  }

  const { data: licenses } = await db
    .from("product_licenses")
    .select("entitlement_code,status,start_at,end_at")
    .eq("user_id", profile.id)
    .eq("status", "active");

  const memberships = (licenses ?? []).filter((license: any) =>
    MEMBERSHIP_CODES.has(String(license.entitlement_code || "").toLowerCase()) &&
    isCurrent(license.start_at, license.end_at)
  );

  const isAdmin = profile.role === "admin";
  const membershipCodes = new Set(memberships.map((license: any) => String(license.entitlement_code).toLowerCase()));
  const plan = isAdmin || membershipCodes.has("vortex") || membershipCodes.has("vaulttrades_vortex")
    ? "vortex"
    : membershipCodes.has("nexus_plus") || membershipCodes.has("vaulttrades_nexus_plus")
      ? "nexus_plus"
      : membershipCodes.has("nexus") || membershipCodes.has("vaulttrades_nexus")
        ? "nexus"
        : null;

  let referralUrl: string | null = null;
  if (plan || isAdmin) {
    let code = profile.referral_code;
    if (!code) {
      code = `VT-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
      await db.from("users").update({ referral_code: code }).eq("id", profile.id);
    }
    referralUrl = `https://vaulttradesve.com/ref/${code}`;
  }

  if (!plan && !isAdmin) {
    return (
      <main className="vt-member-shell">
        <section className="vt-member-empty">
          <span className="vt-member-kicker">MEMBERSHIP REQUIRED</span>
          <h1>Your VaultTrades Knowledge Base</h1>
          <p>Create your profile and choose a membership plan to unlock the member learning area, EA licensing process, installation guides and eligible tools.</p>
          <div className="vt-member-empty-actions">
            <Link href="/plans" className="vt-member-button">View membership plans</Link>
            <Link href="/profile" className="vt-member-outline">My profile</Link>
          </div>
        </section>
      </main>
    );
  }

  const { data: licensingRequests } = await db.from("member_ea_licensing_requests")
    .select("id,broker_name,broker_server,mt5_login,product_code,status,admin_notes,submitted_at,license_generated_at")
    .eq("user_id", profile.id)
    .order("submitted_at", { ascending: false });

  const { data: websiteRequests } = await db.from("member_website_requests")
    .select("id,domain_preference,preferred_name_1,preferred_name_2,preferred_name_3,custom_domain,status,admin_notes,assigned_domain,submitted_at")
    .eq("user_id", profile.id)
    .order("submitted_at", { ascending: false });

  return (
    <MemberPortalClient
      plan={plan ?? "vortex"}
      isAdmin={isAdmin}
      memberEmail={profile.email ?? user.email ?? ""}
      referralUrl={referralUrl}
      licensingRequests={licensingRequests ?? []}
      websiteRequests={websiteRequests ?? []}
      xmRegistrationUrl={process.env.NEXT_PUBLIC_XM_AFFILIATE_URL ?? ""}
      vpsRegistrationUrl={process.env.NEXT_PUBLIC_VPS_PARTNER_URL ?? ""}
    />
  );
}

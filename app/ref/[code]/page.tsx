import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function ReferralRedirectPage({ params }: { params: { code: string } }) {
  const code = decodeURIComponent(params.code || "").trim().toUpperCase();
  if (!code) redirect("/auth/register");

  const admin = createAdminClient();
  const { data: referrer } = await admin
    .from("users")
    .select("id")
    .eq("referral_code", code)
    .maybeSingle();

  if (!referrer) redirect("/auth/register");

  redirect("/auth/register?ref=" + encodeURIComponent(code));
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requestedNext = url.searchParams.get("next");
  const cookieNext = request.headers.get("cookie")?.match(/(?:^|; )vaulttrades_auth_next=([^;]+)/)?.[1];
  const decodedCookieNext = cookieNext ? decodeURIComponent(cookieNext) : "";
  const nextCandidate = requestedNext || decodedCookieNext || "/profile";
  const next = nextCandidate.startsWith("/") && !nextCandidate.startsWith("//") ? nextCandidate : "/profile";

  if (!code) {
    return NextResponse.redirect(new URL("/auth/login?error=missing_confirmation_code&next=" + encodeURIComponent(next), url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/auth/login?error=confirmation_failed&next=" + encodeURIComponent(next), url.origin));
  }

  const referralCookie = request.headers.get("cookie")?.match(/(?:^|; )vaulttrades_referral_code=([^;]+)/)?.[1];
  const { data: { user } } = await supabase.auth.getUser();
  const metadataCode = typeof user?.user_metadata?.referred_by === "string" ? user.user_metadata.referred_by : "";
  const referralCode = (referralCookie ? decodeURIComponent(referralCookie) : metadataCode).trim().toUpperCase();

  if (referralCode && user) {
    const admin = createAdminClient();
    const [{ data: referrer }, { data: profile }] = await Promise.all([
      admin.from("users").select("id").eq("referral_code", referralCode).maybeSingle(),
      admin.from("users").select("id,referred_by").eq("auth_user_id", user.id).maybeSingle(),
    ]);
    if (referrer && profile && referrer.id !== profile.id && !profile.referred_by) {
      await admin.from("users").update({ referred_by: referralCode }).eq("auth_user_id", user.id).is("referred_by", null);
    }
  }

  const response = NextResponse.redirect(new URL(next, url.origin));
  response.cookies.set("vaulttrades_auth_next", "", { maxAge: 0, path: "/" });
  response.cookies.set("vaulttrades_referral_code", "", { maxAge: 0, path: "/" });
  return response;
}

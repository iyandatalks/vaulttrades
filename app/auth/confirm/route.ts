import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  const cookieNext = request.cookies.get("vaulttrades_auth_next")?.value || "";
  const decodedCookieNext = cookieNext ? decodeURIComponent(cookieNext) : "";
  const next = decodedCookieNext.startsWith("/") ? decodedCookieNext : "/profile";

  if (!tokenHash || type !== "email") {
    return NextResponse.redirect(
      new URL(
        "/auth/login?error=missing_confirmation_token&next=" +
          encodeURIComponent(next),
        request.url
      )
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "email",
  });

  if (error) {
    return NextResponse.redirect(
      new URL(
        "/auth/login?error=confirmation_failed&next=" +
          encodeURIComponent(next),
        request.url
      )
    );
  }

  const referralCookie = request.cookies.get("vaulttrades_referral_code")?.value || "";
  const referralCode = referralCookie
    ? decodeURIComponent(referralCookie).trim().toUpperCase()
    : "";

  if (referralCode) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const admin = createAdminClient();
      const { data: referrer } = await admin
        .from("users")
        .select("referral_code")
        .eq("referral_code", referralCode)
        .maybeSingle();

      if (referrer) {
        await admin
          .from("users")
          .update({ referred_by: referralCode })
          .eq("auth_user_id", user.id);
      }
    }
  }

  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.set("vaulttrades_auth_next", "", { maxAge: 0, path: "/" });
  response.cookies.set("vaulttrades_referral_code", "", { maxAge: 0, path: "/" });

  return response;
}

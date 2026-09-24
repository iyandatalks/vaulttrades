import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requestedNext = url.searchParams.get("next");
  const cookieNext = request.headers.get("cookie")?.match(/(?:^|; )vaulttrades_auth_next=([^;]+)/)?.[1];
  const decodedCookieNext = cookieNext ? decodeURIComponent(cookieNext) : "";
  const nextCandidate = requestedNext || decodedCookieNext || "/profile";
  const next = nextCandidate.startsWith("/") ? nextCandidate : "/profile";

  if (!code) {
    return NextResponse.redirect(new URL("/auth/login?error=missing_confirmation_code&next=" + encodeURIComponent(next), url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/auth/login?error=confirmation_failed&next=" + encodeURIComponent(next), url.origin));
  }

  const response = NextResponse.redirect(new URL(next, url.origin));
  response.cookies.set("vaulttrades_auth_next", "", { maxAge: 0, path: "/" });
  return response;
}

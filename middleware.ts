import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const paidProtectedPaths = [
  "/analyzer",
  "/ai-coach",
  "/journal",
  "/strategies",
];

const authenticatedPaths = ["/profile", "/subscription"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => { request.cookies.set(name, value); response.cookies.set(name, value, options); }); },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isPaidProtected = paidProtectedPaths.some(path => pathname === path || pathname.startsWith(`${path}/`));
  const isAuthenticatedOnly = authenticatedPaths.some(path => pathname === path || pathname.startsWith(`${path}/`));
  if (!isPaidProtected && !isAuthenticatedOnly) return response;

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticatedOnly) return response;

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("license_status, is_active, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const hasActiveMembership = !profileError && profile?.is_active === true && profile?.license_status === "active";
  const isAdmin = !profileError && profile?.role === "admin";
  if (!hasActiveMembership && !isAdmin) {
    const subscriptionUrl = request.nextUrl.clone();
    subscriptionUrl.pathname = "/subscription";
    subscriptionUrl.search = "";
    return NextResponse.redirect(subscriptionUrl);
  }
  return response;
}

export const config = {
  matcher: ["/analyzer/:path*", "/ai-coach/:path*", "/journal/:path*", "/strategies/:path*", "/subscription/:path*", "/profile/:path*"],
};

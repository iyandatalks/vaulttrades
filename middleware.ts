import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const paidProtectedPaths = [
  "/ai-coach",
  "/journal",
  "/strategies",
];

const featureProtectedPaths: Record<string, string> = {
  "/analyzer": "analyzer",
  "/referral-vault": "referral",
};

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

  // Keep the public AI Scanner endpoint URL unchanged while routing its
  // request through the persistent active-entry handoff layer.
  if (pathname === "/api/ai-scanner") {
    const url = request.nextUrl.clone();
    url.pathname = "/api/ai-scanner-state";
    return NextResponse.rewrite(url);
  }

  const isPaidProtected = paidProtectedPaths.some(path => pathname === path || pathname.startsWith(`${path}/`));
  const matchedFeaturePath = Object.keys(featureProtectedPaths).find(path => pathname === path || pathname.startsWith(`${path}/`));
  const isFeatureProtected = Boolean(matchedFeaturePath);
  const isAuthenticatedOnly = authenticatedPaths.some(path => pathname === path || pathname.startsWith(`${path}/`));
  if (!isPaidProtected && !isFeatureProtected && !isAuthenticatedOnly) return response;

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

  const isAdmin = !profileError && profile?.role === "admin";

  if (isFeatureProtected && matchedFeaturePath) {
    if (isAdmin) return response;
    const featureCode = featureProtectedPaths[matchedFeaturePath];
    const { data: hasFeature, error: featureError } = await supabase.rpc("has_feature_access", {
      p_auth_user_id: user.id,
      p_feature_code: featureCode,
    });
    if (featureError || hasFeature !== true) {
      const subscriptionUrl = request.nextUrl.clone();
      subscriptionUrl.pathname = "/subscription";
      subscriptionUrl.search = "";
      subscriptionUrl.searchParams.set("required", featureCode);
      return NextResponse.redirect(subscriptionUrl);
    }
    return response;
  }

  const hasActiveMembership = !profileError && profile?.is_active === true && profile?.license_status === "active";
  if (!hasActiveMembership && !isAdmin) {
    const subscriptionUrl = request.nextUrl.clone();
    subscriptionUrl.pathname = "/subscription";
    subscriptionUrl.search = "";
    return NextResponse.redirect(subscriptionUrl);
  }
  return response;
}

export const config = {
  matcher: ["/api/ai-scanner", "/analyzer/:path*", "/referral-vault/:path*", "/ai-coach/:path*", "/journal/:path*", "/strategies/:path*", "/subscription/:path*", "/profile/:path*"],
};

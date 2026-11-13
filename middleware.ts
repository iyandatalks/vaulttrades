import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getProductAccess } from "@/lib/product-access";

const paidProtectedPaths = [
  "/ai-coach",
  "/journal",
  "/strategies",
];

const featureProtectedPaths: Record<string, string> = {
  "/analyzer": "analyzer",
  "/scanner-automation": "scanner",
  "/automated-trader": "automation",
  "/referral-vault": "referral",
};

const authenticatedPaths = ["/profile", "/subscription"];

// Temporary launch gate: keep the complete lead-to-membership journey private
// until its end-to-end flow, checkout and member activation have been verified.
const adminOnlyPaths = [
  "/start",
  "/opportunity",
  "/plans",
  "/membership",
  "/api/marketing-leads",
];

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

  if (pathname === "/api/ai-scanner") {
    const url = request.nextUrl.clone();
    url.pathname = "/api/ai-scanner-state";
    return NextResponse.rewrite(url);
  }

  const isAdminOnly = adminOnlyPaths.some(path => pathname === path || pathname.startsWith(`${path}/`));
  const isMemberPortalPath = pathname === "/member-portal" || pathname.startsWith("/member-portal/");
  const isPaidProtected = paidProtectedPaths.some(path => pathname === path || pathname.startsWith(`${path}/`));
  const matchedFeaturePath = Object.keys(featureProtectedPaths).find(path => pathname === path || pathname.startsWith(`${path}/`));
  const isFeatureProtected = Boolean(matchedFeaturePath);
  const isAuthenticatedOnly = authenticatedPaths.some(path => pathname === path || pathname.startsWith(`${path}/`));

  if (!isAdminOnly && !isPaidProtected && !isFeatureProtected && !isAuthenticatedOnly && !isMemberPortalPath) return response;

  // Return not-found rather than exposing an unfinished module or its existence.
  if (!user) {
    if (isAdminOnly) return new NextResponse(null, { status: 404 });
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticatedOnly) return response;

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("license_status, is_active, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const isAdmin = !profileError && profile?.role === "admin";

  if (isAdminOnly) {
    return isAdmin ? response : new NextResponse(null, { status: 404 });
  }

  // Member Portal performs its own product_licenses entitlement check on the page
  // and content API. Do not restrict it to admins or use the legacy users license flags.
  if (isMemberPortalPath) return response;

  if (isFeatureProtected && matchedFeaturePath) {
    if (isAdmin) return response;
    const featureCode = featureProtectedPaths[matchedFeaturePath];
    const eligibleForFeature = featureCode === "referral"
      ? (await getProductAccess(user.id)).anyPaidProduct
      : (await supabase.rpc("has_feature_access", {
          p_auth_user_id: user.id,
          p_feature_code: featureCode,
        })).data === true;
    if (!eligibleForFeature) {
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
  matcher: [
    "/api/ai-scanner",
    "/start/:path*",
    "/opportunity/:path*",
    "/plans/:path*",
    "/membership/:path*",
    "/member-portal/:path*",
    "/api/marketing-leads",
    "/analyzer/:path*",
    "/scanner-automation/:path*",
    "/automated-trader/:path*",
    "/referral-vault/:path*",
    "/ai-coach/:path*",
    "/journal/:path*",
    "/strategies/:path*",
    "/subscription/:path*",
    "/profile/:path*",
  ],
};

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getProductAccess } from "@/lib/product-access";

const paidProtectedPaths = ["/ai-coach", "/journal", "/strategies"];

const featureProtectedPaths: Record<string, string> = {
  "/analyzer": "analyzer",
  "/scanner-automation": "scanner",
  "/automated-trader": "automation",
  "/referral-vault": "referral",
};

const authenticatedPaths = ["/profile", "/subscription", "/dashboard"];

// These unfinished/internal areas are deliberately unpublished.
// Only an authenticated administrator may open them, including by direct URL.
const adminOnlyPaths = [
  "/start",
  "/opportunity",
  "/plans",
  "/membership",
  "/partners",
  "/how-it-works",
  "/member-portal",
  "/api/marketing-leads",
];

const isPath = (pathname: string, path: string) =>
  pathname === path || pathname.startsWith(`${path}/`);

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  if (pathname === "/api/ai-scanner") {
    const url = request.nextUrl.clone();
    url.pathname = "/api/ai-scanner-state";
    return NextResponse.rewrite(url);
  }

  // The only public website pages are the homepage and the product-name catalogue.
  // Authentication screens remain available so a visitor can create/sign into an account.
  if (pathname === "/" || pathname === "/products" || pathname.startsWith("/auth/")) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const isAdminOnly = adminOnlyPaths.some(path => isPath(pathname, path));
  const isMemberPortalPath = isPath(pathname, "/member-portal");
  const isPaidProtected = paidProtectedPaths.some(path => isPath(pathname, path));
  const matchedFeaturePath = Object.keys(featureProtectedPaths).find(path => isPath(pathname, path));
  const isFeatureProtected = Boolean(matchedFeaturePath);
  const isAuthenticatedOnly = authenticatedPaths.some(path => isPath(pathname, path));

  // Unknown and unpublished pages must not be discoverable by unauthenticated visitors.
  if (!user) return new NextResponse(null, { status: 404 });

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

  // The Knowledge Base is part of the private build and is admin-only until publication.
  if (isMemberPortalPath) return isAdmin ? response : new NextResponse(null, { status: 404 });

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

  if (isPaidProtected) {
    if (isAdmin) return response;
    const access = await getProductAccess(user.id);
    const hasPaidAccess = access.anyPaidProduct;
    if (!hasPaidAccess) {
      const subscriptionUrl = request.nextUrl.clone();
      subscriptionUrl.pathname = "/subscription";
      subscriptionUrl.search = "";
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
    "/((?!api/|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)",
    "/api/ai-scanner",
    "/api/marketing-leads",
  ],
};

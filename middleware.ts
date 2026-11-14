import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getProductAccess } from "@/lib/product-access";

const paidProtectedPaths = ["/ai-coach", "/journal", "/risk-manager"];
const featureProtectedPaths: Record<string, string> = {
  "/analyzer": "analyzer",
  "/scanner-automation": "scanner",
  "/automated-trader": "automation",
  "/copy": "copy_trading",
  "/referral-vault": "referral",
  "/vaulttrades-community": "community",
  "/founders-mentorship": "founders_mentorship",
  "/winning-strategy": "community",
  "/strategies": "analyzer",
};
const publicPagePaths = [
  "/", "/products", "/start", "/opportunity", "/plans", "/subscription",
  "/membership/checkout", "/reseller-return", "/privacy-policy", "/community",
];
const authenticatedPaths = ["/profile", "/dashboard"];
const adminOnlyPaths = ["/membership", "/partners", "/how-it-works"];

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

  // Lead capture is intentionally public. The handler validates consent, input and honeypot.
  if (pathname === "/api/marketing-leads") {
    return request.method === "POST" ? response : new NextResponse(null, { status: 404 });
  }

  // Public marketing and checkout pages never grant product access.
  if (publicPagePaths.some(path => isPath(pathname, path)) || pathname.startsWith("/auth/")) return response;

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
  if (!user) return new NextResponse(null, { status: 404 });

  if (authenticatedPaths.some(path => isPath(pathname, path))) return response;

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("id,license_status,is_active,role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const isAdmin = !profileError && profile?.role === "admin";
  if (adminOnlyPaths.some(path => isPath(pathname, path))) {
    return isAdmin ? response : new NextResponse(null, { status: 404 });
  }

  if (isPath(pathname, "/member-portal")) {
    if (isAdmin) return response;
    if (!profile?.id) return new NextResponse(null, { status: 404 });
    const { data: resellerLicences } = await supabase
      .from("product_licenses")
      .select("entitlement_code,status,start_at,end_at")
      .eq("user_id", profile.id)
      .eq("status", "active")
      .in("entitlement_code", ["nexus", "vaulttrades_nexus", "nexus_plus", "vaulttrades_nexus_plus", "vortex", "vaulttrades_vortex"]);
    const now = Date.now();
    const hasResellerAccess = (resellerLicences ?? []).some(row => {
      const start = row.start_at ? new Date(row.start_at).getTime() : 0;
      const end = row.end_at ? new Date(row.end_at).getTime() : Number.POSITIVE_INFINITY;
      return Number.isFinite(start) && start <= now && end > now;
    });
    return hasResellerAccess ? response : new NextResponse(null, { status: 404 });
  }

  const matchedFeaturePath = Object.keys(featureProtectedPaths).find(path => isPath(pathname, path));
  if (matchedFeaturePath) {
    if (isAdmin) return response;
    const featureCode = featureProtectedPaths[matchedFeaturePath];
    const access = await getProductAccess(user.id);
    let allowed = false;

    if (featureCode === "analyzer") allowed = access.analyzer;
    else if (featureCode === "copy_trading") allowed = access.copy;
    else if (featureCode === "founders_mentorship") allowed = access.foundersMentorship;
    else if (featureCode === "referral") allowed = access.anyPaidProduct;
    else if (featureCode === "community") {
      const { data: featureAccess } = await supabase.rpc("has_feature_access", {
        p_auth_user_id: user.id,
        p_feature_code: "community",
      });
      allowed = featureAccess === true;

      // Existing community/mentorship licences are also accepted as the entitlement source.
      if (!allowed && profile?.id) {
        const { data: licences } = await supabase
          .from("product_licenses")
          .select("entitlement_code,status,start_at,end_at")
          .eq("user_id", profile.id)
          .eq("status", "active")
          .in("entitlement_code", ["community", "vaulttrades_community", "founders_mentorship"]);
        const now = Date.now();
        allowed = (licences ?? []).some(row => {
          const start = row.start_at ? new Date(row.start_at).getTime() : 0;
          const end = row.end_at ? new Date(row.end_at).getTime() : Number.POSITIVE_INFINITY;
          return Number.isFinite(start) && start <= now && end > now;
        });
      }
    } else {
      const { data: featureAccess } = await supabase.rpc("has_feature_access", {
        p_auth_user_id: user.id,
        p_feature_code: featureCode,
      });
      allowed = featureAccess === true;
    }

    if (!allowed) {
      const destination = request.nextUrl.clone();
      destination.pathname = "/subscription";
      destination.search = "";
      destination.searchParams.set("required", featureCode);
      return NextResponse.redirect(destination);
    }
    return response;
  }

  if (paidProtectedPaths.some(path => isPath(pathname, path))) {
    if (isAdmin) return response;
    const access = await getProductAccess(user.id);
    if (!access.anyPaidProduct) {
      const destination = request.nextUrl.clone();
      destination.pathname = "/subscription";
      destination.search = "";
      return NextResponse.redirect(destination);
    }
    return response;
  }

  const hasActiveMembership = !profileError && profile?.is_active === true && profile?.license_status === "active";
  if (!hasActiveMembership && !isAdmin) {
    const destination = request.nextUrl.clone();
    destination.pathname = "/subscription";
    destination.search = "";
    return NextResponse.redirect(destination);
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

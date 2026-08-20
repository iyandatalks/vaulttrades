import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_ROUTES = ["/analyzer", "/strategies", "/ai-coach", "/journal"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isProtected = PROTECTED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  if (!isProtected) return response;

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/join";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const { data: activeSubscription } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!activeSubscription) {
    const url = request.nextUrl.clone();
    url.pathname = "/subscription";
    url.searchParams.set("required", "subscription");
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/analyzer/:path*", "/strategies/:path*", "/ai-coach/:path*", "/journal/:path*"],
};

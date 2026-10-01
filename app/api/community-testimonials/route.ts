import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProductAccess } from "@/lib/product-access";

export const runtime = "nodejs";

export async function GET() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("community_testimonials")
    .select("id,display_name,product_code,testimonial,created_at")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(24);

  if (error) {
    return NextResponse.json({ error: "TESTIMONIALS_LOAD_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ testimonials: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "SIGN_IN_REQUIRED" }, { status: 401 });
  }

  const access = await getProductAccess(user.id);
  if (!access.anyPaidProduct || !access.userId) {
    return NextResponse.json(
      { error: "ACTIVE_PRODUCT_REQUIRED", message: "A purchased active VaultTrades product is required to submit a testimonial." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const testimonial = String(body.testimonial || "").trim();

  if (testimonial.length < 20 || testimonial.length > 1000) {
    return NextResponse.json(
      { error: "INVALID_TESTIMONIAL", message: "Your testimonial must be between 20 and 1,000 characters." },
      { status: 400 }
    );
  }

  const db = createAdminClient();
  const { data: profile } = await db
    .from("users")
    .select("first_name,last_name,email")
    .eq("id", access.userId)
    .maybeSingle();

  const displayName = [profile?.first_name, profile?.last_name?.charAt(0)]
    .filter(Boolean)
    .join(" ")
    .trim() || profile?.email?.split("@")[0] || "VaultTrades Member";

  const { data: license } = await db
    .from("product_licenses")
    .select("purchased_product_code,entitlement_code")
    .eq("user_id", access.userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await db.from("community_testimonials").insert({
    user_id: access.userId,
    display_name: displayName,
    product_code: license?.purchased_product_code ?? license?.entitlement_code ?? "paid_product",
    testimonial,
    status: "pending",
  });

  if (error) {
    return NextResponse.json({ error: "TESTIMONIAL_SUBMIT_FAILED" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: "Thank you. Your testimonial has been submitted for review.",
  });
}

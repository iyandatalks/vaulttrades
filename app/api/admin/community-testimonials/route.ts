import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

async function requireAdmin() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }) };

  const db = createServiceClient();
  const { data: profile } = await db
    .from("users")
    .select("id,role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
  }

  return { db, user };
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { data, error } = await auth.db
    .from("community_testimonials")
    .select("id,user_id,display_name,product_code,testimonial,status,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: "TESTIMONIALS_LOAD_FAILED" }, { status: 500 });
  return NextResponse.json({ testimonials: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => ({}));
  const id = String(body.id || "").trim();
  const status = String(body.status || "").trim();

  if (!id || !["approved", "rejected", "pending"].includes(status)) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const { error } = await auth.db
    .from("community_testimonials")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: "TESTIMONIAL_UPDATE_FAILED" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

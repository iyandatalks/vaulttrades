import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

export const dynamic = "force-dynamic";
const categories = ["Prop Firm", "Broker", "VaultTrades Product", "Tool", "Other"] as const;

async function getAdmin() {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  const db = createAdminClient();
  const { data: profile, error } = await db.from("users").select("role")
    .eq("auth_user_id", user.id).maybeSingle();
  if (error || profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Administrator access required." }, { status: 403 }) };
  }
  return { db, user };
}

function validate(body: any) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const cta_text = typeof body.cta_text === "string" ? body.cta_text.trim() : "";
  const target_url = typeof body.target_url === "string" ? body.target_url.trim() : "";
  const category = body.category;
  if (!title || title.length > 120) return "Title is required (maximum 120 characters).";
  if (!description || description.length > 500) return "Description is required (maximum 500 characters).";
  if (!categories.includes(category)) return "Choose a valid promotion category.";
  if (!cta_text || cta_text.length > 60) return "CTA text is required (maximum 60 characters).";
  if (!(target_url.startsWith("/") && !target_url.startsWith("//"))) {
    try {
      const url = new URL(target_url);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch { return "Enter a valid internal path or http/https URL."; }
  }
  const image_url = typeof body.image_url === "string" ? body.image_url.trim() : "";
  if (image_url) {
    try { const url = new URL(image_url); if (!["http:", "https:"].includes(url.protocol)) throw new Error(); }
    catch { return "Image URL must be a valid http or https URL."; }
  }
  if (body.starts_at && Number.isNaN(Date.parse(body.starts_at))) return "Start date is invalid.";
  if (body.ends_at && Number.isNaN(Date.parse(body.ends_at))) return "End date is invalid.";
  if (body.starts_at && body.ends_at && Date.parse(body.ends_at) <= Date.parse(body.starts_at)) return "End date must be after start date.";
  return null;
}

export async function GET() {
  const auth = await getAdmin();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.db.from("site_promotions").select("*")
    .order("display_order", { ascending: true }).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Could not load promotions." }, { status: 500 });
  return NextResponse.json({ promotions: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await getAdmin();
  if ("error" in auth) return auth.error;
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const problem = validate(body);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  const { data, error } = await auth.db.from("site_promotions").insert({
    title: body.title.trim(), description: body.description.trim(), category: body.category,
    image_url: body.image_url?.trim() || null, cta_text: body.cta_text.trim(),
    target_url: body.target_url.trim(), is_active: body.is_active === true,
    display_order: Number.isFinite(body.display_order) ? body.display_order : 0,
    starts_at: body.starts_at || null, ends_at: body.ends_at || null, created_by: auth.user.id,
  }).select("*").single();
  if (error) return NextResponse.json({ error: "Could not save promotion." }, { status: 500 });
  return NextResponse.json({ promotion: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await getAdmin();
  if ("error" in auth) return auth.error;
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  if (typeof body.id !== "string") return NextResponse.json({ error: "Promotion ID is required." }, { status: 400 });
  const { id, ...changes } = body;
  const allowed = ["title","description","category","image_url","cta_text","target_url","is_active","display_order","starts_at","ends_at"];
  if (Object.keys(changes).some(key => !allowed.includes(key))) return NextResponse.json({ error: "Unsupported field." }, { status: 400 });
  if (Object.keys(changes).some(key => ["title","description","category","cta_text","target_url","image_url","starts_at","ends_at"].includes(key))) {
    const problem = validate({
      title: changes.title ?? "Valid title", description: changes.description ?? "Valid description",
      category: changes.category ?? "Other", cta_text: changes.cta_text ?? "Explore",
      target_url: changes.target_url ?? "/", image_url: changes.image_url ?? "",
      starts_at: changes.starts_at ?? null, ends_at: changes.ends_at ?? null,
    });
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  }
  const { data, error } = await auth.db.from("site_promotions")
    .update({ ...changes, updated_at: new Date().toISOString() }).eq("id", id).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: "Could not update promotion." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Promotion not found." }, { status: 404 });
  return NextResponse.json({ promotion: data });
}

export async function DELETE(request: Request) {
  const auth = await getAdmin();
  if ("error" in auth) return auth.error;
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  if (typeof body.id !== "string") return NextResponse.json({ error: "Promotion ID is required." }, { status: 400 });
  const { error, count } = await auth.db.from("site_promotions").delete({ count: "exact" }).eq("id", body.id);
  if (error) return NextResponse.json({ error: "Could not remove promotion." }, { status: 500 });
  if (count === 0) return NextResponse.json({ error: "Promotion not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

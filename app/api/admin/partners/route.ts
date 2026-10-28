import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

export const dynamic = "force-dynamic";
const categories = ["Broker", "Prop Firm", "Tool", "VaultTrades Product"] as const;

async function getAdmin() {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  const db = createAdminClient();
  const { data: profile, error } = await db.from("users").select("role").eq("auth_user_id", user.id).maybeSingle();
  if (error || profile?.role !== "admin") return { error: NextResponse.json({ error: "Administrator access required." }, { status: 403 }) };
  return { db, user };
}

function validate(body: any) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const category = body.category;
  const referral_url = typeof body.referral_url === "string" ? body.referral_url.trim() : "";
  const cta_text = typeof body.cta_text === "string" ? body.cta_text.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  let parsed: URL | null = null;
  try { parsed = new URL(referral_url); } catch {}
  if (!name || name.length > 120) return "Partner name is required (maximum 120 characters).";
  if (!categories.includes(category)) return "Choose a valid partner category.";
  if (!parsed || !["http:", "https:"].includes(parsed.protocol)) return "Enter a valid http or https referral URL.";
  if (!cta_text || cta_text.length > 60) return "CTA text is required (maximum 60 characters).";
  if (!description || description.length > 1000) return "Description is required (maximum 1,000 characters).";
  return null;
}

export async function GET() {
  const auth = await getAdmin();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.db.from("partners").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Could not load partners." }, { status: 500 });
  return NextResponse.json({ partners: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await getAdmin();
  if ("error" in auth) return auth.error;
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const problem = validate(body);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  const { data, error } = await auth.db.from("partners").insert({
    name: body.name.trim(), category: body.category, referral_code: typeof body.referral_code === "string" ? body.referral_code.trim() || null : null,
    referral_url: body.referral_url.trim(), cta_text: body.cta_text.trim(), description: body.description.trim(),
    is_published: body.is_published === true, sort_order: Number.isFinite(body.sort_order) ? body.sort_order : 0, created_by: auth.user.id,
  }).select("*").single();
  if (error) return NextResponse.json({ error: "Partner could not be saved. Confirm the partner database migration has been applied." }, { status: 500 });
  return NextResponse.json({ partner: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await getAdmin();
  if ("error" in auth) return auth.error;
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  if (typeof body.id !== "string") return NextResponse.json({ error: "Partner ID is required." }, { status: 400 });
  const { id, ...changes } = body;
  if (Object.keys(changes).some((key) => !["name","category","referral_code","referral_url","cta_text","description","is_published","sort_order"].includes(key))) return NextResponse.json({ error: "Unsupported field." }, { status: 400 });
  if (["name","category","referral_url","cta_text","description"].some((key) => key in changes)) {
    const problem = validate({ ...changes, name: changes.name ?? "valid", category: changes.category ?? "Tool", referral_url: changes.referral_url ?? "https://example.com", cta_text: changes.cta_text ?? "Explore", description: changes.description ?? "Description" });
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  }
  const { data, error } = await auth.db.from("partners").update({ ...changes, updated_at: new Date().toISOString() }).eq("id", id).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: "Could not update partner." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Partner not found." }, { status: 404 });
  return NextResponse.json({ partner: data });
}

export async function DELETE(request: Request) {
  const auth = await getAdmin();
  if ("error" in auth) return auth.error;
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  if (typeof body.id !== "string") return NextResponse.json({ error: "Partner ID is required." }, { status: 400 });
  const { error, count } = await auth.db.from("partners").delete({ count: "exact" }).eq("id", body.id);
  if (error) return NextResponse.json({ error: "Could not remove partner." }, { status: 500 });
  if (count === 0) return NextResponse.json({ error: "Partner not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

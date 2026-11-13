import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { id } = await context.params;
  const db = createAdminClient();
  const { data: profile } = await db.from("users").select("id,role").eq("auth_user_id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "PROFILE_NOT_FOUND" }, { status: 404 });

  const { data: row } = await db.from("member_ea_licensing_requests")
    .select("id,user_id,status,download_storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!row || (row.user_id !== profile.id && profile.role !== "admin")) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (row.status !== "ready" || !row.download_storage_path) return NextResponse.json({ error: "DOWNLOAD_NOT_READY" }, { status: 409 });

  const { data, error } = await db.storage.from("member-ea-downloads").createSignedUrl(row.download_storage_path, 60);
  if (error || !data?.signedUrl) return NextResponse.json({ error: "DOWNLOAD_UNAVAILABLE" }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}

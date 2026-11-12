import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const db = createAdminClient();
  const { data: profile } = await db.from("users").select("id,role").eq("auth_user_id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const { id } = await context.params;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size < 1 || file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "Upload one EA file up to 20 MB." }, { status: 400 });
  }

  const originalName = file.name.toLowerCase();
  const extension = originalName.endsWith(".ex5") ? ".ex5" : originalName.endsWith(".zip") ? ".zip" : "";
  if (!extension) return NextResponse.json({ error: "Only compiled .ex5 files or a .zip package are accepted." }, { status: 400 });

  const { data: row } = await db.from("member_ea_licensing_requests")
    .select("id,auth_user_id,member_email,product_code,status")
    .eq("id", id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "REQUEST_NOT_FOUND" }, { status: 404 });

  const storagePath = `${id}/${crypto.randomUUID()}${extension}`;
  const { error: uploadError } = await db.storage.from("member-ea-downloads").upload(storagePath, file, {
    contentType: "application/octet-stream",
    upsert: false,
  });
  if (uploadError) return NextResponse.json({ error: "FILE_UPLOAD_FAILED", detail: uploadError.message }, { status: 500 });

  const now = new Date().toISOString();
  const { error: updateError } = await db.from("member_ea_licensing_requests").update({
    status: "ready",
    download_storage_path: storagePath,
    license_generated_at: now,
    reviewed_by: user.id,
    updated_at: now,
  }).eq("id", id);

  if (updateError) {
    await db.storage.from("member-ea-downloads").remove([storagePath]);
    return NextResponse.json({ error: "REQUEST_UPDATE_FAILED" }, { status: 500 });
  }

  await db.from("copy_profile_notifications").insert({
    auth_user_id: row.auth_user_id,
    title: "Your personalised EA is ready",
    body: "Your licensed EA file is now available in your VaultTrades Knowledge Base. Open the EA Download section to retrieve it.",
    action_href: "/member-portal",
    notification_type: "ea_licensing_ready",
    created_by: user.id,
    metadata: { request_id: row.id, product_code: row.product_code },
  });

  return NextResponse.json({ ok: true, message: "EA uploaded and made available to the member." });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const message = String(body.message || "").trim();
  if (!message) return NextResponse.json({ error: "MESSAGE_REQUIRED" }, { status: 400 });

  const db = createServiceClient();
  const { data, error } = await db.from("copy_support_requests").insert({
    auth_user_id: user.id,
    request_type: String(body.requestType || "PAIRING_RESET"),
    message,
  }).select("id,created_at,status").single();

  if (error) return NextResponse.json({ error: "SUPPORT_REQUEST_FAILED" }, { status: 500 });
  return NextResponse.json({ ok: true, request: data });
}

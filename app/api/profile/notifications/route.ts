import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });

  const db = createServiceClient();
  const { data, error } = await db
    .from("copy_profile_notifications")
    .select("id,title,body,action_href,notification_type,created_at,read_at")
    .eq("auth_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ error: "Unable to load notifications." }, { status: 500 });
  return NextResponse.json({ notifications: data ?? [] });
}

export async function PATCH(request: Request) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });

  let body: { id?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  if (!body.id) return NextResponse.json({ error: "Notification ID is required." }, { status: 400 });

  const db = createServiceClient();
  const { error } = await db.from("copy_profile_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", body.id)
    .eq("auth_user_id", user.id);

  if (error) return NextResponse.json({ error: "Unable to mark notification as read." }, { status: 500 });
  return NextResponse.json({ success: true });
}

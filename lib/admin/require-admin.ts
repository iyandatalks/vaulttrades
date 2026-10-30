import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function requireAdmin() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }) };
  const db = createServiceClient();
  const { data: profile, error } = await db.from("users")
    .select("id,role").eq("auth_user_id", user.id).maybeSingle();
  if (error) return { response: NextResponse.json({ error: "ROLE_LOOKUP_FAILED" }, { status: 500 }) };
  if (profile?.role !== "admin") return { response: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
  return { user, db };
}

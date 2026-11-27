import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ authenticated: false, isMrrMember: false });
  const admin = createAdminClient();
  const { data: profile } = await admin.from("users").select("role").eq("auth_user_id", user.id).maybeSingle();
  const role = String(profile?.role || "").toLowerCase();
  return NextResponse.json({ authenticated: true, isMrrMember: role === "partner" || role === "admin" });
}

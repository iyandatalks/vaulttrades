import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminAccessManagement from "./AdminAccessManagement";

export const metadata = { title: "Admin Access Management | VaultTrades" };

export default async function AdminAccessManagementPage() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) redirect("/login");
  const db = createAdminClient();
  const { data: profile } = await db.from("users").select("role").eq("auth_user_id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/member-portal");
  return <AdminAccessManagement />;
}

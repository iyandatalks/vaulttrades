import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import PromotionManager from "./PromotionManager";

export const dynamic = "force-dynamic";

export default async function AdminPromotionsPage() {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect("/auth/login?next=/admin/promotions");
  const db = createAdminClient();
  const { data: profile } = await db.from("users").select("role").eq("auth_user_id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/dashboard");

  return <main className="vt-info-page"><div className="vt-info-wrap" style={{maxWidth:1000}}>
    <header className="vt-info-hero">
      <div className="vt-label">ADMIN · SITE PROMOTIONS</div>
      <h1>Popup Promotion Management</h1>
      <p>Create, edit, schedule, activate, pause or remove the small promotional cards shown to visitors across VaultTrades.</p>
      <div className="vt-actions" style={{justifyContent:"flex-start",marginTop:18,flexWrap:"wrap"}}>
        <a className="vt-secondary" href="/admin/partners">Partner Management</a>
        <a className="vt-secondary" href="/">View Website</a>
      </div>
    </header>
    <PromotionManager />
  </div></main>;
}

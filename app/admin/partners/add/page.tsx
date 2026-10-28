import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import PartnerForm from "./PartnerForm";

export const dynamic = "force-dynamic";

export default async function AddPartnerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/admin/partners/add");

  const admin = createAdminClient();
  const { data: profile } = await admin.from("users").select("role").eq("auth_user_id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/dashboard");

  return (
    <main className="vt-info-page">
      <div className="vt-info-wrap" style={{ maxWidth: 820 }}>
        <header className="vt-info-hero">
          <div className="vt-label">ADMIN · ADD PARTNER</div>
          <h1>Add Partner</h1>
          <p>Add an approved broker, prop firm, tool or VaultTrades product. Drafts remain private until published.</p>
        </header>
        <section className="vt-info-card" style={{ marginTop: 24 }}>
          <PartnerForm />
        </section>
      </div>
    </main>
  );
}

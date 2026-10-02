import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { getProductAccess } from "../../lib/product-access";
import RiskManager from "../components/RiskManager";

export default async function RiskManagerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/risk-manager");
  const access = await getProductAccess(user.id);
  if (!access.anyPaidProduct) redirect("/dashboard");
  return <main className="vt-info-page"><div className="vt-info-wrap">
    <header className="vt-info-hero"><div className="vt-label">SHARED MEMBER TOOL</div><h1>Risk Manager</h1><p>Available to members with active VaultTrades access. Size positions from defined account risk, stop distance and available margin.</p></header>
    <RiskManager />
    <div style={{marginTop:16}}><Link className="vt-text-link" href="/dashboard">← Back to Dashboard</Link></div>
  </div></main>;
}

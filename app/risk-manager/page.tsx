import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { getProductAccess } from "../../lib/product-access";
import RiskManager from "../components/RiskManager";

type RiskManagerSearchParams = { entry?: string; sl?: string; tp1?: string; tp2?: string; tp3?: string; symbol?: string; strategy?: string; timeframe?: string; direction?: string; source?: string };

export default async function RiskManagerPage({ searchParams }: { searchParams: Promise<RiskManagerSearchParams> }) {
  const params = await searchParams;
  const numberParam = (value?: string) => value != null && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/risk-manager");
  const access = await getProductAccess(user.id);
  if (!access.tools) redirect("/subscription");
  return <main className="vt-info-page"><div className="vt-info-wrap">
    <header className="vt-info-hero"><div className="vt-label">SHARED MEMBER TOOL</div><h1>Risk Manager</h1><p>Available to eligible members with active VaultTrades access. Size positions from defined account risk, stop distance and available margin.</p></header>
    <RiskManager initialEntry={numberParam(params.entry)} initialStop={numberParam(params.sl)} initialTp1={numberParam(params.tp1)} initialTp2={numberParam(params.tp2)} initialTp3={numberParam(params.tp3)} symbol={params.symbol || "XAU/USD"} strategy={params.strategy || ""} timeframe={params.timeframe || ""} direction={params.direction || ""} source={params.source || ""} />
    <div style={{marginTop:16}}><Link className="vt-text-link" href="/dashboard">← Back to Dashboard</Link></div>
  </div></main>;
}

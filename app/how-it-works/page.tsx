import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCopyAccess } from "@/lib/copy-access";

const steps = [
  ["01", "ANALYZE", "Open Analyzer and identify the market context, structure, liquidity and strategy conditions. The objective is to understand where a setup may exist."],
  ["02", "MENTOR", "Use Founders Mentorship when you want the 7-day program and a 1-hour one-on-one session booked through the VaultTrades booking flow."],
  ["03", "COPY", "For Copy Trading, activate the monthly service and connect your MT5 account to the VaultTrades copy infrastructure."],
  ["04", "BUILD", "Use the Funded Account Wealth Builder to model capital, income goals, buffers and monthly return assumptions."],
  ["05", "REVIEW", "Use Journal and AI Coach to record decisions, review outcomes and understand the analysis behind a setup."],
] as const;

export const dynamic = "force-dynamic";

export default async function HowItWorksPage() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) redirect("/products?product=copy");

  const access = await getCopyAccess(user.id);
  if (!access.active) redirect("/products?product=copy");

  return (
    <main className="vt-info-page">
      <div className="vt-info-wrap">
        <header className="vt-info-hero">
          <div className="vt-label">HOW VAULTTRADES COPY WORKS</div>
          <h1>Copy Trading access and connection workflow.</h1>
          <p>This subscriber guide explains how an eligible VaultTrades master execution is delivered through the copy infrastructure to your connected MT5 account.</p>
        </header>

        <section className="vt-info-grid">
          <article className="vt-info-card"><div className="vt-number">01</div><h2>Activate access</h2><p>Purchase the Copy Trading subscription or wait for an administrator to grant access to your account.</p></article>
          <article className="vt-info-card"><div className="vt-number">02</div><h2>Connect MT5</h2><p>Open Manage MT5 Connection, generate a pairing code and enter it into the VaultTrades Copier EA.</p></article>
          <article className="vt-info-card"><div className="vt-number">03</div><h2>Verify connection</h2><p>Return to the connection status page and confirm the follower account is online and authorized before copying trades.</p></article>
        </section>

        <section className="vt-connection">
          <article className="vt-status-card">
            <div className="vt-label">COPY TRADING FLOW</div>
            <h2 style={{ margin: "10px 0 4px", fontSize: 25 }}>VAULTTRADES MASTER → COPY INFRASTRUCTURE → MT5</h2>
            <div className="vt-status-row"><span className="vt-status-name">VaultTrades master trade</span><span className="vt-status-pill">SIGNAL</span></div>
            <div className="vt-status-row"><span className="vt-status-name">Customer MT5 copier</span><span className="vt-status-pill">CONNECTED</span></div>
            <div className="vt-status-row"><span className="vt-status-name">VaultTrades authorization</span><span className="vt-status-pill">SECURE</span></div>
            <div className="vt-status-row"><span className="vt-status-name">Customer trading account</span><span className="vt-status-pill">COPY</span></div>
          </article>
          <article className="vt-technical">
            <div className="vt-label">ACCESS CONTROL</div>
            <h2 style={{ margin: "10px 0 8px", fontSize: 22 }}>Subscription or admin grant required</h2>
            <p>Only accounts with current Copy Trading entitlement can use the connection workflow. Broker User ID submission on the public Copy Trading page remains available to signed-in profiles without an active subscription.</p>
          </article>
        </section>

        <section className="vt-section" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <div className="vt-start">
            <div className="vt-label">COPY TRADING CONTROLS</div>
            <h2>Manage your MT5 connection.</h2>
            <p>Keep your MT5 account secure and verify that access is active before expecting trades to be copied.</p>
            <div className="vt-actions"><Link className="vt-primary" href="/copy/connect">Manage MT5 Connection</Link><Link className="vt-secondary" href="/copy">Back to Copy Trading</Link></div>
          </div>
        </section>
      </div>
    </main>
  );
}

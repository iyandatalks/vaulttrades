"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ProductCode = "nexus" | "nexus_plus" | "vortex";
type LinkMap = Record<ProductCode, string>;

const PRODUCTS: { code: ProductCode; name: string; detail: string }[] = [
  { code: "nexus", name: "VaultTrades Nexus", detail: "Create a PayPal link for $120 (MRR component)." },
  { code: "nexus_plus", name: "VaultTrades Nexus Plus", detail: "Create a PayPal link for $200 (MRR component)." },
  { code: "vortex", name: "VaultTrades Vortex", detail: "Create a PayPal link for $440 (MRR component)." },
];

const EMPTY: LinkMap = { nexus: "", nexus_plus: "", vortex: "" };

export default function ResellerOnboardingClient() {
  const [links, setLinks] = useState<LinkMap>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/reseller/payment-links", { cache: "no-store" })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Unable to load your saved links.");
        setLinks({ ...EMPTY, ...(data.links || {}) });
      })
      .catch(err => setError(err instanceof Error ? err.message : "Unable to load your saved links."))
      .finally(() => setLoading(false));
  }, []);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/reseller/payment-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ links }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to save PayPal links.");
      setMessage("Your PayPal payment links have been saved to your reseller profile.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save PayPal links.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="vt-member-shell">
      <header className="vt-member-header">
        <div>
          <span className="vt-member-kicker">RESELLER ONBOARDING</span>
          <h1>Payment link setup</h1>
          <p>Connect your PayPal checkout links to the correct VaultTrades membership products.</p>
        </div>
        <div className="vt-member-header-actions">
          <Link href="/member-portal" className="vt-member-outline">Back to Knowledge Base</Link>
        </div>
      </header>

      <div className="vt-member-layout" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
        <article className="vt-member-content">
          <span className="vt-member-kicker">STEP 1 · YOUR PAYPAL LINKS</span>
          <h2>One separate link for each MRR component</h2>
          <p className="vt-member-lead">Generate a separate PayPal link in your own account for the MRR component only. The once-off EA setup component is paid separately to VaultTrades after the reseller payment has been verified.</p>
          <div className="vt-member-table-wrap"><table className="vt-member-table"><thead><tr><th>Plan</th><th>Package price</th><th>Your PayPal link amount (80% MRR)</th><th>EA setup (20%)</th></tr></thead><tbody><tr><td>VaultTrades Nexus</td><td>$150</td><td><strong>$120</strong></td><td>$30 once-off</td></tr><tr><td>VaultTrades Nexus Plus</td><td>$250</td><td><strong>$200</strong></td><td>$50 once-off</td></tr><tr><td>VaultTrades Vortex</td><td>$550</td><td><strong>$440</strong></td><td>$110 once-off</td></tr></tbody></table></div>
          <p className="vt-member-note">The reseller earns 100% of the MRR amount shown. VaultTrades receives the separate 20% EA setup component. The $39 reseller website setup fee is a further once-off VaultTrades charge.</p>

          <form className="vt-member-form" onSubmit={save}>
            {PRODUCTS.map(product => (
              <label key={product.code}>
                {product.name}
                <input
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  maxLength={2048}
                  placeholder="https://www.paypal.com/..."
                  value={links[product.code]}
                  onChange={event => setLinks(current => ({ ...current, [product.code]: event.target.value }))}
                  disabled={loading || saving}
                />
                <small style={{ color: "#929eb1", fontWeight: 500 }}>{product.detail}</small>
              </label>
            ))}
            <p className="vt-member-form-note">Only HTTPS PayPal.com or PayPal.Me links are accepted. Keep your PayPal login details private; VaultTrades only needs the public payment URL.</p>
            {loading && <p className="vt-member-form-note">Loading your saved configuration…</p>}
            {error && <p className="vt-member-submit-message" role="alert">{error}</p>}
            {message && <p className="vt-member-submit-message" role="status">{message}</p>}
            <button className="vt-member-button" type="submit" disabled={loading || saving}>
              {saving ? "Saving…" : "Save PayPal links"}
            </button>
          </form>

          <section style={{ marginTop: 30 }}>
            <span className="vt-member-kicker">STEP 2 · HOW CHECKOUT IS ROUTED</span>
            <ol className="vt-member-steps">
              <li>The customer chooses Nexus, Nexus Plus or Vortex on your reseller website.</li>
              <li>The central registration form carries the selected product and your reseller attribution.</li>
              <li>The checkout uses the PayPal link saved for that exact product.</li>
              <li>The customer returns to VaultTrades after PayPal checkout.</li>
              <li>VaultTrades must verify the payment with PayPal before granting the purchased membership.</li>
            </ol>
            <div className="vt-member-pending">
              <strong>Payment verification is a separate security step.</strong>
              <span>A PayPal return page is not proof of payment. The live reseller-payment verification connection must be completed before customer memberships can be activated automatically from reseller-owned PayPal links.</span>
            </div>
          </section>

          <section style={{ marginTop: 30 }}>
            <span className="vt-member-kicker">STEP 3 · YOUR SERVICE ENTITLEMENTS</span>
            <h2>Separate services and subscriptions</h2>
            <div className="vt-member-table-wrap">
              <table className="vt-member-table">
                <thead><tr><th>Service</th><th>Access model</th></tr></thead>
                <tbody>
                  <tr><td>Signals</td><td>Paid subscription. Active subscribers receive private signals-group access.</td></tr>
                  <tr><td>Analyzer</td><td>Optional subscription — $20/month.</td></tr>
                  <tr><td>Journal and core tools</td><td>Required tools package — $10/month, purchased through the central Knowledge Base.</td></tr>
                  <tr><td>TradingView</td><td>Referral link for people who want to learn chart analysis.</td></tr>
                  <tr><td>EA</td><td>Once-off setup plus a 12-month licence, renewable annually. Approved broker and VPS required for automated execution.</td></tr>
                  <tr><td>Website</td><td>Separate once-off VaultTrades website setup fee to activate your four-page reseller website.</td></tr>
                </tbody>
              </table>
            </div>
            <p className="vt-member-note">Analyzer, tools, signals, EA setup and EA licensing remain independent entitlements. They are not silently included in the MRR membership commission.</p>
            <div className="vt-member-pending">
              <strong>Central Knowledge Base subscriptions</strong>
              <span>The $10/month tools package and optional $20/month Analyzer are separate VaultTrades subscriptions. Their checkout and access are controlled centrally, not by the reseller's PayPal membership links.</span>
            </div>
          </section>

          <section style={{ marginTop: 30 }}>
            <span className="vt-member-kicker">STEP 4 · COMMISSION RULE</span>
            <h2>100% MRR commission</h2>
            <p className="vt-member-lead">The reseller receives 100% commission on the eligible MRR membership component. VaultTrades' own website setup, EA setup/licence, tools, Analyzer and other separately priced services are excluded from that membership commission.</p>
            <p className="vt-member-note">The EA setup component must be shown separately in the customer's plan checkout and excluded from the reseller commission calculation. The final fee amount and plan component breakdown are centrally controlled by VaultTrades.</p>
          </section>
        </article>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";

type ProductCode = "nexus" | "nexus_plus" | "vortex";
type LinkMap = Record<ProductCode, string>;

const PRODUCTS: { code: ProductCode; name: string; detail: string }[] = [
  { code: "nexus", name: "VaultTrades Nexus – Automation", detail: "Create a PayPal link for $120 (MRR component)." },
  { code: "nexus_plus", name: "VaultTrades Nexus Plus – Automation", detail: "Create a PayPal link for $200 (MRR component)." },
  { code: "vortex", name: "VaultTrades Vortex – Automation", detail: "Create a PayPal link for $440 (MRR component)." },
];

const EMPTY: LinkMap = { nexus: "", nexus_plus: "", vortex: "" };

export default function ResellerOnboardingClient({ resellerCode }: { resellerCode: string }) {
  const [links, setLinks] = useState<LinkMap>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [copiedReturn, setCopiedReturn] = useState("");
  const returnUrl = (code: ProductCode) => `https://vaulttradesve.com/reseller-return?ref=${encodeURIComponent(resellerCode)}&plan=${encodeURIComponent(code)}`;
  async function copyReturnUrl(code: ProductCode) {
    try { await navigator.clipboard.writeText(returnUrl(code)); setCopiedReturn(code); }
    catch { setError("Unable to copy automatically. Select and copy the return URL shown."); }
  }

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

  async function save(event: FormEvent<HTMLFormElement>) {
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
          <p className="vt-member-lead">Create one PayPal payment link per membership plan in your own PayPal account. You collect only the MRR amount shown below. After your customer pays you, PayPal must automatically return them to the matching VaultTrades page so they can register their profile, declare the reseller payment and pay VaultTrades for the website and EA setup.</p>
          <div className="vt-member-table-wrap"><table className="vt-member-table"><thead><tr><th>Membership plan</th><th>EA product / checkout name</th><th>Package price</th><th>Your PayPal link amount (80% MRR)</th><th>EA setup (20%)</th></tr></thead><tbody><tr><td>VaultTrades Nexus</td><td>VaultTrades Nexus – Automation</td><td>$150</td><td><strong>$120</strong></td><td>$30 once-off</td></tr><tr><td>VaultTrades Nexus Plus</td><td>VaultTrades Nexus Plus – Automation</td><td>$250</td><td><strong>$200</strong></td><td>$50 once-off</td></tr><tr><td>VaultTrades Vortex</td><td>VaultTrades Vortex – Automation</td><td>$550</td><td><strong>$440</strong></td><td>$110 once-off</td></tr></tbody></table></div>
          <p className="vt-member-note">The reseller earns 100% of the MRR amount shown. VaultTrades receives the separate 20% EA setup component. The $39 reseller website setup fee is a further once-off VaultTrades charge.</p>
          <div className="vt-member-pending" style={{ marginTop: 18 }}>
            <strong>Important: set the VaultTrades return page on every PayPal link</strong>
            <span>For each product below, copy its matching return URL and paste it into PayPal's payment-link settings under Confirmation / Auto-return. Enable Auto-return. Do not use your own reseller website as the return address. Each link has its own plan and reseller reference, so the customer arrives at the correct VaultTrades checkout.</span>
            <span>You do not need a PayPal webhook, API integration, developer account, client ID or secret key. Do not share your PayPal login details with VaultTrades.</span>
          </div>
          <div className="vt-member-table-wrap" style={{ marginTop: 14 }}>
            <table className="vt-member-table">
              <thead><tr><th>PayPal link</th><th>VaultTrades return URL to paste into PayPal</th><th>Action</th></tr></thead>
              <tbody>{PRODUCTS.map(product => <tr key={product.code}>
                <td>{product.name}</td>
                <td><code style={{ overflowWrap: "anywhere", whiteSpace: "normal" }}>{returnUrl(product.code)}</code></td>
                <td><button type="button" className="vt-member-outline" onClick={() => void copyReturnUrl(product.code)}>{copiedReturn === product.code ? "Copied" : "Copy URL"}</button></td>
              </tr>)}</tbody>
            </table>
          </div>
          <p className="vt-member-note">Your reseller reference is <strong>{resellerCode}</strong>. Keep the plan-specific return URL paired with the correct PayPal link. If you change a link or its return settings, test it before sharing it with customers.</p>

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
            <span className="vt-member-kicker">STEP 2 · CUSTOMER CHECKOUT</span>
            <ol className="vt-member-steps">
              <li>The customer selects a membership plan on your reseller website and pays your matching PayPal link.</li>
              <li>PayPal automatically returns the customer to the VaultTrades URL configured for that plan.</li>
              <li>The customer completes their VaultTrades profile and the post-payment declaration form, including the amount, date, approximate time and PayPal transaction or invoice reference for the payment made to you.</li>
              <li>The customer then pays VaultTrades separately for the $39 website setup and the applicable EA setup fee. VaultTrades verifies this payment through its own PayPal checkout.</li>
              <li>You remain responsible for checking your own PayPal account and confirming to VaultTrades that the customer's MRR payment has actually arrived. Do not approve access based only on the customer's declaration or the PayPal return page.</li>
            </ol>
            <div className="vt-member-pending">
              <strong>Important: the two payments are verified separately.</strong>
              <span>VaultTrades' PayPal confirmation verifies only the fees paid to VaultTrades. It does not verify the money paid to you. The membership entitlement must remain pending until you have checked your PayPal account and confirmed receipt through the reseller confirmation process.</span>
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

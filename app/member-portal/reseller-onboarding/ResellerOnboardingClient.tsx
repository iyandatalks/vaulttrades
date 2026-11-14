"use client";

import Link from "next/link";

export default function ResellerOnboardingClient({ resellerCode }: { resellerCode: string }) {
  return (
    <main className="vt-member-shell">
      <header className="vt-member-header">
        <div>
          <span className="vt-member-kicker">RESELLER ONBOARDING</span>
          <h1>Payment setup</h1>
          <p>Your reseller payment destination and confirmation process.</p>
        </div>
        <div className="vt-member-header-actions">
          <Link href="/member-portal" className="vt-member-outline">Back to Knowledge Base</Link>
        </div>
      </header>

      <div className="vt-member-layout" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
        <article className="vt-member-content">
          <span className="vt-member-kicker">RESELLER PAYMENT DESTINATION</span>
          <h2>Your MRR payments are paid directly to you.</h2>
          <p className="vt-member-lead">Customers pay the eligible MRR component directly to the reseller. VaultTrades does not collect or automatically verify these reseller payments.</p>

          <div className="vt-member-table-wrap">
            <table className="vt-member-table">
              <thead><tr><th>Membership</th><th>Reseller MRR payment</th><th>Payment destination</th></tr></thead>
              <tbody>
                <tr><td>VaultTrades Nexus</td><td><strong>$120</strong></td><td>Your PayPal account</td></tr>
                <tr><td>VaultTrades Nexus Plus</td><td><strong>$200</strong></td><td>Your PayPal account</td></tr>
                <tr><td>VaultTrades Vortex</td><td><strong>$440</strong></td><td>Your PayPal account</td></tr>
              </tbody>
            </table>
          </div>

          <div className="vt-member-pending" style={{ marginTop: 18 }}>
            <strong>Your reseller PayPal links are not ready yet.</strong>
            <span>We will connect your plan-specific payment links after your reseller subdomain has been created. The payment-link setup fields are intentionally unavailable until that step is complete.</span>
          </div>

          <h2>How you confirm a customer's payment</h2>
          <ol className="vt-member-steps">
            <li>Open your own PayPal account and locate the customer's payment.</li>
            <li>Check the amount, payer and transaction status. Confirm that the payment is completed and not merely pending.</li>
            <li>Open the VaultTrades reseller payment verification page.</li>
            <li>Review the customer's declaration and compare it with the payment shown in your PayPal account.</li>
            <li>Confirm the declaration only when the payment has been received and verified. Reject it if the details do not match, and provide a clear reason.</li>
          </ol>

          <p className="vt-member-note">The detailed PayPal account setup, link creation and verification instructions will be published in the Knowledge Base under PayPal Setup. Do not share your PayPal password, security code or recovery details with VaultTrades.</p>

          <div className="vt-member-header-actions" style={{ marginTop: 22 }}>
            <Link href="/member-portal/reseller-payments" className="vt-member-button">Open payment verification</Link>
            <Link href="/member-portal" className="vt-member-outline">Open Knowledge Base</Link>
          </div>
          <p className="vt-member-form-note" style={{ marginTop: 18 }}>Reseller reference: <strong>{resellerCode}</strong></p>
        </article>
      </div>
    </main>
  );
}

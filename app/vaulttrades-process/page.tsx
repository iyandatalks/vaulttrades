import Link from "next/link";

const stages = [
  {
    number: "01",
    title: "Lead generation",
    label: "INITIAL INTEREST",
    description: "A person discovers VaultTrades and submits their details through the lead-capture journey. The information is stored for the VaultTrades team to review and follow up.",
    detail: "Submitting an enquiry does not create a membership, activate a product or confirm a payment.",
  },
  {
    number: "02",
    title: "Opportunity review",
    label: "UNDERSTAND THE MODEL",
    description: "The person reviews what VaultTrades offers, how the trading products and learning resources fit together, and what the reseller opportunity involves.",
    detail: "The Opportunity presentation is currently restricted to administrators while the final product and commercial terms are being reviewed.",
  },
  {
    number: "03",
    title: "Plan selection",
    label: "CHOOSE A MEMBERSHIP",
    description: "The person compares VaultTrades Nexus, VaultTrades Nexus Plus and VaultTrades Vortex and selects the package that matches their requirements.",
    detail: "The plan comparison must clearly show included products, plan-specific tools, services charged separately and any optional extras before checkout.",
  },
  {
    number: "04",
    title: "Membership activation",
    label: "VERIFIED PAYMENT",
    description: "The intended production flow verifies the payment server-to-server before creating the order record and granting the corresponding membership entitlement.",
    detail: "A browser success page or screenshot is not proof of payment. Payment-provider webhook verification and entitlement activation must be completed before this stage is treated as live.",
  },
  {
    number: "05",
    title: "Knowledge Base access",
    label: "ONBOARD & IMPLEMENT",
    description: "Once membership is active, the member opens the structured Knowledge Base and follows the guided steps for community access, broker and MT5 setup, personalised EA licensing, installation, learning resources and business tools.",
    detail: "Administrators can preview the Knowledge Base directly without purchasing a plan or completing checkout.",
  },
];

export default function VaultTradesProcessPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#050812", color: "#f4f6fb", padding: "42px 22px 80px" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ color: "#d4a637", fontSize: 10, fontWeight: 950, letterSpacing: ".18em" }}>VAULTTRADES · CUSTOMER JOURNEY</div>
        <h1 style={{ maxWidth: 850, margin: "12px 0", fontSize: "clamp(34px,5vw,54px)", lineHeight: 1.08, letterSpacing: "-.04em" }}>How the VaultTrades process works.</h1>
        <p style={{ maxWidth: 790, color: "#aeb9cb", fontSize: 16, lineHeight: 1.8 }}>
          This page explains the overall journey from first contact to member onboarding. It is separate from the existing Referral Programme and from the private Reseller Knowledge Base.
        </p>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10, margin: "30px 0" }}>
          {["Lead Generation", "Opportunity", "Plans", "Membership Activation", "Knowledge Base"].map((label, index) => (
            <div key={label} style={{ padding: 15, border: "1px solid rgba(212,166,55,.25)", borderRadius: 11, background: "#0b111d" }}>
              <span style={{ color: "#d4a637", fontSize: 10, fontWeight: 950 }}>STAGE 0{index + 1}</span>
              <strong style={{ display: "block", marginTop: 7, fontSize: 13 }}>{label}</strong>
            </div>
          ))}
        </section>

        <section style={{ display: "grid", gap: 13 }}>
          {stages.map((stage) => (
            <article key={stage.number} style={{ display: "grid", gridTemplateColumns: "70px minmax(0,1fr)", gap: 18, padding: "22px clamp(16px,3vw,28px)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 14, background: "#0b111d" }}>
              <div style={{ color: "#d4a637", fontSize: 25, fontWeight: 950 }}>{stage.number}</div>
              <div>
                <span style={{ color: "#d4a637", fontSize: 9, fontWeight: 950, letterSpacing: ".16em" }}>{stage.label}</span>
                <h2 style={{ margin: "5px 0 8px", fontSize: 21 }}>{stage.title}</h2>
                <p style={{ margin: 0, color: "#c1cad8", lineHeight: 1.75, fontSize: 13 }}>{stage.description}</p>
                <p style={{ margin: "10px 0 0", color: "#8f9caf", lineHeight: 1.65, fontSize: 11 }}>{stage.detail}</p>
              </div>
            </article>
          ))}
        </section>

        <section style={{ marginTop: 24, padding: 22, border: "1px solid rgba(212,166,55,.25)", borderRadius: 14, background: "rgba(212,166,55,.055)" }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 19 }}>Keep these programmes distinct</h2>
          <ul style={{ paddingLeft: 20, color: "#b9c3d2", lineHeight: 1.85, fontSize: 13 }}>
            <li><strong>Referral Programme:</strong> the existing eligible-product referral arrangement and its current commission rules.</li>
            <li><strong>Reseller Programme:</strong> the separate membership-sales opportunity and its final approved terms.</li>
            <li><strong>Knowledge Base:</strong> the interactive, topic-based member learning workspace with guides, attachments and action links.</li>
          </ul>
        </section>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 24 }}>
          <Link href="/profile" style={{ display: "inline-flex", padding: "12px 17px", borderRadius: 9, background: "#d4a637", color: "#050812", textDecoration: "none", fontWeight: 900, fontSize: 12 }}>Back to Profile</Link>
          <Link href="/member-portal" style={{ display: "inline-flex", padding: "12px 17px", borderRadius: 9, border: "1px solid rgba(212,166,55,.4)", color: "#e5bd55", textDecoration: "none", fontWeight: 900, fontSize: 12 }}>Open Knowledge Base</Link>
        </div>
      </div>
    </main>
  );
}

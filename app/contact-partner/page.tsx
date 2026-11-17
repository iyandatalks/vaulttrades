import PartnerNetworkSection from "../PartnerNetworkSection";

export const dynamic = "force-dynamic";

export default function ContactPartnerPage() {
  return (
    <main style={{ minHeight: "70vh", background: "#070a11", padding: "36px 20px 70px" }}>
      <div style={{ width: "min(1180px,100%)", margin: "0 auto", color: "#f6f4ef" }}>
        <div style={{ color: "#d7b45a", fontSize: 11, fontWeight: 800, letterSpacing: ".18em" }}>VAULTTRADES ACCESS ROUTE</div>
        <h1 style={{ fontSize: "clamp(34px,5vw,56px)", lineHeight: 1.05, margin: "14px 0" }}>Continue through an authorised partner.</h1>
        <p style={{ color: "#aab3c2", maxWidth: 760, lineHeight: 1.8 }}>
          To enquire about VaultTrades products, membership or the business opportunity, choose an active partner below. Their website will establish your referral route before you continue.
        </p>
      </div>
      <PartnerNetworkSection />
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";

type Partner = { name: string; url: string };

export default function PartnerNetworkSection({ compact = false }: { compact?: boolean }) {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/partner-directory", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Partner directory unavailable");
        const data = await response.json();
        setPartners(Array.isArray(data.partners) ? data.partners : []);
      })
      .catch(() => setPartners([]))
      .finally(() => setLoaded(true));
  }, []);

  return (
    <section style={{ padding: compact ? "62px 20px" : "28px 0 12px", background: compact ? "#0c111b" : "transparent", borderTop: compact ? "1px solid #252a33" : "none", borderBottom: compact ? "1px solid #252a33" : "none" }}>
      <div style={{ width: "min(1180px,100%)", margin: "0 auto" }}>
        <div style={{ color: "#d7b45a", fontSize: 11, fontWeight: 800, letterSpacing: ".18em" }}>AUTHORISED PARTNER NETWORK</div>
        <h2 style={{ color: "#f6f4ef", fontSize: "clamp(26px,3.5vw,38px)", lineHeight: 1.12, margin: "12px 0" }}>Connect through a VaultTrades partner.</h2>
        <p style={{ color: "#aab3c2", lineHeight: 1.7, maxWidth: 760, marginBottom: 24 }}>
          For product access, membership and business enquiries, continue through an active VaultTrades partner. Choose a partner below to open their official referral website.
        </p>
        {!loaded ? (
          <p style={{ color: "#aab3c2" }}>Loading active partners…</p>
        ) : partners.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
            {partners.map((partner) => (
              <a key={partner.url} href={partner.url} style={{ display: "block", padding: 22, minHeight: 130, border: "1px solid rgba(215,180,90,.35)", borderRadius: 7, background: "linear-gradient(145deg,#151b27,#090d15)", color: "#f6f4ef", textDecoration: "none" }}>
                <span style={{ display: "block", color: "#d7b45a", fontSize: 10, fontWeight: 800, letterSpacing: ".14em" }}>ACTIVE VAULTTRADES PARTNER</span>
                <strong style={{ display: "block", fontSize: 20, margin: "13px 0" }}>{partner.name}</strong>
                <span style={{ color: "#e2c77e", fontSize: 11, fontWeight: 800, letterSpacing: ".06em" }}>CONTACT PARTNER →</span>
              </a>
            ))}
          </div>
        ) : (
          <p style={{ color: "#c5ccd6", lineHeight: 1.7 }}>There are no active partner websites available right now. Please contact VaultTrades for assistance.</p>
        )}
        <p style={{ color: "#7e8796", fontSize: 11, marginTop: 18 }}>All active partner websites are listed here as they are approved. When the network grows, the directory will display the full active list, including five or more partners when available.</p>
      </div>
    </section>
  );
}

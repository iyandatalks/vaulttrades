import Link from "next/link";

const WOMENS_FOUNDERS_URL = "https://vaulttradesve.com/womens-provincial-founders";

export default function WomensFoundersPromo() {
  return (
    <section
      className="vt-womens-promo"
      style={{
        padding: "22px 20px",
        background: "#090d15",
        borderTop: "1px solid #29251b",
        borderBottom: "1px solid #29251b",
      }}
    >
      <div
        className="vt-womens-promo-inner"
        style={{
          width: "min(1180px, 100%)",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "minmax(150px, 220px) 1fr auto",
          gap: 18,
          alignItems: "center",
        }}
      >
        <div style={{ background: "#111722", border: "1px solid rgba(215,180,90,.45)", borderRadius: 6, overflow: "hidden" }}>
          <img
            src="/images/womens-founders.jpg"
            alt="Women coming together in business"
            style={{
              display: "block",
              width: "100%",
              aspectRatio: "3 / 2",
              height: "auto",
              objectFit: "contain",
            }}
          />
        </div>
        <div>
          <div style={{ color: "#d7b45a", fontSize: 10, fontWeight: 900, letterSpacing: ".16em" }}>
            ♛ VAULTTRADES WOMEN'S FOUNDING OPPORTUNITY
          </div>
          <h2 style={{ color: "#f6f4ef", fontSize: "clamp(18px,2.4vw,26px)", margin: "7px 0 4px" }}>
            81 WOMEN. 9 PROVINCES. ONE SHARED VISION.
          </h2>
          <p style={{ color: "#aab3c2", fontSize: 13, margin: 0 }}>
            Women's Provincial Founding Partners — a collective business opportunity for women.
          </p>
        </div>
        <a
          href={WOMENS_FOUNDERS_URL}
          style={{
            background: "#d7b45a",
            color: "#090b10",
            padding: "13px 15px",
            borderRadius: 4,
            fontWeight: 900,
            fontSize: 11,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          EXPLORE ↗
        </a>
      </div>
      <style>{`
        @media (max-width: 620px) {
          .vt-womens-promo-inner {
            grid-template-columns: 90px 1fr !important;
            gap: 12px !important;
          }
          .vt-womens-promo-inner > a {
            grid-column: 1 / -1;
            text-align: center;
          }
        }
      `}</style>
    </section>
  );
}

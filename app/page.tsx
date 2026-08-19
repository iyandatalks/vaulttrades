import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ minHeight: "calc(100vh - 61px)", background: "#050812", color: "#f4f6fb" }}>
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "72px 24px 64px", textAlign: "center" }}>
        <img src="/vaulttrades-logo.png" alt="VaultTrades" style={{ width: 180, maxWidth: "60vw", height: "auto", margin: "0 auto 18px" }} />
        <div style={{ color: "#d4a637", fontSize: 13, fontWeight: 800, letterSpacing: ".2em", marginBottom: 12 }}>
          Built by Traders.
        </div>
        <div style={{ color: "#aeb5c6", fontSize: 16, marginBottom: 34 }}>
          Focus, discipline, consistency.
        </div>
        <h1 style={{ maxWidth: 850, margin: "0 auto", fontSize: "clamp(42px, 7vw, 78px)", lineHeight: 1.02, letterSpacing: "-.04em" }}>
          Analyze with strategy. Learn with clarity.
        </h1>
        <p style={{ maxWidth: 680, margin: "26px auto 34px", color: "#aeb5c6", fontSize: 18, lineHeight: 1.7 }}>
          VaultTrades is a strategy-driven market analysis and trading education platform. Select a defined strategy, analyze the chart, and learn why a setup is confirmed, developing, waiting, or invalid.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/analyzer" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "14px 26px", borderRadius: 9, background: "#d4a637", color: "#050812", fontWeight: 800, textDecoration: "none" }}>
            Open Analyzer
          </Link>
          <Link href="/strategies" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "14px 26px", borderRadius: 9, border: "1px solid rgba(212,166,55,.45)", color: "#f4f6fb", fontWeight: 800, textDecoration: "none" }}>
            Explore Strategies
          </Link>
        </div>
      </section>

      <footer style={{ borderTop: "1px solid rgba(255,255,255,.08)", padding: "34px 24px 40px", color: "#7f8799", fontSize: 12, textAlign: "center" }}>
        <div style={{ color: "#f4f6fb", fontWeight: 800, letterSpacing: ".12em", marginBottom: 10 }}>VAULTTRADES</div>
        <div>Built by Traders. Focus, discipline, consistency.</div>
        <p style={{ maxWidth: 900, margin: "18px auto 10px", lineHeight: 1.7 }}>
          <strong>Disclaimer:</strong> VaultTrades is an analytical tool designed to assist with market analysis and strategy evaluation. It does not provide financial advice, investment advice or a guarantee of trading results. Trading involves substantial risk and users remain solely responsible for their own trading decisions.
        </p>
        <div>© 2026 VaultTrades. All rights reserved.</div>
      </footer>
    </main>
  );
}

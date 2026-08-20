import Link from "next/link";

export default function LandingPage() {
  return (
    <main style={{ minHeight: "calc(100vh - 61px)", background: "#050812", color: "#f4f6fb" }}>
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "96px 24px 72px", textAlign: "center" }}>
        <div style={{ color: "#d4a637", fontSize: 13, fontWeight: 800, letterSpacing: ".2em", marginBottom: 18 }}>VAULTTRADES</div>
        <h1 style={{ maxWidth: 850, margin: "0 auto", fontSize: "clamp(42px, 7vw, 78px)", lineHeight: 1.02, letterSpacing: "-.04em" }}>Trade with a strategy. Analyze with clarity.</h1>
        <p style={{ maxWidth: 680, margin: "26px auto 34px", color: "#aeb5c6", fontSize: 18, lineHeight: 1.7 }}>Upload your chart, choose a VaultTrades strategy, and get a structured market analysis with entry, risk, targets and setup reasoning.</p>
        <Link href="/join" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "14px 26px", borderRadius: 9, background: "#d4a637", color: "#050812", fontWeight: 800, textDecoration: "none" }}>Get Access</Link>
      </section>
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "0 24px 80px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        {[["Analyzer", "Upload a chart and analyze it against a defined VaultTrades strategy."], ["Strategies", "See the strategies available to subscribers and understand their rules."], ["AI Coach", "Ask questions about your current setup and analysis."], ["Journal", "Record your own trades, outcomes and notes without storing screenshots."]].map(([title, text]) => (
          <article key={title} style={{ border: "1px solid rgba(212,166,55,.2)", borderRadius: 12, padding: 22, background: "#0a0f1c" }}><h2 style={{ margin: "0 0 10px", fontSize: 20 }}>{title}</h2><p style={{ margin: 0, color: "#aeb5c6", lineHeight: 1.6 }}>{text}</p></article>
        ))}
      </section>
      <footer style={{ borderTop: "1px solid rgba(255,255,255,.08)", padding: "24px", color: "#7f8799", fontSize: 12, textAlign: "center" }}>
        <p style={{ margin: "0 0 8px" }}>Trading involves risk. VaultTrades provides analysis and educational information, not financial advice or a guarantee of results.</p>
        <p style={{ margin: 0 }}>© {new Date().getFullYear()} VaultTrades. All rights reserved.</p>
      </footer>
    </main>
  );
}

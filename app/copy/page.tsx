import Link from "next/link";

export default function CopyPage() {
  return (
    <main className="vt-info-page">
      <div className="vt-info-wrap">
        <header className="vt-info-hero">
          <div className="vt-label">VAULTTRADES COPY</div>
          <h1>Copy VaultTrades trades to your MT5 account.</h1>
          <p>
            VaultTrades Copy is the execution product for customers who want their MT5 account
            connected to the VaultTrades trading infrastructure. You do not need TradingView,
            webhook configuration or access to the underlying strategy.
          </p>
          <div className="vt-actions" style={{ justifyContent: "flex-start", marginTop: 20 }}>
            <Link className="vt-primary" href="/copy/connect">Connect MT5</Link>
            <Link className="vt-secondary" href="/how-it-works">How It Works</Link>
          </div>
        </header>

        <section className="vt-info-grid">
          <article className="vt-info-card">
            <div className="vt-number">01</div>
            <h2>VaultTrades Master</h2>
            <p>The VaultTrades trading engine runs on the master MT5 account. The customer does not manage or configure the underlying strategy.</p>
          </article>
          <article className="vt-info-card">
            <div className="vt-number">02</div>
            <h2>VaultTrades Copy Engine</h2>
            <p>Executed master trades are published to the VaultTrades copy infrastructure and routed to connected customer accounts.</p>
          </article>
          <article className="vt-info-card">
            <div className="vt-number">03</div>
            <h2>Your MT5 Account</h2>
            <p>The VaultTrades Copier EA receives the authorized trade instructions and executes them on the MT5 account you connected.</p>
          </article>
        </section>

        <section className="vt-info-card" style={{ marginTop: 24 }}>
          <div className="vt-label">WHAT YOU SEE</div>
          <h2 style={{ marginTop: 10 }}>Only the copy product.</h2>
          <p>
            Strategy logic, master-account controls and the copy infrastructure remain internal
            VaultTrades components. Customers use the Copy connection, account status and
            execution information relevant to their own account.
          </p>
          <div className="vt-actions" style={{ justifyContent: "flex-start", marginTop: 16 }}>
            <Link className="vt-secondary" href="/dashboard">Open Dashboard</Link>
          </div>
        </section>

        <section className="vt-info-card" style={{ marginTop: 24, border: "1px solid rgba(212,166,55,.28)" }}>
          <div className="vt-label">IMPORTANT</div>
          <p style={{ marginBottom: 0 }}>
            VaultTrades Copy is separate from Analyzer. Analyzer is for discretionary market
            analysis and trade planning. Copy is for connecting an MT5 account to the VaultTrades
            execution infrastructure. Trading involves substantial risk and copying trades does
            not guarantee profits.
          </p>
        </section>
      </div>
    </main>
  );
}

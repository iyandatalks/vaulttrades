import Link from "next/link";

export default function WinningStrategyPage() {
  return (
    <main className="vt-winning-page">
      <section className="vt-winning-hero">
        <div className="vt-winning-kicker">VAULTTRADES · STRATEGY FRAMEWORK</div>
        <h1>Trade the structure.<br /><span>Not the noise.</span></h1>
        <p>VaultTrades Winning Strategy brings order-flow context, institutional order blocks and Fibonacci price levels into one structured trade-planning framework.</p>
        <div className="vt-winning-actions"><Link href="/auth/register?next=%2Fwinning-strategy" className="vt-winning-primary">Create a VaultTrades account →</Link><Link href="/auth/login?next=%2Fwinning-strategy" className="vt-winning-secondary">Already registered? Sign in</Link></div>
        <div className="vt-winning-note">Available at no charge to registered VaultTrades Community members. Account registration alone does not automatically establish Community membership or paid-product access.</div>
      </section>
      <section className="vt-winning-grid">
        <article><span>01 / ORDER FLOW</span><h2>Read the context behind price.</h2><p>Assess directional flow and the market movement that established a meaningful trading area.</p></article>
        <article><span>02 / INSTITUTIONAL FOOTPRINT</span><h2>Focus on qualified order blocks.</h2><p>Use relevant historical order-block areas as part of the setup framework rather than chasing a move after it has already happened.</p></article>
        <article><span>03 / PRICE LEVELS</span><h2>Plan around Fibonacci levels.</h2><p>Use defined Fibonacci price zones to frame potential entries and structure a trade plan.</p></article>
        <article><span>04 / RISK & TARGET</span><h2>Define invalidation and target.</h2><p>Set a stop-loss level and a targeted take-profit area before considering execution. No setup removes market risk.</p></article>
      </section>
      <section className="vt-winning-bottom"><div className="vt-winning-kicker">A PROCESS, NOT A PROMISE</div><h2>Structure first. Risk defined. Execution disciplined.</h2><p>The strategy is an analytical framework, not a signal guarantee or promise of profitability. Traders remain responsible for validating conditions and managing risk.</p><div className="vt-winning-actions"><Link href="/vaulttrades-community" className="vt-winning-primary">Explore VaultTrades Community →</Link><Link href="/products#analyzer" className="vt-winning-secondary">Compare with Analyzer</Link></div></section>
    </main>
  );
}

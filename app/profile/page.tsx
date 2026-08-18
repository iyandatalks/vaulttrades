export default function ProfilePage() {
  return (
    <main className="shell">
      <section className="card">
        <div className="section-label">PROFILE</div>
        <h1 className="title">Your VaultTrades Profile</h1>
        <p className="muted">Account, subscription and referral information will live here.</p>
        <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
          <div className="card" style={{ margin: 0 }}><strong>Referral Link</strong><p className="muted">Your unique referral link will appear here.</p></div>
          <div className="card" style={{ margin: 0 }}><strong>Successful Purchases</strong><p className="muted">Only successful purchases count toward referral credit.</p></div>
          <div className="card" style={{ margin: 0 }}><strong>Paid Out</strong><p className="muted">Your confirmed referral payouts will appear here.</p></div>
        </div>
      </section>
    </main>
  );
}

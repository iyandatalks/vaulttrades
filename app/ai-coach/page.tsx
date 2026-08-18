export default function AICoachPage() {
  return (
    <main className="shell">
      <section className="card coach-card">
        <div className="section-label">AI COACH</div>
        <h1 className="title">Ask About Your Setup</h1>
        <p className="muted">The AI Coach will explain the selected strategy and analysis. It does not create or change the strategy engine's trade signal.</p>
        <div className="coach-question" style={{ marginTop: 24 }}>
          <input type="text" placeholder="Ask the AI Coach a question..." />
          <button type="button" className="primary">Ask</button>
        </div>
      </section>
    </main>
  );
}

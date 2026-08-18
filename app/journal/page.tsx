"use client";

import { useState } from "react";

export default function JournalPage() {
  const [result, setResult] = useState("Win");
  return (
    <main className="shell">
      <section className="card">
        <div className="section-label">JOURNAL</div>
        <h1 className="title">Trading Journal</h1>
        <p className="muted">Record your trades, outcomes and notes. Screenshots are intentionally not stored.</p>
        <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
          <input className="coach-question" placeholder="Instrument / setup" />
          <select value={result} onChange={(e) => setResult(e.target.value)}>
            <option>Win</option><option>Loss</option><option>Break Even</option>
          </select>
          <textarea placeholder="Trade notes..." rows={6} />
          <button className="primary" type="button">Save Journal Entry</button>
        </div>
      </section>
    </main>
  );
}

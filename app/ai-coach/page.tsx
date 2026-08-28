"use client";

import { useState } from "react";
import MarketTimingIntelligenceEngine from "./MarketTimingIntelligenceEngine";

export default function AICoachPage() {
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [loading, setLoading] = useState(false);

  const ask = async () => {
    if (!q.trim()) return;
    setLoading(true);
    setA("");
    try {
      const r = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Unable to get a response.");
      setA(d.answer || "No answer returned.");
      setQ("");
    } catch (e) {
      setA(e instanceof Error ? e.message : "Unable to get a response.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="shell">
      <MarketTimingIntelligenceEngine />
      <section className="card">
        <div className="section-label">AI COACH</div>
        <h1 className="title">Learn from the Analysis</h1>
        <p className="muted">
          Ask questions about trading concepts, strategy rules, or why a setup is confirmed, developing, waiting, or invalid. AI Coach explains; the Strategy Engine remains the source of truth.
        </p>
        <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
          <textarea
            className="coach-question"
            rows={5}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ask the AI Coach a question..."
          />
          <button className="primary" type="button" onClick={() => void ask()} disabled={loading || !q.trim()}>
            {loading ? "Thinking..." : "Ask AI Coach"}
          </button>
          {a && (
            <div className="condition-box">
              <strong>AI Coach</strong>
              <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{a}</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

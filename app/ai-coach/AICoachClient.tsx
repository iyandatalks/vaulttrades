"use client";

import { useState } from "react";
import MarketTimingIntelligenceEngine from "./MarketTimingIntelligenceEngine";

const FAQS = [
  "Why did price not go directly to final TP?",
  "Why should I collect partial profit at TP1?",
  "When can I consider moving to break-even?",
  "What liquidity is price targeting next?",
  "How do I tell continuation from reversal?",
  "Can I collect 70% and wait for the remaining target?",
  "What happens when price reaches a high-risk zone?",
  "Explain the XAUUSD 4276 → 4318 → 4332 example.",
];

export default function AICoachClient() {
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [loading, setLoading] = useState(false);

  const ask = async (question = q) => {
    if (!question.trim()) return;
    setLoading(true);
    setA("");
    try {
      const r = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
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
          Ask questions about trading concepts, session profiling, liquidity, trade management, or why a setup is confirmed, developing, waiting, or invalid. AI Coach explains; the Strategy Engine remains the source of truth.
        </p>

        <div style={{ marginTop: 24 }}>
          <div className="section-label">FREQUENTLY ASKED QUESTIONS</div>
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {FAQS.map((faq) => (
              <button
                key={faq}
                type="button"
                className="condition-box"
                onClick={() => { setQ(faq); void ask(faq); }}
                disabled={loading}
                style={{ textAlign: "left", cursor: loading ? "wait" : "pointer" }}
              >
                {faq}
              </button>
            ))}
          </div>
        </div>

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

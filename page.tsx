"use client";

import { useState } from "react";

type Strategy = "kill_zone" | "ema" | "continuation";

const strategies: Record<Strategy, { name: string; description: string }> = {
  kill_zone: {
    name: "London Kill Zone",
    description: "Asian liquidity range → London sweep → MSS → FVG retracement."
  },
  ema: {
    name: "EMA Pullback",
    description: "30M bias → EMA20 trend → volume/momentum → pullback/rejection."
  },
  continuation: {
    name: "Continuation",
    description: "M15 direction → expansion → correction → actual continuation → entry."
  }
};

export default function Home() {
  const [strategy, setStrategy] = useState<Strategy>("kill_zone");
  const [image, setImage] = useState("");
  const [fileName, setFileName] = useState("");

  function onFile(file?: File) {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
  }

  return (
    <main className="shell">
      <header className="header">
        <div>
          <div className="brand">VAULTTRADES AI</div>
          <div className="muted">Build 1 · Strategy Engine + Chart Analyzer</div>
        </div>
        <div className="badge">v0.1 foundation</div>
      </header>

      <section className="grid">
        <aside className="card">
          <h1 className="title">Choose strategy</h1>
          <p className="muted">The selected strategy will be the primary analysis engine.</p>

          {(Object.keys(strategies) as Strategy[]).map((id) => (
            <button
              key={id}
              className={`strategy ${strategy === id ? "active" : ""}`}
              onClick={() => setStrategy(id)}
            >
              <strong>{strategies[id].name}</strong>
              <span className="muted">{strategies[id].description}</span>
            </button>
          ))}
        </aside>

        <section className="card">
          <h1 className="title">Chart Analyzer</h1>
          <p className="muted">
            Selected: <strong>{strategies[strategy].name}</strong>. Upload a chart screenshot
            to begin the analysis workflow.
          </p>

          <label className="upload">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <strong>{fileName || "Upload chart screenshot"}</strong>
            <div className="muted">PNG, JPG or WebP</div>
            {image && <img className="preview" src={image} alt="Uploaded trading chart" />}
          </label>

          <div className="actions">
            <button className="primary" disabled={!image}>
              Analyze {strategies[strategy].name}
            </button>
            <button className="secondary" onClick={() => { setImage(""); setFileName(""); }}>
              Clear
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}
"use client";

import { ChangeEvent, useState } from "react";

type Strategy = "killZone" | "ema" | "continuation";

const strategies = {
  killZone: {
    name: "Killer Zone",
    description: "London Kill Zone model",
    detail:
      "Time-specific London liquidity and reversal/continuation analysis",
  },

  ema: {
    name: "EMA",
    description: "EMA trend model",
    detail:
      "24-hour model requiring trend, volume and momentum confirmation",
  },

  continuation: {
    name: "Continuation",
    description: "Continuation model",
    detail:
      "Trend expansion → correction → retest/balance → continuation",
  },
};

export default function Home() {
  const [strategy, setStrategy] = useState<Strategy>("killZone");
  const [chart, setChart] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");

  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload a chart image.");
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();

    reader.onload = () => {
      setChart(reader.result as string);
    };

    reader.readAsDataURL(file);
  }

  function clearChart() {
    setChart(null);
    setFileName("");
  }

  return (
    <main className="shell">

      <header className="header">

        <div>
          <div className="brand">
            VAULTTRADES AI
          </div>

          <div className="muted">
            Strategy-driven chart analysis
          </div>
        </div>

        <div className="badge">
          BUILD 1
        </div>

      </header>

      <div className="grid">

        {/* STRATEGY PANEL */}

        <section className="card">

          <h2 className="title">
            Select Strategy
          </h2>

          <p className="muted">
            Choose the strategy you want the chart analyzer to apply.
          </p>

          <button
            className={`strategy ${
              strategy === "killZone" ? "active" : ""
            }`}
            onClick={() => setStrategy("killZone")}
          >
            <strong>
              Killer Zone
            </strong>

            <span className="muted">
              London Kill Zone model
            </span>
          </button>

          <button
            className={`strategy ${
              strategy === "ema" ? "active" : ""
            }`}
            onClick={() => setStrategy("ema")}
          >
            <strong>
              EMA
            </strong>

            <span className="muted">
              24-hour trend, volume and momentum model
            </span>
          </button>

          <button
            className={`strategy ${
              strategy === "continuation" ? "active" : ""
            }`}
            onClick={() => setStrategy("continuation")}
          >
            <strong>
              Continuation
            </strong>

            <span className="muted">
              Expansion → correction → retest → continuation
            </span>
          </button>

        </section>


        {/* CHART ANALYZER */}

        <section className="card">

          <h2 className="title">
            Chart Analyzer
          </h2>

          <p className="muted">
            Strategy selected:{" "}
            <strong>
              {strategies[strategy].name}
            </strong>
          </p>

          <div
            className="upload"
            onClick={() =>
              document
                .getElementById("chart-upload")
                ?.click()
            }
          >

            <input
              id="chart-upload"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={handleUpload}
            />

            {!chart ? (
              <>
                <strong>
                  Upload TradingView Chart
                </strong>

                <div className="muted">
                  PNG, JPG or WebP
                </div>
              </>
            ) : (
              <>
                <strong>
                  {fileName}
                </strong>

                <img
                  src={chart}
                  alt="Uploaded trading chart"
                  className="preview"
                />
              </>
            )}

          </div>


          <div className="actions">

            <button
              className="primary"
              disabled={!chart}
              onClick={() =>
                alert(
                  "AI analysis engine will be connected in the next build."
                )
              }
            >
              Analyze Chart
            </button>

            <button
              className="secondary"
              onClick={clearChart}
            >
              Clear
            </button>

          </div>

        </section>

      </div>


      {/* CURRENT STRATEGY */}

      <section
        className="card"
        style={{ marginTop: "20px" }}
      >

        <h2 className="title">
          Selected Strategy
        </h2>

        <p>
          <strong>
            {strategies[strategy].name}
          </strong>
        </p>

        <p className="muted">
          {strategies[strategy].description}
        </p>

        <p className="muted">
          {strategies[strategy].detail}
        </p>

      </section>

    </main>
  );
}

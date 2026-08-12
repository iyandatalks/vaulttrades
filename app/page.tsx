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
    description: "EMA20 Pullback Morning Engine",
    detail:
      "EMA20 pullback, market structure, rejection, break/reclaim, UT Bot OR SMI confirmation",
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

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [fileName, setFileName] = useState("");

  const [analysis, setAnalysis] = useState("");

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  // ============================================================
  // UPLOAD
  // ============================================================

  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload a chart image.");
      return;
    }

    setSelectedFile(file);
    setFileName(file.name);
    setAnalysis("");
    setError("");

    const reader = new FileReader();

    reader.onload = () => {
      setChart(reader.result as string);
    };

    reader.readAsDataURL(file);
  }

  // ============================================================
  // CLEAR
  // ============================================================

  function clearChart() {
    setChart(null);
    setSelectedFile(null);
    setFileName("");
    setAnalysis("");
    setError("");
  }

  // ============================================================
  // ANALYZE CHART
  // ============================================================

  async function analyzeChart() {
    if (!selectedFile) {
      setError("Please upload a chart first.");
      return;
    }

    setLoading(true);
    setAnalysis("");
    setError("");

    try {
      const formData = new FormData();

      formData.append("image", selectedFile);
      formData.append("strategy", strategy);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Unable to analyze the chart."
        );
      }

      if (!data?.analysis) {
        throw new Error(
          "The AI returned an empty analysis."
        );
      }

      setAnalysis(data.analysis);
    } catch (err) {
      console.error("Chart analysis error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to analyze the chart."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">

      {/* ========================================================
          HEADER
      ======================================================== */}

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
          AI ENGINE
        </div>

      </header>


      <div className="grid">

        {/* ======================================================
            STRATEGY PANEL
        ====================================================== */}

        <section className="card">

          <h2 className="title">
            Select Strategy
          </h2>

          <p className="muted">
            Choose the strategy you want the chart analyzer to apply.
          </p>


          {/* KILLER ZONE */}

          <button
            type="button"
            className={`strategy ${
              strategy === "killZone" ? "active" : ""
            }`}
            onClick={() => {
              setStrategy("killZone");
              setAnalysis("");
              setError("");
            }}
          >

            <strong>
              Killer Zone
            </strong>

            <span className="muted">
              London Kill Zone model
            </span>

          </button>


          {/* EMA */}

          <button
            type="button"
            className={`strategy ${
              strategy === "ema" ? "active" : ""
            }`}
            onClick={() => {
              setStrategy("ema");
              setAnalysis("");
              setError("");
            }}
          >

            <strong>
              EMA
            </strong>

            <span className="muted">
              EMA20 pullback + structure + momentum model
            </span>

          </button>


          {/* CONTINUATION */}

          <button
            type="button"
            className={`strategy ${
              strategy === "continuation" ? "active" : ""
            }`}
            onClick={() => {
              setStrategy("continuation");
              setAnalysis("");
              setError("");
            }}
          >

            <strong>
              Continuation
            </strong>

            <span className="muted">
              Expansion → correction → retest → continuation
            </span>

          </button>

        </section>


        {/* ======================================================
            CHART ANALYZER
        ====================================================== */}

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


          {/* UPLOAD AREA */}

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


          {/* ACTIONS */}

          <div className="actions">

            <button
              type="button"
              className="primary"
              disabled={!selectedFile || loading}
              onClick={analyzeChart}
            >
              {loading
                ? "Analyzing Chart..."
                : "Analyze Chart"}
            </button>


            <button
              type="button"
              className="secondary"
              onClick={clearChart}
              disabled={loading}
            >
              Clear
            </button>

          </div>


          {/* ERROR */}

          {error && (
            <div
              className="card"
              style={{
                marginTop: "20px",
                border: "1px solid #ef4444",
              }}
            >

              <strong>
                Analysis Error
              </strong>

              <p className="muted">
                {error}
              </p>

            </div>
          )}

        </section>

      </div>


      {/* ========================================================
          CURRENT STRATEGY
      ======================================================== */}

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


      {/* ========================================================
          AI ANALYSIS RESULT
      ======================================================== */}

      {analysis && (

        <section
          className="card"
          style={{ marginTop: "20px" }}
        >

          <h2 className="title">
            AI Trade Analysis
          </h2>

          <div
            style={{
              whiteSpace: "pre-wrap",
              lineHeight: 1.7,
            }}
          >
            {analysis}
          </div>

        </section>

      )}

    </main>
  );
}

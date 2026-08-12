"use client";

import { ChangeEvent, useState } from "react";

type Strategy =
  | "killZone"
  | "ema"
  | "continuation"
  | "supplyDemand";

const strategies: Record<
  Strategy,
  {
    name: string;
    description: string;
    detail: string;
  }
> = {
  killZone: {
    name: "Killer Zone",
    description: "London Kill Zone model",
    detail:
      "Asian liquidity sweep → MSS → FVG → 50% FVG retracement → entry",
  },

  ema: {
    name: "EMA",
    description: "EMA20 Pullback Morning Engine",
    detail:
      "EMA20 pullback → rejection → break → UT Bot OR SMI confirmation",
  },

  continuation: {
    name: "Continuation",
    description: "M15 Continuation model",
    detail:
      "Expansion → correction → structural support/resistance → recovery → confirmed continuation",
  },

  supplyDemand: {
    name: "Supply & Demand",
    description: "Independent Supply & Demand Zone Engine",
    detail:
      "Swing-based zones → retest → reaction → zone hold → confirmed entry",
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
  // CHANGE STRATEGY
  // ============================================================

  function changeStrategy(nextStrategy: Strategy) {
    setStrategy(nextStrategy);
    setAnalysis("");
    setError("");
  }

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

    const input = document.getElementById(
      "chart-upload"
    ) as HTMLInputElement | null;

    if (input) {
      input.value = "";
    }
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
            Choose the independent strategy you want the chart
            analyzer to apply.
          </p>


          {/* ====================================================
              KILLER ZONE
          ==================================================== */}

          <button
            type="button"
            className={`strategy ${
              strategy === "killZone" ? "active" : ""
            }`}
            onClick={() => changeStrategy("killZone")}
          >
            <strong>
              Killer Zone
            </strong>

            <span className="muted">
              London liquidity sweep → MSS → FVG → entry
            </span>
          </button>


          {/* ====================================================
              EMA
          ==================================================== */}

          <button
            type="button"
            className={`strategy ${
              strategy === "ema" ? "active" : ""
            }`}
            onClick={() => changeStrategy("ema")}
          >
            <strong>
              EMA
            </strong>

            <span className="muted">
              EMA20 pullback → rejection → break → confirmation
            </span>
          </button>


          {/* ====================================================
              CONTINUATION
          ==================================================== */}

          <button
            type="button"
            className={`strategy ${
              strategy === "continuation" ? "active" : ""
            }`}
            onClick={() => changeStrategy("continuation")}
          >
            <strong>
              Continuation
            </strong>

            <span className="muted">
              Expansion → correction → structure → continuation
            </span>
          </button>


          {/* ====================================================
              SUPPLY & DEMAND
          ==================================================== */}

          <button
            type="button"
            className={`strategy ${
              strategy === "supplyDemand" ? "active" : ""
            }`}
            onClick={() => changeStrategy("supplyDemand")}
          >
            <strong>
              Supply & Demand
            </strong>

            <span className="muted">
              Zones → retest → reaction → confirmed entry
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


          {/* ====================================================
              UPLOAD AREA
          ==================================================== */}

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


          {/* ====================================================
              ACTIONS
          ==================================================== */}

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


          {/* ====================================================
              ERROR
          ==================================================== */}

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

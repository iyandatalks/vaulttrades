"use client";

import { ChangeEvent, useState } from "react";

type Strategy =
  | "killZone"
  | "ema"
  | "continuation"
  | "supplyDemand";

type Timeframe =
  | "M1"
  | "M5"
  | "M10"
  | "M15"
  | "M30"
  | "H1"
  | "H4"
  | "D1";

type TradeSignal = {
  direction: string;
  confidence: string;
  entry: string;
  stopLoss: string;
  tp1: string;
  tp2: string;
  finalTp: string;
  invalidation: string;
  status: string;
};

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

const timeframes: Timeframe[] = [
  "M1",
  "M5",
  "M10",
  "M15",
  "M30",
  "H1",
  "H4",
  "D1",
];

/* ============================================================
   EXTRACT VALUE FROM AI RESPONSE
============================================================ */

function extractValue(
  text: string,
  patterns: RegExp[]
): string {
  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return "—";
}

/* ============================================================
   PARSE TRADE SIGNAL
============================================================ */

function parseTradeSignal(
  text: string
): TradeSignal {
  const directionRaw = extractValue(text, [
    /DIRECTION\s*[:\-]\s*([^\n]+)/i,
    /TRADE\s*DIRECTION\s*[:\-]\s*([^\n]+)/i,
    /SIGNAL\s*[:\-]\s*([^\n]+)/i,
  ]);

  const confidence = extractValue(text, [
    /CONFIDENCE\s*[:\-]\s*([^\n]+)/i,
    /CONFIDENCE\s* SCORE\s*[:\-]\s*([^\n]+)/i,
  ]);

  const entry = extractValue(text, [
    /ENTRY\s*PRICE\s*[:\-]\s*([^\n]+)/i,
    /ENTRY\s*[:\-]\s*([^\n]+)/i,
  ]);

  const stopLoss = extractValue(text, [
    /STOP\s*LOSS\s*[:\-]\s*([^\n]+)/i,
    /SL\s*[:\-]\s*([^\n]+)/i,
  ]);

  const tp1 = extractValue(text, [
    /TP1\s*[:\-]\s*([^\n]+)/i,
    /TAKE\s*PROFIT\s*1\s*[:\-]\s*([^\n]+)/i,
  ]);

  const tp2 = extractValue(text, [
    /TP2\s*[:\-]\s*([^\n]+)/i,
    /TAKE\s*PROFIT\s*2\s*[:\-]\s*([^\n]+)/i,
  ]);

  const finalTp = extractValue(text, [
    /FINAL\s*TP\s*[:\-]\s*([^\n]+)/i,
    /FINAL\s*TAKE\s*PROFIT\s*[:\-]\s*([^\n]+)/i,
    /TP3\s*[:\-]\s*([^\n]+)/i,
    /TAKE\s*PROFIT\s*3\s*[:\-]\s*([^\n]+)/i,
  ]);

  const invalidation = extractValue(text, [
    /INVALIDATION\s*[:\-]\s*([^\n]+)/i,
    /INVALIDATION\s*LEVEL\s*[:\-]\s*([^\n]+)/i,
  ]);

  const normalizedDirection =
    directionRaw.toUpperCase().trim();

  let direction = "NO TRADE";

  if (
    normalizedDirection.includes(
      "BUY DEVELOPING"
    ) ||
    normalizedDirection.includes(
      "LONG DEVELOPING"
    )
  ) {
    direction = "BUY DEVELOPING";
  } else if (
    normalizedDirection.includes(
      "SELL DEVELOPING"
    ) ||
    normalizedDirection.includes(
      "SHORT DEVELOPING"
    )
  ) {
    direction = "SELL DEVELOPING";
  } else if (
    normalizedDirection.includes("BUY") ||
    normalizedDirection.includes("LONG")
  ) {
    direction = "BUY";
  } else if (
    normalizedDirection.includes("SELL") ||
    normalizedDirection.includes("SHORT")
  ) {
    direction = "SELL";
  } else if (
    normalizedDirection.includes("WAIT")
  ) {
    direction = "WAITING";
  } else if (
    normalizedDirection.includes("NO TRADE")
  ) {
    direction = "NO TRADE";
  }

  let status = "WAIT FOR CONFIRMATION";

  if (
    direction === "BUY" ||
    direction === "SELL"
  ) {
    if (
      entry !== "—" &&
      stopLoss !== "—" &&
      (tp1 !== "—" || finalTp !== "—")
    ) {
      status = "READY TO EXECUTE";
    }
  } else if (
    direction === "BUY DEVELOPING" ||
    direction === "SELL DEVELOPING"
  ) {
    status = "SETUP DEVELOPING";
  } else if (direction === "WAITING") {
    status = "WAIT FOR CONFIRMATION";
  } else {
    status = "NO VALID SETUP";
  }

  return {
    direction,
    confidence,
    entry,
    stopLoss,
    tp1,
    tp2,
    finalTp,
    invalidation,
    status,
  };
}

/* ============================================================
   SIGNAL CLASS
============================================================ */

function getSignalClass(
  direction: string
): string {
  if (
    direction === "BUY" ||
    direction === "BUY DEVELOPING"
  ) {
    return "signal-buy";
  }

  if (
    direction === "SELL" ||
    direction === "SELL DEVELOPING"
  ) {
    return "signal-sell";
  }

  return "signal-neutral";
}

/* ============================================================
   MAIN PAGE
============================================================ */

export default function Home() {
  const [strategy, setStrategy] =
    useState<Strategy>("killZone");

  const [timeframe, setTimeframe] =
    useState<Timeframe>("M5");

  const [chart, setChart] =
    useState<string | null>(null);

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [fileName, setFileName] =
    useState("");

  const [analysis, setAnalysis] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  /* ==========================================================
     CHANGE STRATEGY
  ========================================================== */

  function changeStrategy(
    nextStrategy: Strategy
  ) {
    setStrategy(nextStrategy);
    setAnalysis("");
    setError("");
  }

  /* ==========================================================
     CHANGE TIMEFRAME
  ========================================================== */

  function changeTimeframe(
    nextTimeframe: Timeframe
  ) {
    setTimeframe(nextTimeframe);
    setAnalysis("");
    setError("");
  }

  /* ==========================================================
     UPLOAD CHART
  ========================================================== */

  function handleUpload(
    event: ChangeEvent<HTMLInputElement>
  ) {
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

  /* ==========================================================
     CLEAR CHART
  ========================================================== */

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

  /* ==========================================================
     ANALYZE CHART
  ========================================================== */

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

      /*
       * The user's selected timeframe is explicitly
       * sent to the analysis API.
       */
      formData.append("timeframe", timeframe);

      const response = await fetch(
        "/api/analyze",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to analyze the chart."
        );
      }

      if (!data?.analysis) {
        throw new Error(
          "The analyzer returned an empty analysis."
        );
      }

      setAnalysis(data.analysis);
    } catch (err) {
      console.error(
        "Chart analysis error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to analyze the chart."
      );
    } finally {
      setLoading(false);
    }
  }

  const tradeSignal = analysis
    ? parseTradeSignal(analysis)
    : null;

  return (
    <main className="shell">

      {/* ======================================================
          HEADER / BRAND
      ====================================================== */}

      <header className="header">

        <div className="brand-block">

          <img
            src="/vaulttrades-logo.png"
            alt="VaultTrades"
            className="logo"
          />

          <div className="tagline">
            Built by Traders.
          </div>

          <div className="slogan">
            Focus, discipline, consistency.
          </div>

        </div>

        <div className="badge">
          ANALYZER
        </div>

      </header>


      {/* ======================================================
          MAIN GRID
      ====================================================== */}

      <div className="grid">

        {/* ====================================================
            STRATEGY PANEL
        ==================================================== */}

        <section className="card">

          <h2 className="title">
            Select Strategy
          </h2>

          <p className="muted">
            Choose the independent strategy you
            want the chart analyzer to apply.
          </p>


          {/* KILLER ZONE */}

          <button
            type="button"
            className={`strategy ${
              strategy === "killZone"
                ? "active"
                : ""
            }`}
            onClick={() =>
              changeStrategy("killZone")
            }
          >

            <strong>
              Killer Zone
            </strong>

            <span className="muted">
              London liquidity sweep →
              MSS → FVG → entry
            </span>

          </button>


          {/* EMA */}

          <button
            type="button"
            className={`strategy ${
              strategy === "ema"
                ? "active"
                : ""
            }`}
            onClick={() =>
              changeStrategy("ema")
            }
          >

            <strong>
              EMA
            </strong>

            <span className="muted">
              EMA20 pullback → rejection →
              break → confirmation
            </span>

          </button>


          {/* CONTINUATION */}

          <button
            type="button"
            className={`strategy ${
              strategy === "continuation"
                ? "active"
                : ""
            }`}
            onClick={() =>
              changeStrategy(
                "continuation"
              )
            }
          >

            <strong>
              Continuation
            </strong>

            <span className="muted">
              Expansion → correction →
              structure → continuation
            </span>

          </button>


          {/* SUPPLY & DEMAND */}

          <button
            type="button"
            className={`strategy ${
              strategy === "supplyDemand"
                ? "active"
                : ""
            }`}
            onClick={() =>
              changeStrategy(
                "supplyDemand"
              )
            }
          >

            <strong>
              Supply & Demand
            </strong>

            <span className="muted">
              Zones → retest → reaction →
              confirmed entry
            </span>

          </button>

        </section>


        {/* ====================================================
            CHART ANALYZER
        ==================================================== */}

        <section className="card">

          <h2 className="title">
            Chart Analyzer
          </h2>

          <p className="muted">
            Select your timeframe, upload your
            chart, then analyze.
          </p>


          {/* ==================================================
              TIMEFRAME
          ================================================== */}

          <div
            style={{
              marginTop: "20px",
              marginBottom: "20px",
            }}
          >

            <div
              style={{
                fontSize: "13px",
                fontWeight: 700,
                marginBottom: "10px",
              }}
            >
              Select Timeframe
            </div>


            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(4, minmax(0, 1fr))",
                gap: "8px",
              }}
            >

              {timeframes.map(
                (tf) => {

                  const selected =
                    timeframe === tf;

                  return (
                    <button
                      key={tf}
                      type="button"
                      className={`timeframe-button ${
                        selected
                          ? "selected"
                          : ""
                      }`}
                      aria-pressed={
                        selected
                      }
                      disabled={loading}
                      onClick={() =>
                        changeTimeframe(tf)
                      }
                    >
                      {tf}
                    </button>
                  );
                }
              )}

            </div>


            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
                gap: "12px",
                marginTop: "12px",
                padding: "10px 12px",
                borderRadius: "8px",
                background:
                  "#080e17",
                border:
                  "1px solid #202b3a",
              }}
            >

              <span className="muted">
                Selected timeframe
              </span>

              <strong
                style={{
                  color: "#d4af37",
                }}
              >
                {timeframe}
              </strong>

            </div>

          </div>


          {/* ==================================================
              UPLOAD
          ================================================== */}

          <div
            className="upload"
            onClick={() =>
              document
                .getElementById(
                  "chart-upload"
                )
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


          {/* ==================================================
              ACTIONS
          ================================================== */}

          <div className="actions">

            <button
              type="button"
              className="primary"
              disabled={
                !selectedFile ||
                loading
              }
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


          {/* ==================================================
              ERROR
          ================================================== */}

          {error && (

            <div
              className="card"
              style={{
                marginTop: "20px",
                border:
                  "1px solid #7f1d1d",
              }}
            >

              <strong
                style={{
                  color: "#d4af37",
                }}
              >
                Analysis Error
              </strong>

              <p className="muted">
                {error}
              </p>

            </div>

          )}

        </section>

      </div>


      {/* ======================================================
          TRADE SIGNAL
          THIS REPLACES THE OLD SELECTED STRATEGY CARD
      ====================================================== */}

      <section
        className="card"
        style={{
          marginTop: "20px",
        }}
      >

        <h2 className="title">
          Trade Signal
        </h2>


        {!tradeSignal ? (

          <div
            style={{
              padding: "18px 0",
            }}
          >

            <strong
              style={{
                color: "#d4af37",
              }}
            >
              Awaiting Analysis
            </strong>

            <p className="muted">
              Upload a chart and analyze it
              to receive the direct execution
              result.
            </p>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                marginTop: "14px",
              }}
            >

              <span className="muted">
                Strategy:
              </span>

              <strong
                style={{
                  color: "#d4af37",
                }}
              >
                {strategies[
                  strategy
                ].name}
              </strong>

              <span className="muted">
                •
              </span>

              <span className="muted">
                Timeframe:
              </span>

              <strong
                style={{
                  color: "#d4af37",
                }}
              >
                {timeframe}
              </strong>

            </div>

          </div>

        ) : (

          <div
            style={{
              marginTop: "10px",
            }}
          >

            {/* ==================================================
                SIGNAL HEADER
            ================================================== */}

            <div
              className={getSignalClass(
                tradeSignal.direction
              )}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent:
                  "space-between",
                gap: "20px",
                flexWrap: "wrap",
                padding: "16px 18px",
                borderRadius: "12px",
                marginBottom: "18px",
              }}
            >

              <div>

                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: 800,
                    color: "#d4af37",
                  }}
                >
                  {tradeSignal.direction}
                </div>

                <div
                  className="muted"
                  style={{
                    marginTop: "4px",
                  }}
                >
                  {strategies[
                    strategy
                  ].name}{" "}
                  • {timeframe}
                </div>

              </div>


              <div
                style={{
                  textAlign: "right",
                }}
              >

                <div
                  className="muted"
                  style={{
                    fontSize: "12px",
                  }}
                >
                  CONFIDENCE
                </div>

                <strong
                  style={{
                    fontSize: "20px",
                    color: "#d4af37",
                  }}
                >
                  {
                    tradeSignal.confidence
                  }
                </strong>

              </div>

            </div>


            {/* ==================================================
                EXECUTION VALUES
            ================================================== */}

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "10px",
              }}
            >

              <div className="card">

                <div className="muted">
                  Entry
                </div>

                <strong
                  style={{
                    color: "#d4af37",
                  }}
                >
                  {tradeSignal.entry}
                </strong>

              </div>


              <div className="card">

                <div className="muted">
                  Stop Loss
                </div>

                <strong
                  style={{
                    color: "#d4af37",
                  }}
                >
                  {
                    tradeSignal.stopLoss
                  }
                </strong>

              </div>


              <div className="card">

                <div className="muted">
                  TP1
                </div>

                <strong
                  style={{
                    color: "#d4af37",
                  }}
                >
                  {tradeSignal.tp1}
                </strong>

              </div>


              <div className="card">

                <div className="muted">
                  TP2
                </div>

                <strong
                  style={{
                    color: "#d4af37",
                  }}
                >
                  {tradeSignal.tp2}
                </strong>

              </div>


              <div className="card">

                <div className="muted">
                  Final TP
                </div>

                <strong
                  style={{
                    color: "#d4af37",
                  }}
                >
                  {
                    tradeSignal.finalTp
                  }
                </strong>

              </div>

            </div>


            {/* ==================================================
                EXECUTION STATUS
            ================================================== */}

            <div
              style={{
                marginTop: "16px",
                padding: "14px 16px",
                borderRadius: "10px",
                background: "#080e17",
                border:
                  "1px solid #202b3a",
              }}
            >

              <div
                className="muted"
                style={{
                  fontSize: "12px",
                  marginBottom: "4px",
                }}
              >
                EXECUTION STATUS
              </div>

              <strong
                style={{
                  color: "#d4af37",
                }}
              >
                {tradeSignal.status}
              </strong>

            </div>


            {/* ==================================================
                INVALIDATION
            ================================================== */}

            {tradeSignal.invalidation !==
              "—" && (

              <div
                style={{
                  marginTop: "12px",
                  fontSize: "13px",
                }}
              >

                <span className="muted">
                  Invalidation:{" "}
                </span>

                <strong
                  style={{
                    color: "#d4af37",
                  }}
                >
                  {
                    tradeSignal.invalidation
                  }
                </strong>

              </div>

            )}

          </div>

        )}

      </section>


      {/* ======================================================
          TRADE ANALYSIS
      ====================================================== */}

      {analysis && (

        <section
          className="card"
          style={{
            marginTop: "20px",
          }}
        >

          <h2 className="title">
            Trade Analysis
          </h2>

          <div
            style={{
              whiteSpace: "pre-wrap",
              lineHeight: 1.7,
              color: "#f8fafc",
            }}
          >
            {analysis}
          </div>

        </section>

      )}


      {/* ======================================================
          FOOTER
      ====================================================== */}

      <footer className="footer">

        <div className="footer-brand">
          VAULTTRADES
        </div>

        <div className="footer-disclaimer">

          <strong>
            Disclaimer:
          </strong>{" "}

          VaultTrades provides market
          analysis and educational
          information only. Trading
          involves substantial risk.
          Signals and analysis are not
          financial advice and should
          not be considered a guarantee
          of future results.

        </div>

        <div className="footer-copy">
          © 2026 VaultTrades. All rights
          reserved.
        </div>

        <div className="footer-developed">
          Built by Traders.
        </div>

      </footer>

    </main>
  );
}

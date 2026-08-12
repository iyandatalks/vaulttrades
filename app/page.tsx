
/
VaultTradesHome.tsx


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

type Direction =
  | "BUY"
  | "SELL"
  | "BUY DEVELOPING"
  | "SELL DEVELOPING"
  | "WAITING"
  | "NO TRADE";

type ChartPoint = {
  x: number;
  y: number;
};

type ChartAnnotation = {
  type:
    | "zone"
    | "entry"
    | "stopLoss"
    | "tp1"
    | "tp2"
    | "finalTp"
    | "retest"
    | "confirmation"
    | "structure";
  label: string;
  price?: number | null;
  points?: ChartPoint[];
  color?: "gold" | "green" | "red" | "white";
};

type Projection = {
  available: boolean;
  setupType: string;
  zoneLow: number | null;
  zoneHigh: number | null;
  expectedEntry: number | null;
  expectedStopLoss: number | null;
  expectedTp1: number | null;
  expectedTp2: number | null;
  expectedFinalTp: number | null;
  retestRequired: boolean;
  retestStatus: string;
  confirmationRequired: string;
  confirmationStatus: string;
};

type TradeSignal = {
  direction: Direction;
  confidence: number;
  entry: number | null;
  stopLoss: number | null;
  risk: number | null;
  tp1: number | null;
  tp2: number | null;
  finalTp: number | null;
  invalidation: string;
};

type AnalysisResponse = {
  analysis?: string;
  tradeSignal?: TradeSignal;
  projection?: Projection;
  chartAnnotations?: ChartAnnotation[];
  marketState?: string;
  setup?: string;
  confirmedConditions?: string[];
  missingConditions?: string[];
  aiCoach?: string;
  error?: string;
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


function formatPrice(value: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "WAIT";
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 5 });
}

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

function parseTradeSignal(text: string): TradeSignal {
  const extract = (patterns: RegExp[]): string => {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) return match[1].trim();
    }
    return "";
  };

  const rawDirection = extract([
    /DIRECTION\s*[:\-]\s*([^\n]+)/i,
    /TRADE\s*DIRECTION\s*[:\-]\s*([^\n]+)/i,
    /SIGNAL\s*[:\-]\s*([^\n]+)/i,
  ]).toUpperCase();

  let direction: Direction = "WAITING";
  if (rawDirection.includes("BUY DEVELOPING") || rawDirection.includes("LONG DEVELOPING")) {
    direction = "BUY DEVELOPING";
  } else if (rawDirection.includes("SELL DEVELOPING") || rawDirection.includes("SHORT DEVELOPING")) {
    direction = "SELL DEVELOPING";
  } else if (rawDirection.includes("BUY") || rawDirection.includes("LONG")) {
    direction = "BUY";
  } else if (rawDirection.includes("SELL") || rawDirection.includes("SHORT")) {
    direction = "SELL";
  } else if (rawDirection.includes("NO TRADE")) {
    direction = "NO TRADE";
  }

  const confidenceText = extract([
    /CONFIDENCE\s*[:\-]\s*([^\n]+)/i,
    /CONFIDENCE\s*SCORE\s*[:\-]\s*([^\n]+)/i,
  ]);
  const confidenceMatch = confidenceText.match(/\d+(?:\.\d+)?/);

  return {
    direction,
    confidence: confidenceMatch ? Number(confidenceMatch[0]) : 0,
    entry: null,
    stopLoss: null,
    risk: null,
    tp1: null,
    tp2: null,
    finalTp: null,
    invalidation: extract([
      /INVALIDATION\s*[:\-]\s*([^\n]+)/i,
      /INVALIDATION\s*LEVEL\s*[:\-]\s*([^\n]+)/i,
    ]),
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

function renderAnnotations(
  annotations: ChartAnnotation[]
) {
  if (!annotations.length) return null;

  return annotations.map((annotation, index) => {
    const points = annotation.points ?? [];

    if (annotation.type === "zone" && points.length >= 2) {
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      return (
        <div
          key={`zone-${index}`}
          className="chart-zone-overlay"
          style={{
            left: `${minX / 10}%`,
            top: `${minY / 10}%`,
            width: `${Math.max(2, (maxX - minX) / 10)}%`,
            height: `${Math.max(2, (maxY - minY) / 10)}%`,
          }}
        >
          <span>{annotation.label}</span>
        </div>
      );
    }

    const point = points[0];
    if (!point) return null;

    if (
      annotation.type === "entry" ||
      annotation.type === "stopLoss" ||
      annotation.type === "tp1" ||
      annotation.type === "tp2" ||
      annotation.type === "finalTp"
    ) {
      return (
        <div
          key={`level-${index}`}
          className={`chart-level chart-level-${annotation.type}`}
          style={{ top: `${point.y / 10}%` }}
        >
          <span>{annotation.label}</span>
          {annotation.price != null && (
            <strong>{formatPrice(annotation.price)}</strong>
          )}
        </div>
      );
    }

    return (
      <div
        key={`marker-${index}`}
        className={`chart-marker chart-marker-${annotation.type}`}
        style={{
          left: `${point.x / 10}%`,
          top: `${point.y / 10}%`,
        }}
      >
        <span>{annotation.label}</span>
      </div>
    );
  });
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

  const [tradeSignal, setTradeSignal] =
    useState<TradeSignal | null>(null);

  const [projection, setProjection] =
    useState<Projection | null>(null);

  const [annotations, setAnnotations] =
    useState<ChartAnnotation[]>([]);

  const [marketState, setMarketState] =
    useState("");

  const [setup, setSetup] =
    useState("");

  const [confirmedConditions, setConfirmedConditions] =
    useState<string[]>([]);

  const [missingConditions, setMissingConditions] =
    useState<string[]>([]);

  const [aiCoach, setAiCoach] =
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
    setTradeSignal(null);
    setProjection(null);
    setAnnotations([]);
    setMarketState("");
    setSetup("");
    setConfirmedConditions([]);
    setMissingConditions([]);
    setAiCoach("");
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
    setTradeSignal(null);
    setProjection(null);
    setAnnotations([]);
    setMarketState("");
    setSetup("");
    setConfirmedConditions([]);
    setMissingConditions([]);
    setAiCoach("");
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
    setTradeSignal(null);
    setProjection(null);
    setAnnotations([]);
    setMarketState("");
    setSetup("");
    setConfirmedConditions([]);
    setMissingConditions([]);
    setAiCoach("");
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
    setTradeSignal(null);
    setProjection(null);
    setAnnotations([]);
    setMarketState("");
    setSetup("");
    setConfirmedConditions([]);
    setMissingConditions([]);
    setAiCoach("");
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
    setTradeSignal(null);
    setProjection(null);
    setAnnotations([]);
    setMarketState("");
    setSetup("");
    setConfirmedConditions([]);
    setMissingConditions([]);
    setAiCoach("");
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

      const data =
        (await response.json()) as AnalysisResponse;

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to analyze the chart."
        );
      }

      if (!data.analysis) {
        throw new Error(
          "The analyzer returned an empty analysis."
        );
      }

      setAnalysis(data.analysis);
      setTradeSignal(
        data.tradeSignal ??
          parseTradeSignal(data.analysis)
      );
      setProjection(data.projection ?? null);
      setAnnotations(data.chartAnnotations ?? []);
      setMarketState(data.marketState ?? "");
      setSetup(data.setup ?? "");
      setConfirmedConditions(
        data.confirmedConditions ?? []
      );
      setMissingConditions(
        data.missingConditions ?? []
      );
      setAiCoach(data.aiCoach ?? "");
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

  async function askCoach(question: string) {
    if (!tradeSignal) return;
    setAiCoach("Analyzing your question...");
    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          strategy,
          timeframe,
          direction: tradeSignal.direction,
          confidence: tradeSignal.confidence,
          analysis,
          marketState,
          setup,
          confirmedConditions,
          missingConditions,
          tradeSignal,
          projection,
          chartAnnotations: annotations,
        }),
      });
      const data = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to answer the question.");
      setAiCoach(data.answer || "The AI Coach could not establish an answer from the current chart analysis.");
    } catch (err) {
      setAiCoach(err instanceof Error ? err.message : "Unable to answer the AI Coach question.");
    }
  }

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

                <div className="chart-wrapper">
                  <img
                    src={chart}
                    alt="Uploaded trading chart"
                    className="preview"
                  />
                  {annotations.length > 0 && (
                    <div className="chart-overlay">
                      {renderAnnotations(annotations)}
                    </div>
                  )}
                </div>

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
                  {formatPrice(tradeSignal.entry)}
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
                  {formatPrice(tradeSignal.tp1)}
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
                  {formatPrice(tradeSignal.tp2)}
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
                  {formatPrice(tradeSignal.finalTp)}
                </strong>

              </div>

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


      {/* ========================================================
          MARKET MAP — WARM ANALYTICAL RESPONSE
      ======================================================== */}
      {tradeSignal && (
        <section className="card" style={{ marginTop: "20px" }}>
          <h2 className="title">Market Map</h2>
          <div className="market-map">
            <div>
              <span className="muted">Current Market State</span>
              <strong>{marketState || "Monitoring current market structure"}</strong>
            </div>
            <div>
              <span className="muted">Current Setup</span>
              <strong>{setup || "No completed setup has been reported yet."}</strong>
            </div>
            {projection?.available && (
              <div>
                <span className="muted">Active / Expected Zone</span>
                <strong>
                  {formatPrice(projection.zoneLow)} — {formatPrice(projection.zoneHigh)}
                </strong>
              </div>
            )}
            <div>
              <span className="muted">Confirmed Conditions</span>
              <strong>
                {confirmedConditions.length
                  ? confirmedConditions.join(" • ")
                  : "No confirmed conditions reported yet"}
              </strong>
            </div>
            <div>
              <span className="muted">What To Watch</span>
              <strong>
                {missingConditions.length
                  ? missingConditions.join(" • ")
                  : "Continue monitoring the selected strategy conditions"}
              </strong>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================
          TRADE ROADMAP
      ======================================================== */}
      {tradeSignal && (
        <section className="card" style={{ marginTop: "20px" }}>
          <h2 className="title">Trade Roadmap</h2>
          <div style={{ display: "grid", gap: "14px", marginTop: "16px" }}>
            <div className="condition-box">
              <strong>Current Setup</strong>
              <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, marginBottom: 0 }}>
                {setup || "The selected strategy is monitoring the chart for its required sequence."}
              </p>
            </div>
            {confirmedConditions.length > 0 && (
              <div className="condition-box">
                <strong>What the Chart Has Confirmed</strong>
                <ul>
                  {confirmedConditions.map((condition, index) => (
                    <li key={`confirmed-${index}`}>{condition}</li>
                  ))}
                </ul>
              </div>
            )}
            {missingConditions.length > 0 && (
              <div className="condition-box">
                <strong>What the Chart Is Watching</strong>
                <ul>
                  {missingConditions.map((condition, index) => (
                    <li key={`watch-${index}`}>{condition}</li>
                  ))}
                </ul>
              </div>
            )}
            {tradeSignal.direction === "NO TRADE" && tradeSignal.invalidation && (
              <div className="condition-box">
                <strong>Why There Is No Trade</strong>
                <p style={{ lineHeight: 1.7, marginBottom: 0 }}>
                  {tradeSignal.invalidation}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ========================================================
          AI COACH — EXPLANATION ONLY
      ======================================================== */}
      {tradeSignal && (
        <section className="card" style={{ marginTop: "20px" }}>
          <span className="muted">AI Coach</span>
          <h2 className="title">Ask About This Setup</h2>
          <p className="muted" style={{ lineHeight: 1.6 }}>
            AI Coach explains the selected strategy result. It does not create or change the trade signal or execution levels.
          </p>
          <div style={{ display: "flex", gap: "10px", marginTop: "14px", flexWrap: "wrap" }}>
            <button type="button" className="secondary" onClick={() => void askCoach("Explain the current strategy result and why it is in this state.")}>Explain This Setup</button>
            <button type="button" className="secondary" onClick={() => void askCoach("What condition is the selected strategy watching next?")}>What Am I Waiting For?</button>
            <button type="button" className="secondary" onClick={() => void askCoach("What invalidates the current strategy idea?")}>What Invalidates It?</button>
          </div>
          <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
            <input id="coach-question" type="text" placeholder="Ask the AI Coach a question..." className="coach-input" onKeyDown={(event) => { if (event.key === "Enter") { const q = event.currentTarget.value.trim(); if (q) { void askCoach(q); event.currentTarget.value = ""; } } }} />
            <button type="button" className="primary" onClick={() => { const input = document.getElementById("coach-question") as HTMLInputElement | null; const q = input?.value.trim(); if (q) { void askCoach(q); if (input) input.value = ""; } }}>Ask</button>
          </div>
          {aiCoach && (
            <div className="coach-box" style={{ marginTop: "16px" }}>
              <span className="muted">AI Coach Response</span>
              <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, marginBottom: 0 }}>{aiCoach}</p>
            </div>
          )}
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

"use client";

import {
  ChangeEvent,
  useState,
} from "react";

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

  color:
    | "gold"
    | "green"
    | "red"
    | "white";
};

type Projection = {
  available: boolean;

  setupType:
    | "demand"
    | "supply"
    | "long"
    | "short"
    | "continuation"
    | "killZone"
    | "ema"
    | "none";

  zoneLow: number | null;

  zoneHigh: number | null;

  expectedEntry: number | null;

  expectedStopLoss: number | null;

  expectedTp1: number | null;

  expectedTp2: number | null;

  expectedFinalTp: number | null;

  retestRequired: boolean;

  retestStatus:
    | "WAITING"
    | "TESTED"
    | "CONFIRMED"
    | "NOT_REQUIRED";

  confirmationRequired: string;

  confirmationStatus:
    | "REQUIRED"
    | "PENDING"
    | "CONFIRMED"
    | "NOT_REQUIRED";
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
  success: boolean;

  strategy: Strategy;

  timeframe: Timeframe;

  analysis: string;

  tradeSignal: TradeSignal;

  projection: Projection;

  chartAnnotations: ChartAnnotation[];

  marketState: string;

  setup: string;

  confirmedConditions: string[];

  missingConditions: string[];

  aiCoach: string;
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

function formatPrice(value: number | null) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return "WAIT";
  }

  return value.toLocaleString(undefined, {
    maximumFractionDigits: 5,
  });
}

function directionClass(direction: Direction) {
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

  return "signal-wait";
}

function directionLabel(direction: Direction) {
  switch (direction) {
    case "BUY":
      return "BUY";

    case "SELL":
      return "SELL";

    case "BUY DEVELOPING":
      return "BUY DEVELOPING";

    case "SELL DEVELOPING":
      return "SELL DEVELOPING";

    case "NO TRADE":
      return "NO TRADE";

    default:
      return "WAITING";
  }
}

function Logo() {
  return (
    <div
      className="vault-logo"
      aria-label="VaultTrades"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
      }}
    >
      <svg
        width="42"
        height="42"
        viewBox="0 0 42 42"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect
          x="1"
          y="1"
          width="40"
          height="40"
          rx="10"
          stroke="currentColor"
          strokeWidth="2"
        />

        <path
          d="M10 12L21 31L32 12"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <path
          d="M15 12L21 22L27 12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div>
        <div
          style={{
            fontWeight: 800,
            letterSpacing: "0.08em",
            lineHeight: 1,
          }}
        >
          VAULTTRADES
        </div>

        <div
          className="brand-subtitle"
          style={{
            marginTop: "5px",
          }}
        >
          Built by Traders.
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [
    strategy,
    setStrategy,
  ] = useState<Strategy>("killZone");

  const [
    timeframe,
    setTimeframe,
  ] = useState<Timeframe>("M5");

  const [
    chart,
    setChart,
  ] = useState<string | null>(null);

  const [
    selectedFile,
    setSelectedFile,
  ] = useState<File | null>(null);

  const [
    fileName,
    setFileName,
  ] = useState("");

  const [
    analysis,
    setAnalysis,
  ] = useState("");

  const [
    tradeSignal,
    setTradeSignal,
  ] = useState<TradeSignal | null>(null);

  const [
    projection,
    setProjection,
  ] = useState<Projection | null>(null);

  const [
    annotations,
    setAnnotations,
  ] = useState<ChartAnnotation[]>([]);

  const [
    marketState,
    setMarketState,
  ] = useState("");

  const [
    setup,
    setSetup,
  ] = useState("");

  const [
    confirmedConditions,
    setConfirmedConditions,
  ] = useState<string[]>([]);

  const [
    missingConditions,
    setMissingConditions,
  ] = useState<string[]>([]);

  const [
    aiCoach,
    setAiCoach,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  // ============================================================
  // RESET RESULT
  // ============================================================

  function clearResults() {
    setAnalysis("");
    setTradeSignal(null);
    setProjection(null);
    setAnnotations([]);
    setMarketState("");
    setSetup("");
    setConfirmedConditions([]);
    setMissingConditions([]);
    setAiCoach("");
  }

  // ============================================================
  // CHANGE STRATEGY
  // ============================================================

  function changeStrategy(nextStrategy: Strategy) {
    setStrategy(nextStrategy);
    clearResults();
    setError("");
  }

  // ============================================================
  // CHANGE TIMEFRAME
  // ============================================================

  function changeTimeframe(nextTimeframe: Timeframe) {
    setTimeframe(nextTimeframe);
    clearResults();
    setError("");
  }

  // ============================================================
  // UPLOAD
  // ============================================================

  function handleUpload(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("Please upload a chart image.");
      return;
    }

    setSelectedFile(file);
    setFileName(file.name);
    clearResults();
    setError("");

    const reader = new FileReader();

    reader.onload = () => {
      setChart(reader.result as string);
    };

    reader.readAsDataURL(file);
  }

  // ============================================================
  // CLEAR CHART
  // ============================================================

  function clearChart() {
    setChart(null);
    setSelectedFile(null);
    setFileName("");
    clearResults();
    setError("");

    const input = document.getElementById(
      "chart-upload"
    ) as HTMLInputElement | null;

    if (input) {
      input.value = "";
    }
  }

  // ============================================================
  // ANALYZE
  // ============================================================

  async function analyzeChart() {
    if (!selectedFile) {
      setError("Please upload a chart first.");
      return;
    }

    setLoading(true);
    clearResults();
    setError("");

    try {
      const formData = new FormData();

      formData.append("image", selectedFile);
      formData.append("strategy", strategy);
      formData.append("timeframe", timeframe);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as
        | AnalysisResponse
        | {
            error?: string;
          };

      if (!response.ok) {
        throw new Error(
          "error" in data && data.error
            ? data.error
            : "Unable to analyze the chart."
        );
      }

      if (
        !("analysis" in data) ||
        !data.analysis
      ) {
        throw new Error(
          "The analyzer returned an empty analysis."
        );
      }

      setAnalysis(data.analysis);
      setTradeSignal(data.tradeSignal);
      setProjection(data.projection);
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

  // ============================================================
  // RENDER CHART ANNOTATIONS
  // ============================================================

  function renderAnnotations() {
    if (!annotations.length) {
      return null;
    }

    return annotations.map(
      (annotation, index) => {
        const points = annotation.points ?? [];

        if (
          annotation.type === "zone" &&
          points.length >= 4
        ) {
          const xs = points.map(
            (point) => point.x
          );

          const ys = points.map(
            (point) => point.y
          );

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
                width: `${Math.max(
                  2,
                  (maxX - minX) / 10
                )}%`,
                height: `${Math.max(
                  2,
                  (maxY - minY) / 10
                )}%`,
              }}
            >
              <span>{annotation.label}</span>
            </div>
          );
        }

        if (
          annotation.type === "entry" ||
          annotation.type === "stopLoss" ||
          annotation.type === "tp1" ||
          annotation.type === "tp2" ||
          annotation.type === "finalTp"
        ) {
          const point = points[0];

          if (!point) {
            return null;
          }

          return (
            <div
              key={`level-${index}`}
              className={`chart-level chart-level-${annotation.type}`}
              style={{
                top: `${point.y / 10}%`,
              }}
            >
              <span>{annotation.label}</span>

              {annotation.price !== null &&
                annotation.price !==
                  undefined && (
                  <strong>
                    {formatPrice(
                      annotation.price
                    )}
                  </strong>
                )}
            </div>
          );
        }

        if (
          annotation.type === "retest" ||
          annotation.type === "confirmation"
        ) {
          const point = points[0];

          if (!point) {
            return null;
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
        }

        if (
          annotation.type === "structure"
        ) {
          const point = points[0];

          if (!point) {
            return null;
          }

          return (
            <div
              key={`structure-${index}`}
              className="chart-marker chart-marker-structure"
              style={{
                left: `${point.x / 10}%`,
                top: `${point.y / 10}%`,
              }}
            >
              <span>{annotation.label}</span>
            </div>
          );
        }

        return null;
      }
    );
  }

  // ============================================================
  // AI COACH REQUEST
  // ============================================================

  async function askCoach(
    question: string
  ) {
    if (!question.trim() || !tradeSignal) {
      return;
    }

    setAiCoach(
      "Analyzing your question..."
    );

    try {
      const response = await fetch(
        "/api/coach",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            question,
            strategy,
            timeframe,
            direction:
              tradeSignal.direction,
            confidence:
              tradeSignal.confidence,
            analysis,
            marketState,
            setup,
            confirmedConditions,
            missingConditions,
            tradeSignal,
            projection,
            chartAnnotations:
              annotations,
          }),
        }
      );

      const data =
        (await response.json()) as {
          answer?: string;
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to answer the question."
        );
      }

      setAiCoach(
        data.answer ||
          "The AI Coach could not establish an answer from the current chart analysis."
      );
    } catch (err) {
      console.error(
        "AI Coach error:",
        err
      );

      setAiCoach(
        err instanceof Error
          ? err.message
          : "Unable to answer the AI Coach question."
      );
    }
  }

  // ============================================================
  // CURRENT EXECUTION STATE
  // ============================================================

  const currentDirection =
    tradeSignal?.direction ?? "WAITING";

  const isDeveloping =
    currentDirection ===
      "BUY DEVELOPING" ||
    currentDirection ===
      "SELL DEVELOPING";

  const displayEntry = isDeveloping
    ? projection?.expectedEntry ?? null
    : tradeSignal?.entry ?? null;

  const displayStop = isDeveloping
    ? projection?.expectedStopLoss ?? null
    : tradeSignal?.stopLoss ?? null;

  const displayTp1 = isDeveloping
    ? projection?.expectedTp1 ?? null
    : tradeSignal?.tp1 ?? null;

  const displayTp2 = isDeveloping
    ? projection?.expectedTp2 ?? null
    : tradeSignal?.tp2 ?? null;

  const displayFinalTp = isDeveloping
    ? projection?.expectedFinalTp ?? null
    : tradeSignal?.finalTp ?? null;

  const executionEntryLabel =
    isDeveloping
      ? "Expected Entry"
      : "Entry";

  const executionStopLabel =
    isDeveloping
      ? "Expected Stop Loss"
      : "Stop Loss";

  const executionTp1Label =
    isDeveloping
      ? "Expected TP1"
      : "TP1";

  const executionTp2Label =
    isDeveloping
      ? "Expected TP2"
      : "TP2";

  const executionFinalTpLabel =
    isDeveloping
      ? "Expected Final TP"
      : "Final TP";

  return (
    <main className="shell">

      {/* ========================================================
          HEADER
      ======================================================== */}

      <header className="header">

        <div className="brand-area">
          <Logo />

          <div className="brand-slogan">
            Focus, discipline, consistency.
          </div>
        </div>

        <div className="badge">
          ANALYZER
        </div>

      </header>


      {/* ========================================================
          MAIN GRID
      ======================================================== */}

      <div className="grid">

        {/* ======================================================
            STRATEGY PANEL
        ====================================================== */}

        <section className="card">

          <h2 className="title">
            Select Strategy
          </h2>

          <p className="muted">
            Choose the independent strategy
            the analyzer must apply.
          </p>


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
              EMA20 pullback →
              rejection → break →
              confirmation
            </span>
          </button>


          <button
            type="button"
            className={`strategy ${
              strategy ===
              "continuation"
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


          <button
            type="button"
            className={`strategy ${
              strategy ===
              "supplyDemand"
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
              Zones → retest →
              reaction → confirmed entry
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
            Select your timeframe, upload
            the chart, then analyze.
          </p>


          {/* ====================================================
              TIMEFRAME SELECTOR
          ==================================================== */}

          <div className="timeframe-section">

            <div className="timeframe-heading">

              <strong>
                Analysis Timeframe
              </strong>

              <span className="muted">
                User selected
              </span>

            </div>


            <div className="timeframe-grid">

              {timeframes.map(
                (tf) => (
                  <button
                    key={tf}
                    type="button"
                    className={`timeframe-button ${
                      timeframe === tf
                        ? "selected"
                        : ""
                    }`}
                    onClick={() =>
                      changeTimeframe(tf)
                    }
                  >
                    {tf}
                  </button>
                )
              )}

            </div>

          </div>


          {/* ====================================================
              NO REPEATED STRATEGY / TIMEFRAME BLOCK
              CHART FOLLOWS DIRECTLY
          ==================================================== */}

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

                  {/* ==================================================
                      WARM CHART ANALYSIS
                      MARKINGS REMAIN VISIBLE EVEN WHEN WAITING
                      OR NO TRADE
                  ================================================== */}

                  {annotations.length > 0 && (
                    <div className="chart-overlay">
                      {renderAnnotations()}
                    </div>
                  )}

                </div>

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


          {/* ====================================================
              ERROR
          ==================================================== */}

          {error && (
            <div className="error-box">

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
          TRADE SIGNAL
          SIMPLIFIED
      ======================================================== */}

      {tradeSignal && (
        <section
          className="card execution-card"
        >

          <div className="execution-header">

            <div>

              <span className="muted">
                Trade Signal
              </span>

              <h2
                className={`execution-direction ${directionClass(
                  currentDirection
                )}`}
              >
                {directionLabel(
                  currentDirection
                )}
              </h2>

            </div>


            <div className="confidence">

              <span className="muted">
                Confidence
              </span>

              <strong>
                {tradeSignal.confidence}%
              </strong>

            </div>

          </div>


          {/* ====================================================
              EXECUTION LEVELS
          ==================================================== */}

          <div className="execution-grid">

            <div className="execution-item">

              <span className="muted">
                {executionEntryLabel}
              </span>

              <strong>
                {formatPrice(
                  displayEntry
                )}
              </strong>

            </div>


            <div className="execution-item">

              <span className="muted">
                {executionStopLabel}
              </span>

              <strong>
                {formatPrice(
                  displayStop
                )}
              </strong>

            </div>


            <div className="execution-item">

              <span className="muted">
                {executionTp1Label}
              </span>

              <strong>
                {formatPrice(
                  displayTp1
                )}
              </strong>

            </div>


            <div className="execution-item">

              <span className="muted">
                {executionTp2Label}
              </span>

              <strong>
                {formatPrice(
                  displayTp2
                )}
              </strong>

            </div>


            <div className="execution-item">

              <span className="muted">
                {executionFinalTpLabel}
              </span>

              <strong>
                {formatPrice(
                  displayFinalTp
                )}
              </strong>

            </div>

          </div>


          {/* ====================================================
              ACTIVE ZONE
          ==================================================== */}

          {projection &&
            projection.available &&
            (
              projection.zoneLow !== null ||
              projection.zoneHigh !== null
            ) && (

              <div className="projection-box">

                <div className="projection-title">

                  <strong>
                    Active Zone
                  </strong>

                  <span>
                    {projection.setupType}
                  </span>

                </div>


                <div className="projection-grid">

                  <div>

                    <span className="muted">
                      Zone Low
                    </span>

                    <strong>
                      {formatPrice(
                        projection.zoneLow
                      )}
                    </strong>

                  </div>


                  <div>

                    <span className="muted">
                      Zone High
                    </span>

                    <strong>
                      {formatPrice(
                        projection.zoneHigh
                      )}
                    </strong>

                  </div>

                </div>

              </div>
            )}


          {/* ====================================================
              RETEST / CONFIRMATION
          ==================================================== */}

          {projection &&
            (
              projection.retestRequired ||
              projection.confirmationRequired
            ) && (

              <div className="status-row">

                {projection.retestRequired && (
                  <div>

                    <span className="muted">
                      Retest
                    </span>

                    <strong>
                      {
                        projection.retestStatus
                      }
                    </strong>

                  </div>
                )}


                {projection.confirmationRequired && (
                  <div>

                    <span className="muted">
                      Confirmation
                    </span>

                    <strong>
                      {
                        projection.confirmationStatus
                      }
                    </strong>

                  </div>
                )}

              </div>
            )}


          {projection &&
            projection.confirmationRequired && (

              <div className="confirmation-box">

                <span className="muted">
                  Confirmation Required
                </span>

                <strong>
                  {
                    projection.confirmationRequired
                  }
                </strong>

              </div>
            )}

        </section>
      )}


      {/* ========================================================
          MARKET MAP
          WARM RESPONSE
      ======================================================== */}

      {tradeSignal && (
        <section
          className="card"
          style={{
            marginTop: "20px",
          }}
        >

          <h2 className="title">
            Market Map
          </h2>


          <div className="market-map">

            <div>

              <span className="muted">
                Current Market State
              </span>

              <strong>
                {marketState || "WAIT"}
              </strong>

            </div>


            <div>

              <span className="muted">
                Current Setup
              </span>

              <strong>
                {setup || "No setup identified yet."}
              </strong>

            </div>


            {projection &&
              projection.available && (
                <div>

                  <span className="muted">
                    Active / Expected Zone
                  </span>

                  <strong>

                    {projection.zoneLow !==
                    null
                      ? formatPrice(
                          projection.zoneLow
                        )
                      : "WAIT"}

                    {" — "}

                    {projection.zoneHigh !==
                    null
                      ? formatPrice(
                          projection.zoneHigh
                        )
                      : "WAIT"}

                  </strong>

                </div>
              )}


            <div>

              <span className="muted">
                Confirmed
              </span>

              <strong>
                {confirmedConditions.length >
                0
                  ? confirmedConditions.join(
                      " • "
                    )
                  : "No conditions confirmed yet."}
              </strong>

            </div>


            <div>

              <span className="muted">
                What To Watch
              </span>

              <strong>
                {missingConditions.length >
                0
                  ? missingConditions.join(
                      " • "
                    )
                  : "No additional condition is currently reported."}
              </strong>

            </div>

          </div>

        </section>
      )}


      {/* ========================================================
          TRADE ROADMAP
          NO WAIT FOR SETUP REPETITION
          NO DUPLICATE NO VALID TRADE MESSAGE
      ======================================================== */}

      {tradeSignal && (
        <section
          className="card"
          style={{
            marginTop: "20px",
          }}
        >

          <h2 className="title">
            Trade Roadmap
          </h2>


          <div
            style={{
              display: "grid",
              gap: "14px",
              marginTop: "16px",
            }}
          >

            <div className="condition-box">

              <strong>
                What the Chart Is Showing
              </strong>

              <p
                style={{
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.7,
                  marginBottom: 0,
                }}
              >
                {setup ||
                  marketState ||
                  "The selected strategy has analyzed the available chart evidence."}
              </p>

            </div>


            {confirmedConditions.length >
              0 && (
                <div className="condition-box">

                  <strong>
                    Confirmed Conditions
                  </strong>

                  <ul>

                    {confirmedConditions.map(
                      (
                        condition,
                        index
                      ) => (
                        <li
                          key={`roadmap-confirmed-${index}`}
                        >
                          {condition}
                        </li>
                      )
                    )}

                  </ul>

                </div>
              )}


            {missingConditions.length >
              0 && (
                <div className="condition-box">

                  <strong>
                    Condition Being Watched
                  </strong>

                  <ul>

                    {missingConditions.map(
                      (
                        condition,
                        index
                      ) => (
                        <li
                          key={`roadmap-missing-${index}`}
                        >
                          {condition}
                        </li>
                      )
                    )}

                  </ul>

                </div>
              )}


            {currentDirection ===
              "NO TRADE" && (
                <div className="condition-box">

                  <strong>
                    Why There Is No Trade
                  </strong>

                  <p
                    style={{
                      whiteSpace:
                        "pre-wrap",
                      lineHeight: 1.7,
                      marginBottom: 0,
                    }}
                  >
                    {tradeSignal.invalidation ||
                      (missingConditions.length >
                      0
                        ? missingConditions.join(
                            " • "
                          )
                        : "The selected strategy conditions are not currently sufficient for a trade.")}
                  </p>

                </div>
              )}


            {(currentDirection ===
              "WAITING" ||
              isDeveloping) &&
              missingConditions.length ===
                0 && (
                <div className="condition-box">

                  <strong>
                    What To Watch
                  </strong>

                  <p
                    style={{
                      lineHeight: 1.7,
                      marginBottom: 0,
                    }}
                  >
                    The chart remains under
                    observation for the next
                    strategy-defined confirmation.
                  </p>

                </div>
              )}

          </div>

        </section>
      )}


      {/* ========================================================
          AI COACH
          EXPLANATION ONLY
      ======================================================== */}

      {tradeSignal && (
        <section
          className="card"
          style={{
            marginTop: "20px",
          }}
        >

          <div className="analysis-heading">

            <div>

              <span className="muted">
                AI Coach
              </span>

              <h2 className="title">
                Ask About This Setup
              </h2>

            </div>

          </div>


          <p
            className="muted"
            style={{
              lineHeight: 1.6,
            }}
          >
            Ask why the strategy is in its
            current state, what has been
            confirmed, what is missing, or
            what would invalidate the setup.
          </p>


          <div
            style={{
              display: "flex",
              gap: "10px",
              marginTop: "14px",
              flexWrap: "wrap",
            }}
          >

            <button
              type="button"
              className="secondary"
              onClick={() => {
                if (
                  currentDirection ===
                  "WAITING"
                ) {
                  setAiCoach(
                    missingConditions.length >
                    0
                      ? `The strategy has identified the current market evidence, but these conditions are still being watched: ${missingConditions.join(
                          "; "
                        )}`
                      : "The strategy has not reported a completed confirmation sequence."
                  );

                  return;
                }

                if (
                  currentDirection ===
                  "BUY DEVELOPING"
                ) {
                  setAiCoach(
                    "The BUY setup is developing. Review the confirmed conditions and the remaining condition shown in the Trade Roadmap before the strategy can produce a confirmed BUY."
                  );

                  return;
                }

                if (
                  currentDirection ===
                  "SELL DEVELOPING"
                ) {
                  setAiCoach(
                    "The SELL setup is developing. Review the confirmed conditions and the remaining condition shown in the Trade Roadmap before the strategy can produce a confirmed SELL."
                  );

                  return;
                }

                if (
                  currentDirection ===
                  "NO TRADE"
                ) {
                  setAiCoach(
                    tradeSignal.invalidation ||
                      "The selected strategy has not produced a valid trade from the current chart evidence."
                  );

                  return;
                }

                setAiCoach(
                  `The ${currentDirection} is confirmed by the selected strategy. The execution levels shown above are returned by the strategy engine.`
                );
              }}
            >
              Explain This
            </button>


            <button
              type="button"
              className="secondary"
              onClick={() => {
                setAiCoach(
                  missingConditions.length >
                  0
                    ? `Watch for: ${missingConditions.join(
                        "; "
                      )}`
                    : "No additional missing conditions were reported by the strategy analysis."
                );
              }}
            >
              What Am I Waiting For?
            </button>


            <button
              type="button"
              className="secondary"
              onClick={() => {
                setAiCoach(
                  tradeSignal.invalidation ||
                    "No specific invalidation condition was returned by the strategy analysis."
                );
              }}
            >
              What Invalidates It?
            </button>

          </div>


          <div
            style={{
              display: "flex",
              gap: "10px",
              marginTop: "14px",
            }}
          >

            <input
              type="text"
              placeholder="Ask the AI Coach a question..."
              className="coach-input"
              onKeyDown={async (
                event
              ) => {
                if (
                  event.key !== "Enter"
                ) {
                  return;
                }

                const question =
                  event.currentTarget.value.trim();

                if (!question) {
                  return;
                }

                await askCoach(question);
                event.currentTarget.value =
                  "";
              }}
            />


            <button
              type="button"
              className="primary"
              onClick={async () => {
                const input =
                  document.querySelector(
                    ".coach-input"
                  ) as HTMLInputElement | null;

                const question =
                  input?.value.trim();

                if (!question) {
                  return;
                }

                await askCoach(question);

                if (input) {
                  input.value = "";
                }
              }}
            >
              Ask
            </button>

          </div>


          {aiCoach && (
            <div
              className="coach-box"
              style={{
                marginTop: "16px",
              }}
            >

              <span className="muted">
                AI Coach Response
              </span>

              <p
                style={{
                  whiteSpace:
                    "pre-wrap",
                  lineHeight: 1.7,
                  marginBottom: 0,
                }}
              >
                {aiCoach}
              </p>

            </div>
          )}

        </section>
      )}


      {/* ========================================================
          DISCLAIMER
      ======================================================== */}

      <footer className="footer">

        <div className="footer-brand">
          VAULTTRADES
        </div>

        <p>
          Built by Traders. Focus,
          discipline, consistency.
        </p>

        <p className="disclaimer">

          <strong>
            Disclaimer:
          </strong>{" "}

          VaultTrades is an analytical
          tool designed to assist with
          market analysis and strategy
          evaluation. It does not
          provide financial advice,
          investment advice or a
          guarantee of trading results.
          Trading involves substantial
          risk and users remain solely
          responsible for their own
          trading decisions.

        </p>

        <p className="copyright">
          © {new Date().getFullYear()}{" "}
          VaultTrades. All rights
          reserved.
        </p>

      </footer>

    </main>
  );
}

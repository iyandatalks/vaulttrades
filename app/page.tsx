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
    description:
      "London Kill Zone model",
    detail:
      "Asian liquidity sweep → MSS → FVG → 50% FVG retracement → entry",
  },

  ema: {
    name: "EMA",
    description:
      "EMA20 Pullback Morning Engine",
    detail:
      "EMA20 pullback → rejection → break → UT Bot OR SMI confirmation",
  },

  continuation: {
    name: "Continuation",
    description:
      "M15 Continuation model",
    detail:
      "Expansion → correction → structural support/resistance → recovery → confirmed continuation",
  },

  supplyDemand: {
    name: "Supply & Demand",
    description:
      "Independent Supply & Demand Zone Engine",
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

function formatPrice(
  value: number | null
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return "WAIT";
  }

  return value.toLocaleString(
    undefined,
    {
      maximumFractionDigits: 5,
    }
  );
}

function directionClass(
  direction: Direction
) {
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

function directionLabel(
  direction: Direction
) {
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

function setupTypeLabel(
  setupType: Projection["setupType"]
) {
  switch (setupType) {
    case "demand":
      return "Demand Zone";

    case "supply":
      return "Supply Zone";

    case "long":
      return "Long Setup";

    case "short":
      return "Short Setup";

    case "continuation":
      return "Continuation Setup";

    case "killZone":
      return "Killer Zone Setup";

    case "ema":
      return "EMA Setup";

    default:
      return "No Active Projection";
  }
}

export default function Home() {
  const [
    strategy,
    setStrategy,
  ] = useState<Strategy>(
    "killZone"
  );

  const [
    timeframe,
    setTimeframe,
  ] = useState<Timeframe>("M5");

  const [
    chart,
    setChart,
  ] = useState<string | null>(
    null
  );

  const [
    selectedFile,
    setSelectedFile,
  ] = useState<File | null>(
    null
  );

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
  ] = useState<TradeSignal | null>(
    null
  );

  const [
    projection,
    setProjection,
  ] = useState<Projection | null>(
    null
  );

  const [
    annotations,
    setAnnotations,
  ] = useState<
    ChartAnnotation[]
  >([]);

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
  ] = useState<string[]>(
    []
  );

  const [
    missingConditions,
    setMissingConditions,
  ] = useState<string[]>(
    []
  );

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

  function changeStrategy(
    nextStrategy: Strategy
  ) {
    setStrategy(nextStrategy);
    clearResults();
    setError("");
  }


  // ============================================================
  // CHANGE TIMEFRAME
  // ============================================================

  function changeTimeframe(
    nextTimeframe: Timeframe
  ) {
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
    const file =
      event.target.files?.[0];

    if (!file) return;

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      alert(
        "Please upload a chart image."
      );

      return;
    }

    setSelectedFile(file);
    setFileName(file.name);

    clearResults();
    setError("");

    const reader =
      new FileReader();

    reader.onload = () => {
      setChart(
        reader.result as string
      );
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

    const input =
      document.getElementById(
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
      setError(
        "Please upload a chart first."
      );

      return;
    }

    setLoading(true);
    clearResults();
    setError("");

    try {
      const formData =
        new FormData();

      formData.append(
        "image",
        selectedFile
      );

      formData.append(
        "strategy",
        strategy
      );

      formData.append(
        "timeframe",
        timeframe
      );

      const response =
        await fetch(
          "/api/analyze",
          {
            method: "POST",
            body: formData,
          }
        );

      const data =
        (await response.json()) as
          | AnalysisResponse
          | {
              error?: string;
            };

      if (!response.ok) {
        throw new Error(
          "error" in data &&
          data.error
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

      setAnalysis(
        data.analysis
      );

      setTradeSignal(
        data.tradeSignal
      );

      setProjection(
        data.projection
      );

      setAnnotations(
        data.chartAnnotations ?? []
      );

      setMarketState(
        data.marketState ?? ""
      );

      setSetup(
        data.setup ?? ""
      );

      setConfirmedConditions(
        data.confirmedConditions ?? []
      );

      setMissingConditions(
        data.missingConditions ?? []
      );

      setAiCoach(
        data.aiCoach ?? ""
      );
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
        const points =
          annotation.points ?? [];

        if (
          annotation.type ===
            "zone" &&
          points.length >= 4
        ) {
          const xs =
            points.map(
              (point) => point.x
            );

          const ys =
            points.map(
              (point) => point.y
            );

          const minX =
            Math.min(...xs);

          const maxX =
            Math.max(...xs);

          const minY =
            Math.min(...ys);

          const maxY =
            Math.max(...ys);

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
              <span>
                {annotation.label}
              </span>
            </div>
          );
        }

        if (
          annotation.type ===
            "entry" ||
          annotation.type ===
            "stopLoss" ||
          annotation.type ===
            "tp1" ||
          annotation.type ===
            "tp2" ||
          annotation.type ===
            "finalTp"
        ) {
          const point =
            points[0];

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
              <span>
                {annotation.label}
              </span>

              {annotation.price !==
                null &&
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
          annotation.type ===
            "retest" ||
          annotation.type ===
            "confirmation"
        ) {
          const point =
            points[0];

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
              <span>
                {annotation.label}
              </span>
            </div>
          );
        }

        return null;
      }
    );
  }


  // ============================================================
  // RESULT VALUES
  // ============================================================

  const currentDirection =
    tradeSignal?.direction ??
    "WAITING";

  const isDeveloping =
    currentDirection ===
      "BUY DEVELOPING" ||
    currentDirection ===
      "SELL DEVELOPING";

  const displayEntry =
    isDeveloping
      ? projection?.expectedEntry ??
        null
      : tradeSignal?.entry ??
        null;

  const displayStop =
    isDeveloping
      ? projection?.expectedStopLoss ??
        null
      : tradeSignal?.stopLoss ??
        null;

  const displayTp1 =
    isDeveloping
      ? projection?.expectedTp1 ??
        null
      : tradeSignal?.tp1 ??
        null;

  const displayTp2 =
    isDeveloping
      ? projection?.expectedTp2 ??
        null
      : tradeSignal?.tp2 ??
        null;

  const displayFinalTp =
    isDeveloping
      ? projection?.expectedFinalTp ??
        null
      : tradeSignal?.finalTp ??
        null;


  const hasProjectedZone =
    !!projection &&
    projection.available &&
    (
      projection.zoneLow !== null ||
      projection.zoneHigh !== null
    );


  return (
    <main className="shell">

      {/* ========================================================
          HEADER
      ======================================================== */}

      <header className="header">

        <div className="brand-area">

          <div className="brand">
            VAULTTRADES
          </div>

          <div className="brand-subtitle">
            Built by Traders.
          </div>

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


          {/* KILL ZONE */}

          <button
            type="button"
            className={`strategy ${
              strategy === "killZone"
                ? "active"
                : ""
            }`}
            onClick={() =>
              changeStrategy(
                "killZone"
              )
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
              changeStrategy(
                "ema"
              )
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


          {/* CONTINUATION */}

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


          {/* SUPPLY & DEMAND */}

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
                      changeTimeframe(
                        tf
                      )
                    }
                  >
                    {tf}
                  </button>
                )
              )}

            </div>

          </div>


          {/* ====================================================
              NO DUPLICATE STRATEGY / TIMEFRAME BLOCK HERE
              CHART FOLLOWS DIRECTLY
          ==================================================== */}


          {/* ====================================================
              UPLOAD / CHART
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
              onChange={
                handleUpload
              }
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

                  {annotations.length >
                    0 && (
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
              onClick={
                analyzeChart
              }
            >
              {loading
                ? "Analyzing Chart..."
                : "Analyze Chart"}
            </button>


            <button
              type="button"
              className="secondary"
              onClick={
                clearChart
              }
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
          IMMEDIATE TRADE / MARKET RESPONSE

          This is intentionally BEFORE the long analysis.

          It gives the trader an immediate answer about:
          - current direction/state
          - confidence
          - active zone
          - expected execution
          - retest
          - confirmation
          - what to watch
      ======================================================== */}

      {tradeSignal && (
        <section
          className="card execution-card"
        >

          <div className="execution-header">

            <div>

              <span className="muted">
                Current Market Read
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
                {
                  tradeSignal.confidence
                }
                %
              </strong>

            </div>

          </div>


          {/* ====================================================
              HUMAN MARKET RESPONSE
          ==================================================== */}

          <div className="market-response">

            <div className="market-response-heading">
              <strong>
                What the chart is showing now
              </strong>
            </div>

            {marketState && (
              <p>
                {marketState}
              </p>
            )}

          </div>


          {/* ====================================================
              ACTIVE / PROJECTED ZONE
          ==================================================== */}

          {hasProjectedZone && (
            <div className="projection-box">

              <div className="projection-title">

                <strong>
                  Current Zone / Trade Area
                </strong>

                <span>
                  {setupTypeLabel(
                    projection!.setupType
                  )}
                </span>

              </div>

              <div className="projection-grid">

                <div>

                  <span className="muted">
                    Zone Low
                  </span>

                  <strong>
                    {formatPrice(
                      projection!.zoneLow
                    )}
                  </strong>

                </div>

                <div>

                  <span className="muted">
                    Zone High
                  </span>

                  <strong>
                    {formatPrice(
                      projection!.zoneHigh
                    )}
                  </strong>

                </div>

              </div>

            </div>
          )}


          {/* ====================================================
              DEVELOPING STATE
          ==================================================== */}

          {isDeveloping && (
            <div className="developing-banner">

              <strong>
                SETUP DEVELOPING
              </strong>

              <span>
                The strategy has identified a
                potential trade area, but the
                required confirmation has not
                completed yet.
              </span>

            </div>
          )}


          {/* ====================================================
              WAITING STATE

              No generic "current market conditions..."
              sentence. Explain using actual analysis.
          ==================================================== */}

          {currentDirection ===
            "WAITING" && (
            <div className="waiting-banner">

              <strong>
                WAIT FOR SETUP
              </strong>

              <span>
                The chart is being monitored for
                the conditions required by the
                selected strategy.
              </span>

            </div>
          )}


          {/* ====================================================
              NO TRADE STATE

              Do NOT repeat:
              "NO VALID TRADE — Current market
              conditions do not satisfy the strategy."
          ==================================================== */}

          {currentDirection ===
            "NO TRADE" && (
            <div className="waiting-banner">

              <strong>
                NO TRADE
              </strong>

              <span>
                {missingConditions.length >
                0
                  ? missingConditions[0]
                  : tradeSignal.invalidation ||
                    "The required strategy conditions are not currently aligned."}
              </span>

            </div>
          )}


          {/* ====================================================
              EXECUTION LEVELS
          ==================================================== */}

          <div className="execution-grid">

            <div className="execution-item">

              <span className="muted">
                {isDeveloping
                  ? "Expected Entry"
                  : "Entry"}
              </span>

              <strong>
                {formatPrice(
                  displayEntry
                )}
              </strong>

            </div>


            <div className="execution-item">

              <span className="muted">
                {isDeveloping
                  ? "Expected Stop Loss"
                  : "Stop Loss"}
              </span>

              <strong>
                {formatPrice(
                  displayStop
                )}
              </strong>

            </div>


            <div className="execution-item">

              <span className="muted">
                {isDeveloping
                  ? "Expected TP1"
                  : "TP1"}
              </span>

              <strong>
                {formatPrice(
                  displayTp1
                )}
              </strong>

            </div>


            <div className="execution-item">

              <span className="muted">
                {isDeveloping
                  ? "Expected TP2"
                  : "TP2"}
              </span>

              <strong>
                {formatPrice(
                  displayTp2
                )}
              </strong>

            </div>


            <div className="execution-item">

              <span className="muted">
                {isDeveloping
                  ? "Expected Final TP"
                  : "Final TP"}
              </span>

              <strong>
                {formatPrice(
                  displayFinalTp
                )}
              </strong>

            </div>

          </div>


          {/* ====================================================
              RETEST / CONFIRMATION
          ==================================================== */}

          {projection &&
            projection.retestRequired && (
              <div className="status-row">

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

              </div>
            )}


          {/* ====================================================
              CONFIRMATION REQUIRED
          ==================================================== */}

          {projection &&
            projection.confirmationRequired && (
              <div className="confirmation-box">

                <span className="muted">
                  What to Watch
                </span>

                <strong>
                  {
                    projection.confirmationRequired
                  }
                </strong>

              </div>
            )}


          {/* ====================================================
              CONFIRMED CONDITIONS
          ==================================================== */}

          {confirmedConditions.length >
            0 && (
            <div className="condition-box">

              <strong>
                Conditions Already Detected
              </strong>

              <ul>
                {confirmedConditions.map(
                  (
                    condition,
                    index
                  ) => (
                    <li
                      key={`immediate-confirmed-${index}`}
                    >
                      {condition}
                    </li>
                  )
                )}
              </ul>

            </div>
          )}


          {/* ====================================================
              MISSING CONDITIONS
          ==================================================== */}

          {missingConditions.length >
            0 && (
            <div className="condition-box">

              <strong>
                Still Required
              </strong>

              <ul>
                {missingConditions.map(
                  (
                    condition,
                    index
                  ) => (
                    <li
                      key={`immediate-missing-${index}`}
                    >
                      {condition}
                    </li>
                  )
                )}
              </ul>

            </div>
          )}


          {/* ====================================================
              INVALIDATION
          ==================================================== */}

          {tradeSignal.invalidation && (
            <div className="confirmation-box">

              <span className="muted">
                Setup Invalidation
              </span>

              <strong>
                {
                  tradeSignal.invalidation
                }
              </strong>

            </div>
          )}

        </section>
      )}


      {/* ========================================================
          SETUP
      ======================================================== */}

      {tradeSignal && setup && (
        <section
          className="card"
          style={{
            marginTop: "20px",
          }}
        >

          <h2 className="title">
            Setup
          </h2>

          <p
            style={{
              whiteSpace:
                "pre-wrap",
              lineHeight: 1.7,
              marginBottom: 0,
            }}
          >
            {setup}
          </p>

        </section>
      )}


      {/* ========================================================
          AI TRADE ANALYSIS

          Detailed explanation remains BELOW immediate result.
      ======================================================== */}

      {analysis && (
        <section
          className="card analysis-card"
          style={{
            marginTop: "20px",
          }}
        >

          <div className="analysis-heading">

            <div>

              <span className="muted">
                Detailed Strategy Review
              </span>

              <h2 className="title">
                AI Trade Analysis
              </h2>

            </div>

            <div className="analysis-meta">

              <span>
                {
                  strategies[
                    strategy
                  ].name
                }
              </span>

              <strong>
                {timeframe}
              </strong>

            </div>

          </div>


          <div
            style={{
              whiteSpace:
                "pre-wrap",
              lineHeight: 1.7,
            }}
          >
            {analysis}
          </div>


          {/* ====================================================
              CONDITIONS
          ==================================================== */}

          {(confirmedConditions.length >
            0 ||
            missingConditions.length >
              0) && (
            <div className="conditions-grid">

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
                          key={
                            `confirmed-${index}`
                          }
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
                    Missing Conditions
                  </strong>

                  <ul>
                    {missingConditions.map(
                      (
                        condition,
                        index
                      ) => (
                        <li
                          key={
                            `missing-${index}`
                          }
                        >
                          {condition}
                        </li>
                      )
                    )}
                  </ul>

                </div>
              )}

            </div>
          )}


          {/* ====================================================
              AI COACH
          ==================================================== */}

          {aiCoach && (
            <div className="coach-box">

              <span className="muted">
                Trade Coach
              </span>

              <strong>
                {aiCoach}
              </strong>

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

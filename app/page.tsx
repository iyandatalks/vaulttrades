"use client";

import { ChangeEvent, useMemo, useState } from "react";

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

const TIMEFRAMES: Timeframe[] = [
  "M1",
  "M5",
  "M10",
  "M15",
  "M30",
  "H1",
  "H4",
  "D1",
];

const STRATEGIES: {
  id: Strategy;
  name: string;
  description: string;
}[] = [
  {
    id: "killZone",
    name: "Killer Zone",
    description: "London liquidity sweep → MSS → FVG → entry",
  },
  {
    id: "ema",
    name: "EMA",
    description: "EMA20 pullback → rejection → break → confirmation",
  },
  {
    id: "continuation",
    name: "Continuation",
    description: "Expansion → correction → structure → continuation",
  },
  {
    id: "supplyDemand",
    name: "Supply & Demand",
    description: "Zones → retest → reaction → confirmed entry",
  },
];

function formatPrice(
  value: number | null | undefined,
): string {
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

function signalClass(direction: Direction): string {
  if (
    direction === "BUY" ||
    direction === "BUY DEVELOPING"
  ) {
    return "buy";
  }

  if (
    direction === "SELL" ||
    direction === "SELL DEVELOPING"
  ) {
    return "sell";
  }

  return "neutral";
}

function isConfirmedDirection(
  direction: Direction,
): boolean {
  return direction === "BUY" || direction === "SELL";
}

function isDevelopingDirection(
  direction: Direction,
): boolean {
  return (
    direction === "BUY DEVELOPING" ||
    direction === "SELL DEVELOPING"
  );
}

function safeNumber(
  value: unknown,
): number | null {
  if (typeof value !== "number") return null;
  return Number.isFinite(value) ? value : null;
}

function normaliseTradeSignal(
  signal: TradeSignal | undefined,
): TradeSignal | null {
  if (!signal) return null;

  return {
    direction: signal.direction ?? "NO TRADE",
    confidence:
      typeof signal.confidence === "number"
        ? signal.confidence
        : 0,
    entry: safeNumber(signal.entry),
    stopLoss: safeNumber(signal.stopLoss),
    risk: safeNumber(signal.risk),
    tp1: safeNumber(signal.tp1),
    tp2: safeNumber(signal.tp2),
    finalTp: safeNumber(signal.finalTp),
    invalidation: signal.invalidation ?? "",
  };
}

function renderChartAnnotations(
  annotations: ChartAnnotation[],
) {
  return annotations.map((annotation, index) => {
    const points = annotation.points ?? [];

    if (
      annotation.type === "zone" &&
      points.length >= 2
    ) {
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
            width: `${Math.max(
              2,
              (maxX - minX) / 10,
            )}%`,
            height: `${Math.max(
              2,
              (maxY - minY) / 10,
            )}%`,
          }}
        >
          <span>{annotation.label}</span>
        </div>
      );
    }

    const point = points[0];

    if (!point) return null;

    if (
      [
        "entry",
        "stopLoss",
        "tp1",
        "tp2",
        "finalTp",
      ].includes(annotation.type)
    ) {
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
            annotation.price !== undefined && (
              <strong>
                {formatPrice(annotation.price)}
              </strong>
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

export default function Home() {
  const [strategy, setStrategy] =
    useState<Strategy>("killZone");

  const [timeframe, setTimeframe] =
    useState<Timeframe>("M5");

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [chart, setChart] =
    useState<string | null>(null);

  const [fileName, setFileName] =
    useState<string>("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string>("");

  const [analysis, setAnalysis] =
    useState<string>("");

  const [tradeSignal, setTradeSignal] =
    useState<TradeSignal | null>(null);

  const [projection, setProjection] =
    useState<Projection | null>(null);

  const [annotations, setAnnotations] =
    useState<ChartAnnotation[]>([]);

  const [marketState, setMarketState] =
    useState<string>("");

  const [setup, setSetup] =
    useState<string>("");

  const [confirmedConditions, setConfirmedConditions] =
    useState<string[]>([]);

  const [missingConditions, setMissingConditions] =
    useState<string[]>([]);

  const [aiCoach, setAiCoach] =
    useState<string>("");

  const [coachLoading, setCoachLoading] =
    useState(false);

  const clearResults = () => {
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
  };

  const handleStrategyChange = (
    nextStrategy: Strategy,
  ) => {
    setStrategy(nextStrategy);
    clearResults();
  };

  const handleTimeframeChange = (
    nextTimeframe: Timeframe,
  ) => {
    setTimeframe(nextTimeframe);
    clearResults();
  };

  const handleUpload = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError(
        "Please upload a PNG, JPG or WebP chart image.",
      );
      return;
    }

    setSelectedFile(file);
    setFileName(file.name);
    clearResults();

    const reader = new FileReader();

    reader.onload = () => {
      setChart(
        typeof reader.result === "string"
          ? reader.result
          : null,
      );
    };

    reader.onerror = () => {
      setError("Unable to read the chart image.");
    };

    reader.readAsDataURL(file);
  };

  const clearChart = () => {
    setChart(null);
    setSelectedFile(null);
    setFileName("");
    clearResults();

    const input =
      document.getElementById(
        "chart-upload",
      ) as HTMLInputElement | null;

    if (input) {
      input.value = "";
    }
  };

  const analyzeChart = async () => {
    if (!selectedFile) {
      setError(
        "Please upload a trading chart first.",
      );
      return;
    }

    setLoading(true);
    clearResults();

    try {
      const formData = new FormData();

      formData.append(
        "image",
        selectedFile,
      );

      formData.append(
        "strategy",
        strategy,
      );

      formData.append(
        "timeframe",
        timeframe,
      );

      const response = await fetch(
        "/api/analyze",
        {
          method: "POST",
          body: formData,
        },
      );

      let data: AnalysisResponse;

      try {
        data =
          (await response.json()) as AnalysisResponse;
      } catch {
        throw new Error(
          "The analysis server returned an invalid response.",
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to analyze the chart.",
        );
      }

      const signal =
        normaliseTradeSignal(
          data.tradeSignal,
        );

      setAnalysis(
        data.analysis ?? "",
      );

      setTradeSignal(signal);

      setProjection(
        data.projection ?? null,
      );

      setAnnotations(
        data.chartAnnotations ?? [],
      );

      setMarketState(
        data.marketState ?? "",
      );

      setSetup(
        data.setup ?? "",
      );

      setConfirmedConditions(
        Array.isArray(
          data.confirmedConditions,
        )
          ? data.confirmedConditions
          : [],
      );

      setMissingConditions(
        Array.isArray(
          data.missingConditions,
        )
          ? data.missingConditions
          : [],
      );

      setAiCoach(
        data.aiCoach ?? "",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to analyze the chart.",
      );
    } finally {
      setLoading(false);
    }
  };

  const askCoach = async (
    question: string,
  ) => {
    const trimmedQuestion =
      question.trim();

    if (
      !trimmedQuestion ||
      !tradeSignal
    ) {
      return;
    }

    setCoachLoading(true);
    setAiCoach("");

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
            question:
              trimmedQuestion,

            strategy,

            timeframe,

            direction:
              tradeSignal.direction,

            confidence:
              tradeSignal.confidence,

            tradeSignal,

            projection,

            analysis,

            marketState,

            setup,

            confirmedConditions,

            missingConditions,

            chartAnnotations:
              annotations,
          }),
        },
      );

      let data: {
        answer?: string;
        error?: string;
      };

      try {
        data =
          (await response.json()) as {
            answer?: string;
            error?: string;
          };
      } catch {
        throw new Error(
          "The AI Coach returned an invalid response.",
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to get an AI Coach response.",
        );
      }

      setAiCoach(
        data.answer ||
          "The AI Coach could not provide an answer from the current setup.",
      );
    } catch (err) {
      setAiCoach(
        err instanceof Error
          ? err.message
          : "Unable to get an AI Coach response.",
      );
    } finally {
      setCoachLoading(false);
    }
  };

  const displayLevels = useMemo(() => {
    if (!tradeSignal) {
      return null;
    }

    const developing =
      isDevelopingDirection(
        tradeSignal.direction,
      );

    if (
      developing &&
      projection?.available
    ) {
      return {
        entry:
          projection.expectedEntry,

        stopLoss:
          projection.expectedStopLoss,

        risk: null,

        tp1:
          projection.expectedTp1,

        tp2:
          projection.expectedTp2,

        finalTp:
          projection.expectedFinalTp,
      };
    }

    return {
      entry: tradeSignal.entry,
      stopLoss: tradeSignal.stopLoss,
      risk: tradeSignal.risk,
      tp1: tradeSignal.tp1,
      tp2: tradeSignal.tp2,
      finalTp: tradeSignal.finalTp,
    };
  }, [
    tradeSignal,
    projection,
  ]);

  const confirmed =
    tradeSignal
      ? isConfirmedDirection(
          tradeSignal.direction,
        )
      : false;

  const developing =
    tradeSignal
      ? isDevelopingDirection(
          tradeSignal.direction,
        )
      : false;

  return (
    <main className="shell">
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

      <div className="grid">
        <section className="card">
          <h2 className="title">
            Select Strategy
          </h2>

          <p className="muted">
            Choose the independent strategy
            the analyzer must apply to the
            uploaded chart.
          </p>

          <div
            style={{
              display: "grid",
              gap: 10,
              marginTop: 18,
            }}
          >
            {STRATEGIES.map(
              (item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`strategy ${
                    strategy === item.id
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    handleStrategyChange(
                      item.id,
                    )
                  }
                  disabled={loading}
                >
                  <strong>
                    {item.name}
                  </strong>

                  <span className="muted">
                    {item.description}
                  </span>
                </button>
              ),
            )}
          </div>
        </section>

        <section className="card">
          <h2 className="title">
            Chart Analyzer
          </h2>

          <p className="muted">
            Select your timeframe, upload
            your TradingView chart, then
            analyze.
          </p>

          <div className="timeframe-section">
            <div className="section-label">
              SELECT TIMEFRAME
            </div>

            <div className="timeframe-grid">
              {TIMEFRAMES.map(
                (tf) => (
                  <button
                    key={tf}
                    type="button"
                    className={`timeframe-button ${
                      timeframe === tf
                        ? "selected"
                        : ""
                    }`}
                    disabled={loading}
                    aria-pressed={
                      timeframe === tf
                    }
                    onClick={() =>
                      handleTimeframeChange(
                        tf,
                      )
                    }
                  >
                    {tf}
                  </button>
                ),
              )}
            </div>
          </div>

          <label
            className="upload"
            htmlFor="chart-upload"
          >
            <input
              id="chart-upload"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={handleUpload}
              disabled={loading}
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
                      {renderChartAnnotations(
                        annotations,
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </label>

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
              onClick={clearChart}
              disabled={loading}
            >
              Clear
            </button>
          </div>

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

      {/* =========================================================
          IMMEDIATE EXECUTION RESULT
          This is deliberately before the long analysis.
          It displays the actual strategy engine result.
          ========================================================= */}

      <section className="card execution-card">
        <div className="section-label">
          IMMEDIATE EXECUTION RESULT
        </div>

        {!tradeSignal ? (
          <div
            style={{
              marginTop: 14,
            }}
          >
            <h2 className="title">
              Trade Signal
            </h2>

            <p className="muted">
              Upload a chart and analyze it
              to receive the direct
              execution result.
            </p>
          </div>
        ) : (
          <div
            className={`execution-result ${signalClass(
              tradeSignal.direction,
            )}`}
            style={{
              marginTop: 14,
            }}
          >
            <div className="execution-header">
              <div>
                <div className="execution-label">
                  EXECUTION STATE
                </div>

                <div className="execution-direction">
                  {tradeSignal.direction}
                </div>
              </div>

              <div className="confidence-box">
                <span>
                  CONFIDENCE
                </span>

                <strong>
                  {Math.max(
                    0,
                    Math.min(
                      100,
                      tradeSignal.confidence,
                    ),
                  )}
                  %
                </strong>
              </div>
            </div>

            <div className="execution-grid">
              <div className="execution-item">
                <span>
                  ENTRY
                </span>

                <strong>
                  {formatPrice(
                    displayLevels?.entry,
                  )}
                </strong>
              </div>

              <div className="execution-item">
                <span>
                  STOP LOSS
                </span>

                <strong>
                  {formatPrice(
                    displayLevels?.stopLoss,
                  )}
                </strong>
              </div>

              <div className="execution-item">
                <span>
                  RISK
                </span>

                <strong>
                  {formatPrice(
                    displayLevels?.risk,
                  )}
                </strong>
              </div>

              <div className="execution-item">
                <span>
                  TP1
                </span>

                <strong>
                  {formatPrice(
                    displayLevels?.tp1,
                  )}
                </strong>
              </div>

              <div className="execution-item">
                <span>
                  TP2
                </span>

                <strong>
                  {formatPrice(
                    displayLevels?.tp2,
                  )}
                </strong>
              </div>

              <div className="execution-item">
                <span>
                  FINAL TP
                </span>

                <strong>
                  {formatPrice(
                    displayLevels?.finalTp,
                  )}
                </strong>
              </div>
            </div>

            <div className="execution-status">
              <span>
                EXECUTION
              </span>

              <strong>
                {confirmed
                  ? "CONFIRMED"
                  : developing
                    ? "DEVELOPING — WAIT FOR CONFIRMATION"
                    : "NO CONFIRMED TRADE"}
              </strong>
            </div>

            {developing &&
              projection && (
                <>
                  {projection.retestRequired && (
                    <div className="execution-status">
                      <span>
                        RETEST
                      </span>

                      <strong>
                        {projection.retestStatus ||
                          "Required"}
                      </strong>
                    </div>
                  )}

                  {projection.confirmationRequired && (
                    <div className="execution-status">
                      <span>
                        REQUIRED NEXT
                      </span>

                      <strong>
                        {
                          projection.confirmationRequired
                        }
                      </strong>
                    </div>
                  )}

                  {projection.confirmationStatus && (
                    <div className="execution-status">
                      <span>
                        CONFIRMATION
                      </span>

                      <strong>
                        {
                          projection.confirmationStatus
                        }
                      </strong>
                    </div>
                  )}
                </>
              )}

            {tradeSignal.invalidation && (
              <div className="execution-status">
                <span>
                  INVALIDATION
                </span>

                <strong>
                  {
                    tradeSignal.invalidation
                  }
                </strong>
              </div>
            )}
          </div>
        )}
      </section>

      {tradeSignal && (
        <>
          {/* =====================================================
              MARKET MAP
              ===================================================== */}

          <section className="card analysis-card">
            <h2 className="title">
              Market Map
            </h2>

            <div className="market-map">
              <div>
                <span className="muted">
                  Current Market State
                </span>

                <strong>
                  {marketState ||
                    "Monitoring current market structure"}
                </strong>
              </div>

              <div>
                <span className="muted">
                  Current Setup
                </span>

                <strong>
                  {setup ||
                    "No completed setup has been reported yet."}
                </strong>
              </div>

              {projection?.available && (
                <div>
                  <span className="muted">
                    Active / Expected Zone
                  </span>

                  <strong>
                    {formatPrice(
                      projection.zoneLow,
                    )}{" "}
                    —{" "}
                    {formatPrice(
                      projection.zoneHigh,
                    )}
                  </strong>
                </div>
              )}

              <div>
                <span className="muted">
                  Confirmed Conditions
                </span>

                <strong>
                  {confirmedConditions.length >
                  0
                    ? confirmedConditions.join(
                        " • ",
                      )
                    : "No confirmed conditions reported yet"}
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
                        " • ",
                      )
                    : "Continue monitoring the selected strategy conditions"}
                </strong>
              </div>
            </div>
          </section>

          {/* =====================================================
              TRADE ROADMAP
              ===================================================== */}

          <section className="card analysis-card">
            <h2 className="title">
              Trade Roadmap
            </h2>

            <div
              style={{
                display: "grid",
                gap: 14,
                marginTop: 16,
              }}
            >
              <div className="condition-box">
                <strong>
                  Current Setup
                </strong>

                <p
                  style={{
                    whiteSpace:
                      "pre-wrap",
                    lineHeight: 1.7,
                    marginBottom: 0,
                  }}
                >
                  {setup ||
                    "The selected strategy is monitoring the chart for its required sequence."}
                </p>
              </div>

              {confirmedConditions.length >
                0 && (
                <div className="condition-box">
                  <strong>
                    What the Chart Has Confirmed
                  </strong>

                  <ul>
                    {confirmedConditions.map(
                      (
                        condition,
                        index,
                      ) => (
                        <li
                          key={`confirmed-${index}`}
                        >
                          {condition}
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              )}

              {missingConditions.length >
                0 && (
                <div className="condition-box">
                  <strong>
                    What the Chart Is Watching
                  </strong>

                  <ul>
                    {missingConditions.map(
                      (
                        condition,
                        index,
                      ) => (
                        <li
                          key={`watch-${index}`}
                        >
                          {condition}
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              )}
            </div>
          </section>

          {/* =====================================================
              LONG-FORM AI TRADE ANALYSIS
              This intentionally comes AFTER the execution result.
              ===================================================== */}

          {analysis && (
            <section className="card analysis-card">
              <h2 className="title">
                AI Trade Analysis
              </h2>

              <p className="analysis-text">
                {analysis}
              </p>
            </section>
          )}

          {/* =====================================================
              AI COACH
              Explanation only. It does not generate or alter
              the strategy engine's trade signal.
              ===================================================== */}

          <section className="card coach-card">
            <span className="muted">
              AI Coach
            </span>

            <h2 className="title">
              Ask About This Setup
            </h2>

            <p
              className="muted"
              style={{
                lineHeight: 1.6,
              }}
            >
              AI Coach explains the
              selected strategy result.
              It does not create or
              change the trade signal,
              entry, stop loss or
              targets.
            </p>

            <div className="coach-suggestions">
              <button
                type="button"
                disabled={coachLoading}
                onClick={() =>
                  void askCoach(
                    "Explain the current strategy result and why it is in this state.",
                  )
                }
              >
                Explain This Setup
              </button>

              <button
                type="button"
                disabled={coachLoading}
                onClick={() =>
                  void askCoach(
                    "What condition is the selected strategy watching next?",
                  )
                }
              >
                What Am I Waiting For?
              </button>

              <button
                type="button"
                disabled={coachLoading}
                onClick={() =>
                  void askCoach(
                    "What invalidates the current strategy idea?",
                  )
                }
              >
                What Invalidates It?
              </button>
            </div>

            <div className="coach-question">
              <input
                id="coach-question"
                type="text"
                placeholder="Ask the AI Coach a question..."
                disabled={
                  coachLoading
                }
                onKeyDown={(
                  event,
                ) => {
                  if (
                    event.key !==
                    "Enter"
                  ) {
                    return;
                  }

                  const value =
                    event.currentTarget.value.trim();

                  if (!value) {
                    return;
                  }

                  void askCoach(value);

                  event.currentTarget.value =
                    "";
                }}
              />

              <button
                type="button"
                className="primary"
                disabled={coachLoading}
                onClick={() => {
                  const input =
                    document.getElementById(
                      "coach-question",
                    ) as HTMLInputElement | null;

                  const question =
                    input?.value.trim();

                  if (!question) {
                    return;
                  }

                  void askCoach(
                    question,
                  );

                  if (input) {
                    input.value = "";
                  }
                }}
              >
                {coachLoading
                  ? "Thinking..."
                  : "Ask"}
              </button>
            </div>

            {aiCoach && (
              <div className="coach-response">
                <span className="muted">
                  AI Coach Response
                </span>

                <p className="coach-response-text">
                  {aiCoach}
                </p>
              </div>
            )}
          </section>
        </>
      )}

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
          © 2026 VaultTrades. All
          rights reserved.
        </div>

        <div className="footer-developed">
          Built by Traders.
        </div>
      </footer>
    </main>
  );
}

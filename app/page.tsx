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

type TradeSignal = {
  direction: Direction;
  confidence: string;
  entry: string;
  stopLoss: string;
  tp1: string;
  tp2: string;
  finalTp: string;
  invalidation: string;
  status: string;
};

type AnnotationType =
  | "zone"
  | "structure"
  | "entry"
  | "stopLoss"
  | "tp1"
  | "tp2"
  | "finalTp"
  | "retest"
  | "confirmation";

type ChartAnnotation = {
  type: AnnotationType;
  label: string;
  price?: string;
  x?: number;
  y?: number;
};

type Projection = {
  available: boolean;
  setupType?: string;
  zoneLow?: string;
  zoneHigh?: string;
  expectedEntry?: string;
  expectedStopLoss?: string;
  expectedTp1?: string;
  expectedTp2?: string;
  expectedFinalTp?: string;
  retestStatus?: string;
  confirmationRequired?: string;
  confirmationStatus?: string;
};

type AnalyzerResponse = {
  analysis?: string;

  tradeSignal?: {
    direction?: string;
    confidence?: number | string;
    entry?: number | string | null;
    stopLoss?: number | string | null;
    tp1?: number | string | null;
    tp2?: number | string | null;
    finalTp?: number | string | null;
    invalidation?: string;
    status?: string;
  };

  chartAnnotations?: ChartAnnotation[];

  projection?: Projection;

  marketState?: string;

  setup?: string;

  confirmedConditions?: string[];

  missingConditions?: string[];

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

/* ============================================================
   EXTRACT VALUE
============================================================ */

function extractValue(
  text: string,
  patterns: RegExp[],
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
   EXTRACT LIST
============================================================ */

function extractList(
  text: string,
  headings: string[],
): string[] {
  for (const heading of headings) {
    const regex = new RegExp(
      `${heading}\\s*[:\\-]?\\s*([\\s\\S]*?)(?=\\n[A-Z][A-Z ]{2,}:|$)`,
      "i",
    );

    const match = text.match(regex);

    if (!match?.[1]) {
      continue;
    }

    return match[1]
      .split("\n")
      .map((item) =>
        item
          .replace(/^[-•*]\s*/, "")
          .replace(/^\d+[.)]\s*/, "")
          .trim(),
      )
      .filter(Boolean);
  }

  return [];
}

/* ============================================================
   PARSE TRADE SIGNAL
============================================================ */

function parseTradeSignal(
  text: string,
): TradeSignal {
  const directionRaw = extractValue(text, [
    /DIRECTION\s*[:\-]\s*([^\n]+)/i,
    /TRADE\s*DIRECTION\s*[:\-]\s*([^\n]+)/i,
    /SIGNAL\s*[:\-]\s*([^\n]+)/i,
  ]);

  const confidence = extractValue(text, [
    /CONFIDENCE\s*[:\-]\s*([^\n]+)/i,
    /CONFIDENCE\s*SCORE\s*[:\-]\s*([^\n]+)/i,
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

  let direction: Direction = "NO TRADE";

  if (
    normalizedDirection.includes(
      "BUY DEVELOPING",
    ) ||
    normalizedDirection.includes(
      "LONG DEVELOPING",
    )
  ) {
    direction = "BUY DEVELOPING";
  } else if (
    normalizedDirection.includes(
      "SELL DEVELOPING",
    ) ||
    normalizedDirection.includes(
      "SHORT DEVELOPING",
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

  let status = "WAITING";

  if (
    direction === "BUY" ||
    direction === "SELL"
  ) {
    status = "CONFIRMED";
  } else if (
    direction === "BUY DEVELOPING" ||
    direction === "SELL DEVELOPING"
  ) {
    status = "DEVELOPING";
  } else if (direction === "NO TRADE") {
    status = "NO TRADE";
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
  direction: Direction,
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

  const [annotations, setAnnotations] =
    useState<ChartAnnotation[]>([]);

  const [projection, setProjection] =
    useState<Projection | null>(null);

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

  /* ==========================================================
     RESET ANALYSIS
  ========================================================== */

  function clearAnalysis() {
    setAnalysis("");
    setAnnotations([]);
    setProjection(null);
    setMarketState("");
    setSetup("");
    setConfirmedConditions([]);
    setMissingConditions([]);
    setAiCoach("");
  }

  /* ==========================================================
     CHANGE STRATEGY
  ========================================================== */

  function changeStrategy(
    nextStrategy: Strategy,
  ) {
    setStrategy(nextStrategy);
    clearAnalysis();
    setError("");
  }

  /* ==========================================================
     CHANGE TIMEFRAME
  ========================================================== */

  function changeTimeframe(
    nextTimeframe: Timeframe,
  ) {
    setTimeframe(nextTimeframe);
    clearAnalysis();
    setError("");
  }

  /* ==========================================================
     UPLOAD
  ========================================================== */

  function handleUpload(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    if (
      !file.type.startsWith("image/")
    ) {
      setError(
        "Please upload a chart image.",
      );
      return;
    }

    setSelectedFile(file);
    setFileName(file.name);
    clearAnalysis();
    setError("");

    const reader =
      new FileReader();

    reader.onload = () => {
      setChart(
        reader.result as string,
      );
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
    clearAnalysis();
    setError("");

    const input =
      document.getElementById(
        "chart-upload",
      ) as HTMLInputElement | null;

    if (input) {
      input.value = "";
    }
  }

  /* ==========================================================
     ANALYZE
  ========================================================== */

  async function analyzeChart() {
    if (!selectedFile) {
      setError(
        "Please upload a chart first.",
      );
      return;
    }

    setLoading(true);
    clearAnalysis();
    setError("");

    try {
      const formData =
        new FormData();

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

      const response =
        await fetch(
          "/api/analyze",
          {
            method: "POST",
            body: formData,
          },
        );

      const data =
        (await response.json()) as AnalyzerResponse;

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to analyze the chart.",
        );
      }

      if (!data.analysis) {
        throw new Error(
          "The analyzer returned an empty analysis.",
        );
      }

      setAnalysis(data.analysis);

      /*
       * These fields are optional so this page
       * remains compatible with the current API.
       */
      setAnnotations(
        Array.isArray(
          data.chartAnnotations,
        )
          ? data.chartAnnotations
          : [],
      );

      setProjection(
        data.projection ?? null,
      );

      setMarketState(
        data.marketState ||
          extractValue(
            data.analysis,
            [
              /MARKET\s*STATE\s*[:\-]\s*([^\n]+)/i,
              /CURRENT\s*MARKET\s*STATE\s*[:\-]\s*([^\n]+)/i,
            ],
          ),
      );

      setSetup(
        data.setup ||
          extractValue(
            data.analysis,
            [
              /CURRENT\s*SETUP\s*[:\-]\s*([^\n]+)/i,
              /SETUP\s*[:\-]\s*([^\n]+)/i,
            ],
          ),
      );

      setConfirmedConditions(
        data.confirmedConditions ??
          extractList(
            data.analysis,
            [
              "CONFIRMED CONDITIONS",
              "CONFIRMED",
            ],
          ),
      );

      setMissingConditions(
        data.missingConditions ??
          extractList(
            data.analysis,
            [
              "MISSING CONDITIONS",
              "WHAT TO WATCH",
              "WAITING FOR",
            ],
          ),
      );
    } catch (err) {
      console.error(
        "Chart analysis error:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to analyze the chart.",
      );
    } finally {
      setLoading(false);
    }
  }

  /* ==========================================================
     AI COACH
     EXPLANATION ONLY
  ========================================================== */

  async function askCoach(
    question: string,
  ) {
    if (!question.trim()) {
      return;
    }

    if (!analysis) {
      setAiCoach(
        "Analyze a chart first.",
      );
      return;
    }

    setAiCoach(
      "Analyzing your question...",
    );

    try {
      const signal =
        parseTradeSignal(analysis);

      const response =
        await fetch(
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
                signal.direction,
              confidence:
                signal.confidence,
              analysis,
              marketState,
              setup,
              confirmedConditions,
              missingConditions,
              tradeSignal: signal,
              projection,
              chartAnnotations:
                annotations,
            }),
          },
        );

      const data =
        (await response.json()) as {
          answer?: string;
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to answer the question.",
        );
      }

      setAiCoach(
        data.answer ||
          "The AI Coach could not establish an answer from the current chart analysis.",
      );
    } catch (err) {
      console.error(
        "AI Coach error:",
        err,
      );

      setAiCoach(
        err instanceof Error
          ? err.message
          : "Unable to answer the AI Coach question.",
      );
    }
  }

  /* ==========================================================
     CURRENT SIGNAL
  ========================================================== */

  const tradeSignal =
    analysis
      ? parseTradeSignal(analysis)
      : null;

  /* ==========================================================
     RENDER ANNOTATIONS
  ========================================================== */

  function renderAnnotations() {
    if (!annotations.length) {
      return null;
    }

    return annotations.map(
      (
        annotation,
        index,
      ) => {
        const style: React.CSSProperties = {};

        if (
          typeof annotation.x ===
          "number"
        ) {
          style.left = `${annotation.x}%`;
        }

        if (
          typeof annotation.y ===
          "number"
        ) {
          style.top = `${annotation.y}%`;
        }

        return (
          <div
            key={`${annotation.type}-${index}`}
            className={`chart-annotation chart-annotation-${annotation.type}`}
            style={style}
          >
            <span>
              {annotation.label}
            </span>

            {annotation.price && (
              <strong>
                {annotation.price}
              </strong>
            )}
          </div>
        );
      },
    );
  }

  return (
    <main className="shell">

      {/* ======================================================
          HEADER
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
            STRATEGY
        ==================================================== */}

        <section className="card">

          <h2 className="title">
            Select Strategy
          </h2>

          <p className="muted">
            Choose the independent strategy
            the chart analyzer must apply.
          </p>


          <button
            type="button"
            className={`strategy ${
              strategy === "killZone"
                ? "active"
                : ""
            }`}
            onClick={() =>
              changeStrategy(
                "killZone",
              )
            }
            disabled={loading}
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
            disabled={loading}
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
                "continuation",
              )
            }
            disabled={loading}
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
                "supplyDemand",
              )
            }
            disabled={loading}
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


        {/* ====================================================
            CHART ANALYZER
        ==================================================== */}

        <section className="card">

          <h2 className="title">
            Chart Analyzer
          </h2>

          <p className="muted">
            Select your timeframe, upload
            the chart, then analyze.
          </p>


          {/* TIMEFRAME */}

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
                (tf) => (
                  <button
                    key={tf}
                    type="button"
                    className={`timeframe-button ${
                      timeframe === tf
                        ? "selected"
                        : ""
                    }`}
                    aria-pressed={
                      timeframe === tf
                    }
                    disabled={loading}
                    onClick={() =>
                      changeTimeframe(
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


          {/* UPLOAD / CHART */}

          <div
            className="upload"
            onClick={() =>
              document
                .getElementById(
                  "chart-upload",
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


                  {/* ==========================================
                      VISUAL ANALYSIS MARKINGS
                  ========================================== */}

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


          {/* ACTIONS */}

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


          {/* ERROR */}

          {error && (
            <div
              className="error-box"
              style={{
                marginTop: "16px",
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


      {/* ======================================================
          TRADE SIGNAL
      ====================================================== */}

      {tradeSignal && (
        <section
          className="card"
          style={{
            marginTop: "20px",
          }}
        >

          <div
            className="execution-header"
          >

            <div>

              <span className="muted">
                Trade Signal
              </span>

              <h2
                className={`execution-direction ${getSignalClass(
                  tradeSignal.direction,
                )}`}
              >
                {tradeSignal.direction}
              </h2>

            </div>


            <div className="confidence">

              <span className="muted">
                Confidence
              </span>

              <strong>
                {tradeSignal.confidence}
              </strong>

            </div>

          </div>


          {/* EXECUTION LEVELS */}

          <div
            className="execution-grid"
          >

            <div className="execution-item">

              <span className="muted">
                Entry
              </span>

              <strong>
                {tradeSignal.entry}
              </strong>

            </div>


            <div className="execution-item">

              <span className="muted">
                Stop Loss
              </span>

              <strong>
                {tradeSignal.stopLoss}
              </strong>

            </div>


            <div className="execution-item">

              <span className="muted">
                TP1
              </span>

              <strong>
                {tradeSignal.tp1}
              </strong>

            </div>


            <div className="execution-item">

              <span className="muted">
                TP2
              </span>

              <strong>
                {tradeSignal.tp2}
              </strong>

            </div>


            <div className="execution-item">

              <span className="muted">
                Final TP
              </span>

              <strong>
                {tradeSignal.finalTp}
              </strong>

            </div>

          </div>


          {tradeSignal.invalidation !==
            "—" && (
            <div
              style={{
                marginTop: "14px",
              }}
            >
              <span className="muted">
                Invalidation
              </span>

              <p
                style={{
                  marginBottom: 0,
                  lineHeight: 1.6,
                }}
              >
                {tradeSignal.invalidation}
              </p>
            </div>
          )}

        </section>
      )}


      {/* ======================================================
          WARM MARKET MAP
      ====================================================== */}

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
                {marketState ||
                  "Monitoring current market structure."}
              </strong>
            </div>


            <div>
              <span className="muted">
                Current Setup
              </span>

              <strong>
                {setup ||
                  "The selected strategy is mapping the current chart conditions."}
              </strong>
            </div>


            {projection?.available &&
              (projection.zoneLow ||
                projection.zoneHigh) && (
                <div>
                  <span className="muted">
                    Active / Expected Zone
                  </span>

                  <strong>
                    {projection.zoneLow ||
                      "—"}
                    {" — "}
                    {projection.zoneHigh ||
                      "—"}
                  </strong>
                </div>
              )}


            {confirmedConditions.length >
              0 && (
              <div>
                <span className="muted">
                  Confirmed
                </span>

                <strong>
                  {confirmedConditions.join(
                    " • ",
                  )}
                </strong>
              </div>
            )}


            {missingConditions.length >
              0 && (
              <div>
                <span className="muted">
                  What To Watch
                </span>

                <strong>
                  {missingConditions.join(
                    " • ",
                  )}
                </strong>
              </div>
            )}

          </div>

        </section>
      )}


      {/* ======================================================
          TRADE ROADMAP
      ====================================================== */}

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
                What the Strategy Sees
              </strong>

              <p
                style={{
                  lineHeight: 1.7,
                  marginBottom: 0,
                }}
              >
                {setup ||
                  marketState ||
                  "The selected strategy is monitoring the chart for its required conditions."}
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
                  What Is Being Watched
                </strong>

                <ul>
                  {missingConditions.map(
                    (
                      condition,
                      index,
                    ) => (
                      <li
                        key={`missing-${index}`}
                      >
                        {condition}
                      </li>
                    ),
                  )}
                </ul>

              </div>
            )}


            {tradeSignal.direction ===
              "NO TRADE" && (
              <div className="condition-box">

                <strong>
                  Why There Is No Trade
                </strong>

                <p
                  style={{
                    lineHeight: 1.7,
                    marginBottom: 0,
                  }}
                >
                  {tradeSignal.invalidation !==
                  "—"
                    ? tradeSignal.invalidation
                    : missingConditions.length >
                        0
                      ? missingConditions.join(
                          " ",
                        )
                      : "The selected strategy has not produced a valid execution condition."}
                </p>

              </div>
            )}

          </div>

        </section>
      )}


      {/* ======================================================
          AI COACH
          EXPLANATION ONLY
      ====================================================== */}

      {tradeSignal && (
        <section
          className="card"
          style={{
            marginTop: "20px",
          }}
        >

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
            Ask why the strategy is waiting,
            what is developing, what has been
            confirmed, or what would invalidate
            the setup.
          </p>


          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              marginTop: "14px",
            }}
          >

            <button
              type="button"
              className="secondary"
              onClick={() =>
                askCoach(
                  "Explain the current setup and what the strategy is seeing.",
                )
              }
            >
              Explain This Setup
            </button>


            <button
              type="button"
              className="secondary"
              onClick={() =>
                askCoach(
                  "What condition is the strategy currently waiting for?",
                )
              }
            >
              What Am I Waiting For?
            </button>


            <button
              type="button"
              className="secondary"
              onClick={() =>
                askCoach(
                  "What would invalidate this setup?",
                )
              }
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
              id="coach-input"
              type="text"
              placeholder="Ask the AI Coach a question..."
              className="coach-input"
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

                askCoach(value);
                event.currentTarget.value =
                  "";
              }}
            />


            <button
              type="button"
              className="primary"
              onClick={() => {
                const input =
                  document.getElementById(
                    "coach-input",
                  ) as HTMLInputElement | null;

                if (!input) {
                  return;
                }

                const question =
                  input.value.trim();

                if (!question) {
                  return;
                }

                askCoach(question);
                input.value = "";
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


      {/* ======================================================
          FOOTER
      ====================================================== */}

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
          VaultTrades provides market
          analysis and educational
          information only. Trading
          involves substantial risk.
          Signals and analysis are not
          financial advice and should
          not be considered a guarantee
          of future results.
        </p>

        <p className="copyright">
          © {new Date().getFullYear()}{" "}
          VaultTrades. All rights reserved.
        </p>

      </footer>

    </main>
  );
}

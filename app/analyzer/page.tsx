"use client";

import { useMemo, useState } from "react";
import { ANALYZER_CATEGORIES, ANALYZER_STRATEGIES, ANALYZER_STRATEGY_MAP, type IndicatorName } from "../../lib/strategies/analyzerProfiles";
import { StrategyPipeline } from "./StrategyPipeline";

type Timeframe = "1m" | "5m" | "15m" | "30m" | "1H" | "4H" | "1D" | "1W" | "1M";
type Decision = "TRADE" | "NO TRADE";
type CurrentState = "WAITING" | "DEVELOPING" | "READY" | "ACTIVE" | "COMPLETED" | "INVALIDATED";
type Result = {
  market?: { asset?: string; timeframe?: string; marketCondition?: string; directionalBias?: string; session?: string };
  strategy?: { id?: string; name?: string; category?: string };
  aiIndicators?: { name: string; selected: boolean; reason?: string; reading?: string }[];
  bollinger?: { status: string; period: number | null; standardDeviation: number | null; series: string; maType: string; reason: string; optimized: boolean };
  strategyAnalysis?: { marketStructure?: string; priceAction?: string; liquidity?: string; momentum?: string; volatility?: string; indicatorConfirmation?: string };
  smcScores?: { BOS?: number; CHoCH?: number; OrderBlock?: number; FVG?: number; LiquiditySweep?: number; Displacement?: number };
  smcEvidence?: { BOS?: string; CHoCH?: string; OrderBlock?: string; FVG?: string; LiquiditySweep?: string; Displacement?: string };
  decision?: Decision;
  tradeSignal?: { direction: "BUY" | "SELL" | "NO TRADE"; confidence: number; entry: number | null; stopLoss: number | null; risk: number | null; tp1: number | null; tp2: number | null; finalTp: number | null; invalidation: string };
  decisionReason?: string;
  marketState?: string;
  setup?: string;
  confirmedConditions?: string[];
  missingConditions?: string[];
  projection?: { available?: boolean; setupType?: string; zoneLow?: number | null; zoneHigh?: number | null; expectedEntry?: number | null; expectedStopLoss?: number | null; expectedTp1?: number | null; expectedTp2?: number | null; expectedFinalTp?: number | null; retestRequired?: boolean; retestStatus?: string; confirmationRequired?: string; confirmationStatus?: string } | null;
  previousSetup?: { found?: boolean; timestamp?: string; direction?: string; entry?: number | null; stopLoss?: number | null; tp1?: number | null; tp2?: number | null; finalTp?: number | null; outcome?: string; evidence?: string[] } | null;
  currentState?: CurrentState;
  currentTrade?: { visible?: boolean; direction?: string; entry?: number | null; stopLoss?: number | null; tp1?: number | null; tp2?: number | null; finalTp?: number | null; progress?: string; status?: string; evidence?: string[] } | null;
  nextAction?: string;
};

const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "30m", "1H", "4H", "1D", "1W", "1M"];
const INDICATORS: IndicatorName[] = ["SMA", "EMA", "Ichimoku", "Bollinger Bands", "ATR", "VWAP", "Supertrend", "SAR", "RSI", "MACD", "KST", "Stochastic", "ADX", "Percent B", "MFI", "DPO", "RVOL", "A/D", "SMI"];
const price = (v: number | null | undefined) => v == null || !Number.isFinite(v) ? "Information unavailable" : v.toLocaleString(undefined, { maximumFractionDigits: 5 });

function confluence(result: Result) {
  const scores = Object.values(result.smcScores || {}).filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  const strong = scores.filter(x => x >= 7).length;
  if (strong >= 3) return "VERY HIGH";
  if (strong >= 2) return "HIGH";
  if (strong === 1) return "MEDIUM";
  return result.confirmedConditions && result.confirmedConditions.length >= 3 ? "MEDIUM" : "LOW";
}

export default function AnalyzerPage() {
  const [strategy, setStrategy] = useState(ANALYZER_STRATEGIES[0].id);
  const [timeframes, setTimeframes] = useState<Timeframe[]>(["5m"]);
  const [indicatorMode, setIndicatorMode] = useState<"AUTO" | "MANUAL">("AUTO");
  const [manualIndicators, setManualIndicators] = useState<IndicatorName[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selected = ANALYZER_STRATEGY_MAP[strategy];
  const manualWarning = useMemo(() => manualIndicators.length > 0 && manualIndicators.some(i => !selected.defaultIndicators.includes(i)), [manualIndicators, selected]);

  const toggleTimeframe = (tf: Timeframe) => setTimeframes(current => current.includes(tf) ? current.filter(x => x !== tf) : current.length < 2 ? [...current, tf] : current);
  const toggleIndicator = (indicator: IndicatorName) => setManualIndicators(current => current.includes(indicator) ? current.filter(x => x !== indicator) : current.length < 3 ? [...current, indicator] : current);

  const analyze = async () => {
    if (!file) { setError("Please upload a TradingView chart first."); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const form = new FormData();
      form.append("image", file); form.append("strategy", strategy); form.append("timeframes", JSON.stringify(timeframes));
      form.append("indicatorMode", indicatorMode); form.append("manualIndicators", JSON.stringify(manualIndicators));
      const res = await fetch("/api/analyze-v2", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to analyze the chart.");
      setResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to analyze the chart."); }
    finally { setLoading(false); }
  };

  return <main className="shell">
    <header className="header"><div className="brand-block"><img src="/vaulttrades-logo.png" alt="VaultTrades" className="logo"/><div className="tagline">Built by Traders.</div><div className="slogan">Focus, discipline, consistency.</div></div><div className="badge">ANALYZER</div></header>

    <section className="card">
      <div className="section-label">CHOOSE STRATEGY</div>
      <h1 className="title">AI-Driven Chart Analyzer</h1>
      <p className="muted">Select the analytical framework. VaultTrades determines the relevant evidence and indicators automatically; the selected strategy remains the primary decision engine.</p>
      <select value={strategy} disabled={loading} onChange={e => { setStrategy(e.target.value); setResult(null); }} style={{ width: "100%", marginTop: 16, padding: 14, borderRadius: 10, background: "#050812", color: "#f4f6fb", border: "1px solid rgba(212,166,55,.35)" }}>
        {ANALYZER_CATEGORIES.map(category => <optgroup key={category} label={category}>{ANALYZER_STRATEGIES.filter(s => s.category === category).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>)}
      </select>
      <div className="condition-box" style={{ marginTop: 14 }}><strong>Analysis framework</strong><p className="muted">{selected.focus.join(" · ")}</p></div>
    </section>

    <section className="card">
      <div className="section-label">MULTIPLE TIMEFRAMES (MAX 2)</div>
      <p className="muted">When two are selected, the higher timeframe supplies market context and the lower timeframe supplies setup/entry context.</p>
      <div className="timeframe-grid" style={{ marginTop: 14 }}>{TIMEFRAMES.map(tf => <button key={tf} type="button" className={`timeframe-button ${timeframes.includes(tf) ? "selected" : ""}`} onClick={() => toggleTimeframe(tf)} disabled={loading}>{tf}</button>)}</div>
      <div className="muted" style={{ marginTop: 10 }}>Selected: {timeframes.length ? timeframes.join(" + ") : "Application default"}</div>
    </section>

    <section className="card">
      <div className="section-label">INDICATORS</div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}><button className={indicatorMode === "AUTO" ? "primary" : "secondary"} type="button" onClick={() => setIndicatorMode("AUTO")} disabled={loading}>AUTO</button><button className={indicatorMode === "MANUAL" ? "primary" : "secondary"} type="button" onClick={() => setIndicatorMode("MANUAL")} disabled={loading}>MANUAL</button></div>
      {indicatorMode === "AUTO" ? <div className="condition-box" style={{ marginTop: 14 }}><strong>AI SELECTED — STRATEGY DEPENDENT</strong><p>{selected.defaultIndicators.map(i => `${i} — supporting evidence`).join(" · ")}</p><p className="muted">The Analyzer is not required to use exactly three indicators. The selected strategy determines which evidence is useful.</p></div> : <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8, marginTop: 14 }}>{INDICATORS.map(i => <button key={i} type="button" className={`secondary ${manualIndicators.includes(i) ? "selected" : ""}`} onClick={() => toggleIndicator(i)} disabled={loading || (!manualIndicators.includes(i) && manualIndicators.length >= 3)}>{i}</button>)}</div>
        <div className="muted" style={{ marginTop: 10 }}>Selected: {manualIndicators.length ? manualIndicators.join(" · ") : "None"}</div>
        {manualWarning && <div className="condition-box" style={{ marginTop: 12 }}><strong>Indicator alignment notice</strong><p>These indicators may provide weaker confirmation for the selected strategy.</p></div>}
      </>}
    </section>

    <section className="card">
      <div className="section-label">SCREENSHOT ANALYSIS</div>
      <label className="upload" style={{ marginTop: 14 }}><input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={loading} onChange={e => { const f = e.target.files?.[0]; if (!f) return; setFile(f); setPreview(URL.createObjectURL(f)); setResult(null); setError(""); }} />{preview ? <><strong>{file?.name}</strong><img src={preview} alt="Trading chart preview" className="preview"/></> : <><strong>Upload TradingView Chart</strong><div className="muted">PNG, JPG or WebP</div></>}</label>
      <div className="actions"><button className="primary" type="button" disabled={!file || loading} onClick={() => void analyze()}>{loading ? "Analyzing Chart..." : "Analyze Chart"}</button><button className="secondary" type="button" disabled={loading} onClick={() => { setFile(null); setPreview(""); setResult(null); setError(""); }}>Clear</button></div>
      {error && <div className="error-box"><strong>Analysis Error</strong><p className="muted">{error}</p></div>}
    </section>

    {result && <>
      <section className="card execution-card" style={{ border: "1px solid rgba(212,166,55,.28)", background: "linear-gradient(145deg, rgba(10,16,30,.98), rgba(5,8,18,.98))" }}>
        <div className="section-label">VERDICT</div>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 16, alignItems: "center", marginTop: 8 }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: ".14em", color: "#9aa4b2", fontWeight: 700 }}>CURRENT DECISION</div>
            <h2 className="title" style={{ marginBottom: 4 }}>{result.currentTrade?.visible ? `${result.currentTrade.direction || "TRADE"} TRADE ACTIVE` : result.decision === "TRADE" ? `${result.tradeSignal?.direction || "TRADE"} TRADE READY` : `WATCH — ${result.currentState === "DEVELOPING" ? "SETUP DEVELOPING" : "NO NEW ENTRY"}`}</h2>
            <div className="muted">{result.market?.asset || "Asset unavailable"} · {result.market?.timeframe || timeframes.join(" + ")} · {result.market?.directionalBias || "Bias unavailable"}</div>
          </div>
          <div style={{ minWidth: 150, padding: "12px 16px", borderRadius: 12, textAlign: "center", fontWeight: 800, letterSpacing: ".08em", background: result.tradeSignal?.direction === "BUY" ? "rgba(34,197,94,.16)" : result.tradeSignal?.direction === "SELL" ? "rgba(239,68,68,.16)" : "rgba(148,163,184,.12)", border: result.tradeSignal?.direction === "BUY" ? "1px solid rgba(34,197,94,.45)" : result.tradeSignal?.direction === "SELL" ? "1px solid rgba(239,68,68,.45)" : "1px solid rgba(148,163,184,.25)", color: result.tradeSignal?.direction === "BUY" ? "#4ade80" : result.tradeSignal?.direction === "SELL" ? "#f87171" : "#cbd5e1" }}>{result.currentTrade?.visible ? "ACTIVE" : result.decision === "TRADE" ? "NEW TRADE" : "NO NEW ENTRY"}</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginTop: 18 }}>
          <div className="execution-item"><span>QUALITY / CONFIDENCE</span><strong style={{ fontSize: 26 }}>{Math.round(result.tradeSignal?.confidence ?? 0)}<small style={{ fontSize: 14 }}>/100</small></strong></div>
          <div className="execution-item"><span>CONFLUENCE</span><strong>{confluence(result)}</strong><small className="muted">{result.confirmedConditions?.length ? `${result.confirmedConditions.length} conditions confirmed` : "Evidence still developing"}</small></div>
          <div className="execution-item"><span>STATE</span><strong>{result.currentState || "WAITING"}</strong><small className="muted">{result.market?.session || "Session unavailable"}</small></div>
        </div>

        <div style={{ marginTop: 18 }}><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 10 }}>
          {[
            ["ENTRY", result.currentTrade?.visible ? result.currentTrade.entry : result.decision === "TRADE" ? result.tradeSignal?.entry : result.projection?.expectedEntry],
            ["STOP LOSS", result.currentTrade?.visible ? result.currentTrade.stopLoss : result.decision === "TRADE" ? result.tradeSignal?.stopLoss : result.projection?.expectedStopLoss],
            ["TP1", result.currentTrade?.visible ? result.currentTrade.tp1 : result.decision === "TRADE" ? result.tradeSignal?.tp1 : result.projection?.expectedTp1],
            ["TP2", result.currentTrade?.visible ? result.currentTrade.tp2 : result.decision === "TRADE" ? result.tradeSignal?.tp2 : result.projection?.expectedTp2],
            ["FINAL TP", result.currentTrade?.visible ? result.currentTrade.finalTp : result.decision === "TRADE" ? result.tradeSignal?.finalTp : result.projection?.expectedFinalTp]
          ].map(([label, value]) => <div key={String(label)} className="execution-item"><span>{label}</span><strong style={{ fontSize: 18 }}>{price(value as number | null | undefined)}</strong></div>)}
        </div></div>

        <StrategyPipeline result={result} />
      </section>

      <section className="card">
        <div className="section-label">ANALYSIS</div>
        <div className="execution-grid">
          <div className="execution-item"><span>MARKET CONDITION</span><strong>{result.market?.marketCondition || "Information unavailable"}</strong></div>
          <div className="execution-item"><span>DIRECTIONAL BIAS</span><strong>{result.market?.directionalBias || "Information unavailable"}</strong></div>
          <div className="execution-item"><span>STATE</span><strong>{result.currentState || "WAITING"}</strong></div>
          <div className="execution-item"><span>ASSET</span><strong>{result.market?.asset || "Information unavailable"}</strong></div>
          <div className="execution-item"><span>TIMEFRAME</span><strong>{result.market?.timeframe || timeframes.join(" + ") || "Information unavailable"}</strong></div>
        </div>
        {(["marketStructure","priceAction","liquidity","momentum","volatility","indicatorConfirmation"] as const).map(key => <div key={key} className="condition-box" style={{ marginTop: 10 }}><strong>{key.replace(/([A-Z])/g, " $1").toUpperCase()}</strong><p>{result.strategyAnalysis?.[key] || "Information unavailable from the uploaded chart."}</p></div>)}
      </section>

      {result.currentTrade?.visible && <section className="card execution-card"><div className="section-label">TRADE STATE</div><h2 className="title">{result.currentTrade.direction || "ACTIVE"} · {result.currentTrade.status || "ACTIVE"}</h2><div className="condition-box"><strong>Trade progress</strong><p>{result.currentTrade.progress || "Active trade detected from the strategy information."}</p>{result.currentTrade.evidence?.length ? <ul>{result.currentTrade.evidence.map(x => <li key={x}>{x}</li>)}</ul> : null}</div></section>}

      <section className="card"><div className="section-label">WHAT TO EXPECT</div><h2 className="title">{result.setup || "Next valid strategy opportunity"}</h2><div className="condition-box">{result.projection?.available ? <><p><strong>Projected entry zone:</strong> {price(result.projection.zoneLow)} – {price(result.projection.zoneHigh)}</p><p><strong>Expected entry:</strong> {price(result.projection.expectedEntry)}</p><p><strong>Expected stop loss:</strong> {price(result.projection.expectedStopLoss)}</p><p><strong>Expected TP1:</strong> {price(result.projection.expectedTp1)} · <strong>TP2:</strong> {price(result.projection.expectedTp2)} · <strong>Final TP:</strong> {price(result.projection.expectedFinalTp)}</p><p><strong>Pullback / retest:</strong> {result.projection.retestStatus || (result.projection.retestRequired ? "Required" : "Not required")}</p><p><strong>Confirmation:</strong> {result.projection.confirmationStatus || result.projection.confirmationRequired || "Awaiting strategy confirmation"}</p></> : <p>{result.nextAction || "No new entry is confirmed at the current price."}</p>}</div></section>

      <section className="card"><div className="section-label">PREVIOUS SETUP</div><h2 className="title">Latest Visible Setup</h2>{result.previousSetup?.found ? <div className="condition-box"><strong>{result.previousSetup.direction} · {result.previousSetup.timestamp}</strong><p>Entry: {price(result.previousSetup.entry)} · SL: {price(result.previousSetup.stopLoss)}</p><p>TP1: {price(result.previousSetup.tp1)} · TP2: {price(result.previousSetup.tp2)} · Final: {price(result.previousSetup.finalTp)}</p><p><strong>Outcome:</strong> {result.previousSetup.outcome}</p>{result.previousSetup.evidence?.length ? <ul>{result.previousSetup.evidence.map(x => <li key={x}>{x}</li>)}</ul> : null}</div> : <div className="condition-box"><strong>No prior setup confirmed</strong><p className="muted">The visible market history is not sufficient to reconstruct a prior qualifying setup from the selected strategy rules.</p></div>}</section>

      <section className="card"><div className="section-label">EDUCATIONAL BREAKDOWN</div><div className="condition-box"><strong>Confirmed Conditions</strong>{result.confirmedConditions?.length ? <ul>{result.confirmedConditions.map(x => <li key={x}>✓ {x}</li>)}</ul> : <p className="muted">No required conditions are confirmed yet.</p>}</div><div className="condition-box" style={{ marginTop: 12 }}><strong>Conditions Still Required</strong>{result.missingConditions?.length ? <ul>{result.missingConditions.map(x => <li key={x}>• {x}</li>)}</ul> : <p className="muted">No additional conditions reported.</p>}</div><div className="condition-box" style={{ marginTop: 12 }}><strong>Invalidation</strong><p>{result.tradeSignal?.invalidation || "Information unavailable from the uploaded chart."}</p></div></section>
    </>}
  </main>;
}

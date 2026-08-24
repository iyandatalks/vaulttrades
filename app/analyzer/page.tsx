"use client";

import { useMemo, useState } from "react";
import { ANALYZER_CATEGORIES, ANALYZER_STRATEGIES, ANALYZER_STRATEGY_MAP, type IndicatorName } from "../../lib/strategies/analyzerProfiles";

type Timeframe = "1m" | "5m" | "15m" | "30m" | "1H" | "4H" | "1D" | "1W" | "1M";
type Decision = "TRADE" | "NO TRADE";
type Result = {
  market?: { asset?: string; timeframe?: string; marketCondition?: string; directionalBias?: string };
  strategy?: { id?: string; name?: string; category?: string };
  aiIndicators?: { name: string; selected: boolean; reason?: string }[];
  bollinger?: { status: string; period: number | null; standardDeviation: number | null; series: string; maType: string; reason: string; optimized: boolean };
  strategyAnalysis?: { marketStructure?: string; priceAction?: string; liquidity?: string; momentum?: string; volatility?: string; indicatorConfirmation?: string };
  decision?: Decision;
  tradeSignal?: { direction: "BUY" | "SELL" | "NO TRADE"; confidence: number; entry: number | null; stopLoss: number | null; risk: number | null; tp1: number | null; tp2: number | null; finalTp: number | null; invalidation: string };
  decisionReason?: string;
  marketState?: string;
  setup?: string;
  confirmedConditions?: string[];
  missingConditions?: string[];
  projection?: { available?: boolean; setupType?: string; zoneLow?: number | null; zoneHigh?: number | null; expectedEntry?: number | null; expectedStopLoss?: number | null; expectedTp1?: number | null; expectedTp2?: number | null; expectedFinalTp?: number | null; retestRequired?: boolean; retestStatus?: string; confirmationRequired?: string; confirmationStatus?: string } | null;
  previousSetup?: { found?: boolean; timestamp?: string; direction?: string; entry?: number | null; stopLoss?: number | null; tp1?: number | null; tp2?: number | null; finalTp?: number | null; outcome?: string; evidence?: string[] } | null;
  error?: string;
};

const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "30m", "1H", "4H", "1D", "1W", "1M"];
const INDICATORS: IndicatorName[] = ["SMA", "EMA", "Ichimoku", "Bollinger Bands", "ATR", "VWAP", "Supertrend", "SAR", "RSI", "MACD", "KST", "Stochastic", "ADX", "Percent B", "MFI", "DPO", "RVOL", "A/D"];
const price = (v: number | null | undefined) => v == null || !Number.isFinite(v) ? "Information unavailable" : v.toLocaleString(undefined, { maximumFractionDigits: 5 });

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

  const toggleTimeframe = (tf: Timeframe) => {
    setTimeframes(current => current.includes(tf) ? current.filter(x => x !== tf) : current.length < 2 ? [...current, tf] : current);
  };

  const toggleIndicator = (indicator: IndicatorName) => {
    setManualIndicators(current => current.includes(indicator) ? current.filter(x => x !== indicator) : current.length < 3 ? [...current, indicator] : current);
  };

  const analyze = async () => {
    if (!file) { setError("Please upload a TradingView chart first."); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const form = new FormData();
      form.append("image", file);
      form.append("strategy", strategy);
      form.append("timeframes", JSON.stringify(timeframes));
      form.append("indicatorMode", indicatorMode);
      form.append("manualIndicators", JSON.stringify(manualIndicators));
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
      <p className="muted">Select the analytical framework. VaultTrades determines the relevant indicators and settings automatically so the user does not have to build the analysis manually.</p>
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
      <div className="section-label">INDICATORS (MAX 3)</div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}><button className={indicatorMode === "AUTO" ? "primary" : "secondary"} type="button" onClick={() => setIndicatorMode("AUTO")} disabled={loading}>AUTO</button><button className={indicatorMode === "MANUAL" ? "primary" : "secondary"} type="button" onClick={() => setIndicatorMode("MANUAL")} disabled={loading}>MANUAL</button></div>
      {indicatorMode === "AUTO" ? <div className="condition-box" style={{ marginTop: 14 }}><strong>AI SELECTED</strong><p>{selected.defaultIndicators.map(i => `${i} — AI Selected`).join(" · ")}</p></div> : <>
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
      <section className="card"><div className="section-label">MARKET</div><div className="execution-grid"><div className="execution-item"><span>ASSET</span><strong>{result.market?.asset || "Information unavailable"}</strong></div><div className="execution-item"><span>TIMEFRAME</span><strong>{result.market?.timeframe || timeframes.join(" + ") || "Information unavailable"}</strong></div><div className="execution-item"><span>MARKET CONDITION</span><strong>{result.market?.marketCondition || "Information unavailable"}</strong></div><div className="execution-item"><span>DIRECTIONAL BIAS</span><strong>{result.market?.directionalBias || "Information unavailable"}</strong></div></div></section>

      <section className="card"><div className="section-label">STRATEGY</div><h2 className="title">{selected.name}</h2><div className="muted">Category: {selected.category}</div></section>

      <section className="card"><div className="section-label">AI INDICATORS</div><div className="condition-box">{result.aiIndicators?.map(i => <p key={i.name} style={{ margin: "6px 0" }}><strong>{i.name}</strong> — <span>AI Selected</span>{i.reason ? <span className="muted"> · {i.reason}</span> : null}</p>)}</div></section>

      <section className="card"><div className="section-label">BOLLINGER BANDS</div><div className="condition-box"><strong>{result.bollinger?.status || "NOT REQUIRED"}</strong>{result.bollinger?.status !== "NOT REQUIRED" && <><p>Period: {result.bollinger?.period ?? "Information unavailable"}</p><p>Standard Deviation: {result.bollinger?.standardDeviation ?? "Information unavailable"}</p><p>Series: {result.bollinger?.series || "Information unavailable"}</p><p>MA Type: {result.bollinger?.maType || "Information unavailable"}</p><p>{result.bollinger?.reason}</p>{result.bollinger?.optimized && <strong>AI OPTIMIZED</strong>}</>}</div></section>

      <section className="card"><div className="section-label">STRATEGY ANALYSIS</div>{(["marketStructure","priceAction","liquidity","momentum","volatility","indicatorConfirmation"] as const).map(key => <div key={key} className="condition-box" style={{ marginTop: 10 }}><strong>{key.replace(/([A-Z])/g, " $1").toUpperCase()}</strong><p>{result.strategyAnalysis?.[key] || "Information unavailable from the uploaded chart."}</p></div>)}</section>

      <section className="card execution-card"><div className="section-label">AI VERDICT</div><div className="execution-header"><div><div className="execution-label">DECISION</div><div className="execution-direction">{result.decision || "NO TRADE"}</div></div><div className="confidence-box"><span>CONFIDENCE</span><strong>{result.tradeSignal?.confidence ?? 0}%</strong></div></div><div className="execution-grid"><div className="execution-item"><span>DIRECTION</span><strong>{result.tradeSignal?.direction || "NO TRADE"}</strong></div><div className="execution-item"><span>ENTRY ZONE</span><strong>{price(result.tradeSignal?.entry)}</strong></div><div className="execution-item"><span>INVALIDATION / STOP</span><strong>{price(result.tradeSignal?.stopLoss)}</strong></div><div className="execution-item"><span>TP1</span><strong>{price(result.tradeSignal?.tp1)}</strong></div><div className="execution-item"><span>TP2</span><strong>{price(result.tradeSignal?.tp2)}</strong></div><div className="execution-item"><span>FINAL TP</span><strong>{price(result.tradeSignal?.finalTp)}</strong></div></div><div className="condition-box" style={{ marginTop: 16 }}><strong>Why?</strong><p style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{result.decisionReason || "Information unavailable from the uploaded chart."}</p></div></section>

      <section className="card"><div className="section-label">ANTICIPATED SETUP</div><h2 className="title">What We Are Waiting For</h2><div className="condition-box"><strong>{result.setup || "No coherent anticipated setup established."}</strong>{result.projection?.available && <><p>Entry zone: {price(result.projection.zoneLow)} – {price(result.projection.zoneHigh)}</p><p>Expected entry: {price(result.projection.expectedEntry)} · SL: {price(result.projection.expectedStopLoss)}</p><p>TP1: {price(result.projection.expectedTp1)} · TP2: {price(result.projection.expectedTp2)} · Final: {price(result.projection.expectedFinalTp)}</p><p className="muted">Retest: {result.projection.retestStatus} · Confirmation: {result.projection.confirmationStatus}</p></>}</div></section>

      <section className="card"><div className="section-label">MARKET STATE</div><h2 className="title">What the Chart Is Telling You</h2><div className="condition-box"><p>{result.marketState || "Information unavailable from the uploaded chart."}</p></div></section>

      <section className="card"><div className="section-label">PREVIOUS SETUP</div><h2 className="title">Latest Visible Setup</h2>{result.previousSetup?.found ? <div className="condition-box"><strong>{result.previousSetup.direction} · {result.previousSetup.timestamp}</strong><p>Entry: {price(result.previousSetup.entry)} · SL: {price(result.previousSetup.stopLoss)}</p><p>TP1: {price(result.previousSetup.tp1)} · TP2: {price(result.previousSetup.tp2)} · Final: {price(result.previousSetup.finalTp)}</p><p><strong>Outcome:</strong> {result.previousSetup.outcome}</p>{result.previousSetup.evidence?.length ? <ul>{result.previousSetup.evidence.map(x => <li key={x}>{x}</li>)}</ul> : null}</div> : <div className="condition-box"><strong>No prior setup confirmed</strong><p className="muted">The uploaded chart does not show enough reliable history to identify a prior qualifying setup. VaultTrades will not manufacture one.</p></div>}</section>

      <section className="card"><div className="section-label">EDUCATIONAL BREAKDOWN</div><div className="condition-box"><strong>Confirmed Conditions</strong>{result.confirmedConditions?.length ? <ul>{result.confirmedConditions.map(x => <li key={x}>✓ {x}</li>)}</ul> : <p className="muted">No required conditions are confirmed yet.</p>}</div><div className="condition-box" style={{ marginTop: 12 }}><strong>Missing Conditions / What To Wait For</strong>{result.missingConditions?.length ? <ul>{result.missingConditions.map(x => <li key={x}>• {x}</li>)}</ul> : <p className="muted">No missing conditions reported.</p>}</div><div className="condition-box" style={{ marginTop: 12 }}><strong>Invalidation</strong><p>{result.tradeSignal?.invalidation || "Information unavailable from the uploaded chart."}</p></div></section>
    </>}
  </main>;
}

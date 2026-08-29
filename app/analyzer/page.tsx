"use client";

import { useState } from "react";
import { ANALYZER_CATEGORIES, ANALYZER_STRATEGIES, ANALYZER_STRATEGY_MAP } from "../../lib/strategies/analyzerProfiles";
import { LiveMarketChart } from "./LiveMarketChart";

type Timeframe = "1m" | "5m" | "15m" | "30m" | "1H" | "4H" | "1D" | "1W" | "1M";
type MarketType = "FOREX" | "INDICES" | "CRYPTO" | "STOCKS" | "SYNTHETIC";
type Candle = { datetime: string; open: number; high: number; low: number; close: number; volume: number | null };
type Scanner = {
  projectedDirection?: "BUY" | "SELL" | "NO TRADE";
  analysisState?: string;
  statusMessage?: string;
  cycleStatus?: string;
  trend?: string;
  trendReason?: string;
  institutionalActivity?: string;
  institutionalEvidence?: string[];
  confirmations?: string[];
  projectedProbability?: number;
  entry?: number | null;
  projectedEntry?: number | null;
  actualEntry?: number | null;
  stopLoss?: number | null;
  projectedStopLoss?: number | null;
  tp1?: number | null;
  projectedTp1?: number | null;
  tp2?: number | null;
  projectedTp2?: number | null;
  finalTp?: number | null;
  projectedFinalTp?: number | null;
  tp1Hit?: boolean;
  stopHit?: boolean;
  confirmationPrice?: number | null;
  reversalPrice?: number | null;
  opposingLiquidityTarget?: number | null;
  waitReason?: string;
  tradeReason?: string;
  invalidation?: string;
  pipeline?: string[];
  nextZone?: string;
  rr?: number | null;
  strategyConditionsMet?: boolean;
  entryConfirmation?: boolean;
  entryConfirmationReason?: string;
  confirmationTimeframe?: string;
  universalValidationPassed?: boolean;
  volumeProfile?: { currentVolume: number | null; averageVolume: number | null; ratio: number | null; expansion: boolean; candleDirection: string; displacementATR: number | null };
};
type Result = {
  market?: { type?: MarketType; asset?: string; timeframe?: string; currentPrice?: number | null; directionalBias?: string; session?: string };
  strategy?: { id?: string; name?: string; category?: string };
  sourceIndicators?: { name: string; purpose: string; parameters: string; required: boolean }[];
  indicatorReadings?: { name: string; value: number | null; signal: string; reason: string; values?: Record<string, number | null> }[];
  chart?: { candles: Candle[]; channel20?: { upper: number | null; lower: number | null; middle: number | null } };
  structure?: { trend?: string; support?: number | null; resistance?: number | null; latestHigh?: number | null; latestLow?: number | null };
  volatility?: { atr?: number | null; atrPct?: number | null; breakout?: string };
  decision?: "TRADE" | "NO TRADE";
  direction?: "BUY" | "SELL" | "NO TRADE";
  confidence?: number;
  setup?: string;
  marketCondition?: string;
  marketStructure?: string;
  recentPriceAction?: string;
  confirmedConditions?: string[];
  missingConditions?: string[];
  smcScores?: Record<string, number>;
  pipeline?: string[];
  nextZone?: string;
  invalidation?: string;
  entry?: number | null;
  stopLoss?: number | null;
  tp1?: number | null;
  tp2?: number | null;
  finalTp?: number | null;
  rr?: number | null;
  slDistancePct?: number | null;
  entryDistancePct?: number | null;
  nextAction?: string;
  educationalNote?: string;
  qualityChecks?: { smcStrongCount?: number; rrValid?: boolean; slDistanceValid?: boolean; entryDistanceValid?: boolean; universalTradeGate?: boolean };
  scanner?: Scanner;
};

const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "30m", "1H", "4H", "1D", "1W", "1M"];
const MARKET_TYPES: MarketType[] = ["FOREX", "INDICES", "CRYPTO", "STOCKS", "SYNTHETIC"];
const DEFAULT_SYMBOLS: Record<MarketType, string[]> = {
  FOREX: ["XAU/USD", "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD"],
  INDICES: ["NASDAQ", "SPX", "DOW", "FTSE"],
  CRYPTO: ["BTC/USD", "ETH/USD", "SOL/USD"],
  STOCKS: ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN"],
  SYNTHETIC: ["V75", "V100", "Boom 1000", "Crash 1000"],
};
const fmt = (v: number | null | undefined) => v == null || !Number.isFinite(v) ? "—" : v.toLocaleString(undefined, { maximumFractionDigits: 5 });

type LevelKind = "entry" | "sl" | "tp" | "orange";
const levelColors: Record<LevelKind, { border: string; background: string; text: string }> = {
  entry: { border: "rgba(45,125,255,.65)", background: "rgba(45,125,255,.14)", text: "#dbeafe" },
  sl: { border: "rgba(255,70,70,.65)", background: "rgba(255,70,70,.14)", text: "#fee2e2" },
  tp: { border: "rgba(40,200,110,.65)", background: "rgba(40,200,110,.14)", text: "#dcfce7" },
  orange: { border: "rgba(255,165,45,.65)", background: "rgba(255,165,45,.14)", text: "#ffedd5" },
};

function PriceLevel({ label, value, kind }: { label: string; value: number | null | undefined; kind: LevelKind }) {
  const colors = levelColors[kind];
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ height: 18, marginBottom: 5, padding: "0 2px", color: "#a7b0bd", fontSize: 10, lineHeight: "18px", fontWeight: 800, letterSpacing: ".08em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      <div style={{ minHeight: 52, display: "flex", alignItems: "center", justifyContent: "center", padding: "10px 8px", borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.background, color: colors.text, fontSize: 17, lineHeight: 1.1, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {fmt(value)}
      </div>
    </div>
  );
}

export default function AnalyzerPage() {
  const [marketType, setMarketType] = useState<MarketType>("FOREX");
  const [symbol, setSymbol] = useState("XAU/USD");
  const [timeframe, setTimeframe] = useState<Timeframe>("15m");
  const [strategy, setStrategy] = useState(ANALYZER_STRATEGIES[0].id);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [scannerLoading, setScannerLoading] = useState(false);
  const [error, setError] = useState("");

  const selected = ANALYZER_STRATEGY_MAP[strategy];
  const runAnalysis = async () => {
    if (!symbol.trim()) { setError("Select a market symbol first."); return; }
    if (marketType === "SYNTHETIC") { setError("Synthetic indices need the separate Synthetic/Broker data connection."); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await fetch("/api/analyze-market", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ marketType, symbol, timeframe, strategy }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to analyze live market data.");
      setResult(data);
      const candles = Array.isArray(data.chart?.candles) ? data.chart.candles.slice(-80) : [];
      if (candles.length >= 30) {
        setScannerLoading(true);
        try {
          const scannerRes = await fetch("/api/ai-scanner", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ strategy, currentPrice: data.market?.currentPrice, candles, analysis: data }) });
          const scanner = await scannerRes.json();
          if (scannerRes.ok) setResult({ ...data, scanner });
        } finally { setScannerLoading(false); }
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to analyze live market data."); setScannerLoading(false); }
    finally { setLoading(false); }
  };

  const changeMarket = (value: MarketType) => { setMarketType(value); setSymbol(DEFAULT_SYMBOLS[value][0]); setResult(null); setError(""); };
  const s = result?.scanner;
  const displayDirection = s?.projectedDirection && s.projectedDirection !== "NO TRADE" ? s.projectedDirection : result?.direction;
  const projectedEntry = s?.projectedEntry ?? s?.entry ?? result?.entry;
  const actualEntry = s?.actualEntry ?? null;
  const projectedSL = s?.projectedStopLoss ?? s?.stopLoss ?? result?.stopLoss;
  const projectedTp1 = s?.projectedTp1 ?? s?.tp1 ?? result?.tp1;
  const projectedTp2 = s?.projectedTp2 ?? s?.tp2 ?? result?.tp2;
  const projectedFinalTp = s?.projectedFinalTp ?? s?.finalTp ?? result?.finalTp;
  const projectedTp3 = projectedTp2 != null && projectedFinalTp != null ? projectedTp2 + (projectedFinalTp - projectedTp2) / 2 : projectedFinalTp;
  const projectedTp4 = projectedFinalTp;
  const projectedRR = s?.rr ?? result?.rr;
  const liquidityLabel = displayDirection === "SELL" ? "LIQ SELL" : "LIQ BUY";
  const liquidityTarget = s?.opposingLiquidityTarget ?? projectedFinalTp;
  const scannerStatus = s?.statusMessage || s?.analysisState?.replaceAll("_", " ") || (displayDirection === "BUY" ? "WATCH — BUY" : displayDirection === "SELL" ? "WATCH — SELL" : "WATCH");

  return <main className="shell">
    <header className="header"><div className="brand-block"><img src="/vaulttrades-logo.png" alt="VaultTrades" className="logo"/><div className="tagline">Built by Traders.</div><div className="slogan">Focus, discipline, consistency.</div></div><div className="badge">AI SCANNER</div></header>

    <section className="card">
      <div className="section-label">LIVE MARKET</div>
      <h1 className="title">Analyze the market, not a screenshot</h1>
      <p className="muted">Select the market, timeframe and strategy. The selected strategy remains the source of truth; Analyzer Rules 1–6 remain the universal validation layer. AI Scanner adds institutional-volume profiling, directional context and projected trade levels without replacing either.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginTop: 18 }}>
        <label className="muted">Market<select value={marketType} disabled={loading} onChange={e => changeMarket(e.target.value as MarketType)} style={{ width: "100%", marginTop: 7, padding: 13, borderRadius: 10, background: "#050812", color: "#f4f6fb", border: "1px solid rgba(212,166,55,.35)" }}>{MARKET_TYPES.map(m => <option key={m} value={m}>{m === "SYNTHETIC" ? "Synthetic indices" : m.charAt(0) + m.slice(1).toLowerCase()}</option>)}</select></label>
        <label className="muted">Symbol<input value={symbol} disabled={loading || marketType === "SYNTHETIC"} onChange={e => setSymbol(e.target.value)} list="symbols" placeholder="e.g. XAU/USD" style={{ width: "100%", marginTop: 7, padding: 13, borderRadius: 10, background: "#050812", color: "#f4f6fb", border: "1px solid rgba(212,166,55,.35)" }}/><datalist id="symbols">{DEFAULT_SYMBOLS[marketType].map(s => <option key={s} value={s}/>)}</datalist></label>
        <label className="muted">Timeframe<select value={timeframe} disabled={loading} onChange={e => { setTimeframe(e.target.value as Timeframe); setResult(null); }} style={{ width: "100%", marginTop: 7, padding: 13, borderRadius: 10, background: "#050812", color: "#f4f6fb", border: "1px solid rgba(212,166,55,.35)" }}>{TIMEFRAMES.map(tf => <option key={tf} value={tf}>{tf}</option>)}</select></label>
      </div>
    </section>

    <section className="card">
      <div className="section-label">STRATEGY</div>
      <h2 className="title">Choose the strategy first</h2>
      <select value={strategy} disabled={loading} onChange={e => { setStrategy(e.target.value); setResult(null); }} style={{ width: "100%", marginTop: 14, padding: 14, borderRadius: 10, background: "#050812", color: "#f4f6fb", border: "1px solid rgba(212,166,55,.35)" }}>{ANALYZER_CATEGORIES.map(category => <optgroup key={category} label={category}>{ANALYZER_STRATEGIES.filter(s => s.category === category).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>)}</select>
      <div className="condition-box" style={{ marginTop: 14 }}><strong>Strategy evidence</strong><p className="muted">{selected.focus.join(" · ")}</p><div style={{ marginTop: 8 }}><strong>Source-required indicators</strong><p>{selected.indicatorSpecs.length ? selected.indicatorSpecs.map(i => `${i.name} (${i.parameters})${i.required ? " · required" : " · optional"}`).join(" · ") : "None — this strategy is price/structure based."}</p></div></div>
    </section>

    <section className="card"><div className="actions"><button className="primary" type="button" disabled={loading || marketType === "SYNTHETIC"} onClick={() => void runAnalysis()}>{loading ? "Analyzing live market..." : "Analyze Live Market"}</button></div>{marketType === "SYNTHETIC" && <div className="condition-box" style={{ marginTop: 12 }}><strong>Synthetic market connection</strong><p className="muted">This route deliberately does not substitute another provider. Connect the Synthetic/Broker provider before enabling synthetic analysis.</p></div>}{error && <div className="error-box" style={{ marginTop: 12 }}><strong>Analysis Error</strong><p className="muted">{error}</p></div>}</section>

    {result && <>
      <section className="card"><div className="section-label">LIVE CHART</div><div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}><div><h2 className="title" style={{ marginBottom: 3 }}>{result.market?.asset}</h2><div className="muted">{result.market?.timeframe} · Current price {fmt(result.market?.currentPrice)}</div></div><div className="condition-box" style={{ padding: "10px 14px" }}><strong>Strategy: {result.strategy?.name}</strong></div></div><LiveMarketChart candles={result.chart?.candles || []} channel={result.chart?.channel20} /></section>

      <section className="card execution-card" style={{ border: "1px solid rgba(212,166,55,.28)", background: "linear-gradient(145deg, rgba(10,16,30,.98), rgba(5,8,18,.98))" }}>
        <div className="section-label">AI SCANNER</div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}><div><h2 className="title" style={{ marginBottom: 4 }}>{scannerStatus}</h2><div className="muted">{s?.trend || result.marketCondition || "Market state"} · {s?.institutionalActivity ? `Institutional activity: ${s.institutionalActivity}` : result.market?.directionalBias}</div></div><div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><div style={{ minWidth: 135, textAlign: "center", padding: 12, borderRadius: 12, background: "rgba(212,166,55,.10)", border: "1px solid rgba(212,166,55,.35)" }}><span className="muted">QUALITY</span><div style={{ fontSize: 28, fontWeight: 900 }}>{Math.round(result.confidence ?? 0)}<span style={{ fontSize: 15 }}>/100</span></div></div><div style={{ minWidth: 135, textAlign: "center", padding: 12, borderRadius: 12, background: "rgba(45,125,255,.10)", border: "1px solid rgba(45,125,255,.35)" }}><span className="muted">PROJECTED PROBABILITY</span><div style={{ fontSize: 28, fontWeight: 900 }}>{s?.projectedProbability ?? "—"}<span style={{ fontSize: 15 }}>{s?.projectedProbability != null ? "%" : ""}</span></div></div></div></div>
        <div style={{ marginTop: 15 }}><strong>Trend</strong><p>{s?.trendReason || result.marketStructure}</p><strong>{s?.cycleStatus === "ACTIVE" ? "Trade status" : s?.cycleStatus === "TP1_HIT" ? "Trade status" : "Why we are waiting"}</strong><p>{s?.statusMessage || s?.waitReason || result.nextAction}</p></div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 10, marginTop: 16, alignItems: "start" }}>
          <PriceLevel label="PROJECTED ENTRY" value={projectedEntry} kind="entry" />
          <PriceLevel label="ACTUAL ENTRY" value={actualEntry} kind="orange" />
          <PriceLevel label="S LOSS" value={projectedSL} kind="sl" />
          <PriceLevel label="TP1" value={projectedTp1} kind="tp" />
          <PriceLevel label="TP2" value={projectedTp2} kind="tp" />
          <PriceLevel label="TP3" value={projectedTp3} kind="tp" />
          <PriceLevel label="FINAL TP" value={projectedTp4} kind="tp" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10, marginTop: 12, alignItems: "start", maxWidth: "calc(50% - 5px)" }}>
          <PriceLevel label="CONFIRM" value={s?.confirmationPrice} kind="orange" />
          <PriceLevel label="REVERSE" value={s?.reversalPrice} kind="orange" />
          <PriceLevel label={liquidityLabel} value={liquidityTarget} kind="orange" />
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
          <div className="execution-item" style={{ minWidth: 180 }}><span>R:R TO LIQUIDITY</span><strong>{projectedRR == null ? "—" : `1:${projectedRR.toFixed(2)}`}</strong></div>
          <div className="execution-item" style={{ minWidth: 180 }}><span>CYCLE</span><strong>{s?.cycleStatus || "WATCH"}</strong></div>
          <p className="muted" style={{ margin: 0, flex: 1, minWidth: 280 }}>Projected Entry, Stop Loss and TP levels are fixed strategy projections. Actual Entry is recorded only after confirmation and is not moved with current price.</p>
        </div>
        {s?.tp1Hit && <div className="condition-box" style={{ marginTop: 12 }}><strong>TP1 HIT</strong><p>The projected TP1 has already been reached. The scanner will not continue presenting this trade as a waiting-for-entry setup.</p></div>}
      </section>

      <section className="card"><div className="section-label">INSTITUTIONAL PROFILE</div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 9 }}><div className="condition-box"><strong>Activity</strong><p>{s?.institutionalActivity || "—"}</p></div><div className="condition-box"><strong>Volume ratio</strong><p>{s?.volumeProfile?.ratio == null ? "—" : `${s.volumeProfile.ratio.toFixed(2)}× average`}</p></div><div className="condition-box"><strong>Volume expansion</strong><p>{s?.volumeProfile?.expansion ? "CONFIRMED" : "Not confirmed"}</p></div><div className="condition-box"><strong>Displacement</strong><p>{s?.volumeProfile?.displacementATR == null ? "—" : `${s.volumeProfile.displacementATR.toFixed(2)} ATR`}</p></div></div><ul>{(s?.institutionalEvidence || []).map((x, i) => <li key={i}>{x}</li>)}</ul></section>

      <section className="card"><div className="section-label">CONFIRMATIONS</div><div style={{ display: "grid", gap: 8 }}>{(s?.confirmations || result.confirmedConditions || []).map((x, i) => <div key={i} style={{ ...levelColors.orange, borderRadius: 10, padding: "13px 14px", border: `1px solid ${levelColors.orange.border}`, background: levelColors.orange.background }}><strong>{i + 1}. </strong>{x}</div>)}</div><div className="condition-box" style={{ marginTop: 10 }}><strong>Why trade?</strong><p>{s?.tradeReason || result.setup}</p></div></section>

      <section className="card"><div className="section-label">PIPELINE</div><h2 className="title">{result.strategy?.name} — current state</h2><div style={{ display: "grid", gap: 9, marginTop: 14 }}>{(s?.pipeline || result.pipeline || []).map((line, i) => <div key={i} className="condition-box" style={{ margin: 0 }}><strong>{line}</strong></div>)}</div><div className="condition-box" style={{ marginTop: 12 }}><strong>What happens next</strong><p>{s?.nextZone || result.nextAction}</p></div></section>

      <section className="card"><div className="section-label">MARKET STRUCTURE</div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}><div className="condition-box"><strong>Structure</strong><p>{result.marketStructure}</p></div><div className="condition-box"><strong>Support</strong><p>{fmt(result.structure?.support)}</p></div><div className="condition-box"><strong>Resistance</strong><p>{fmt(result.structure?.resistance)}</p></div><div className="condition-box"><strong>Next zone</strong><p>{s?.nextZone || result.nextZone}</p></div></div><div className="condition-box" style={{ marginTop: 10 }}><strong>Recent price action</strong><p>{result.recentPriceAction}</p></div></section>

      <section className="card" style={{ border: "1px solid rgba(255,165,45,.35)", background: "linear-gradient(145deg, rgba(28,20,8,.55), rgba(5,8,18,.98))" }}>
        <div className="section-label">ENTRY CONFIRMATION</div>
        <div className="condition-box" style={{ border: `1px solid ${s?.entryConfirmation ? "rgba(40,200,110,.65)" : "rgba(255,165,45,.65)"}`, background: s?.entryConfirmation ? "rgba(40,200,110,.10)" : "rgba(255,165,45,.10)" }}>
          <strong style={{ fontSize: 18 }}>{s?.entryConfirmation ? `ENTRY CONFIRMATION: YES — ${s.confirmationTimeframe || "CONFIRMATION TIMEFRAME"}` : "NO ENTRY — WAIT FOR ENTRY CONFIRMATION"}</strong>
          <p>{s?.entryConfirmationReason || "The strategy-specific entry trigger has not yet been confirmed."}</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, marginTop: 10 }}>
          <div className="condition-box"><strong>Confirmation timeframe</strong><p>{s?.confirmationTimeframe || "Not yet established"}</p></div>
          <div className="condition-box"><strong>Entry trigger</strong><p>{s?.entryConfirmationReason || "Waiting for the strategy-defined entry trigger."}</p></div>
          <div className="condition-box"><strong>Strategy setup</strong><p>{s?.strategyConditionsMet ? "SETUP CONDITIONS CONFIRMED" : "STRATEGY CONDITIONS NOT YET CONFIRMED"}</p></div>
        </div>
        <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>This section is the entry trigger only. Validation above remains separate. Lifecycle states such as ACTIVE, TP1, SL and COMPLETED are never entry confirmation.</p>
      </section>

      <section className="card"><div className="section-label">SMC CONFLUENCE</div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8 }}>{Object.entries(result.smcScores || {}).map(([name, score]) => <div className="condition-box" key={name}><strong>{name}</strong><div style={{ fontSize: 22, fontWeight: 800 }}>{score}/10</div></div>)}</div><p className="muted" style={{ marginTop: 12 }}>A new BUY/SELL is allowed only when at least two SMC signals score 7 or higher and the price-validation gates also pass.</p></section>

      <section className="card"><div className="section-label">STRATEGY INDICATORS</div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 9 }}>{(result.indicatorReadings || []).map(i => <div className="condition-box" key={i.name}><strong>{i.name}</strong><div className="muted">{i.signal} · {fmt(i.value)}</div><p style={{ fontSize: 13 }}>{i.reason}</p></div>)}</div></section>

      <section className="card"><div className="section-label">VALIDATION</div><div className="condition-box"><strong>{result.decision === "TRADE" ? "TRADE VALIDATION PASSED" : "NO TRADE — WAIT FOR THE MISSING CONDITIONS"}</strong><p>{result.setup}</p></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 10, marginTop: 10 }}><div className="condition-box"><strong>Confirmed</strong><ul>{(result.confirmedConditions || []).map((x, i) => <li key={i}>{x}</li>)}</ul></div><div className="condition-box"><strong>Still required</strong><ul>{(result.missingConditions || []).map((x, i) => <li key={i}>{x}</li>)}</ul></div></div><div className="condition-box" style={{ marginTop: 10 }}><strong>Invalidation</strong><p>{s?.invalidation || result.invalidation}</p></div><div className="condition-box" style={{ marginTop: 10 }}><strong>Educational note</strong><p>{result.educationalNote}</p></div></section>
    </>}
    {scannerLoading && result && <div className="muted" style={{ textAlign: "center", padding: 10 }}>AI Scanner is profiling volume, institutional activity and projected market path…</div>}
  </main>;
}

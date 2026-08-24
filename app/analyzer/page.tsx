"use client";

import { useState } from "react";
import { ANALYZER_CATEGORIES, ANALYZER_STRATEGIES, ANALYZER_STRATEGY_MAP } from "../../lib/strategies/analyzerProfiles";
import { LiveMarketChart } from "./LiveMarketChart";

type Timeframe = "1m" | "5m" | "15m" | "30m" | "1H" | "4H" | "1D" | "1W" | "1M";
type MarketType = "FOREX" | "INDICES" | "CRYPTO" | "STOCKS" | "SYNTHETIC";
type Candle = { datetime: string; open: number; high: number; low: number; close: number; volume: number | null };
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

export default function AnalyzerPage() {
  const [marketType, setMarketType] = useState<MarketType>("FOREX");
  const [symbol, setSymbol] = useState("XAU/USD");
  const [timeframe, setTimeframe] = useState<Timeframe>("15m");
  const [strategy, setStrategy] = useState(ANALYZER_STRATEGIES[0].id);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
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
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to analyze live market data."); }
    finally { setLoading(false); }
  };

  const changeMarket = (value: MarketType) => { setMarketType(value); setSymbol(DEFAULT_SYMBOLS[value][0]); setResult(null); setError(""); };

  return <main className="shell">
    <header className="header"><div className="brand-block"><img src="/vaulttrades-logo.png" alt="VaultTrades" className="logo"/><div className="tagline">Built by Traders.</div><div className="slogan">Focus, discipline, consistency.</div></div><div className="badge">ANALYZER</div></header>

    <section className="card">
      <div className="section-label">LIVE MARKET</div>
      <h1 className="title">Analyze the market, not a screenshot</h1>
      <p className="muted">Select the market, timeframe and strategy. VaultTrades then analyzes real OHLCV candles and calculates the indicators required by the selected strategy before applying Analyzer Rules 1–6.</p>
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

    <section className="card">
      <div className="actions"><button className="primary" type="button" disabled={loading || marketType === "SYNTHETIC"} onClick={() => void runAnalysis()}>{loading ? "Analyzing live market..." : "Analyze Live Market"}</button></div>
      {marketType === "SYNTHETIC" && <div className="condition-box" style={{ marginTop: 12 }}><strong>Synthetic market connection</strong><p className="muted">This route deliberately does not substitute another provider. Connect the Synthetic/Broker provider before enabling synthetic analysis.</p></div>}
      {error && <div className="error-box" style={{ marginTop: 12 }}><strong>Analysis Error</strong><p className="muted">{error}</p></div>}
    </section>

    {result && <>
      <section className="card">
        <div className="section-label">LIVE CHART</div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}><div><h2 className="title" style={{ marginBottom: 3 }}>{result.market?.asset}</h2><div className="muted">{result.market?.timeframe} · Current price {fmt(result.market?.currentPrice)}</div></div><div className="condition-box" style={{ padding: "10px 14px" }}><strong>Strategy: {result.strategy?.name}</strong></div></div>
        <LiveMarketChart candles={result.chart?.candles || []} channel={result.chart?.channel20} />
      </section>

      <section className="card execution-card" style={{ border: "1px solid rgba(212,166,55,.28)", background: "linear-gradient(145deg, rgba(10,16,30,.98), rgba(5,8,18,.98))" }}>
        <div className="section-label">RESULT</div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div><h2 className="title" style={{ marginBottom: 4 }}>{result.direction === "BUY" ? "BUY" : result.direction === "SELL" ? "SELL" : "WATCH"}</h2><div className="muted">{result.marketCondition} · {result.market?.directionalBias}</div></div>
          <div style={{ minWidth: 150, textAlign: "center", padding: 12, borderRadius: 12, background: "rgba(212,166,55,.10)", border: "1px solid rgba(212,166,55,.35)" }}><span className="muted">QUALITY</span><div style={{ fontSize: 28, fontWeight: 900 }}>{Math.round(result.confidence ?? 0)}<span style={{ fontSize: 15 }}>/100</span></div></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginTop: 18 }}>
          <div className="execution-item"><span>ENTRY</span><strong>{fmt(result.entry)}</strong></div><div className="execution-item"><span>STOP LOSS</span><strong>{fmt(result.stopLoss)}</strong></div><div className="execution-item"><span>TP1</span><strong>{fmt(result.tp1)}</strong></div><div className="execution-item"><span>TP2</span><strong>{fmt(result.tp2)}</strong></div><div className="execution-item"><span>FINAL TP</span><strong>{fmt(result.finalTp)}</strong></div><div className="execution-item"><span>R:R</span><strong>{result.rr == null ? "—" : `1:${result.rr.toFixed(2)}`}</strong></div>
        </div>
      </section>

      <section className="card">
        <div className="section-label">PIPELINE</div>
        <h2 className="title">{result.strategy?.name} — current state</h2>
        <div style={{ display: "grid", gap: 9, marginTop: 14 }}>{(result.pipeline || []).map((line, i) => <div key={i} className="condition-box" style={{ margin: 0 }}><strong>{line}</strong></div>)}</div>
        <div className="condition-box" style={{ marginTop: 12 }}><strong>What to watch next</strong><p>{result.nextAction}</p><p className="muted">{result.nextZone}</p></div>
      </section>

      <section className="card">
        <div className="section-label">MARKET STRUCTURE</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}><div className="condition-box"><strong>Structure</strong><p>{result.marketStructure}</p></div><div className="condition-box"><strong>Support</strong><p>{fmt(result.structure?.support)}</p></div><div className="condition-box"><strong>Resistance</strong><p>{fmt(result.structure?.resistance)}</p></div><div className="condition-box"><strong>Next zone</strong><p>{result.nextZone}</p></div></div>
        <div className="condition-box" style={{ marginTop: 10 }}><strong>Recent price action</strong><p>{result.recentPriceAction}</p></div>
      </section>

      <section className="card">
        <div className="section-label">SMC CONFLUENCE</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8 }}>{Object.entries(result.smcScores || {}).map(([name, score]) => <div className="condition-box" key={name}><strong>{name}</strong><div style={{ fontSize: 22, fontWeight: 800 }}>{score}/10</div></div>)}</div>
        <p className="muted" style={{ marginTop: 12 }}>A new BUY/SELL is allowed only when at least two SMC signals score 7 or higher and the price-validation gates also pass.</p>
      </section>

      <section className="card">
        <div className="section-label">STRATEGY INDICATORS</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 9 }}>{(result.indicatorReadings || []).map(i => <div className="condition-box" key={i.name}><strong>{i.name}</strong><div className="muted">{i.signal} · {fmt(i.value)}</div><p style={{ fontSize: 13 }}>{i.reason}</p></div>)}</div>
      </section>

      <section className="card">
        <div className="section-label">VALIDATION</div>
        <div className="condition-box"><strong>{result.decision === "TRADE" ? "TRADE VALIDATION PASSED" : "NO TRADE — WAIT FOR THE MISSING CONDITIONS"}</strong><p>{result.setup}</p></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 10, marginTop: 10 }}><div className="condition-box"><strong>Confirmed</strong><ul>{(result.confirmedConditions || []).map((x, i) => <li key={i}>{x}</li>)}</ul></div><div className="condition-box"><strong>Still required</strong><ul>{(result.missingConditions || []).map((x, i) => <li key={i}>{x}</li>)}</ul></div></div>
        <div className="condition-box" style={{ marginTop: 10 }}><strong>Invalidation</strong><p>{result.invalidation}</p></div>
        <div className="condition-box" style={{ marginTop: 10 }}><strong>Educational note</strong><p>{result.educationalNote}</p></div>
      </section>
    </>}
  </main>;
}

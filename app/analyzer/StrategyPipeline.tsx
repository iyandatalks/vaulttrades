import React from "react";

type PipelineResult = {
  market?: { asset?: string; timeframe?: string; marketCondition?: string; directionalBias?: string; session?: string };
  marketData?: { structure?: { support?: number | null; resistance?: number | null; latestHigh?: number | null; latestLow?: number | null }; volatility?: { atr?: number | null } } | null;
  strategy?: { id?: string; name?: string };
  strategyAnalysis?: { marketStructure?: string; priceAction?: string; liquidity?: string; momentum?: string; volatility?: string; indicatorConfirmation?: string };
  confirmedConditions?: string[];
  missingConditions?: string[];
  nextAction?: string;
  decisionReason?: string;
  currentState?: string;
  currentTrade?: { visible?: boolean; direction?: string; progress?: string; status?: string } | null;
  projection?: { zoneLow?: number | null; zoneHigh?: number | null } | null;
  smcScores?: { BOS?: number; CHoCH?: number; OrderBlock?: number; FVG?: number; LiquiditySweep?: number; Displacement?: number } | null;
};

type Stage = { label: string; value: string };
const text = (value?: string | null, fallback = "Not clearly confirmed from the available evidence.") => value?.trim() || fallback;
const score = (result: PipelineResult, key: keyof NonNullable<PipelineResult["smcScores"]>) => result.smcScores?.[key] ?? null;
const scoreText = (result: PipelineResult, key: keyof NonNullable<PipelineResult["smcScores"]>, label: string) => { const value = score(result, key); return value == null ? `${label}: not clearly scored` : `${label}: ${value}/10`; };
function evidence(result: PipelineResult, label: string, preferred?: string[]) { const candidates = [...(preferred || []), ...(result.confirmedConditions || []), ...(result.missingConditions || [])].filter(Boolean); const hit = candidates.find(x => x.toLowerCase().includes(label.toLowerCase())); return hit || "No explicit confirmation recorded."; }

function priceDecimals(value: number): number {
  const abs = Math.abs(value);
  if (abs >= 1000) return 2;
  if (abs >= 100) return 2;
  if (abs >= 10) return 3;
  if (abs >= 1) return 4;
  return 5;
}

const fmt = (value: number | null | undefined) => value == null || !Number.isFinite(value)
  ? "—"
  : value.toLocaleString(undefined, { minimumFractionDigits: priceDecimals(value), maximumFractionDigits: priceDecimals(value) });

function priceMap(result: PipelineResult): Stage[] {
  const s = result.marketData?.structure;
  const atr = s && result.marketData?.volatility?.atr != null && Number.isFinite(result.marketData.volatility.atr) ? result.marketData.volatility.atr : null;
  const support = s?.support ?? null;
  const resistance = s?.resistance ?? null;
  const hasDistinctLevels = support != null && resistance != null && resistance > support;
  const range = hasDistinctLevels ? resistance - support : null;
  const projectedLow = result.projection?.zoneLow ?? null;
  const projectedHigh = result.projection?.zoneHigh ?? null;
  const currentZone = projectedLow != null && projectedHigh != null && projectedHigh > projectedLow
    ? `${fmt(projectedLow)} – ${fmt(projectedHigh)}`
    : hasDistinctLevels
      ? `${fmt(support)} – ${fmt(resistance)}`
      : "No strategy-specific setup zone confirmed yet.";
  const upperLow = resistance;
  const upperHigh = resistance != null && range != null ? resistance + Math.max(range * 0.5, atr ?? 0) : null;
  const lowerHigh = support;
  const lowerLow = support != null && range != null ? support - Math.max(range * 0.5, atr ?? 0) : null;

  return [
    { label: "Support", value: support != null ? fmt(support) : "No reliable structural support identified" },
    { label: "Resistance", value: resistance != null ? fmt(resistance) : "No reliable structural resistance identified" },
    { label: "Break above", value: upperLow != null && upperHigh != null ? `Close above ${fmt(upperLow)} → next structural area ${fmt(upperLow)} – ${fmt(upperHigh)}` : "Await a confirmed resistance level." },
    { label: "Break below", value: lowerLow != null && lowerHigh != null ? `Close below ${fmt(lowerHigh)} → next structural area ${fmt(lowerLow)} – ${fmt(lowerHigh)}` : "Await a confirmed support level." },
    { label: "Current setup zone", value: currentZone },
  ];
}

function buildStages(result: PipelineResult): Stage[] {
  const id = result.strategy?.id || "";
  const a = result.strategyAnalysis;
  const zone = result.projection?.zoneLow != null && result.projection?.zoneHigh != null ? `${fmt(result.projection.zoneLow)} – ${fmt(result.projection.zoneHigh)}` : "No reliable setup zone identified";
  const bias = text(result.market?.directionalBias, "Neutral / unclear");
  const map = priceMap(result);
  const base: Stage[] = [];
  if (id === "institutional") base.push(
    { label: "Session structure", value: `${text(result.market?.session, "Session not visible")} · ${text(result.market?.timeframe, "timeframe unavailable")}` },
    { label: "BOS / CHoCH", value: `${scoreText(result, "BOS", "BOS")} · ${scoreText(result, "CHoCH", "CHoCH")} · ${text(a?.marketStructure, "Structure not clearly established")}` },
    { label: "Liquidity sweep", value: text(a?.liquidity, "No clear qualifying sweep on the latest visible price action.") },
    { label: "Zone tap", value: `${result.projection?.zoneLow != null ? "Setup area identified" : "No confirmed tap"} · ${zone}` },
    { label: "2-bar confirmation", value: evidence(result, "2-bar", [a?.priceAction || "", a?.momentum || ""]) },
    { label: "Execution bias", value: result.currentTrade?.visible ? `${result.currentTrade.direction || "TRADE"} active · ${text(result.currentTrade.progress || result.currentTrade.status)}` : text(result.nextAction || result.decisionReason, "Patient until the institutional confirmation sequence is complete.") },
  );
  else if (id === "sweepDeveloping") base.push(
    { label: "H1 direction", value: text(result.market?.directionalBias, "H1 direction not clearly confirmed") },
    { label: "M15 alignment", value: text(a?.marketStructure, "M15 alignment not clearly confirmed") },
    { label: "EMA 9/15 pullback", value: evidence(result, "pullback", [a?.priceAction || ""]) },
    { label: "Recovery", value: evidence(result, "recovery", [a?.momentum || ""]) },
    { label: "SMI confirmation", value: evidence(result, "SMI", [a?.indicatorConfirmation || ""]) },
    { label: "Execution bias", value: text(result.nextAction || result.decisionReason, "Patient until the source-defined entry transition is complete.") },
  );
  else if (id === "swingEngulfing") base.push(
    { label: "Direction / structure", value: `${bias} · ${text(a?.marketStructure)}` },
    { label: "Liquidity event", value: text(a?.liquidity, "No qualifying liquidity event clearly confirmed.") },
    { label: "BOS / CHoCH", value: `${scoreText(result, "BOS", "BOS")} · ${scoreText(result, "CHoCH", "CHoCH")}` },
    { label: "Engulfing / displacement", value: `${scoreText(result, "Displacement", "Displacement")} · ${text(a?.priceAction)}` },
    { label: "Confirmation", value: text(a?.indicatorConfirmation, "Final confirmation not complete.") },
    { label: "Execution bias", value: text(result.nextAction || result.decisionReason, "Wait for the qualifying sweep → structure → engulfing sequence.") },
  );
  else if (id === "volatilityBreakout") base.push(
    { label: "Directional structure", value: `${bias} · ${text(a?.marketStructure)}` },
    { label: "Channel / location", value: text(a?.priceAction, "Channel/location evidence unavailable.") },
    { label: "Breakout", value: `${scoreText(result, "BOS", "BOS")} · ${text(a?.liquidity, "No confirmed breakout/liquidity event.")}` },
    { label: "Momentum / volatility", value: `${text(a?.momentum)} · ${text(a?.volatility)}` },
    { label: "Indicator confirmation", value: text(a?.indicatorConfirmation) },
    { label: "Execution bias", value: text(result.nextAction || result.decisionReason, "Wait for a qualified breakout rather than a raw channel touch.") },
  );
  else if (id === "fibRetracement") base.push(
    { label: "Swing anchors", value: text(a?.marketStructure, "Validated swing anchors not clearly established.") },
    { label: "Retracement depth", value: text(a?.priceAction, "Retracement depth not clearly confirmed.") },
    { label: "Flip / confluence", value: text(a?.liquidity, "No confirmed flip/confluence reaction.") },
    { label: "Momentum", value: text(a?.momentum) },
    { label: "Risk geometry", value: text(a?.indicatorConfirmation, "Trade geometry not yet validated.") },
    { label: "Execution bias", value: text(result.nextAction || result.decisionReason, "Wait for a source-valid retracement reaction.") },
  );
  else if (id === "continuation") base.push(
    { label: "Expansion", value: text(a?.marketStructure, "Expansion not clearly confirmed.") },
    { label: "Correction", value: text(a?.priceAction, "Correction/pullback not clearly confirmed.") },
    { label: "Structural hold", value: text(a?.liquidity, "Structural hold not clearly confirmed.") },
    { label: "Recovery", value: text(a?.momentum, "Recovery not clearly confirmed.") },
    { label: "Continuation trigger", value: text(a?.indicatorConfirmation, "Continuation trigger pending.") },
    { label: "Execution bias", value: text(result.nextAction || result.decisionReason, "Wait for the source-defined continuation event.") },
  );
  else base.push(
    { label: "Observation / direction", value: `${bias} · ${text(a?.marketStructure)}` },
    { label: "Key price level", value: text(a?.priceAction) },
    { label: "Liquidity / event", value: text(a?.liquidity) },
    { label: "Momentum / displacement", value: text(a?.momentum) },
    { label: "Confirmation", value: text(a?.indicatorConfirmation) },
    { label: "Execution bias", value: text(result.nextAction || result.decisionReason, "Wait for the strategy's qualifying execution event.") },
  );
  return [...base, { label: "Price map", value: map.map(x => `${x.label}: ${x.value}`).join(" · ") }];
}

export function StrategyPipeline({ result }: { result: PipelineResult }) {
  const stages = buildStages(result);
  const map = priceMap(result);
  return <>
    <style>{`section.execution-card + section.card { display:none !important; } section.card:first-of-type > .condition-box { display:none !important; }
      .execution-card > div:nth-child(4) { display:grid !important; grid-template-columns:repeat(5,minmax(0,1fr)) !important; gap:9px !important; align-items:start !important; }
      .execution-card > div:nth-child(4) > div { position:relative !important; min-width:0 !important; padding:0 !important; border:0 !important; background:transparent !important; border-radius:0 !important; }
      .execution-card > div:nth-child(4) > div > span { display:block !important; margin:0 0 6px !important; padding:0 2px !important; color:#a7b0bd !important; font-size:0 !important; font-weight:800 !important; letter-spacing:.08em !important; line-height:1.2 !important; }
      .execution-card > div:nth-child(4) > div:nth-child(1) > span:after { content:"ENTRY"; }
      .execution-card > div:nth-child(4) > div:nth-child(2) > span:after { content:"STOP LOSS"; }
      .execution-card > div:nth-child(4) > div:nth-child(3) > span:after { content:"TP1"; }
      .execution-card > div:nth-child(4) > div:nth-child(4) > span:after { content:"TP2"; }
      .execution-card > div:nth-child(4) > div:nth-child(5) > span:after { content:"FINAL TP"; }
      .execution-card > div:nth-child(4) > div:nth-child(6) > span:after { content:"CONFIRMATION"; }
      .execution-card > div:nth-child(4) > div:nth-child(7) > span:after { content:"REVERSAL"; }
      .execution-card > div:nth-child(4) > div > span:after { font-size:10px !important; }
      .execution-card > div:nth-child(4) > div > strong { display:flex !important; align-items:center !important; justify-content:center !important; min-height:50px !important; margin:0 !important; padding:10px 8px !important; border-radius:10px !important; font-size:17px !important; font-weight:900 !important; line-height:1.1 !important; color:#f8fafc !important; border:1px solid rgba(148,163,184,.22) !important; background:rgba(148,163,184,.08) !important; white-space:nowrap !important; }
      .execution-card > div:nth-child(4) > div:nth-child(1) > strong { color:#dbeafe !important; border-color:rgba(45,125,255,.65) !important; background:rgba(45,125,255,.14) !important; }
      .execution-card > div:nth-child(4) > div:nth-child(2) > strong { color:#fee2e2 !important; border-color:rgba(255,70,70,.65) !important; background:rgba(255,70,70,.14) !important; }
      .execution-card > div:nth-child(4) > div:nth-child(3) > strong,.execution-card > div:nth-child(4) > div:nth-child(4) > strong,.execution-card > div:nth-child(4) > div:nth-child(5) > strong { color:#dcfce7 !important; border-color:rgba(40,200,110,.65) !important; background:rgba(40,200,110,.14) !important; }
      .execution-card > div:nth-child(4) > div:nth-child(6) { grid-column:1 !important; }
      .execution-card > div:nth-child(4) > div:nth-child(7) { grid-column:2 !important; }
      .execution-card > div:nth-child(4) > div:nth-child(6) > strong,.execution-card > div:nth-child(4) > div:nth-child(7) > strong { color:#ffedd5 !important; border-color:rgba(255,165,45,.65) !important; background:rgba(255,165,45,.14) !important; }
      @media(max-width:800px){.execution-card > div:nth-child(4){grid-template-columns:repeat(3,minmax(0,1fr)) !important}.execution-card > div:nth-child(4) > div:nth-child(6),.execution-card > div:nth-child(4) > div:nth-child(7){grid-column:auto !important}}
      @media(max-width:560px){.execution-card > div:nth-child(4){grid-template-columns:repeat(2,minmax(0,1fr)) !important}}
    `}</style>
    <section className="condition-box" style={{ marginTop: 16 }}>
      <div style={{ marginBottom: 12 }}><div className="section-label" style={{ marginBottom: 4 }}>PIPELINE</div><strong>{result.strategy?.name || "Strategy"} · {result.currentState || "WAITING"}</strong></div>
      <div style={{ display: "grid", gap: 8 }}>
        {stages.slice(0, -1).map((stage, index) => <div key={`${stage.label}-${index}`} style={{ display: "grid", gridTemplateColumns: "minmax(145px, 0.32fr) 1fr", gap: 12, padding: "9px 0", borderTop: index ? "1px solid rgba(148,163,184,.12)" : undefined }}><strong>{stage.label}:</strong><span>{stage.value}</span></div>)}
      </div>
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(148,163,184,.16)" }}>
        <div className="section-label" style={{ marginBottom: 8 }}>KEY LEVELS & NEXT ZONES</div>
        <div style={{ display: "grid", gap: 7 }}>
          {map.map(item => <div key={item.label} style={{ display: "grid", gridTemplateColumns: "minmax(130px,.3fr) 1fr", gap: 12 }}><strong>{item.label}:</strong><span>{item.value}</span></div>)}
        </div>
      </div>
    </section>
  </>;
}

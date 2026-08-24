import React from "react";

type PipelineResult = {
  market?: { asset?: string; timeframe?: string; marketCondition?: string; directionalBias?: string; session?: string };
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
const text = (value?: string | null, fallback = "Not clearly confirmed from the chart.") => value?.trim() || fallback;
const score = (result: PipelineResult, key: keyof NonNullable<PipelineResult["smcScores"]>) => result.smcScores?.[key] ?? null;
const scoreText = (result: PipelineResult, key: keyof NonNullable<PipelineResult["smcScores"]>, label: string) => { const value = score(result, key); return value == null ? `${label}: not clearly scored` : `${label}: ${value}/10`; };
function evidence(result: PipelineResult, label: string, preferred?: string[]) { const candidates = [...(preferred || []), ...(result.confirmedConditions || []), ...(result.missingConditions || [])].filter(Boolean); const hit = candidates.find(x => x.toLowerCase().includes(label.toLowerCase())); return hit || "No explicit confirmation recorded."; }

function buildStages(result: PipelineResult): Stage[] {
  const id = result.strategy?.id || "";
  const a = result.strategyAnalysis;
  const zone = result.projection?.zoneLow != null && result.projection?.zoneHigh != null ? `${result.projection.zoneLow} – ${result.projection.zoneHigh}` : "No reliable setup zone identified";
  const bias = text(result.market?.directionalBias, "Neutral / unclear");

  if (id === "institutional") return [
    { label: "Session structure", value: `${text(result.market?.session, "Session not visible")} · ${text(result.market?.timeframe, "timeframe unavailable")}` },
    { label: "BOS / CHoCH", value: `${scoreText(result, "BOS", "BOS")} · ${scoreText(result, "CHoCH", "CHoCH")} · ${text(a?.marketStructure, "Structure not clearly established")}` },
    { label: "Liquidity sweep", value: text(a?.liquidity, "No clear qualifying sweep on the latest visible price action.") },
    { label: "Zone tap", value: `${result.projection?.zoneLow != null ? "Tap / setup area identified" : "No confirmed tap"} · ${zone}` },
    { label: "2-bar confirmation", value: evidence(result, "2-bar", [a?.priceAction || "", a?.momentum || ""]) },
    { label: "Execution bias", value: result.currentTrade?.visible ? `${result.currentTrade.direction || "TRADE"} active · ${text(result.currentTrade.progress || result.currentTrade.status)}` : text(result.nextAction || result.decisionReason, "Patient until the institutional confirmation sequence is complete.") },
  ];

  if (id === "sweepDeveloping") return [
    { label: "H1 direction", value: text(result.market?.directionalBias, "H1 direction not clearly confirmed") },
    { label: "M15 alignment", value: text(a?.marketStructure, "M15 alignment not clearly confirmed") },
    { label: "EMA 9/15 pullback", value: evidence(result, "pullback", [a?.priceAction || ""]) },
    { label: "Recovery", value: evidence(result, "recovery", [a?.momentum || ""]) },
    { label: "SMI confirmation", value: evidence(result, "SMI", [a?.indicatorConfirmation || ""]) },
    { label: "Execution bias", value: text(result.nextAction || result.decisionReason, "Patient until the source-defined entry transition is complete.") },
  ];

  if (id === "swingEngulfing") return [
    { label: "Direction / structure", value: `${bias} · ${text(a?.marketStructure)}` },
    { label: "Liquidity event", value: text(a?.liquidity, "No qualifying liquidity event clearly confirmed.") },
    { label: "BOS / CHoCH", value: `${scoreText(result, "BOS", "BOS")} · ${scoreText(result, "CHoCH", "CHoCH")}` },
    { label: "Engulfing / displacement", value: `${scoreText(result, "Displacement", "Displacement")} · ${text(a?.priceAction)}` },
    { label: "Confirmation", value: text(a?.indicatorConfirmation, "Final confirmation not complete.") },
    { label: "Execution bias", value: text(result.nextAction || result.decisionReason, "Wait for the qualifying sweep → structure → engulfing sequence.") },
  ];

  if (id === "volatilityBreakout") return [
    { label: "Directional structure", value: `${bias} · ${text(a?.marketStructure)}` },
    { label: "Channel / location", value: text(a?.priceAction, "Channel/location evidence unavailable.") },
    { label: "Breakout", value: `${scoreText(result, "BOS", "BOS")} · ${text(a?.liquidity, "No confirmed breakout/liquidity event.")}` },
    { label: "Momentum / volatility", value: `${text(a?.momentum)} · ${text(a?.volatility)}` },
    { label: "Indicator confirmation", value: text(a?.indicatorConfirmation) },
    { label: "Execution bias", value: text(result.nextAction || result.decisionReason, "Wait for a qualified breakout rather than a raw channel touch.") },
  ];

  if (id === "fibRetracement") return [
    { label: "Swing anchors", value: text(a?.marketStructure, "Validated swing anchors not clearly established.") },
    { label: "Retracement depth", value: text(a?.priceAction, "Retracement depth not clearly confirmed.") },
    { label: "Flip / confluence", value: text(a?.liquidity, "No confirmed flip/confluence reaction.") },
    { label: "Momentum", value: text(a?.momentum) },
    { label: "Risk geometry", value: text(a?.indicatorConfirmation, "Trade geometry not yet validated.") },
    { label: "Execution bias", value: text(result.nextAction || result.decisionReason, "Wait for a source-valid retracement reaction.") },
  ];

  if (id === "continuation") return [
    { label: "Expansion", value: text(a?.marketStructure, "Expansion not clearly confirmed.") },
    { label: "Correction", value: text(a?.priceAction, "Correction/pullback not clearly confirmed.") },
    { label: "Structural hold", value: text(a?.liquidity, "Structural hold not clearly confirmed.") },
    { label: "Recovery", value: text(a?.momentum, "Recovery not clearly confirmed.") },
    { label: "Continuation trigger", value: text(a?.indicatorConfirmation, "Continuation trigger pending.") },
    { label: "Execution bias", value: text(result.nextAction || result.decisionReason, "Wait for the source-defined continuation event.") },
  ];

  return [
    { label: "Observation / direction", value: `${bias} · ${text(a?.marketStructure)}` },
    { label: "Key price level", value: text(a?.priceAction) },
    { label: "Liquidity / event", value: text(a?.liquidity) },
    { label: "Momentum / displacement", value: text(a?.momentum) },
    { label: "Confirmation", value: text(a?.indicatorConfirmation) },
    { label: "Execution bias", value: text(result.nextAction || result.decisionReason, "Wait for the strategy's qualifying execution event.") },
  ];
}

export function StrategyPipeline({ result }: { result: PipelineResult }) {
  const stages = buildStages(result);
  return <section className="condition-box" style={{ marginTop: 16 }}>
    <div style={{ marginBottom: 12 }}><div className="section-label" style={{ marginBottom: 4 }}>PIPELINE</div><strong>{result.strategy?.name || "Strategy"} · {result.currentState || "WAITING"}</strong></div>
    <div style={{ display: "grid", gap: 8 }}>
      {stages.map((stage, index) => <div key={`${stage.label}-${index}`} style={{ display: "grid", gridTemplateColumns: "minmax(145px, 0.32fr) 1fr", gap: 12, padding: "9px 0", borderTop: index ? "1px solid rgba(148,163,184,.12)" : undefined }}><strong>{stage.label}:</strong><span>{stage.value}</span></div>)}
    </div>
  </section>;
}

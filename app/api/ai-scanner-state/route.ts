import { POST as runScanner } from "../ai-scanner/route";
import { createClient } from "../../../lib/supabase/server";
import { ANALYZER_STRATEGY_MAP } from "../../../lib/strategies/analyzerProfiles";

export const runtime = "nodejs";

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

type StoredLifecycle = {
  key: string;
  direction: "BUY" | "SELL";
  actualEntry: number;
  projectedEntry: number | null;
  projectedStopLoss: number | null;
  projectedTp1: number | null;
  projectedTp2: number | null;
  projectedFinalTp: number | null;
  status: string;
};

type AnalyzerStrategy = (typeof ANALYZER_STRATEGY_MAP)[keyof typeof ANALYZER_STRATEGY_MAP];

function getAnalyzerStrategy(strategy: string): AnalyzerStrategy | undefined {
  if (!Object.prototype.hasOwnProperty.call(ANALYZER_STRATEGY_MAP, strategy)) return undefined;
  return ANALYZER_STRATEGY_MAP[strategy as keyof typeof ANALYZER_STRATEGY_MAP];
}

function hashKey(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return `vt_ai_${(hash >>> 0).toString(36)}`;
}
function cookieValue(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") || "";
  const part = header.split(";").map(v => v.trim()).find(v => v.startsWith(`${name}=`));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : null;
}
function parseStored(request: Request, name: string): StoredLifecycle | null {
  const raw = cookieValue(request, name); if (!raw) return null;
  try { const parsed = JSON.parse(raw) as StoredLifecycle; return parsed && typeof parsed.key === "string" && finite(parsed.actualEntry) ? parsed : null; } catch { return null; }
}
function setCookie(name: string, value: string, maxAge: number): string { return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax`; }

async function getLatestSetup(supabase: any, userId: string, strategy: string, symbol: string, timeframe: string) {
  const { data } = await supabase.from("scanner_setup_history").select("*").eq("auth_user_id", userId).eq("strategy_id", strategy).eq("canonical_symbol", symbol).eq("timeframe", timeframe).order("last_seen_at", { ascending: false }).limit(1).maybeSingle();
  return data ?? null;
}

async function closePreviousLifecycle(supabase: any, userId: string, strategy: string, symbol: string, timeframe: string, oppositeDirection: "BUY" | "SELL") {
  const now = new Date().toISOString();
  await supabase.from("scanner_setup_history").update({ state: "INVALIDATED", completed_at: now, outcome: "OPPOSITE_SETUP", reason: `Previous setup invalidated by confirmed opposite ${oppositeDirection} setup on ${timeframe}.`, last_seen_at: now }).eq("auth_user_id", userId).eq("strategy_id", strategy).eq("canonical_symbol", symbol).eq("timeframe", timeframe).in("state", ["ACTIVE", "CONFIRMED", "ENTRY_ZONE", "WATCH"]);
  await supabase.from("scanner_signals").update({ status: "CYCLE_COMPLETE", completed_at: now, updated_at: now }).eq("auth_user_id", userId).eq("strategy_id", strategy).eq("canonical_symbol", symbol).eq("timeframe", timeframe).in("status", ["CONFIRMED", "ACTIVE"]);
}

async function closeStopLifecycle(supabase: any, userId: string, strategy: string, symbol: string, timeframe: string) {
  const now = new Date().toISOString();
  await supabase.from("scanner_signals").update({ status: "INVALIDATED", completed_at: now, updated_at: now }).eq("auth_user_id", userId).eq("strategy_id", strategy).eq("canonical_symbol", symbol).eq("timeframe", timeframe).in("status", ["CONFIRMED", "ACTIVE"]);
}

async function publishConfirmedSignal(supabase: any, userId: string, analysis: any, scanner: any, strategy: string) {
  const direction = scanner?.projectedDirection === "BUY" || scanner?.projectedDirection === "SELL" ? scanner.projectedDirection : null;
  const timeframe = typeof analysis?.market?.timeframe === "string" ? analysis.market.timeframe : "";
  const symbol = typeof analysis?.market?.asset === "string" ? analysis.market.asset.trim().toUpperCase() : "";
  const selectedStrategy = getAnalyzerStrategy(strategy);
  const confirmed = direction !== null && scanner?.strategyConditionsMet === true && scanner?.entryConfirmation === true && finite(scanner?.actualEntry) && selectedStrategy !== undefined;
  if (!confirmed || !symbol || !timeframe) return { scanner, published: false };

  const entry = scanner.actualEntry;
  const stopLoss = finite(scanner?.stopLoss) ? scanner.stopLoss : null;
  const tp1 = finite(scanner?.tp1) ? scanner.tp1 : null;
  const tp2 = finite(scanner?.tp2) ? scanner.tp2 : null;
  const tp3 = finite(scanner?.tp3) ? scanner.tp3 : null;
  const tp4 = finite(scanner?.tp4) ? scanner.tp4 : null;
  const latest = await getLatestSetup(supabase, userId, strategy, symbol, timeframe);
  const previousDirection = latest?.direction === "BUY" || latest?.direction === "SELL" ? latest.direction : null;
  if (previousDirection && previousDirection !== direction) await closePreviousLifecycle(supabase, userId, strategy, symbol, timeframe, direction);

  const confirmationTimeframe = typeof scanner?.confirmation?.confirmationTimeframe === "string"
    ? scanner.confirmation.confirmationTimeframe
    : typeof scanner?.confirmationTimeframe === "string" ? scanner.confirmationTimeframe : "";
  const confirmationPrice = finite(scanner?.confirmationPrice) ? scanner.confirmationPrice : entry;
  const setupIdentity = {
    canonical_symbol: symbol,
    direction,
    strategy_id: selectedStrategy.id,
    timeframe,
    confirmation_timeframe: confirmationTimeframe,
    confirmation_price: confirmationPrice,
  };
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(setupIdentity)));
  const fingerprint = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
  const { data: existing } = await supabase.from("scanner_signals").select("*").eq("auth_user_id", userId).eq("signal_fingerprint", fingerprint).maybeSingle();
  const now = new Date().toISOString();
  let signal = existing;

  if (!existing) {
    const tradeId = `VT-${Date.now()}-${symbol.replace(/[^A-Z0-9]/gi, "")}-${timeframe.toUpperCase()}`;
    const row = {
      auth_user_id: userId, trade_id: tradeId, signal_fingerprint: fingerprint,
      market_category: typeof analysis?.market?.category === "string" ? analysis.market.category.toUpperCase() : "FOREX",
      canonical_symbol: symbol, direction, strategy_id: selectedStrategy.id, strategy_name: selectedStrategy.name, timeframe,
      entry, stop_loss: stopLoss, tp1, tp2, tp3, tp4,
      confidence: finite(scanner?.projectedProbability) ? scanner.projectedProbability : null, rr: finite(scanner?.rr) ? scanner.rr : null, status: "ACTIVE",
      confirmation_conditions: Array.isArray(scanner?.confirmations) ? scanner.confirmations : [], missing_conditions: [],
      execution_payload: { trade_id: tradeId, symbol, side: direction, entry, stop_loss: stopLoss, take_profit: tp1, strategy: selectedStrategy.id, strategy_id: selectedStrategy.id, strategy_name: selectedStrategy.name, timeframe, status: "ACTIVE", execution_enabled: false, execution_provider: "MetaKit", authority: "SELECTED_STRATEGY" },
      source_snapshot: { ...(typeof scanner === "object" && scanner ? scanner : {}), strategy_id: selectedStrategy.id, strategy_name: selectedStrategy.name, authoritative_confirmation: "SELECTED_STRATEGY_ENTRY_CONFIRMATION" },
      fired_at: now, completed_at: null, updated_at: now,
    };
    const inserted = await supabase.from("scanner_signals").insert(row).select("*").single(); signal = inserted.data ?? null;
  }

  const normalizedScanner = {
    ...scanner, projectedDirection: direction, analysisState: "ACTIVE", isExecutable: true, actualEntry: entry,
    projectedEntry: finite(scanner?.projectedEntry) ? scanner.projectedEntry : entry, stopLoss, projectedStopLoss: stopLoss,
    tp1, projectedTp1: tp1, tp2, projectedTp2: tp2, tp3, projectedTp3: tp3, tp4, projectedTp4: tp4,
    cycleStatus: "ACTIVE", tp1Hit: false, stopHit: false, statusMessage: `ACTIVE ${direction} — ${timeframe}`,
    tradeReason: "Entry Confirmation: YES — published from the selected strategy entry trigger.",
    invalidation: "Lifecycle ends only on actual SL or a confirmed opposite setup on the same timeframe.",
  };
  return { scanner: normalizedScanner, published: Boolean(signal && !existing) };
}

async function persistSetupHistory(input: { strategy: string; analysis: any; scanner: any }) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
  const analysis = input.analysis ?? {}; const scanner = input.scanner ?? {};
  const market = typeof analysis?.market?.asset === "string" ? analysis.market.asset.trim().toUpperCase() : "";
  const timeframe = typeof analysis?.market?.timeframe === "string" ? analysis.market.timeframe.trim() : "";
  const direction = scanner?.projectedDirection === "BUY" || scanner?.projectedDirection === "SELL" ? scanner.projectedDirection : "NO TRADE";
  if (!input.strategy || !market || !timeframe || direction === "NO TRADE") return;
  const strategyName = typeof analysis?.strategyName === "string" ? analysis.strategyName : getAnalyzerStrategy(input.strategy)?.name ?? null;
  const projectedEntry = finite(scanner?.projectedEntry) ? scanner.projectedEntry : finite(scanner?.entry) ? scanner.entry : null;
  const projectedStopLoss = finite(scanner?.projectedStopLoss) ? scanner.projectedStopLoss : finite(scanner?.stopLoss) ? scanner.stopLoss : null;
  const projectedTp1 = finite(scanner?.projectedTp1) ? scanner.projectedTp1 : finite(scanner?.tp1) ? scanner.tp1 : null;
  const projectedTp2 = finite(scanner?.projectedTp2) ? scanner.projectedTp2 : finite(scanner?.tp2) ? scanner.tp2 : null;
  const projectedTp3 = finite(scanner?.projectedTp3) ? scanner.projectedTp3 : finite(scanner?.tp3) ? scanner.tp3 : null;
  const projectedTp4 = finite(scanner?.projectedTp4) ? scanner.projectedTp4 : finite(scanner?.tp4) ? scanner.tp4 : null;
  const actualEntry = finite(scanner?.actualEntry) ? scanner.actualEntry : null;
  const status = typeof scanner?.cycleStatus === "string" ? scanner.cycleStatus : typeof scanner?.analysisState === "string" ? scanner.analysisState : "PROJECTED";
  const setupKey = `${input.strategy}|${market}|${timeframe}|${direction}|${projectedEntry ?? "na"}`; const now = new Date().toISOString();
  const { data: existing } = await supabase.from("scanner_setup_history").select("id,first_seen_at,confirmed_at,completed_at,state,direction").eq("auth_user_id", user.id).eq("setup_key", setupKey).maybeSingle();
  const completed = status === "INVALIDATED" || status === "CYCLE_COMPLETE";
  const row = {
    auth_user_id: user.id, setup_key: setupKey, strategy_id: input.strategy, strategy_name: strategyName,
    market_category: typeof analysis?.market?.category === "string" ? analysis.market.category.toUpperCase() : "FOREX",
    canonical_symbol: market, timeframe, direction, projected_entry: projectedEntry, projected_stop_loss: projectedStopLoss,
    projected_tp1: projectedTp1, projected_tp2: projectedTp2, projected_tp3: projectedTp3, projected_tp4: projectedTp4,
    state: actualEntry !== null ? (completed ? status : "ACTIVE") : status,
    confirmation_conditions: Array.isArray(scanner?.confirmations) ? scanner.confirmations : [],
    missing_conditions: Array.isArray(scanner?.missingConditions) ? scanner.missingConditions : [],
    reason: typeof scanner?.waitReason === "string" ? scanner.waitReason : typeof scanner?.tradeReason === "string" ? scanner.tradeReason : null,
    last_seen_at: now, confirmed_at: existing?.confirmed_at ?? (actualEntry !== null ? now : null),
    completed_at: existing?.completed_at ?? (completed ? now : null), outcome: completed ? "OPPOSITE_SETUP" : null, snapshot: scanner,
  };
  if (existing) await supabase.from("scanner_setup_history").update(row).eq("id", existing.id); else await supabase.from("scanner_setup_history").insert(row);
}

export async function POST(request: Request) {
  const originalBody = await request.json(); const analysis = originalBody?.analysis ?? {};
  const strategy = typeof originalBody?.strategy === "string" ? originalBody.strategy : "";
  const asset = typeof analysis?.market?.asset === "string" ? analysis.market.asset : "";
  const timeframe = typeof analysis?.market?.timeframe === "string" ? analysis.market.timeframe : "";
  const key = `${strategy}|${asset}|${timeframe}`; const cookieName = hashKey(key); const stored = parseStored(request, cookieName);
  const analysisDirection = analysis?.direction === "BUY" || analysis?.direction === "SELL" ? analysis.direction : null;
  const analysisEntry = finite(analysis?.entry) ? analysis.entry : null;
  const strategyConfirmed = analysis?.decision === "TRADE" && analysisDirection && analysisEntry !== null;

  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  const persistentSetup = user && asset && strategy && timeframe ? await getLatestSetup(supabase, user.id, strategy, asset.trim().toUpperCase(), timeframe) : null;
  const priorDirection = persistentSetup?.direction === "BUY" || persistentSetup?.direction === "SELL" ? persistentSetup.direction : stored?.direction ?? null;
  const lifecycle = {
    actualEntry: stored?.actualEntry ?? null, projectedEntry: stored?.projectedEntry ?? null, projectedStopLoss: stored?.projectedStopLoss ?? null,
    projectedTp1: stored?.projectedTp1 ?? null, projectedTp2: stored?.projectedTp2 ?? null, projectedFinalTp: stored?.projectedFinalTp ?? null,
    status: stored?.status ?? persistentSetup?.state ?? "WATCH", tp1Hit: false, stopHit: false, cycleComplete: false,
    priorDirection, oppositeConfirmed: Boolean(strategyConfirmed && priorDirection && analysisDirection && priorDirection !== analysisDirection),
  };

  const scannerResponse = await runScanner(new Request(request.url, { method: "POST", headers: request.headers, body: JSON.stringify({ ...originalBody, lifecycle }) }));
  const text = await scannerResponse.text(); let payload: any;
  try { payload = JSON.parse(text); } catch { return new Response(text, { status: scannerResponse.status, headers: scannerResponse.headers }); }
  let scanner = payload?.scanner ?? payload;

  let published = false;
  if (user) {
    const publication = await publishConfirmedSignal(supabase, user.id, analysis, scanner, strategy);
    scanner = publication.scanner; published = publication.published;
    if (scanner?.cycleStatus === "INVALIDATED" && stored?.actualEntry) await closeStopLifecycle(supabase, user.id, strategy, asset.trim().toUpperCase(), timeframe);
  }

  await persistSetupHistory({ strategy, analysis, scanner });
  const returnedActualEntry = finite(scanner?.actualEntry) ? scanner.actualEntry : null;
  const returnedDirection = scanner?.projectedDirection === "BUY" || scanner?.projectedDirection === "SELL" ? scanner.projectedDirection : null;
  const responseHeaders = new Headers(scannerResponse.headers);
  if (returnedActualEntry !== null && returnedDirection) {
    const record: StoredLifecycle = { key, direction: returnedDirection, actualEntry: returnedActualEntry, projectedEntry: finite(scanner?.projectedEntry) ? scanner.projectedEntry : stored?.projectedEntry ?? null, projectedStopLoss: finite(scanner?.projectedStopLoss) ? scanner.projectedStopLoss : stored?.projectedStopLoss ?? null, projectedTp1: finite(scanner?.projectedTp1) ? scanner.projectedTp1 : stored?.projectedTp1 ?? null, projectedTp2: finite(scanner?.projectedTp2) ? scanner.projectedTp2 : stored?.projectedTp2 ?? null, projectedFinalTp: finite(scanner?.projectedFinalTp) ? scanner.projectedFinalTp : stored?.projectedFinalTp ?? null, status: "ACTIVE" };
    responseHeaders.append("Set-Cookie", setCookie(cookieName, JSON.stringify(record), 60 * 60 * 24 * 7));
  } else if (returnedDirection === null && stored) responseHeaders.append("Set-Cookie", setCookie(cookieName, "", 0));

  return new Response(JSON.stringify({ ...payload, scanner, signalPublished: published, lifecycleSource: "PERSISTED_SETUP_HISTORY", mtfLifecycle: "M5_INDEPENDENT_M15_STRONGER" }), { status: scannerResponse.status, headers: responseHeaders });
}

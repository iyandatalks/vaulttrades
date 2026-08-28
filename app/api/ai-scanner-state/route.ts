import { POST as runScanner } from "../ai-scanner/route";
import { createClient } from "../../../lib/supabase/server";

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
  tp1Hit: boolean;
  stopHit: boolean;
};

function hashKey(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `vt_ai_${(hash >>> 0).toString(36)}`;
}

function cookieValue(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") || "";
  const part = header.split(";").map(v => v.trim()).find(v => v.startsWith(`${name}=`));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : null;
}

function parseStored(request: Request, name: string): StoredLifecycle | null {
  const raw = cookieValue(request, name);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredLifecycle;
    return parsed && typeof parsed.key === "string" && finite(parsed.actualEntry) ? parsed : null;
  } catch {
    return null;
  }
}

function setCookie(name: string, value: string, maxAge: number): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax`;
}

async function persistSetupHistory(request: Request, input: { strategy: string; analysis: any; scanner: any }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const analysis = input.analysis ?? {};
  const scanner = input.scanner ?? {};
  const market = typeof analysis?.market?.asset === "string" ? analysis.market.asset.trim().toUpperCase() : "";
  const timeframe = typeof analysis?.market?.timeframe === "string" ? analysis.market.timeframe.trim() : "";
  const direction = scanner?.projectedDirection === "BUY" || scanner?.projectedDirection === "SELL" ? scanner.projectedDirection : "NO TRADE";
  if (!input.strategy || !market || !timeframe || direction === "NO TRADE") return;

  const strategyName = typeof analysis?.strategyName === "string" ? analysis.strategyName : null;
  const projectedEntry = finite(scanner?.projectedEntry) ? scanner.projectedEntry : finite(scanner?.entry) ? scanner.entry : null;
  const projectedStopLoss = finite(scanner?.projectedStopLoss) ? scanner.projectedStopLoss : finite(scanner?.stopLoss) ? scanner.stopLoss : null;
  const projectedTp1 = finite(scanner?.projectedTp1) ? scanner.projectedTp1 : finite(scanner?.tp1) ? scanner.tp1 : null;
  const projectedTp2 = finite(scanner?.projectedTp2) ? scanner.projectedTp2 : finite(scanner?.tp2) ? scanner.tp2 : null;
  const projectedTp3 = finite(scanner?.projectedTp3) ? scanner.projectedTp3 : finite(scanner?.tp3) ? scanner.tp3 : null;
  const projectedTp4 = finite(scanner?.projectedTp4) ? scanner.projectedTp4 : finite(scanner?.tp4) ? scanner.tp4 : null;
  const actualEntry = finite(scanner?.actualEntry) ? scanner.actualEntry : null;
  const status = typeof scanner?.cycleStatus === "string" ? scanner.cycleStatus : typeof scanner?.analysisState === "string" ? scanner.analysisState : "PROJECTED";
  const completed = status === "TP1_HIT" || status === "SL_HIT" || status === "CYCLE_COMPLETE";
  const outcome = status === "TP1_HIT" ? "TP1" : status === "SL_HIT" ? "SL" : status === "CYCLE_COMPLETE" ? "CYCLE_COMPLETE" : null;
  const setupKey = `${input.strategy}|${market}|${timeframe}|${direction}|${projectedEntry ?? "na"}`;

  const row = {
    auth_user_id: user.id,
    setup_key: setupKey,
    strategy_id: input.strategy,
    strategy_name: strategyName,
    market_category: typeof analysis?.market?.category === "string" ? analysis.market.category.toUpperCase() : "FOREX",
    canonical_symbol: market,
    timeframe,
    direction,
    projected_entry: projectedEntry,
    projected_stop_loss: projectedStopLoss,
    projected_tp1: projectedTp1,
    projected_tp2: projectedTp2,
    projected_tp3: projectedTp3,
    projected_tp4: projectedTp4,
    state: actualEntry !== null ? (completed ? status : "ACTIVE") : status,
    confirmation_conditions: Array.isArray(scanner?.confirmations) ? scanner.confirmations : [],
    missing_conditions: Array.isArray(scanner?.missingConditions) ? scanner.missingConditions : [],
    reason: typeof scanner?.waitReason === "string" ? scanner.waitReason : typeof scanner?.tradeReason === "string" ? scanner.tradeReason : null,
    last_seen_at: new Date().toISOString(),
    confirmed_at: actualEntry !== null ? new Date().toISOString() : null,
    completed_at: completed ? new Date().toISOString() : null,
    outcome,
    snapshot: scanner,
  };

  const { data: existing } = await supabase
    .from("scanner_setup_history")
    .select("id,first_seen_at,confirmed_at,completed_at")
    .eq("auth_user_id", user.id)
    .eq("setup_key", setupKey)
    .maybeSingle();

  const update = { ...row, confirmed_at: existing?.confirmed_at ?? row.confirmed_at, completed_at: existing?.completed_at ?? row.completed_at };
  if (existing) await supabase.from("scanner_setup_history").update(update).eq("id", existing.id);
  else await supabase.from("scanner_setup_history").insert(row);
}

export async function POST(request: Request) {
  const originalBody = await request.json();
  const analysis = originalBody?.analysis ?? {};
  const strategy = typeof originalBody?.strategy === "string" ? originalBody.strategy : "";
  const asset = typeof analysis?.market?.asset === "string" ? analysis.market.asset : "";
  const timeframe = typeof analysis?.market?.timeframe === "string" ? analysis.market.timeframe : "";
  const key = `${strategy}|${asset}|${timeframe}`;
  const cookieName = hashKey(key);
  const stored = parseStored(request, cookieName);

  const analysisDirection = analysis?.direction === "BUY" || analysis?.direction === "SELL" ? analysis.direction : null;
  const analysisEntry = finite(analysis?.entry) ? analysis.entry : null;
  const newConfirmedEntry = Boolean(
    stored && analysis?.decision === "TRADE" && analysisDirection && analysisEntry !== null &&
    (analysisDirection !== stored.direction || Math.abs(analysisEntry - stored.actualEntry) > 1e-8),
  );

  const lifecycle = stored && !newConfirmedEntry ? {
    actualEntry: stored.actualEntry,
    projectedEntry: stored.projectedEntry,
    projectedStopLoss: stored.projectedStopLoss,
    projectedTp1: stored.projectedTp1,
    projectedTp2: stored.projectedTp2,
    projectedFinalTp: stored.projectedFinalTp,
    status: stored.status,
    tp1Hit: stored.tp1Hit,
    stopHit: stored.stopHit,
    cycleComplete: false,
  } : originalBody?.lifecycle ?? {};

  const scannerRequest = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify({ ...originalBody, lifecycle }),
  });

  const scannerResponse = await runScanner(scannerRequest);
  const text = await scannerResponse.text();
  let payload: any;
  try { payload = JSON.parse(text); }
  catch { return new Response(text, { status: scannerResponse.status, headers: scannerResponse.headers }); }

  const scanner = payload?.scanner ?? payload;
  await persistSetupHistory(request, { strategy, analysis, scanner });

  const returnedActualEntry = finite(scanner?.actualEntry) ? scanner.actualEntry : null;
  const returnedDirection = scanner?.projectedDirection === "BUY" || scanner?.projectedDirection === "SELL" ? scanner.projectedDirection : null;
  const returnedStatus = typeof scanner?.cycleStatus === "string" ? scanner.cycleStatus : typeof scanner?.analysisState === "string" ? scanner.analysisState : "";
  const stopHit = scanner?.stopHit === true || returnedStatus === "SL_HIT";
  const cycleComplete = returnedStatus === "CYCLE_COMPLETE" || returnedStatus === "TP1_HIT";

  const responseHeaders = new Headers(scannerResponse.headers);
  if (stopHit || cycleComplete) {
    responseHeaders.append("Set-Cookie", setCookie(cookieName, "", 0));
  } else if (returnedActualEntry !== null && returnedDirection) {
    const record: StoredLifecycle = {
      key, direction: returnedDirection, actualEntry: returnedActualEntry,
      projectedEntry: finite(scanner?.projectedEntry) ? scanner.projectedEntry : stored?.projectedEntry ?? null,
      projectedStopLoss: finite(scanner?.projectedStopLoss) ? scanner.projectedStopLoss : stored?.projectedStopLoss ?? null,
      projectedTp1: finite(scanner?.projectedTp1) ? scanner.projectedTp1 : stored?.projectedTp1 ?? null,
      projectedTp2: finite(scanner?.projectedTp2) ? scanner.projectedTp2 : stored?.projectedTp2 ?? null,
      projectedFinalTp: finite(scanner?.projectedFinalTp) ? scanner.projectedFinalTp : stored?.projectedFinalTp ?? null,
      status: returnedStatus || "ACTIVE", tp1Hit: scanner?.tp1Hit === true, stopHit: false,
    };
    responseHeaders.append("Set-Cookie", setCookie(cookieName, JSON.stringify(record), 60 * 60 * 24 * 7));
  }

  return new Response(JSON.stringify(payload), { status: scannerResponse.status, headers: responseHeaders });
}

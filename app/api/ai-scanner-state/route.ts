import { POST as runScanner } from "../ai-scanner/route";

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
    stored &&
    analysis?.decision === "TRADE" &&
    analysisDirection &&
    analysisEntry !== null &&
    (analysisDirection !== stored.direction || Math.abs(analysisEntry - stored.actualEntry) > 1e-8),
  );

  const lifecycle = stored && !newConfirmedEntry
    ? {
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
      }
    : originalBody?.lifecycle ?? {};

  const scannerRequest = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify({ ...originalBody, lifecycle }),
  });

  const scannerResponse = await runScanner(scannerRequest);
  const text = await scannerResponse.text();
  let payload: any;
  try {
    payload = JSON.parse(text);
  } catch {
    return new Response(text, { status: scannerResponse.status, headers: scannerResponse.headers });
  }

  const scanner = payload?.scanner ?? payload;
  const returnedActualEntry = finite(scanner?.actualEntry) ? scanner.actualEntry : null;
  const returnedDirection = scanner?.projectedDirection === "BUY" || scanner?.projectedDirection === "SELL" ? scanner.projectedDirection : null;
  const returnedStatus = typeof scanner?.cycleStatus === "string" ? scanner.cycleStatus : typeof scanner?.analysisState === "string" ? scanner.analysisState : "";
  const stopHit = scanner?.stopHit === true || returnedStatus === "SL_HIT";
  const cycleComplete = returnedStatus === "CYCLE_COMPLETE";

  const responseHeaders = new Headers(scannerResponse.headers);
  if (stopHit || cycleComplete) {
    responseHeaders.append("Set-Cookie", setCookie(cookieName, "", 0));
  } else if (returnedActualEntry !== null && returnedDirection) {
    const record: StoredLifecycle = {
      key,
      direction: returnedDirection,
      actualEntry: returnedActualEntry,
      projectedEntry: finite(scanner?.projectedEntry) ? scanner.projectedEntry : stored?.projectedEntry ?? null,
      projectedStopLoss: finite(scanner?.projectedStopLoss) ? scanner.projectedStopLoss : stored?.projectedStopLoss ?? null,
      projectedTp1: finite(scanner?.projectedTp1) ? scanner.projectedTp1 : stored?.projectedTp1 ?? null,
      projectedTp2: finite(scanner?.projectedTp2) ? scanner.projectedTp2 : stored?.projectedTp2 ?? null,
      projectedFinalTp: finite(scanner?.projectedFinalTp) ? scanner.projectedFinalTp : stored?.projectedFinalTp ?? null,
      status: returnedStatus || "ACTIVE",
      tp1Hit: scanner?.tp1Hit === true,
      stopHit: false,
    };
    responseHeaders.append("Set-Cookie", setCookie(cookieName, JSON.stringify(record), 60 * 60 * 24 * 7));
  }

  return new Response(JSON.stringify(payload), {
    status: scannerResponse.status,
    headers: responseHeaders,
  });
}

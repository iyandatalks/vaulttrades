import { scanVaultAutoFib, VAULT_AUTO_FIB_CRYPTO_SYMBOLS, VAULT_AUTO_FIB_FOREX_SYMBOLS } from "../../../../lib/scanner-automation/vaultAutoFib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: Request) {
  return process.env.VERCEL_ENV === "preview"
    && process.env.VERCEL_GIT_COMMIT_REF === "fib-signal-audit"
    && new URL(request.url).searchParams.get("audit") === "1";
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: "Preview audit endpoint only." }, { status: 401 });

  const symbols = [...VAULT_AUTO_FIB_FOREX_SYMBOLS, ...VAULT_AUTO_FIB_CRYPTO_SYMBOLS];
  const startedAt = Date.now();
  try {
    const signals = await scanVaultAutoFib(symbols);
    return Response.json({
      status: "COMPLETED",
      symbolsScanned: symbols,
      symbolsCount: symbols.length,
      signalsDetected: signals.length,
      signals,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    return Response.json({
      status: "FAILED",
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    }, { status: 500 });
  }
}

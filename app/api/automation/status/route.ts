export const runtime = "nodejs";

const enabled = (name: string, fallback: boolean) => {
  const value = process.env[name]?.trim().toLowerCase();
  return value === undefined ? fallback : !["off", "false", "0", "disabled"].includes(value);
};

export async function GET() {
  return Response.json({
    engine: "AUTOMATED_MARKET_ENGINE",
    executionEnabled: false,
    markets: {
      FOREX: enabled("VAULT_AUTOMATION_FOREX", true),
      CRYPTO: enabled("VAULT_AUTOMATION_CRYPTO", true),
    },
    strategies: {
      adaptiveExecution: enabled("VAULT_AUTOMATION_ADAPTIVE", true),
      ema20: enabled("VAULT_AUTOMATION_EMA", false),
    },
    emaAutomationWindow: {
      timezone: "Africa/Johannesburg",
      start: process.env.VAULT_EMA_START ?? "01:30",
      lastSignal: process.env.VAULT_EMA_LAST_SIGNAL ?? "08:45",
      timeframe: (process.env.VAULT_EMA_TIMEFRAME ?? "M5").toUpperCase(),
    },
    note: "ON/OFF controls automation publication only. The underlying strategy engines continue to be observable independently of the Analyzer UI.",
  });
}

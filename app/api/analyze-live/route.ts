import { ANALYZER_STRATEGY_MAP, type IndicatorName } from "../../../lib/strategies/analyzerProfiles";
import { getStrategyRules, type StrategyId } from "../../../lib/strategies";
import { buildAnalyzerMarketContext } from "../../../lib/market-data/indicators";
import { getTwelveDataTimeSeries } from "../../../lib/market-data/twelvedata";
import { getMarketProviderRoute, type MarketType } from "../../../lib/market-data/provider";

export const runtime = "nodejs";

const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1H", "4H", "1D", "1W", "1M"] as const;
type Direction = "BUY" | "SELL" | "NO TRADE";
type Decision = "TRADE" | "NO TRADE";
const MARKET_TYPES: MarketType[] = ["FOREX", "INDICES", "CRYPTO", "STOCKS", "SYNTHETIC"];
const INDICATORS: IndicatorName[] = ["SMA", "EMA", "Ichimoku", "Bollinger Bands", "ATR", "VWAP", "Supertrend", "SAR", "RSI", "MACD", "KST", "Stochastic", "ADX", "Percent B", "MFI", "DPO", "RVOL", "A/D", "SMI"];

const num = (v: unknown) => { const n = typeof v === "number" ? v : Number(v); return Number.isFinite(n) ? n : null; };
const arr = (v: unknown) => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map(x => x.trim()).filter(Boolean) : [];
const validTimeframes = (v: unknown) => Array.isArray(v) ? v.filter((x): x is (typeof TIMEFRAMES)[number] => typeof x === "string" && TIMEFRAMES.includes(x as any)).slice(0, 2) : [];
const validIndicators = (v: unknown): IndicatorName[] => Array.isArray(v) ? v.filter((x): x is IndicatorName => typeof x === "string" && INDICATORS.includes(x as IndicatorName)).slice(0, 20) : [];
const validMarketType = (v: unknown): MarketType => typeof v === "string" && MARKET_TYPES.includes(v as MarketType) ? v as MarketType : "FOREX";

function parseJsonField(form: FormData, key: string, fallback: unknown) { try { return JSON.parse(String(form.get(key) || JSON.stringify(fallback))); } catch { return fallback; } }

function tradeMath(direction: Direction, entry: number | null, sl: number | null, tp: number | null, current: number | null) {
  if (!entry || sl === null || tp === null || (direction !== "BUY" && direction !== "SELL")) return { valid: false, risk: null, reward: null, rr: null, slPct: null, entryDistancePct: null, reason: "Entry, SL and TP are incomplete." };
  const risk = direction === "BUY" ? entry - sl : sl - entry;
  const reward = direction === "BUY" ? tp - entry : entry - tp;
  const rr = risk > 0 ? reward / risk : null;
  const slPct = Math.abs(entry - sl) / Math.abs(entry) * 100;
  const entryDistancePct = current && current !== 0 ? Math.abs(entry - current) / Math.abs(current) * 100 : null;
  const valid = risk > 0 && reward > 0 && slPct >= 0.1 && (entryDistancePct === null || entryDistancePct <= 0.5) && rr !== null && rr >= 2;
  const reason = !risk || !reward ? "Entry/SL/TP geometry is invalid." : slPct < 0.1 ? "SL is less than 0.1% from entry." : entryDistancePct !== null && entryDistancePct > 0.5 ? "Entry is more than 0.5% from current price." : rr! < 2 ? "R:R is below 1:2." : "All measurable price-level gates passed.";
  return { valid, risk, reward, rr, slPct, entryDistancePct, reason };
}

function normalizeSymbol(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (s === "GOLD" || s === "XAU") return "XAU/USD";
  if (s === "SILVER" || s === "XAG") return "XAG/USD";
  if (s === "BITCOIN" || s === "BTC") return "BTC/USD";
  if (s === "ETHEREUM" || s === "ETH") return "ETH/USD";
  return s.replace("/", "/");
}

async function identifyAsset(apiKey: string, imageUrl: string, marketType: MarketType): Promise<{ symbol: string; asset: string }> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: [{ role: "user", content: [{ type: "input_text", text: `Inspect this trading chart only to identify the visible instrument/symbol. The user selected market type ${marketType}. Return the exact visible symbol if readable, otherwise a likely standard symbol appropriate to that market (Forex: EUR/USD; Indices: NAS100/US30/SPX; Crypto: BTC/USD; Stocks: AAPL). Never invent a symbol when the chart does not show one.` }, { type: "input_image", image_url: imageUrl }] }],
      max_output_tokens: 300,
      text: { format: { type: "json_schema", name: "asset_identifier", strict: true, schema: { type: "object", additionalProperties: false, properties: { symbol: { type: "string" }, asset: { type: "string" } }, required: ["symbol", "asset"] } } },
    }),
  });
  if (!response.ok) return { symbol: "", asset: "Unknown" };
  const raw = await response.json();
  const text = raw.output?.flatMap((x: any) => x.content ?? []).filter((x: any) => x.type === "output_text").map((x: any) => x.text).join("").trim();
  if (!text) return { symbol: "", asset: "Unknown" };
  try { const parsed = JSON.parse(text); return { symbol: normalizeSymbol(String(parsed.symbol || "")), asset: String(parsed.asset || parsed.symbol || "Unknown") }; } catch { return { symbol: "", asset: "Unknown" }; }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const image = form.get("image");
    const strategyId = String(form.get("strategy") || "");
    const selectedTimeframes = validTimeframes(parseJsonField(form, "timeframes", []));
    const marketType = validMarketType(form.get("marketType"));
    const indicatorMode = String(form.get("indicatorMode") || "AUTO") === "MANUAL" ? "MANUAL" : "AUTO";
    const manualIndicators = validIndicators(parseJsonField(form, "manualIndicators", []));
    if (!(image instanceof File)) return Response.json({ error: "Chart image is required." }, { status: 400 });
    if (!ANALYZER_STRATEGY_MAP[strategyId]) return Response.json({ error: "Invalid strategy selected." }, { status: 400 });
    if (!selectedTimeframes.length) return Response.json({ error: "Select at least one timeframe." }, { status: 400 });

    const profile = ANALYZER_STRATEGY_MAP[strategyId];
    const selectedIndicators = indicatorMode === "AUTO" ? profile.defaultIndicators : manualIndicators;
    const sourceRules = profile.sourceIds.map((id: StrategyId) => getStrategyRules(id));
    const providerRoute = getMarketProviderRoute(marketType);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return Response.json({ error: "OpenAI API key is not configured." }, { status: 500 });

    const bytes = await image.arrayBuffer();
    const imageUrl = `data:${image.type || "image/png"};base64,${Buffer.from(bytes).toString("base64")}`;
    const higher = selectedTimeframes.length === 2 ? selectedTimeframes[1] : selectedTimeframes[0];
    const lower = selectedTimeframes[0];

    // Market selection controls the provider. Strategy selection controls the
    // indicator/evidence set. These concerns intentionally remain separate.
    const identified = marketType === "SYNTHETIC"
      ? { symbol: "", asset: "Synthetic index" }
      : await identifyAsset(apiKey, imageUrl, marketType);

    let marketData: Awaited<ReturnType<typeof getTwelveDataTimeSeries>> | null = null;
    let marketContext: ReturnType<typeof buildAnalyzerMarketContext> | null = null;
    let marketDataError = providerRoute.available ? "" : (providerRoute.reason || "Market-data provider unavailable.");

    if (providerRoute.available && identified.symbol) {
      try {
        marketData = await getTwelveDataTimeSeries({ symbol: identified.symbol, timeframe: lower, outputsize: 250 });
        marketContext = buildAnalyzerMarketContext(marketData.candles, marketData.symbol, lower, selectedIndicators);
      } catch (error) {
        marketDataError = error instanceof Error ? error.message : "Twelve Data unavailable.";
      }
    } else if (providerRoute.available) {
      marketDataError = "Instrument could not be identified reliably from the chart.";
    }

    const marketEvidence = marketContext ? JSON.stringify({
      provider: providerRoute.provider,
      marketType,
      symbol: marketContext.symbol,
      timeframe: marketContext.timeframe,
      currentPrice: marketContext.currentPrice,
      candles: marketContext.candles,
      structure: marketContext.structure,
      volatility: marketContext.volatility,
      selectedIndicators: marketContext.selectedIndicators,
    }) : JSON.stringify({ provider: providerRoute.provider, marketType, unavailable: true, reason: marketDataError });

    const prompt = `You are VaultTrades Analyzer. The screenshot is visual evidence; the selected market-data provider is the deterministic data layer. Never pretend an indicator was read from the screenshot when a calculated provider value is available.

MARKET TYPE: ${marketType}
MARKET DATA PROVIDER: ${providerRoute.provider}
SELECTED STRATEGY: ${profile.name} (${strategyId})
CATEGORY: ${profile.category}
TIMEFRAMES: ${selectedTimeframes.join(" + ")}
HIGHER: ${higher}
LOWER: ${lower}
AUTO/MANUAL INDICATORS: ${indicatorMode}
AUTO STRATEGY INDICATORS: ${profile.defaultIndicators.join(", ") || "None"}
INDICATORS SENT TO ENGINE: ${selectedIndicators.join(", ") || "None"}
STRATEGY FOCUS: ${JSON.stringify(profile.focus)}
STRATEGY REQUIRED EVIDENCE: ${JSON.stringify((profile as any).requiredEvidence ?? [])}
AUTHORITATIVE SOURCE RULES: ${JSON.stringify(sourceRules)}
LIVE MARKET EVIDENCE: ${marketEvidence}

UNIVERSAL RULES 1–6 ARE MANDATORY FOR EVERY STRATEGY:
1. VISUAL ANALYSIS: classify actual structure; identify support/resistance and recent price action. >5 consecutive inside bars OR material conflict across 3+ visible timeframes = NO TRADE.
2. SMC: score BOS, CHoCH, Order Block, FVG, Liquidity Sweep, Displacement 1–10 with evidence. A NEW BUY/SELL requires at least TWO scores >=7. Do not invent a score merely because the strategy is SMC-like; score only evidence actually visible or derivable from the data.
3. SESSION/CONFLUENCE: identify London/NY/Asian when time permits, HTF alignment, visible/reliable news and sentiment. Asian requires >=9/10 plus major news; London/NY overlap preferred; pre-London 07:00–08:00 GMT only if exceptional.
4. PRICE VALIDATION: SL >=0.1% from entry, TP >=2x SL distance, entry <=0.5% from current price. R:R must be mathematically >=1:2. Maximum risk 1.5%; if account equity is unavailable, explicitly say sizing is unverified.
5. CONFIDENCE: 90–100 perfect/multiple strong confluences; 80–89 strong; 70–79 decent; 60–69 marginal; 50–59 weak; 30–49 poor; 10–29 very poor/image quality too low. Never inflate confidence.
6. QUALITY CHECK: re-check R:R, geometry, SL distance, entry proximity, risk sizing when measurable, SMC gate, confidence/evidence consistency and lifecycle logic.

STRATEGY LOGIC:
- The selected strategy is the primary thesis and its source module is authoritative.
- In AUTO mode, use exactly the strategy-defined indicator set above. Do not add a generic indicator bundle and do not impose a three-indicator quota.
- Structural evidence engines such as session structure, liquidity, BOS/CHoCH, order blocks, FVG and displacement are calculated/communicated separately from the technical-indicator list when required by the strategy.
- Preserve source lifecycle states. DEVELOPING/READY are not BUY/SELL. ACTIVE is not a new entry.
- Scan the full visible screenshot history and reconstruct the latest reliable strategy footprint/outcome when possible.
- Use provider values for current price, indicator readings and volatility where available. If the provider is unavailable, say so explicitly and do not claim live confirmation.
- For SYNTHETIC, do not use Twelve Data. The Synthetic/Broker provider route is intentionally separate and must be reported as unavailable until connected.

OUTPUT COMMUNICATION:
Return a useful user-facing explanation: what is happening, what the strategy sees, what is confirmed, what is missing, exact trigger, invalidation, trade geometry and next action. The UI will display a strategy-specific PIPELINE instead of “What happens next”.

Return JSON only.`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }, { type: "input_image", image_url: imageUrl }] }],
        max_output_tokens: 6500,
        text: { format: { type: "json_schema", name: "vaulttrades_live_analyzer", strict: true, schema: {
          type: "object", additionalProperties: false,
          properties: {
            tradeDecision: { type: "string", enum: ["TRADE", "NO TRADE"] }, direction: { type: "string", enum: ["BUY", "SELL", "NO TRADE"] }, confidence: { type: "number", minimum: 0, maximum: 100 },
            asset: { type: "string" }, timeframe: { type: "string" }, currentPrice: { type: ["number", "null"] }, marketCondition: { type: "string" }, directionalBias: { type: "string" }, session: { type: "string" }, htfAlignment: { type: "string" }, newsContext: { type: "string" }, sentiment: { type: "string" },
            decisionReason: { type: "string" }, marketState: { type: "string" }, setup: { type: "string" }, confirmedConditions: { type: "array", items: { type: "string" } }, missingConditions: { type: "array", items: { type: "string" } }, invalidation: { type: "string" }, nextAction: { type: "string" },
            entry: { type: ["number", "null"] }, stopLoss: { type: ["number", "null"] }, risk: { type: ["number", "null"] }, tp1: { type: ["number", "null"] }, tp2: { type: ["number", "null"] }, finalTp: { type: ["number", "null"] }, rr: { type: ["number", "null"] }, slDistancePct: { type: ["number", "null"] }, entryDistancePct: { type: ["number", "null"] },
            strategyAnalysis: { type: "object", additionalProperties: false, properties: { marketStructure: { type: "string" }, priceAction: { type: "string" }, liquidity: { type: "string" }, momentum: { type: "string" }, volatility: { type: "string" }, indicatorConfirmation: { type: "string" } }, required: ["marketStructure", "priceAction", "liquidity", "momentum", "volatility", "indicatorConfirmation"] },
            smcScores: { type: "object", additionalProperties: false, properties: { BOS: { type: "number", minimum: 1, maximum: 10 }, CHoCH: { type: "number", minimum: 1, maximum: 10 }, OrderBlock: { type: "number", minimum: 1, maximum: 10 }, FVG: { type: "number", minimum: 1, maximum: 10 }, LiquiditySweep: { type: "number", minimum: 1, maximum: 10 }, Displacement: { type: "number", minimum: 1, maximum: 10 } }, required: ["BOS", "CHoCH", "OrderBlock", "FVG", "LiquiditySweep", "Displacement"] },
            smcEvidence: { type: "array", items: { type: "string" } },
            aiIndicators: { type: "array", items: { type: "object", additionalProperties: false, properties: { name: { type: "string", enum: INDICATORS }, selected: { type: "boolean" }, reason: { type: "string" }, reading: { type: "string" } }, required: ["name", "selected", "reason", "reading"] } },
            previousSetup: { type: "object", additionalProperties: false, properties: { found: { type: "boolean" }, timestamp: { type: "string" }, direction: { type: "string" }, entry: { type: ["number", "null"] }, stopLoss: { type: ["number", "null"] }, tp1: { type: ["number", "null"] }, tp2: { type: ["number", "null"] }, finalTp: { type: ["number", "null"] }, outcome: { type: "string" }, evidence: { type: "array", items: { type: "string" } } }, required: ["found", "timestamp", "direction", "entry", "stopLoss", "tp1", "tp2", "finalTp", "outcome", "evidence"] },
            currentState: { type: "string", enum: ["WAITING", "DEVELOPING", "READY", "ACTIVE", "COMPLETED", "INVALIDATED"] },
            currentTrade: { type: "object", additionalProperties: false, properties: { visible: { type: "boolean" }, direction: { type: "string" }, entry: { type: ["number", "null"] }, stopLoss: { type: ["number", "null"] }, tp1: { type: ["number", "null"] }, tp2: { type: ["number", "null"] }, finalTp: { type: ["number", "null"] }, progress: { type: "string" }, status: { type: "string" }, evidence: { type: "array", items: { type: "string" } } }, required: ["visible", "direction", "entry", "stopLoss", "tp1", "tp2", "finalTp", "progress", "status", "evidence"] },
            projection: { type: "object", additionalProperties: false, properties: { available: { type: "boolean" }, setupType: { type: "string" }, zoneLow: { type: ["number", "null"] }, zoneHigh: { type: ["number", "null"] }, expectedEntry: { type: ["number", "null"] }, expectedStopLoss: { type: ["number", "null"] }, expectedTp1: { type: ["number", "null"] }, expectedTp2: { type: ["number", "null"] }, expectedFinalTp: { type: ["number", "null"] }, retestRequired: { type: "boolean" }, retestStatus: { type: "string" }, confirmationRequired: { type: "string" }, confirmationStatus: { type: "string" } }, required: ["available", "setupType", "zoneLow", "zoneHigh", "expectedEntry", "expectedStopLoss", "expectedTp1", "expectedTp2", "expectedFinalTp", "retestRequired", "retestStatus", "confirmationRequired", "confirmationStatus"] }
          },
          required: ["tradeDecision","direction","confidence","asset","timeframe","currentPrice","marketCondition","directionalBias","session","htfAlignment","newsContext","sentiment","decisionReason","marketState","setup","confirmedConditions","missingConditions","invalidation","nextAction","entry","stopLoss","risk","tp1","tp2","finalTp","rr","slDistancePct","entryDistancePct","strategyAnalysis","smcScores","smcEvidence","aiIndicators","previousSetup","currentState","currentTrade","projection"]
        } } }
      })
    });
    if (!response.ok) return Response.json({ error: "OpenAI live analyzer failed.", details: await response.text() }, { status: 500 });
    const raw = await response.json();
    const text = raw.output?.flatMap((x: any) => x.content ?? []).filter((x: any) => x.type === "output_text").map((x: any) => x.text).join("").trim();
    if (!text) return Response.json({ error: "The live analyzer returned no structured result." }, { status: 500 });
    const parsed = JSON.parse(text);

    const direction: Direction = parsed.direction === "BUY" || parsed.direction === "SELL" ? parsed.direction : "NO TRADE";
    const currentPrice = marketContext?.currentPrice ?? num(parsed.currentPrice);
    const entry = num(parsed.entry), stopLoss = num(parsed.stopLoss), tp1 = num(parsed.tp1);
    const math = tradeMath(direction, entry, stopLoss, tp1, currentPrice);
    const smc = parsed.smcScores || {};
    const strongSmcCount = [smc.BOS, smc.CHoCH, smc.OrderBlock, smc.FVG, smc.LiquiditySweep, smc.Displacement].filter((v: unknown) => Number(v) >= 7).length;
    const active = Boolean(parsed.currentTrade?.visible);
    const failures: string[] = [];
    let decision: Decision = parsed.tradeDecision === "TRADE" ? "TRADE" : "NO TRADE";
    let finalDirection = direction;
    if (decision === "TRADE") {
      if (strongSmcCount < 2) failures.push(`SMC gate failed: ${strongSmcCount} signal(s) >=7/10; 2 are required.`);
      if (!math.valid) failures.push(math.reason);
      if (!marketContext) failures.push(`Live market data could not be validated: ${marketDataError || "unavailable"}.`);
      if (active) failures.push("A visible active trade already exists; no new position should be opened.");
      if (failures.length) { decision = "NO TRADE"; finalDirection = "NO TRADE"; }
    }
    let confidence = Math.max(0, Math.min(100, Math.round(Number(parsed.confidence) || 0)));
    if (strongSmcCount < 2) confidence = Math.min(confidence, 69);
    if (!marketContext) confidence = Math.min(confidence, 69);
    const currentState = active ? "ACTIVE" : parsed.currentState;
    const missing = [...arr(parsed.missingConditions), ...failures];
    const responsePayload = {
      success: true,
      strategy: { id: strategyId, name: profile.name, category: profile.category },
      market: { type: marketType, provider: providerRoute.provider, asset: String(parsed.asset || identified.asset), timeframe: String(parsed.timeframe || selectedTimeframes.join(" + ")), marketCondition: String(parsed.marketCondition || ""), directionalBias: String(parsed.directionalBias || "") },
      session: { name: String(parsed.session || "Information unavailable"), higherTimeframeAlignment: String(parsed.htfAlignment || "Information unavailable"), newsContext: String(parsed.newsContext || "No reliable news context visible"), sentiment: String(parsed.sentiment || "Information unavailable") },
      marketData: { provider: providerRoute.provider, available: Boolean(marketContext), symbol: marketContext?.symbol || identified.symbol || null, currentPrice: marketContext?.currentPrice ?? null, timeframe: lower, candles: marketContext?.candles ?? 0, structure: marketContext?.structure ?? null, volatility: marketContext?.volatility ?? null, error: marketDataError || null },
      aiIndicators: Array.isArray(parsed.aiIndicators) ? parsed.aiIndicators : [],
      liveIndicators: marketContext?.selectedIndicators ?? [],
      autoIndicators: selectedIndicators,
      smcScores: smc,
      smcEvidence: arr(parsed.smcEvidence),
      strategyAnalysis: parsed.strategyAnalysis || {},
      decision,
      tradeSignal: { direction: active ? "NO TRADE" : finalDirection, confidence, entry: decision === "TRADE" ? entry : null, stopLoss: decision === "TRADE" ? stopLoss : null, risk: decision === "TRADE" ? math.risk : null, tp1: decision === "TRADE" ? tp1 : null, tp2: decision === "TRADE" ? num(parsed.tp2) : null, finalTp: decision === "TRADE" ? num(parsed.finalTp) : null, rr: decision === "TRADE" ? math.rr : null, slDistancePct: decision === "TRADE" ? math.slPct : null, entryDistancePct: decision === "TRADE" ? math.entryDistancePct : null, invalidation: String(parsed.invalidation || "") },
      decisionReason: String(parsed.decisionReason || ""), marketState: String(parsed.marketState || ""), setup: String(parsed.setup || ""), confirmedConditions: arr(parsed.confirmedConditions), missingConditions: missing, invalidation: String(parsed.invalidation || ""), nextAction: String(parsed.nextAction || ""),
      previousSetup: parsed.previousSetup, currentState, currentTrade: parsed.currentTrade, projection: parsed.projection,
    };
    return Response.json(responsePayload);
  } catch (error) {
    console.error("Live analyzer error", error);
    return Response.json({ error: error instanceof Error ? error.message : "Unable to analyze chart with live market data." }, { status: 500 });
  }
}

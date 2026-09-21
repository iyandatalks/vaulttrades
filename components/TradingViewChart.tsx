"use client";

import { useEffect, useRef } from "react";

type TradingViewChartProps = {
  symbol?: string;
  interval?: string;
  height?: number;
  signal?: {
    direction: string;
    entry: number | null;
    stop_loss: number | null;
    tp1: number | null;
    tp2: number | null;
    tp3: number | null;
    tp4: number | null;
    tp5: number | null;
    strategy_id?: string;
    strategy_name: string;
    timeframe: string;
    fired_at: string;
  } | null;
};

function normalizeInterval(value: string) {
  const normalized = value.toUpperCase().trim();
  const map: Record<string, string> = {
    M1: "1",
    M5: "5",
    M10: "10",
    M15: "15",
    M30: "30",
    H1: "60",
    H4: "240",
    D1: "D",
  };
  return map[normalized] ?? value;
}

function levelRows(signal: NonNullable<TradingViewChartProps["signal"]>) {
  return [
    ["TP5", signal.tp5],
    ["TP4", signal.tp4],
    ["TP3", signal.tp3],
    ["TP2", signal.tp2],
    ["TP1", signal.tp1],
    ["ENTRY", signal.entry],
    ["SL", signal.stop_loss],
  ] as const;
}

export default function TradingViewChart({
  symbol = "OANDA:XAUUSD",
  interval = "5",
  height = 650,
  signal = null,
}: TradingViewChartProps) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    container.current.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "tradingview-widget-container";
    wrapper.style.width = "100%";
    wrapper.style.height = `${height}px`;

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.width = "100%";
    widget.style.height = "100%";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: normalizeInterval(interval),
      timezone: "Africa/Johannesburg",
      theme: "dark",
      style: "1",
      locale: "en",
      allow_symbol_change: true,
      hide_top_toolbar: false,
      hide_legend: false,
      hide_side_toolbar: false,
      save_image: true,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });

    wrapper.appendChild(widget);
    wrapper.appendChild(script);
    container.current.appendChild(wrapper);

    return () => {
      if (container.current) container.current.innerHTML = "";
    };
  }, [symbol, interval, height]);

  const rows = signal ? levelRows(signal) : [];
  const validPrices = rows.map(([, value]) => value).filter((value): value is number => typeof value === "number");
  const low = validPrices.length ? Math.min(...validPrices) : 0;
  const high = validPrices.length ? Math.max(...validPrices) : 1;
  const range = Math.max(high - low, 0.01);

  return (
    <section style={{ width: "100%", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,.10)", background: "#0b0b0b" }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,.08)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: ".10em", fontWeight: 800, opacity: 0.65 }}>TRADINGVIEW MARKET CHART</div>
          <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800 }}>{symbol.replace(/^OANDA:/, "")} · {String(signal?.timeframe ?? interval).toUpperCase()}</div>
        </div>
        <div style={{ fontSize: 10, padding: "6px 9px", borderRadius: 999, border: "1px solid rgba(212,166,55,.35)", color: "#d4a637", fontWeight: 800 }}>LIVE MARKET DATA</div>
      </div>

      <div style={{ position: "relative", width: "100%", height }}>
        <div ref={container} style={{ width: "100%", height }} />

        {signal && (
          <>
            <div style={{ position: "absolute", top: 16, left: 16, zIndex: 5, width: 270, padding: 14, borderRadius: 10, border: "1px solid rgba(212,166,55,.42)", background: "rgba(8,8,8,.92)", backdropFilter: "blur(8px)", boxShadow: "0 8px 30px rgba(0,0,0,.35)", pointerEvents: "none" }}>
              <div style={{ fontSize: 9, letterSpacing: ".10em", fontWeight: 900, color: "#d4a637" }}>VAULTTRADES STRATEGY SIGNAL</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 7 }}>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{signal.direction.toUpperCase()}</div>
                <div style={{ fontSize: 10, fontWeight: 800, opacity: .7 }}>{signal.timeframe}</div>
              </div>
              <div style={{ fontSize: 10, opacity: .65, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{signal.strategy_name}</div><div style={{ fontSize: 9, opacity: .5, marginTop: 4 }}>{signal.strategy_id ?? "TradingView"} · {new Date(signal.fired_at).toLocaleTimeString()}</div>
            </div>

            <div style={{ position: "absolute", top: 16, right: 16, bottom: 16, zIndex: 5, width: 205, padding: 12, borderRadius: 10, border: "1px solid rgba(212,166,55,.35)", background: "rgba(8,8,8,.88)", backdropFilter: "blur(8px)", pointerEvents: "none" }}>
              <div style={{ fontSize: 9, letterSpacing: ".10em", fontWeight: 900, color: "#d4a637" }}>STRATEGY LEVELS</div>
              <div style={{ fontSize: 9, opacity: .55, marginTop: 3 }}>Webhook-confirmed VaultTrades output</div>
              <div style={{ position: "relative", height: "calc(100% - 34px)", minHeight: 250, marginTop: 8 }}>
                {rows.map(([label, value]) => {
                  if (typeof value !== "number") return null;
                  const top = ((high - value) / range) * 100;
                  const isEntry = label === "ENTRY";
                  const isStop = label === "SL";
                  return (
                    <div key={label} style={{ position: "absolute", left: 0, right: 0, top: `${Math.min(96, Math.max(2, top))}%`, transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: 7 }}>
                      <div style={{ flex: 1, height: 1, background: isEntry ? "#d4a637" : "rgba(255,255,255,.30)" }} />
                      <div style={{ minWidth: 82, textAlign: "right" }}>
                        <span style={{ fontSize: 9, fontWeight: 900, opacity: .65 }}>{label}</span>
                        <span style={{ marginLeft: 7, fontSize: 11, fontWeight: 900 }}>{value.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ position: "absolute", bottom: 10, left: 12, right: 12, fontSize: 8, opacity: .45 }}>
                Pine source remains private in TradingView.
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

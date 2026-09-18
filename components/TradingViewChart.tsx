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
    strategy_name: string;
    timeframe: string;
    fired_at: string;
  } | null;
};

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
      interval,
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

  return (
    <section style={{ width: "100%", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,.10)", background: "#0b0b0b" }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,.08)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: ".10em", fontWeight: 800, opacity: 0.65 }}>TRADINGVIEW MARKET CHART</div>
          <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800 }}>XAUUSD · M5</div>
        </div>
        <div style={{ fontSize: 10, padding: "6px 9px", borderRadius: 999, border: "1px solid rgba(212,166,55,.35)", color: "#d4a637", fontWeight: 800 }}>LIVE MARKET DATA</div>
      </div>
      <div style={{ position: "relative", width: "100%", height }}>
        <div ref={container} style={{ width: "100%", height }} />
        {signal && (
          <div style={{ position: "absolute", top: 16, left: 16, zIndex: 5, width: 270, padding: 14, borderRadius: 10, border: "1px solid rgba(212,166,55,.42)", background: "rgba(8,8,8,.92)", backdropFilter: "blur(8px)", boxShadow: "0 8px 30px rgba(0,0,0,.35)", pointerEvents: "none" }}>
            <div style={{ fontSize: 9, letterSpacing: ".10em", fontWeight: 900, color: "#d4a637" }}>VAULTTRADES STRATEGY SIGNAL</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 7 }}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{signal.direction.toUpperCase()}</div>
              <div style={{ fontSize: 10, fontWeight: 800, opacity: .7 }}>{signal.timeframe}</div>
            </div>
            <div style={{ fontSize: 10, opacity: .65, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{signal.strategy_name}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
              {[["ENTRY", signal.entry], ["SL", signal.stop_loss], ["TP1", signal.tp1], ["TP2", signal.tp2], ["TP3", signal.tp3], ["TP4", signal.tp4]].map(([label, value]) => (
                <div key={label as string} style={{ padding: "7px 8px", borderRadius: 7, background: "rgba(255,255,255,.045)", border: "1px solid rgba(255,255,255,.07)" }}>
                  <div style={{ fontSize: 8, opacity: .55, letterSpacing: ".06em" }}>{label as string}</div>
                  <div style={{ marginTop: 2, fontSize: 12, fontWeight: 800 }}>{typeof value === "number" ? value.toFixed(2) : "—"}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 9, fontSize: 9, opacity: .55 }}>Calculated by VaultTrades strategy · Pine source remains private in TradingView</div>
          </div>
        )}
      </div>
    </section>
  );
}

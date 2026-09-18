"use client";

import { useEffect, useRef } from "react";

type TradingViewChartProps = {
  symbol?: string;
  interval?: string;
  height?: number;
};

export default function TradingViewChart({
  symbol = "OANDA:XAUUSD",
  interval = "5",
  height = 650,
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
      <div ref={container} style={{ width: "100%", height }} />
    </section>
  );
}

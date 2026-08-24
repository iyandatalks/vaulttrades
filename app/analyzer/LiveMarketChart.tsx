"use client";

import { useMemo } from "react";

type Candle = { datetime: string; open: number; high: number; low: number; close: number };

export function LiveMarketChart({ candles, channel }: { candles: Candle[]; channel?: { upper: number | null; lower: number | null } }) {
  const data = useMemo(() => candles.slice(-70), [candles]);
  if (!data.length) return <div className="condition-box">No live candles available.</div>;
  const width = 1100, height = 420, pad = 36;
  const min = Math.min(...data.map(c => c.low), channel?.lower ?? Infinity);
  const max = Math.max(...data.map(c => c.high), channel?.upper ?? -Infinity);
  const scaleX = (i: number) => pad + i * ((width - pad * 2) / Math.max(data.length - 1, 1));
  const scaleY = (v: number) => pad + (max - v) / Math.max(max - min, 1e-9) * (height - pad * 2);
  const bodyW = Math.max(4, (width - pad * 2) / data.length * 0.58);
  const last = data[data.length - 1];
  return <div style={{ overflowX: "auto", borderRadius: 14, border: "1px solid rgba(212,166,55,.22)", background: "#050812" }}>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Live market candlestick chart" style={{ width: "100%", minWidth: 720, display: "block" }}>
      {[0, .25, .5, .75, 1].map(t => <line key={t} x1={pad} x2={width - pad} y1={pad + t * (height - pad * 2)} y2={pad + t * (height - pad * 2)} stroke="rgba(255,255,255,.07)" />)}
      {channel?.upper != null && <line x1={pad} x2={width - pad} y1={scaleY(channel.upper)} y2={scaleY(channel.upper)} stroke="#d4a637" strokeDasharray="8 6" strokeWidth="2" />}
      {channel?.lower != null && <line x1={pad} x2={width - pad} y1={scaleY(channel.lower)} y2={scaleY(channel.lower)} stroke="#d4a637" strokeDasharray="8 6" strokeWidth="2" />}
      {data.map((c, i) => {
        const x = scaleX(i), bullish = c.close >= c.open;
        const top = scaleY(Math.max(c.open, c.close)), bottom = scaleY(Math.min(c.open, c.close));
        const color = bullish ? "#35d07f" : "#ef5b66";
        return <g key={`${c.datetime}-${i}`}>
          <line x1={x} x2={x} y1={scaleY(c.high)} y2={scaleY(c.low)} stroke={color} strokeWidth="1.5" />
          <rect x={x - bodyW / 2} y={top} width={bodyW} height={Math.max(2, bottom - top)} fill={color} rx="1" />
        </g>;
      })}
      <text x={width - pad} y={24} textAnchor="end" fill="#cbd5e1" fontSize="14">Live · {last.close.toLocaleString(undefined, { maximumFractionDigits: 5 })}</text>
      {channel?.upper != null && <text x={pad + 4} y={scaleY(channel.upper) - 6} fill="#d4a637" fontSize="12">MA Channel High</text>}
      {channel?.lower != null && <text x={pad + 4} y={scaleY(channel.lower) + 16} fill="#d4a637" fontSize="12">MA Channel Low</text>}
    </svg>
  </div>;
}

"use client";

import { useMemo } from "react";

type Candle = { datetime: string; open: number; high: number; low: number; close: number; volume?: number | null };

type Props = {
  candles: Candle[];
  channel?: { upper: number | null; lower: number | null; middle?: number | null };
  liquidityTargets?: { buySide: { price: number; source: string; touches: number } | null; sellSide: { price: number; source: string; touches: number } | null };
  orderBlock?: { direction: string; top: number; bottom: number; createdAt?: string } | null;
  orderBlocks?: Array<{ direction: string; top: number; bottom: number; label?: string; state?: string }>;
};

const fmtPrice = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 });

export function LiveMarketChart({ candles, channel, liquidityTargets, orderBlock, orderBlocks = [] }: Props) {
  const data = useMemo(() => candles.slice(-80), [candles]);
  const visibleOrderBlocks = useMemo(() => {
    const supplied = orderBlocks.filter((block) =>
      Number.isFinite(block.top) && Number.isFinite(block.bottom) && block.top > block.bottom
    );
    const legacy = orderBlock && Number.isFinite(orderBlock.top) && Number.isFinite(orderBlock.bottom) && orderBlock.top > orderBlock.bottom
      ? [{ ...orderBlock, label: "ACTIVE ORDER BLOCK", state: "ACTIVE" }]
      : [];
    return [...supplied, ...legacy.filter((candidate) => !supplied.some((block) =>
      block.direction === candidate.direction && block.top === candidate.top && block.bottom === candidate.bottom
    ))];
  }, [orderBlocks, orderBlock]);

  if (!data.length) return <div className="condition-box">No live candles available.</div>;

  const width = 1200;
  const height = 520;
  const left = 18;
  const right = 86;
  const top = 18;
  const priceBottom = 370;
  const volumeTop = 390;
  const volumeBottom = 490;
  const chartWidth = width - left - right;
  const priceHeight = priceBottom - top;
  const priceMin = Math.min(...data.map(c => c.low), channel?.lower ?? Infinity, liquidityTargets?.sellSide?.price ?? Infinity, ...visibleOrderBlocks.map(block => block.bottom));
  const priceMax = Math.max(...data.map(c => c.high), channel?.upper ?? -Infinity, liquidityTargets?.buySide?.price ?? -Infinity, ...visibleOrderBlocks.map(block => block.top));
  const priceRange = Math.max(priceMax - priceMin, Math.abs(priceMax) * 0.00001, 1e-9);
  const maxVolume = Math.max(...data.map(c => c.volume ?? 0), 1);
  const bodyWidth = Math.max(3, Math.min(11, chartWidth / data.length * 0.62));
  const x = (i: number) => left + (i + 0.5) * (chartWidth / data.length);
  const y = (value: number) => top + (priceMax - value) / priceRange * priceHeight;
  const volumeY = (volume: number) => volumeBottom - (volume / maxVolume) * (volumeBottom - volumeTop);
  const last = data[data.length - 1];
  const previous = data.length > 1 ? data[data.length - 2] : last;
  const lastChange = last.close - previous.close;
  const lastChangePct = previous.close !== 0 ? lastChange / previous.close * 100 : 0;

  const priceTicks = Array.from({ length: 6 }, (_, i) => priceMax - (priceRange * i / 5));
  const timeTicks = Array.from({ length: 6 }, (_, i) => {
    const index = Math.min(data.length - 1, Math.round(i * (data.length - 1) / 5));
    return { index, label: data[index]?.datetime ?? "" };
  });

  return (
    <div style={{ overflowX: "auto", borderRadius: 14, border: "1px solid rgba(148,163,184,.20)", background: "#090d14" }}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Live market candlestick chart" style={{ width: "100%", minWidth: 820, display: "block", fontFamily: "Inter, system-ui, sans-serif" }}>
        <rect x="0" y="0" width={width} height={height} fill="#090d14" />
        <rect x={left} y={top} width={chartWidth} height={priceHeight} fill="#0b1018" />
        <rect x={left} y={volumeTop} width={chartWidth} height={volumeBottom - volumeTop} fill="#080c13" />

        {priceTicks.map((tick, i) => (
          <g key={`price-${i}`}>
            <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke="rgba(148,163,184,.12)" strokeWidth="1" />
            <text x={width - right + 10} y={y(tick) + 4} fill="#94a3b8" fontSize="12">{fmtPrice(tick)}</text>
          </g>
        ))}

        <line x1={left} x2={width - right} y1={volumeTop - 10} y2={volumeTop - 10} stroke="rgba(148,163,184,.16)" />
        <text x={left + 8} y={volumeTop + 14} fill="#64748b" fontSize="11">VOLUME</text>

        {visibleOrderBlocks.map((block, index) => {
          const bearish = block.direction.toUpperCase().includes("BEAR");
          const stroke = bearish ? "rgba(239,83,80,.85)" : "rgba(38,166,154,.85)";
          const fill = bearish ? "rgba(239,83,80,.16)" : "rgba(38,166,154,.16)";
          const labelColor = bearish ? "#f87171" : "#5eead4";
          return (
            <g key={`${block.direction}-ob-${index}`}>
              <rect x={left} y={y(block.top)} width={chartWidth} height={Math.max(1, y(block.bottom) - y(block.top))} fill={fill} stroke={stroke} strokeDasharray="5 4" strokeWidth="1.5" />
              <text x={left + 8} y={y(block.top) + 14 + index * 13} fill={labelColor} fontSize="11" fontWeight="700">{block.label || (bearish ? "ACTIVE BEARISH ORDER BLOCK" : "ACTIVE BULLISH ORDER BLOCK")}</text>
            </g>
          );
        })}
        {channel?.upper != null && (
          <>
            <line x1={left} x2={width - right} y1={y(channel.upper)} y2={y(channel.upper)} stroke="#d4a637" strokeDasharray="8 6" strokeWidth="1.5" />
            <text x={left + 8} y={y(channel.upper) - 7} fill="#d4a637" fontSize="11">MA Channel High</text>
          </>
        )}
        {channel?.middle != null && (
          <line x1={left} x2={width - right} y1={y(channel.middle)} y2={y(channel.middle)} stroke="rgba(212,166,55,.38)" strokeDasharray="3 5" />
        )}
        {liquidityTargets?.buySide && (
          <g>
            <line x1={left} x2={width - right} y1={y(liquidityTargets.buySide.price)} y2={y(liquidityTargets.buySide.price)} stroke="#22c55e" strokeDasharray="3 5" strokeWidth="2" />
            <text x={left + 8} y={y(liquidityTargets.buySide.price) - 7} fill="#4ade80" fontSize="11" fontWeight="700">BUY-SIDE LIQUIDITY · {fmtPrice(liquidityTargets.buySide.price)}</text>
          </g>
        )}
        {liquidityTargets?.sellSide && (
          <g>
            <line x1={left} x2={width - right} y1={y(liquidityTargets.sellSide.price)} y2={y(liquidityTargets.sellSide.price)} stroke="#f97316" strokeDasharray="3 5" strokeWidth="2" />
            <text x={left + 8} y={y(liquidityTargets.sellSide.price) + 15} fill="#fb923c" fontSize="11" fontWeight="700">SELL-SIDE LIQUIDITY · {fmtPrice(liquidityTargets.sellSide.price)}</text>
          </g>
        )}
        {channel?.lower != null && (
          <>
            <line x1={left} x2={width - right} y1={y(channel.lower)} y2={y(channel.lower)} stroke="#d4a637" strokeDasharray="8 6" strokeWidth="1.5" />
            <text x={left + 8} y={y(channel.lower) + 15} fill="#d4a637" fontSize="11">MA Channel Low</text>
          </>
        )}

        {data.map((c, i) => {
          const bullish = c.close >= c.open;
          const candleColor = bullish ? "#26a69a" : "#ef5350";
          const candleX = x(i);
          const openY = y(c.open);
          const closeY = y(c.close);
          const highY = y(c.high);
          const lowY = y(c.low);
          const bodyTop = Math.min(openY, closeY);
          const bodyHeight = Math.max(1.5, Math.abs(closeY - openY));
          const volume = c.volume ?? 0;
          return (
            <g key={`${c.datetime}-${i}`}>
              <line x1={candleX} x2={candleX} y1={highY} y2={lowY} stroke={candleColor} strokeWidth="1.2" />
              <rect x={candleX - bodyWidth / 2} y={bodyTop} width={bodyWidth} height={bodyHeight} fill={candleColor} />
              {volume > 0 && <rect x={candleX - bodyWidth / 2} y={volumeY(volume)} width={bodyWidth} height={volumeBottom - volumeY(volume)} fill={candleColor} opacity="0.42" />}
            </g>
          );
        })}

        <line x1={left} x2={width - right} y1={y(last.close)} y2={y(last.close)} stroke="#f1f5f9" strokeDasharray="4 4" opacity="0.55" />
        <rect x={width - right + 5} y={y(last.close) - 12} width={right - 10} height="24" rx="4" fill="#f1f5f9" />
        <text x={width - right + 10} y={y(last.close) + 4} fill="#0b1018" fontSize="12" fontWeight="700">{fmtPrice(last.close)}</text>

        {timeTicks.map((tick, i) => (
          <g key={`time-${i}`}>
            <line x1={x(tick.index)} x2={x(tick.index)} y1={top} y2={volumeBottom} stroke="rgba(148,163,184,.05)" />
            <text x={x(tick.index)} y={height - 12} textAnchor="middle" fill="#64748b" fontSize="11">{tick.label.slice(5, 16)}</text>
          </g>
        ))}

        <text x={left + 8} y={top + 17} fill="#cbd5e1" fontSize="13" fontWeight="700">LIVE PRICE</text>
        <text x={left + 8} y={top + 34} fill={lastChange >= 0 ? "#26a69a" : "#ef5350"} fontSize="12">{lastChange >= 0 ? "+" : ""}{fmtPrice(lastChange)} ({lastChangePct.toFixed(2)}%)</text>
      </svg>
    </div>
  );
}

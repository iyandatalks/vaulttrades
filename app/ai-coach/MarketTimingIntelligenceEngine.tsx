"use client";

import { useEffect, useMemo, useState } from "react";

type Phase = {
  start: number;
  end: number;
  label: string;
  description: string;
  risk: "LOW" | "MEDIUM" | "HIGH";
};

const PHASES: Phase[] = [
  { start: 0, end: 2, label: "Asia Open", description: "Early range formation and liquidity building.", risk: "LOW" },
  { start: 2, end: 3.5, label: "Asia Expansion", description: "Monitor continuation and early directional expansion.", risk: "MEDIUM" },
  { start: 3.5, end: 5.5, label: "Asia Continuation", description: "Continuation of the developing Asia structure.", risk: "LOW" },
  { start: 5.5, end: 7.5, label: "EMA / London Transition", description: "Common window for EMA-based continuation signals and late prints.", risk: "MEDIUM" },
  { start: 7.5, end: 8, label: "Pre-London", description: "Prepare for the Asia liquidity test.", risk: "HIGH" },
  { start: 8, end: 8.75, label: "London Liquidity Window", description: "Watch Asia High/Low sweeps before accepting a new direction.", risk: "HIGH" },
  { start: 8.75, end: 12, label: "London Direction Discovery", description: "Wait for post-sweep structure and directional confirmation.", risk: "MEDIUM" },
  { start: 12, end: 13, label: "London Consolidation / NY Preparation", description: "Monitor compression, continuation and transition risk.", risk: "MEDIUM" },
  { start: 13, end: 15.5, label: "New York Expansion", description: "Second major volatility window; existing trades may experience a new wave of movement.", risk: "HIGH" },
  { start: 15.5, end: 24, label: "Late Session", description: "Lower priority for new signals; manage existing lifecycle carefully.", risk: "LOW" },
];

const EVENT_WINDOWS = [
  ["00:00", "02:00", "Asia range formation", "LOW"],
  ["02:00", "03:30", "Asia expansion / continuation", "MEDIUM"],
  ["05:30", "07:30", "EMA / London transition", "MEDIUM"],
  ["08:00", "08:45", "Asia High/Low liquidity sweep window", "HIGH"],
  ["09:00", "12:00", "London direction discovery", "MEDIUM"],
  ["12:00", "13:00", "London consolidation / NY preparation", "MEDIUM"],
  ["13:00", "15:30", "New York expansion wave", "HIGH"],
] as const;

function hourDecimal(date: Date) {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

function minutesUntil(hour: number, minute: number, now: Date) {
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return Math.round((target.getTime() - now.getTime()) / 60000);
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function timingStatus(now: Date) {
  const h = hourDecimal(now);
  const phase = PHASES.find((p) => h >= p.start && h < p.end) ?? PHASES[PHASES.length - 1];
  const isFriday = now.getDay() === 5;
  const isMonday = now.getDay() === 1;
  const londonRisk = h >= 7.5 && h < 8.75;
  const nyRisk = h >= 13 && h < 15.5;
  let risk = phase.risk;
  if (londonRisk || nyRisk) risk = "HIGH";
  if ((isFriday || isMonday) && risk === "LOW") risk = "MEDIUM";
  return { phase, risk, isFriday, isMonday };
}

export default function MarketTimingIntelligenceEngine() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const status = useMemo(() => timingStatus(now), [now]);
  const time = now.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Africa/Johannesburg" });
  const date = now.toLocaleDateString("en-ZA", { weekday: "long", day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Johannesburg" });
  const nextLondon = minutesUntil(8, 0, now);
  const nextNy = minutesUntil(13, 0, now);

  return (
    <section className="card" style={{ marginBottom: 20, border: "1px solid rgba(212,166,55,.4)" }}>
      <div className="section-label">MARKET TIMING INTELLIGENCE ENGINE</div>
      <h2 className="title" style={{ marginTop: 8 }}>Market Timing — South African Time (SAST)</h2>
      <p className="muted">Timing context is additive only. It does not alter, replace, or invalidate the existing Strategy Engine or AI Scanner rules.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10, marginTop: 18 }}>
        {[
          ["CURRENT TIME", `${time} SAST`],
          ["MARKET PHASE", status.phase.label],
          ["TIMING RISK", status.risk],
          ["DAY CONTEXT", status.isFriday ? "FRIDAY MODE" : status.isMonday ? "MONDAY MODE" : date],
        ].map(([label, value]) => (
          <div key={label} className="execution-item">
            <span>{label}</span>
            <strong style={{ fontSize: 14 }}>{value}</strong>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, padding: 14, border: "1px solid #263244", borderRadius: 12, background: "#080e17" }}>
        <strong style={{ color: "#d4af37" }}>{status.phase.label}</strong>
        <p className="muted" style={{ marginBottom: 0 }}>{status.phase.description}</p>
        {status.risk === "HIGH" && <p className="muted" style={{ marginBottom: 0 }}><strong style={{ color: "#d4af37" }}>Timing warning:</strong> treat fresh signals as time-sensitive and check M15 structure before acting.</p>}
      </div>

      <div style={{ overflowX: "auto", marginTop: 18 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr>{["SAST", "SIGNIFICANT MARKET WINDOW", "TIMING RISK"].map((x) => <th key={x} style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #263244", color: "#d4af37" }}>{x}</th>)}</tr></thead>
          <tbody>{EVENT_WINDOWS.map(([start, end, label, risk]) => <tr key={label}><td style={{ padding: "9px 8px", borderBottom: "1px solid #202b3a", whiteSpace: "nowrap" }}>{start}–{end}</td><td style={{ padding: "9px 8px", borderBottom: "1px solid #202b3a" }}>{label}</td><td style={{ padding: "9px 8px", borderBottom: "1px solid #202b3a", fontWeight: 800 }}>{risk}</td></tr>)}</tbody>
        </table>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10, marginTop: 16 }}>
        <div className="execution-item"><span>NEXT LONDON LIQUIDITY WINDOW</span><strong>{nextLondon <= 0 ? "ACTIVE" : `in ${formatDuration(nextLondon)}`}</strong><p className="muted" style={{ marginBottom: 0 }}>08:00–08:45 SAST · Asia High/Low sweep watch.</p></div>
        <div className="execution-item"><span>NEXT NEW YORK EXPANSION</span><strong>{nextNy <= 0 ? "ACTIVE" : `in ${formatDuration(nextNy)}`}</strong><p className="muted" style={{ marginBottom: 0 }}>13:00–15:30 SAST · second volatility wave.</p></div>
      </div>

      <div style={{ marginTop: 16, padding: 14, border: "1px solid #263244", borderRadius: 12, background: "#080e17" }}>
        <strong style={{ color: "#d4af37" }}>Scanner integration policy</strong>
        <p className="muted" style={{ marginBottom: 0 }}>Signal timestamps and lifecycle events remain owned by the scanner. This module provides the timing context needed to judge whether a signal is early, mature, or exposed to a major session transition. No strategy condition is changed here.</p>
        <p className="muted" style={{ marginBottom: 0, marginTop: 8 }}>Gap status is intentionally shown as a monitoring item until a live prior-close/session-open price feed is attached; the engine will not fabricate a gap value.</p>
      </div>
    </section>
  );
}

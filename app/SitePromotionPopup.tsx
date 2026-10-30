"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Promotion = {
  id: string; title: string; description: string; category: string;
  image_url: string | null; cta_text: string; target_url: string; display_order: number;
};

const DISMISSED_KEY = "vt_promo_dismissed_v1";
const SHOWN_KEY = "vt_promo_shown_v1";

export default function SitePromotionPopup() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [active, setActive] = useState<Promotion | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueRef = useRef<Promotion[]>([]);

  const readIds = (key: string): string[] => {
    try { return JSON.parse(sessionStorage.getItem(key) || "[]"); } catch { return []; }
  };

  const scheduleNext = useCallback((delay: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const dismissed = readIds(DISMISSED_KEY);
      const shown = readIds(SHOWN_KEY);
      if (shown.length >= 3) return;
      const next = queueRef.current.find(item => !dismissed.includes(item.id) && !shown.includes(item.id));
      if (!next) return;
      sessionStorage.setItem(SHOWN_KEY, JSON.stringify([...shown, next.id]));
      setActive(next);
    }, delay);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/promotions", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Promotions unavailable");
        return response.json();
      })
      .then(data => {
        if (cancelled) return;
        const items = (data.promotions || []) as Promotion[];
        queueRef.current = items;
        setPromotions(items);
        if (items.length) scheduleNext(9000);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [scheduleNext]);

  function dismiss() {
    if (!active) return;
    const dismissed = readIds(DISMISSED_KEY);
    if (!dismissed.includes(active.id)) sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed, active.id]));
    setActive(null);
    scheduleNext(60000);
  }

  if (!active) return null;
  const href = active.target_url.startsWith("/") ? active.target_url : active.target_url;
  return (
    <aside aria-label="VaultTrades promotion" className="vt-promo-toast">
      <button type="button" className="vt-promo-close" onClick={dismiss} aria-label="Close promotion">×</button>
      <div className="vt-promo-content">
        <div className="vt-promo-copy">
          <div className="vt-promo-category">{active.category}</div>
          <h3>{active.title}</h3>
          <p>{active.description}</p>
          <a className="vt-promo-cta" href={href} onClick={dismiss}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noopener noreferrer" : undefined}>
            {active.cta_text}
          </a>
        </div>
        {active.image_url ? <img className="vt-promo-image" src={active.image_url} alt="" /> : null}
      </div>
      <div className="vt-promo-brand">VAULTTRADES</div>
    </aside>
  );
}

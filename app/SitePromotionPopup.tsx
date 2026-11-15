"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Promotion = {
  id: string; title: string; description: string; category: string;
  image_url: string | null; cta_text: string; target_url: string; display_order: number;
};

const DISMISSED_KEY = "vt_promo_dismissed_v1";
const SHOWN_KEY = "vt_promo_shown_v1";
const CONTRACTOR_PORTAL_URL = "https://contractorportal.io/contractor-portal/ID/1220/";

export default function SitePromotionPopup() {
  const pathname = usePathname();
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
        const contractorPromotion: Promotion = {
          id: "vt-global-contracting",
          title: "When we're not trading, we're exploring global contracts and deals.",
          description: "Explore online contracting opportunities and global business deals through our external Contractor Portal.",
          category: "GLOBAL CONTRACTING · ONLINE OPPORTUNITIES",
          image_url: null,
          cta_text: "Explore opportunities ↗",
          target_url: CONTRACTOR_PORTAL_URL,
          display_order: 999,
        };
        const homepageItems = pathname === "/" ? [...items, contractorPromotion] : items;
        queueRef.current = homepageItems;
        if (homepageItems.length) scheduleNext(9000);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [scheduleNext, pathname]);

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
        <img className="vt-promo-image" src={active.image_url || "/vaulttrades-logo.png"} alt="" />
      </div>
      <div className="vt-promo-brand">VAULTTRADES</div>
    </aside>
  );
}

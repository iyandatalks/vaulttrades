"use client";

import type { ReactNode } from "react";
import AppNav from "./AppNav";
import VaultTradesFooter from "./VaultTradesFooter";
import SitePromotionPopup from "./SitePromotionPopup";

export default function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="vt-site-shell">
      <AppNav />
      <div className="vt-site-content">{children}</div>
      <VaultTradesFooter />
      <SitePromotionPopup />
    </div>
  );
}

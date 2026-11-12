"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import AppNav from "./AppNav";
import VaultTradesFooter from "./VaultTradesFooter";
import SitePromotionPopup from "./SitePromotionPopup";

export default function MarketingShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isProspectFunnel = ["/start", "/opportunity", "/plans", "/privacy-policy"].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  if (isProspectFunnel) return <>{children}</>;

  return (
    <>
      <AppNav />
      {children}
      <VaultTradesFooter />
      <SitePromotionPopup />
    </>
  );
}

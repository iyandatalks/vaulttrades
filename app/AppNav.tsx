"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/subscription?promo=1", label: "Products" },
  { href: "/partners", label: "Partners" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/profile", label: "Profile" },
];

const promoItems = [
  "CREATE A FREE VAULTTRADES ACCOUNT",
  "ANALYZE YOUR MARKET",
  "JOURNAL YOUR TRADES",
  "USE AI COACH",
  "BUILD YOUR BUFFER",
  "PREPARE FOR PROP-FIRM EVALUATIONS",
  "SCALE WITH DISCIPLINE",
  "PARTNER REFERRAL BONUSES WHERE AVAILABLE",
  "MEMBER TOOLS WITH ACTIVE VAULTTRADES ACCESS",
  "OPEN A RECOMMENDED BROKER OR PROP-FIRM ACCOUNT",
];

export default function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="vt-nav" aria-label="VaultTrades navigation">
      <Link href="/subscription?product=analyzer_monthly" style={{ position:"fixed", top:8, left:"50%", transform:"translateX(-50%)", zIndex:1000, background:"#dc2626", color:"#fff", padding:"7px 16px", borderRadius:999, fontSize:12, fontWeight:950, letterSpacing:".06em", textDecoration:"none", boxShadow:"0 8px 24px rgba(0,0,0,.35)", whiteSpace:"nowrap" }}>50% DISCOUNT · CODE VAULT50</Link>
      <div className="vt-promo-bar" aria-label="VaultTrades promotions">
        <div className="vt-promo-track">
          {[...promoItems, ...promoItems].map((item, index) => (
            <span className="vt-promo-item" key={item + index}>
              {item}
              <span className="vt-promo-separator">✦</span>
            </span>
          ))}
        </div>
      </div>

      <div className="vt-nav-inner">
        <Link href="/" className="vt-nav-brand">VAULTTRADES</Link>
        <div className="vt-nav-links">
          {tabs.map((tab) => {
            const tabPath = tab.href.split("?")[0];
            const active = pathname === tabPath || (tabPath !== "/" && pathname.startsWith(tabPath));
            return <Link key={tab.href} href={tab.href} className={"vt-nav-link" + (active ? " active" : "")}>{tab.label}</Link>;
          })}
        </div>
      </div>
    </nav>
  );
}

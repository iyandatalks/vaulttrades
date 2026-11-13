"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const tabs = [
  { href: "/", label: "Home", adminOnly: false },
  { href: "/products", label: "Products", adminOnly: false },
  { href: "/dashboard", label: "Dashboard", adminOnly: true },
  { href: "/start", label: "Lead Generation", adminOnly: true },
  { href: "/partners", label: "Partners", adminOnly: true },
  { href: "/how-it-works", label: "How It Works", adminOnly: true },
  { href: "/member-portal", label: "Knowledge Base", adminOnly: true },
  { href: "/profile", label: "Profile", adminOnly: true },
];

const promoItems = [
  "VAULTTRADES ADMIN WORKSPACE",
  "PRIVATE BUILD — NOT YET PUBLISHED",
  "INTERNAL REVIEW ONLY",
];

export default function AppNav() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/member-portal/access", { cache: "no-store" })
      .then(response => response.ok ? response.json() : { isAdmin: false })
      .then(data => { if (active) setIsAdmin(data.isAdmin === true); })
      .catch(() => { if (active) setIsAdmin(false); });
    return () => { active = false; };
  }, []);

  return (
    <nav className="vt-nav" aria-label="VaultTrades navigation">
      {isAdmin && (
        <div className="vt-promo-bar" aria-label="Administrator workspace notice">
          <div className="vt-promo-track">
            {[...promoItems, ...promoItems].map((item, index) => (
              <span className="vt-promo-item" key={item + index}>
                {item}<span className="vt-promo-separator">✦</span>
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="vt-nav-inner">
        <Link href="/" className="vt-nav-brand">VAULTTRADES</Link>
        <div className="vt-nav-links">
          {tabs.filter(tab => !tab.adminOnly || isAdmin).map(tab => {
            const tabPath = tab.href.split("?")[0];
            const active = pathname === tabPath || (tabPath !== "/" && pathname.startsWith(tabPath));
            return <Link key={tab.href} href={tab.href} className={"vt-nav-link" + (active ? " active" : "")}>{tab.label}</Link>;
          })}
        </div>
      </div>
    </nav>
  );
}

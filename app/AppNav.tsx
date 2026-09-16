"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "VAULTTRADES" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/products", label: "Products" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/profile", label: "Profile" },
];

export default function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="vt-nav" aria-label="VaultTrades navigation">
      <div className="vt-nav-inner">
        <Link href="/" className="vt-nav-brand">VAULTTRADES</Link>
        <div className="vt-nav-links">
          {tabs.map((tab) => {
            const active = pathname === tab.href || (tab.href !== "/" && pathname.startsWith(tab.href));
            return <Link key={tab.href} href={tab.href} className={`vt-nav-link${active ? " active" : ""}`}>{tab.label}</Link>;
          })}
        </div>
      </div>
    </nav>
  );
}

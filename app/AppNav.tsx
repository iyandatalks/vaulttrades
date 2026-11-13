"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const publicTabs = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/start", label: "Business Opportunity" },
];

const adminTabs = [
  { href: "/how-it-works", label: "How It Works" },
  { href: "/partners", label: "Partners" },
  { href: "/member-portal", label: "Knowledge Base" },
];

export default function AppNav() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/dashboard/access", { cache: "no-store" })
      .then(response => response.ok ? response.json() : { authenticated: false })
      .then(data => {
        if (!active) return;
        setSignedIn(data.authenticated === true);
        setIsAdmin(data.admin === true);
      })
      .catch(() => {
        if (active) { setSignedIn(false); setIsAdmin(false); }
      });
    return () => { active = false; };
  }, []);

  const tabs = [
    ...publicTabs,
    ...(signedIn ? [{ href: "/dashboard", label: "Dashboard" }, { href: "/profile", label: "Profile" }] : []),
    ...(isAdmin ? adminTabs : []),
  ];

  return (
    <header className="vt-site-header">
      <div className="vt-nav-inner">
        <Link href="/" className="vt-nav-brand-block" aria-label="VaultTrades home">
          <span className="vt-nav-brand">VAULTTRADES</span>
          <span className="vt-nav-tagline">Built by Traders.</span>
          <span className="vt-nav-slogan">Focus. Discipline. Consistency.</span>
        </Link>
        <nav className="vt-nav-links" aria-label="VaultTrades navigation">
          {tabs.map(tab => {
            const active = pathname === tab.href || (tab.href !== "/" && pathname.startsWith(tab.href));
            return <Link key={tab.href} href={tab.href} className={"vt-nav-link" + (active ? " active" : "")}>{tab.label}</Link>;
          })}
          {!signedIn && <Link href="/auth/login" className="vt-nav-link">Sign in</Link>}
        </nav>
      </div>
    </header>
  );
}

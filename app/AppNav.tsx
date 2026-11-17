"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const publicTabs = [
  { href: "/", label: "Home" },
  { href: "/contact-partner", label: "Products" },
];

const adminTabs = [
  { href: "/partners", label: "Partners" },
  { href: "/member-portal", label: "Knowledge Base" },
];

export default function AppNav() {
  const pathname = usePathname();
  const [isPartnerSubdomain, setIsPartnerSubdomain] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [hasResellerAccess, setHasResellerAccess] = useState(false);

  useEffect(() => {
    const host = window.location.hostname.toLowerCase();
    setIsPartnerSubdomain(host.endsWith(".vaulttradesve.com") && host !== "www.vaulttradesve.com");
  }, []);

  useEffect(() => {
    if (isPartnerSubdomain) return;
    let active = true;
    fetch("/api/dashboard/access", { cache: "no-store" })
      .then(response => response.ok ? response.json() : { authenticated: false })
      .then(data => {
        if (!active) return;
        setSignedIn(data.authenticated === true);
        setIsAdmin(data.admin === true);
        setHasResellerAccess(data.reseller?.enabled === true);
      })
      .catch(() => {
        if (active) { setSignedIn(false); setIsAdmin(false); }
      });
    return () => { active = false; };
  }, [isPartnerSubdomain]);

  // Partner acquisition pages use their own focused branding and funnel navigation.
  // Do not expose central Home, Products or Sign in links on partner subdomains.
  if (isPartnerSubdomain) return null;

  const tabs = [
    ...publicTabs,
    ...(signedIn ? [{ href: "/dashboard", label: "Dashboard" }, { href: "/profile", label: "Profile" }] : []),
    ...((isAdmin || hasResellerAccess) ? adminTabs.filter(tab => tab.href === "/member-portal") : []),
    ...(isAdmin ? adminTabs.filter(tab => tab.href !== "/member-portal") : []),
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
            const tabPath = tab.href.split("?")[0];
            const active = pathname === tabPath || (tabPath !== "/" && pathname.startsWith(tabPath));
            return <Link key={tab.href} href={tab.href} className={"vt-nav-link" + (active ? " active" : "")}>{tab.label}</Link>;
          })}
          {!signedIn && <Link href="/auth/login" className="vt-nav-link">Sign in</Link>}
        </nav>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="vt-home">
      <section className="vt-hero">
        <div className="vt-eyebrow">BUILT BY TRADERS.</div>
        <h1>Trade with structure. Manage risk. Execute with discipline.</h1>
        <p>Welcome to VaultTrades. Explore the product catalogue to see the services currently offered.</p>
        <div className="vt-actions">
          <Link className="vt-primary" href="/products">View VaultTrades Products</Link>
          <a
            className="vt-secondary vt-whatsapp-contact"
            href="https://wa.me/27746653633?text=Hello%20VaultTrades%20Admin%2C%20I%20would%20like%20general%20information."
            target="_blank"
            rel="noopener noreferrer"
          >
            Contact Admin
          </a>
        </div>
        <div className="vt-hero-note">Focus. Discipline. Consistency.</div>
      </section>
    </main>
  );
}

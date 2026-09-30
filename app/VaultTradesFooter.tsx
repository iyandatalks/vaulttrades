import type { ReactNode } from "react";

export default function VaultTradesFooter() {
  return (
    <footer className="vt-global-footer">
      <div className="vt-global-footer-brand">VAULTTRADES</div>
      <div className="vt-global-footer-tagline">Built by Traders. Focus, discipline, consistency.</div>
      <p>
        <strong>Disclaimer:</strong> VaultTrades is an analytical and trading-support platform.
        It does not provide financial advice, investment advice or a guarantee of trading results.
        Trading involves substantial risk and users remain solely responsible for their own trading decisions.
      </p>
      <div className="vt-global-footer-copy">© 2026 VaultTrades. All rights reserved.</div>
    </footer>
  );
}

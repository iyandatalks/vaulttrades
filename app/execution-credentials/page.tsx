"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function ExecutionCredentialsPage() {
  const [credential, setCredential] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
        const { data: { session } } = await sb.auth.getSession();
        if (!session?.access_token) { setError("Please log in to VaultTrades first."); return; }
        const response = await fetch("/api/execution/credentials", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store"
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load credential");
        setCredential(data.credential);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load credential");
      } finally { setLoading(false); }
    })();
  }, []);

  async function copyKey() {
    if (!credential?.access_key) return;
    await navigator.clipboard.writeText(credential.access_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <main className="shell">
      <section className="card" style={{ maxWidth: 820, margin: "0 auto" }}>
        <div className="section-label">EXECUTION CREDENTIALS</div>
        <h1 className="title">TradingView & MT5 Access</h1>
        <p className="muted">Your execution key authorizes TradingView webhook requests and the VaultTrades MT5 worker. Keep it private.</p>
        {loading && <p className="muted">Loading your credential…</p>}
        {error && <div className="card" style={{ marginTop: 20, border: "1px solid rgba(220,80,80,.5)" }}><strong>{error}</strong></div>}
        {!loading && credential && <div className="card" style={{ marginTop: 20, border: "1px solid rgba(212,166,55,.35)" }}>
          <div className="section-label">VAULTTRADES ACCESS KEY</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
            <code style={{ flex: 1, minWidth: 260, padding: "12px 14px", borderRadius: 8, background: "#050812", letterSpacing: ".06em" }}>{credential.access_key_masked}</code>
            <button className="button" type="button" onClick={copyKey}>{copied ? "Copied" : "Copy key"}</button>
          </div>
          <p className="muted" style={{ marginTop: 12 }}>Use this key in the MT5 EA and in your TradingView webhook. Never post it in chat or commit it to source control.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginTop: 18 }}>
            <div><small className="muted">Platform</small><div>{credential.platform || "—"}</div></div>
            <div><small className="muted">MT5 Login</small><div>{credential.mt_login || "—"}</div></div>
            <div><small className="muted">Broker</small><div>{credential.broker_name || "—"}</div></div>
            <div><small className="muted">Server</small><div>{credential.broker_server || "—"}</div></div>
          </div>
        </div>}
        <div className="card" style={{ marginTop: 20 }}>
          <div className="section-label">TEST SAFETY</div>
          <p className="muted">The MT5 integration must remain in OBSERVE mode for the initial C–I verification. Live execution stays disabled until the demo execution test passes.</p>
        </div>
      </section>
    </main>
  );
}

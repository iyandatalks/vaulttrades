"use client";

import { useState } from "react";

export default function CopySupportPage() {
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!message.trim()) return;
    setBusy(true);
    try {
      const r = await fetch("/api/copy/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestType: "PAIRING_RESET", message }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Unable to submit request.");
      setSent(true);
      setMessage("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Unable to submit request.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="vt-info-page">
      <div className="vt-info-wrap">
        <header className="vt-info-hero">
          <div className="vt-label">VAULTTRADES COPY · SUPPORT</div>
          <h1>Copier activation support.</h1>
          <p>If your pairing code expired unused, or you need to replace an already activated MT5 account, submit a request here. No personal admin contact details are required.</p>
        </header>
        <section className="vt-info-card">
          <div className="vt-label">PAIRING RESET REQUEST</div>
          <h2 style={{ marginTop: 10 }}>Request a new activation</h2>
          <p>Customer activations are limited to one pairing-code generation per subscription period. VaultTrades Support can reset the activation when necessary.</p>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Tell us why you need the Copier activation reset."
            rows={6}
            style={{ width: "100%", marginTop: 12, padding: 12, borderRadius: 10 }}
          />
          <button className="vt-primary" onClick={() => void submit()} disabled={busy || !message.trim()} style={{ marginTop: 12 }}>
            {busy ? "Submitting…" : "Submit Support Request"}
          </button>
          {sent && <p style={{ marginTop: 14 }}>Request submitted. VaultTrades Support can review it from the admin portal.</p>}
        </section>
      </div>
    </main>
  );
}

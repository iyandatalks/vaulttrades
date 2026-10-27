"use client";

import { useCallback, useEffect, useState } from "react";

type Registration = {
  id: string;
  auth_user_id: string;
  email: string | null;
  mt5_login: string | null;
  created_at: string;
  broker_referral_status: "pending" | "verified" | "review_required";
  broker_referral_mt5_login: string | null;
  broker_referral_verified_at: string | null;
  onboarding_notified_at: string | null;
};

export default function WeltradeReferralsPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [brokerLogins, setBrokerLogins] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/weltrade-referrals", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Unable to load registrations.");
    setRegistrations(data.registrations ?? []);
  }, []);

  useEffect(() => { void load().catch(e => setError(e instanceof Error ? e.message : "Unable to load registrations.")); }, [load]);

  async function act(registration: Registration, action: "verify" | "notify") {
    setBusyId(registration.id); setMessage(""); setError("");
    try {
      const response = await fetch("/api/admin/weltrade-referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationId: registration.id,
          action,
          brokerMt5Login: brokerLogins[registration.id] ?? registration.broker_referral_mt5_login ?? "",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Request failed.");
      setMessage(data.message || "Saved.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
      await load().catch(() => undefined);
    } finally { setBusyId(null); }
  }

  return (
    <main className="vt-info-page">
      <div className="vt-info-wrap">
        <header className="vt-info-hero">
          <div className="vt-label">ADMIN · COPY TRADING</div>
          <h1>Broker referral verification</h1>
          <p>Match the MT5 number from the broker’s referral report against the number the customer submitted. Only verified, unique matches can receive the in-profile onboarding notice.</p>
        </header>
        {message && <div className="vt-info-card" role="status" style={{ marginBottom: 14 }}>{message}</div>}
        {error && <div className="vt-info-card" role="alert" style={{ marginBottom: 14, border: "1px solid rgba(220,80,80,.45)" }}>{error}</div>}
        <section className="vt-info-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div><div className="vt-label">CUSTOMER REGISTRATIONS</div><p className="muted">Showing the latest 250 registrations. Verification and copier connection are separate statuses.</p></div>
            <button className="vt-secondary" onClick={() => void load().catch(e => setError(e.message))}>Refresh</button>
          </div>
          {!registrations.length ? <p className="muted">No copy-trading registrations found.</p> : (
            <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
              {registrations.map(registration => {
                const busy = busyId === registration.id;
                return (
                  <article key={registration.id} style={{ border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <strong>{registration.email || "Email unavailable"}</strong>
                        <div className="muted" style={{ marginTop: 5 }}>Customer-submitted MT5: <strong>{registration.mt5_login || "Not provided"}</strong></div>
                        <div className="muted">Registered: {new Date(registration.created_at).toLocaleString()}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <strong style={{ color: registration.broker_referral_status === "verified" ? "#d4a637" : registration.broker_referral_status === "review_required" ? "#f0a36a" : "#9ba6b6" }}>
                          {registration.broker_referral_status.replace("_", " ").toUpperCase()}
                        </strong>
                        <div className="muted" style={{ marginTop: 5 }}>{registration.onboarding_notified_at ? "Notification sent" : "Notification not sent"}</div>
                      </div>
                    </div>
                    <label style={{ display: "block", marginTop: 14, fontSize: 13 }}>MT5 account number in the broker referral report</label>
                    <input
                      inputMode="numeric"
                      value={brokerLogins[registration.id] ?? registration.broker_referral_mt5_login ?? ""}
                      onChange={event => setBrokerLogins(current => ({ ...current, [registration.id]: event.target.value.trim() }))}
                      placeholder="Enter broker-reported MT5 number"
                      style={{ width: "100%", padding: 12, borderRadius: 9, marginTop: 6 }}
                    />
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                      <button className="vt-primary" disabled={busy} onClick={() => void act(registration, "verify")}>{busy ? "Saving…" : "Verify exact match"}</button>
                      <button className="vt-secondary" disabled={busy || registration.broker_referral_status !== "verified" || !!registration.onboarding_notified_at} onClick={() => void act(registration, "notify")}>Send in-profile notification</button>
                    </div>
                    {registration.broker_referral_verified_at && <div className="muted" style={{ marginTop: 8 }}>Verified: {new Date(registration.broker_referral_verified_at).toLocaleString()}</div>}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

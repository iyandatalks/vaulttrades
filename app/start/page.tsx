"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import "./start.css";

export default function StartPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [cellphone, setCellphone] = useState("");
  const [processingConsent, setProcessingConsent] = useState(false);
  const [emailMarketing, setEmailMarketing] = useState(false);
  const [whatsappMarketing, setWhatsappMarketing] = useState(false);
  const [partnerShareConsent, setPartnerShareConsent] = useState(false);
  const [paramsHasPartner, setParamsHasPartner] = useState(false);
  useState(() => { if (typeof window !== "undefined") setParamsHasPartner(Boolean(new URLSearchParams(window.location.search).get("ref"))); return null; });
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!processingConsent) {
      setError("Please confirm that VaultTrades may use your details to respond to this access request.");
      return;
    }
    const partnerCode = new URLSearchParams(window.location.search).get("ref") || "";
    if (partnerCode && !partnerShareConsent) {
      setError("Please confirm whether your contact details may be shared with the referring VaultTrades partner.");
      return;
    }

    setBusy(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const response = await fetch("/api/marketing-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          email,
          cellphone,
          processingConsent,
          emailMarketing,
          whatsappMarketing,
          partnerCode,
          partnerShareConsent,
          website,
          source: params.get("utm_source") || params.get("ref") || "bio_link",
          campaign: params.get("utm_campaign") || "",
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "We could not submit your details. Please try again.");
      router.push("/opportunity");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main className="vt-start-page">
      <section className="vts-hero">
        <div className="vts-image" role="img" aria-label="VaultTrades lifestyle workspace" />
        <div className="vts-shade" />
        <div className="vts-top">
          <a href="/start" className="vts-brand">VAULT<span>TRADES</span></a>
          <span className="vts-top-note">BUILT BY TRADERS.</span>
        </div>

        <div className="vts-content">
          <div className="vts-copy">
            <div className="vts-kicker">A NEW WAY TO APPROACH YOUR NEXT MOVE</div>
            <h1>A process you can follow.<br /><em>A business you can build.</em></h1>
            <p>Explore a structured trading pathway alongside the opportunity to develop practical digital-business skills—at your own pace, with clear expectations.</p>
            <div className="vts-popouts">
              <div><span>01 / STRUCTURE</span><strong>A process<br />you can follow.</strong></div>
              <div><span>02 / POSSIBILITY</span><strong>A business<br />you can build.</strong></div>
            </div>
            <div className="vts-promise">FOCUS. DISCIPLINE. CONSISTENCY.</div>
          </div>

          <div className="vts-form-wrap" id="get-access">
            <div className="vts-form-kicker">YOUR NEXT STEP STARTS HERE</div>
            <h2>Get the opportunity overview.</h2>
            <p className="vts-form-intro">Leave your details to see what the VaultTrades opportunity involves and explore whether it is right for you.</p>
            <form onSubmit={submitLead} className="vts-form">
              <label>First name<input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" maxLength={100} placeholder="Your first name" required /></label>
              <label>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={254} placeholder="you@example.com" required /></label>
              <label>Cellphone number<input type="tel" value={cellphone} onChange={(e) => setCellphone(e.target.value)} autoComplete="tel" maxLength={30} placeholder="+27 ..." required /></label>

              <div className="vts-honeypot" aria-hidden="true"><label>Leave this field empty<input value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" /></label></div>

              <label className="vts-consent required"><input type="checkbox" checked={processingConsent} onChange={(e) => setProcessingConsent(e.target.checked)} required /><span>I agree that VaultTrades may use these details to respond to my request and provide access to the opportunity information. I have read the <a href="/privacy-policy" target="_blank" rel="noreferrer">Privacy Policy</a>.</span></label>

              {paramsHasPartner && <label className="vts-consent required"><input type="checkbox" checked={partnerShareConsent} onChange={(e) => setPartnerShareConsent(e.target.checked)} /><span>I agree that my name, email address and cellphone number may be shared with the VaultTrades partner who referred me, as well as VaultTrades, so they can follow up on my enquiry. I understand I can contact VaultTrades about my privacy choices.</span></label>}
              <div className="vts-marketing-title">OPTIONAL UPDATES</div>
              <label className="vts-consent"><input type="checkbox" checked={emailMarketing} onChange={(e) => setEmailMarketing(e.target.checked)} /><span>I would also like to receive VaultTrades updates by email. I can unsubscribe at any time.</span></label>
              <label className="vts-consent"><input type="checkbox" checked={whatsappMarketing} onChange={(e) => setWhatsappMarketing(e.target.checked)} /><span>I would also like to receive VaultTrades updates by WhatsApp. I can opt out at any time.</span></label>

              {error && <p className="vts-error" role="alert">{error}</p>}
              <button type="submit" className="vts-submit" disabled={busy}>{busy ? "SUBMITTING..." : "YES, I WANT TO GET ACCESS"} <span>→</span></button>
              <p className="vts-privacy-note">Your details are used in line with the choices above. Your contact information is not displayed publicly.</p>
            </form>
          </div>
        </div>
        <div className="vts-bottom-note">A clearer process. A chance to learn. Your decision.</div>
      </section>
      <section className="vts-disclaimer"><strong>Important:</strong> Trading involves risk and losses are possible. No trading profits, business income or reseller commissions are guaranteed. Take time to understand the opportunity and its terms before making a decision.</section>
    </main>
  );
}

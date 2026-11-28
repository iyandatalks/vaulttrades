"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import "./start.css";
import VaultTradesFaq from "../VaultTradesFaq";

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
  const [resolvedPartnerCode, setResolvedPartnerCode] = useState("");
  const [partnerAttributionReady, setPartnerAttributionReady] = useState(false);
  const [generalContactWhatsApp, setGeneralContactWhatsApp] = useState("");
  useEffect(() => {
    const host = window.location.hostname.toLowerCase();
    const queryCode = new URLSearchParams(window.location.search).get("ref") || "";
    const partnerHost = host.endsWith(".vaulttradesve.com") && host !== "www.vaulttradesve.com";
    setParamsHasPartner(Boolean(queryCode) || partnerHost);
    if (queryCode) { setResolvedPartnerCode(queryCode.toUpperCase()); setPartnerAttributionReady(true); }
    if (partnerHost) fetch("/api/partner-site", { cache: "no-store" }).then(r => r.json()).then(data => {
      if (data.assigned && data.partnerCode) { setResolvedPartnerCode(String(data.partnerCode).toUpperCase()); setGeneralContactWhatsApp(String(data.generalContactWhatsApp || "")); }
      else setError("This partner website has not yet been assigned to an active VaultTrades partner account. Please contact VaultTrades before accepting enquiries.");
    }).catch(() => setError("We could not verify this partner website. Please try again later.")).finally(() => setPartnerAttributionReady(true));
    else setPartnerAttributionReady(true);
  }, []);
  const [website, setWebsite] = useState("");
  const publicWhatsAppUrl = generalContactWhatsApp ? "https://wa.me/" + generalContactWhatsApp.replace(/\D/g, "").replace(/^0/, "27") : "";
  const womensFoundersUrl = "https://vaulttradesve.com/womens-provincial-founders" + (resolvedPartnerCode ? "?ref=" + encodeURIComponent(resolvedPartnerCode) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!processingConsent) {
      setError("Please confirm that VaultTrades may use your details to respond to this access request.");
      return;
    }
    const partnerCode = resolvedPartnerCode || new URLSearchParams(window.location.search).get("ref") || "";
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
          source: params.get("utm_source") || (params.get("ref") ? "partner_lead_link" : "bio_link"),
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

        {generalContactWhatsApp && <a href={publicWhatsAppUrl+"?text="+encodeURIComponent("Hello, I am visiting your VaultTrades website and would like to enquire about the Master Reseller opportunity. Please share more information with me.")} target="_blank" rel="noreferrer" aria-label="For Inquiries on WhatsApp" style={{position:"absolute",zIndex:2,right:24,top:72,display:"inline-flex",alignItems:"center",gap:8,color:"#25D366",fontSize:12,fontWeight:800,letterSpacing:".12em",textDecoration:"none"}}><svg aria-hidden="true" viewBox="0 0 32 32" width="20" height="20" fill="currentColor"><path d="M16 3.2A12.3 12.3 0 0 0 5.4 21.7L4 28l6.5-1.7A12.3 12.3 0 1 0 16 3.2Zm0 22.4c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.8 1 1-3.7-.3-.4A10 10 0 1 1 16 25.6Zm5.5-7.4c-.3-.2-1.8-.9-2.1-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7.1a8.2 8.2 0 0 1-2.5-1.5 9.2 9.2 0 0 1-1.7-2.1c-.2-.3 0-.5.1-.7l.5-.6.3-.5c.1-.2 0-.4 0-.6l-1-2.3c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4s-1.2 1.2-1.2 2.8 1.2 3.2 1.4 3.4c.2.2 2.4 3.7 5.8 5.1.8.3 1.4.5 1.9.6.8.3 1.5.2 2 .1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.2-.3-.3-.6-.4Z"/></svg>FOR INQUIRIES</a>}
        <div className="vts-content">
          <div className="vts-copy">
            <div className="vts-kicker">THE MASTER RESELLER RIGHTS OPPORTUNITY</div>
            <h1>A process you can follow.<br /><em>A business you can build.</em></h1>
            <p>Explore the VaultTrades Master Reseller Rights opportunity: build your own branded digital-products business, introduce customers to the wider VaultTrades portfolio and access trading tools and learning resources as supporting products.</p>
            <div className="vts-popouts">
              <div><span>01 / RESELLER RIGHTS</span><strong>Master Reseller<br />Rights.</strong></div>
              <div><span>02 / BUSINESS</span><strong>A business<br />you can build.</strong></div>
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

      <section aria-label="Women’s Provincial Founding Partners" style={{ background: "#0a0e17", borderTop: "1px solid #3a3020", borderBottom: "1px solid #3a3020", padding: "26px 20px" }}>
        <div style={{ width: "min(1120px, 100%)", margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(120px, 190px) 1fr auto", gap: 20, alignItems: "center" }}>
          <img src="/images/womens-founders.jpg" alt="Women building a shared provincial business" style={{ display: "block", width: "100%", aspectRatio: "3 / 2", objectFit: "contain", borderRadius: 6, border: "1px solid rgba(215,180,90,.4)" }} />
          <div>
            <div style={{ color: "#d7b45a", fontSize: 10, fontWeight: 900, letterSpacing: ".16em" }}>81 WOMEN · 9 PROVINCES</div>
            <h2 style={{ color: "#f5f1e8", fontSize: "clamp(20px, 3vw, 30px)", margin: "7px 0" }}>Explore the Women’s Provincial Founding Partners opportunity.</h2>
            <p style={{ color: "#b8c0cc", fontSize: 13, lineHeight: 1.7, margin: 0 }}>A collective business opportunity for women to build together through one shared provincial arrangement.</p>
          </div>
          <a href={womensFoundersUrl} aria-disabled={!partnerAttributionReady || (paramsHasPartner && !resolvedPartnerCode)} style={{ display: "inline-block", background: "#d7b45a", color: "#090b10", padding: "14px 17px", borderRadius: 4, fontWeight: 900, fontSize: 11, letterSpacing: ".06em", textDecoration: "none", whiteSpace: "nowrap", opacity: !partnerAttributionReady || (paramsHasPartner && !resolvedPartnerCode) ? .5 : 1, pointerEvents: !partnerAttributionReady || (paramsHasPartner && !resolvedPartnerCode) ? "none" : "auto" }}>EXPLORE THIS OPPORTUNITY →</a>
        </div>
        <style jsx>{`@media(max-width:700px){section[aria-label="Women’s Provincial Founding Partners"] > div{grid-template-columns:100px 1fr!important;gap:12px!important}section[aria-label="Women’s Provincial Founding Partners"] > div > a{grid-column:1/-1;text-align:center}}`}</style>
      </section>

      <section className="vts-memberships" aria-labelledby="vts-memberships-title">
        <div className="vts-memberships-inner">
          <div className="vts-memberships-heading">
            <div className="vts-kicker">CHOOSE YOUR VAULTTRADES MEMBERSHIP</div>
            <h2 id="vts-memberships-title">Explore the three <em>membership pathways.</em></h2>
            <p>Select a plan to continue through the VaultTrades checkout. Your partner reference is carried into checkout, where you can create or sign in to your VaultTrades profile before completing the payment declaration and setup steps.</p>
          </div>
          <div className="vts-membership-grid">
            <article className="vts-membership-card">
              <span>PLAN 1 · CORE MEMBERSHIP</span><h3>VaultTrades Nexus</h3><strong>$150 <small>USD · once-off</small></strong>
              <p className="vts-plan-summary">Your starting package for the core VaultTrades trading and business pathway.</p>
              <ul>
                <li>Nexus automation product</li>
                <li>Trading guidance and learning resources</li>
                <li>Free member community access</li>
                <li>Basics of Trading lessons and reseller Knowledge Base</li>
                <li>Access to the membership reseller opportunity</li>
              </ul>
              <a href={"/membership/checkout?plan=nexus" + (resolvedPartnerCode ? "&ref=" + encodeURIComponent(resolvedPartnerCode) : "")}>Choose Nexus <b>→</b></a>
            </article>
            <article className="vts-membership-card featured">
              <span>PLAN 2 · EXPANDED TOOLS</span><h3>VaultTrades Nexus Plus</h3><strong>$250 <small>USD · once-off</small></strong>
              <p className="vts-plan-summary">Everything in Nexus, plus the Nexus Plus automation product and expanded trading-development resources.</p>
              <ul>
                <li>Everything included in Nexus</li>
                <li>Nexus Plus automation product</li>
                <li>Additional trading indicators and tools</li>
                <li>Trading development and scaling resources</li>
                <li>Analyzer is optional at $20/month, separately</li>
                <li>Journal and core tools require a separate $10/month package</li>
              </ul>
              <a href={"/membership/checkout?plan=nexus_plus" + (resolvedPartnerCode ? "&ref=" + encodeURIComponent(resolvedPartnerCode) : "")}>Choose Nexus Plus <b>→</b></a>
            </article>
            <article className="vts-membership-card">
              <span>PLAN 3 · COMPLETE PACKAGE</span><h3>VaultTrades Vortex</h3><strong>$550 <small>USD · once-off</small></strong>
              <p className="vts-plan-summary">The most complete package, combining all three automation products with advanced trading and development support.</p>
              <ul>
                <li>Everything included in Nexus and Nexus Plus</li>
                <li>All three automation products: Nexus, Nexus Plus and Vortex</li>
                <li>Full risk-management resources and both trading indicators</li>
                <li>Advanced trading and business-scaling resources</li>
                <li>Expanded affiliate-development guidance</li>
                <li>One-on-one mentorship</li>
              </ul>
              <a href={"/membership/checkout?plan=vortex" + (resolvedPartnerCode ? "&ref=" + encodeURIComponent(resolvedPartnerCode) : "")}>Choose Vortex <b>→</b></a>
            </article>
          </div>
          <div className="vts-price-clarity">
            <h3>Exactly what the package price covers</h3>
            <p className="vts-price-lead">The amount shown on each plan is the full one-time membership package price. It is paid in two clearly identified parts:</p>
            <div className="vts-price-parts">
              <div><span>80% · PARTNER PAYMENT / ELIGIBLE RESELLER COMMISSION</span><strong>Nexus $120 · Plus $200 · Vortex $440</strong><small>Paid through the referring partner's PayPal checkout link.</small></div>
              <div><span>20% · VAULTTRADES EA SETUP ALLOCATION</span><strong>Nexus $30 · Plus $50 · Vortex $110</strong><small>Paid separately to VaultTrades for the EA setup allocation.</small></div>
            </div>
            <p className="vts-price-footnote">The two payments add up to the selected membership price: $150, $250 or $550. There is no additional EA setup fee on top of that package price.</p>
            <div className="vts-website-fee"><strong>Joining the reseller programme?</strong> Personal website setup is an additional <b>$39 USD once-off</b>. This fee applies to the reseller programme and is not included in the membership price. A personalised domain is optional and any domain-related cost is disclosed separately.</div>
            <div className="vts-separate-tools"><strong>Separate monthly tools:</strong> Analyzer ($20/month) and the Journal/core-tools package ($10/month) are not included in Nexus Plus or Vortex package pricing unless explicitly stated in a separate offer.</div>
          </div>
          <p className="vts-memberships-note">Choose the package based on the products and support you want included. Payments and access remain subject to verification. Trading involves risk; no trading or business income is guaranteed.</p>
        </div>
      </section>
      <VaultTradesFaq />
      <section className="vts-disclaimer"><strong>Important:</strong> Trading involves risk and losses are possible. No trading profits, business income or reseller commissions are guaranteed. Take time to understand the opportunity and its terms before making a decision.</section>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";

const outcomes = [
  ["01", "A repeatable trading routine", "Know what to check before, during and after a trade instead of improvising under pressure."],
  ["02", "A defined risk framework", "Work with risk per trade, position sizing, invalidation, drawdown awareness and daily boundaries."],
  ["03", "A setup decision process", "Learn to evaluate structure, liquidity, FIB levels, FVGs, OBs, EMA conditions and session context without turning the chart into noise."],
  ["04", "Execution discipline", "Build rules around entries, stops, targets, trade management and when to stay out."],
  ["05", "A psychology framework", "Work on FOMO, revenge trading, hesitation, overconfidence and the habit of breaking your own rules."],
  ["06", "A review habit", "Review whether the process was followed — not simply whether the last trade won or lost."],
];

const packageItems = [
  "Online 1-on-1 onboarding and trading review",
  "Weekly online trading psychology live class",
  "Daily online trading insights",
  "Online trade-with-me sessions",
  "VaultTrades strategy and execution education",
  "Risk-management frameworks and trading checklists",
  "Trading psychology and discipline training",
  "VaultTrades training and e-book library",
  "Technology and automation education",
  "OBSERVE → VALIDATE → LIVE framework",
  "Online community accountability and development",
];

type Testimonial = {
  id: string;
  display_name: string;
  product_code: string | null;
  testimonial: string;
  created_at: string;
};

export default function VaultTradesCommunitySales() {
  const checkout = "/subscription?product=founders_mentorship_once&start=1";
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [canSubmit, setCanSubmit] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [testimonial, setTestimonial] = useState("");
  const [testimonialStatus, setTestimonialStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/community-testimonials", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("load_failed");
        return res.json();
      })
      .then((data) => {
        setTestimonials(data.testimonials ?? []);
        setCanSubmit(Boolean(data.canSubmit));
        setSignedIn(Boolean(data.signedIn));
      })
      .catch(() => {});
  }, []);

  async function submitTestimonial() {
    setSubmitting(true);
    setTestimonialStatus("");

    try {
      const res = await fetch("/api/community-testimonials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testimonial }),
      });
      const data = await res.json();

      if (!res.ok) {
        setTestimonialStatus(data.message || "Your testimonial could not be submitted.");
        return;
      }

      setTestimonial("");
      setCanSubmit(false);
      setTestimonialStatus(data.message || "Submitted for review.");
    } catch {
      setTestimonialStatus("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="vt-community-sales">
      <section className="vt-community-hero">
        <div className="vt-community-nav">
          <div className="vt-brand">Vault<span>Trades</span></div>
          <div className="vt-online-badge">100% ONLINE COMMUNITY</div>
        </div>

        <div className="vt-community-hero-inner">
          <div className="vt-label">VAULTTRADES COMMUNITY · NEXT PROGRAM</div>
          <h1>Sign up for the next<br /><span>program online.</span></h1>
          <p>
            Join the next VaultTrades Community programme and build a more structured approach
            to trading around risk management, disciplined execution, psychology and technology.
          </p>
          <div className="vt-community-actions">
            <a className="vt-community-cta" href={checkout}>SIGN UP FOR THE NEXT PROGRAM <b>→</b></a>
            <a className="vt-community-link" href="#package">See what is included</a>
          </div>
          <div className="vt-community-motto">CAPITAL FIRST · RISK DEFINED · PROCESS FOLLOWED · EXECUTION DISCIPLINED</div>
        </div>
      </section>

      <section className="vt-community-dark">
        <div className="vt-community-container vt-problem-grid">
          <div>
            <div className="vt-label">THE VAULTTRADES DIFFERENCE</div>
            <h2>Trading is not won by finding more information.</h2>
          </div>
          <div className="vt-community-copy">
            <p>There are enough indicators, strategies and signals.</p>
            <p>The real problem is what happens after the setup appears: the late entry, oversized position, moved stop, revenge trade or decision made from emotion.</p>
            <p><strong>VaultTrades is built around the process between analysis and execution.</strong></p>
          </div>
        </div>
      </section>

      <section className="vt-community-section" id="what-you-build">
        <div className="vt-community-container">
          <div className="vt-label">WHAT YOU WILL BUILD</div>
          <h2>Six capabilities that turn trading from reaction into process.</h2>
          <div className="vt-outcome-grid">
            {outcomes.map(([n, title, text]) => (
              <article className="vt-outcome" key={n}>
                <div>{n}</div><h3>{title}</h3><p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="vt-community-dark">
        <div className="vt-community-container">
          <div className="vt-label">THE VAULTTRADES FRAMEWORK</div>
          <div className="vt-framework">
            {["MARKET", "SETUP", "SIGNAL", "RISK", "EXECUTE", "MANAGE", "REVIEW"].map((x, i) => (
              <div key={x}><small>0{i + 1}</small><strong>{x}</strong></div>
            ))}
          </div>
          <div className="vt-framework-bottom">DEFINE → CALCULATE → EXECUTE → CONTROL → REVIEW</div>
          <p className="vt-framework-note">The objective is not to eliminate losing trades. <strong>The objective is to prevent one trade from becoming a damaging decision.</strong></p>
        </div>
      </section>

      <section className="vt-community-section">
        <div className="vt-community-container">
          <div className="vt-label">WHAT YOU GET</div>
          <h2>Everything is delivered online.</h2>
          <div className="vt-package-list">
            {packageItems.map((item, i) => (
              <div key={item}><span>{String(i + 1).padStart(2, "0")}</span><b>{item}</b></div>
            ))}
          </div>
        </div>
      </section>

      <section className="vt-community-dark vt-testimonials-section" id="testimonials">
        <div className="vt-community-container">
          <div className="vt-label">COMMUNITY TESTIMONIES</div>
          <h2>Hear from people who have actually purchased and used VaultTrades products.</h2>
          <p className="vt-testimonials-intro">
            Testimonials are restricted to customers with a verified active purchased VaultTrades product.
            New submissions are reviewed before they are published.
          </p>

          {testimonials.length > 0 ? (
            <div className="vt-testimonials-grid">
              {testimonials.map((item) => (
                <article className="vt-testimonial" key={item.id}>
                  <div className="vt-testimonial-mark">“</div>
                  <p>{item.testimonial}</p>
                  <div className="vt-testimonial-author">
                    <strong>{item.display_name}</strong>
                    <span>Verified VaultTrades customer</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="vt-testimonials-empty">
              <strong>The first community testimonies will appear here.</strong>
              <span>Customers with active purchased products can submit theirs below.</span>
            </div>
          )}

          <div className="vt-testimonial-submit">
            <div>
              <div className="vt-label">ADD YOUR EXPERIENCE</div>
              <h3>Share your VaultTrades experience.</h3>
              <p>
                Signing up for an account alone does not qualify. You must have an active purchased
                VaultTrades product to submit a testimonial.
              </p>
            </div>

            {canSubmit ? (
              <div className="vt-testimonial-form">
                <textarea
                  value={testimonial}
                  onChange={(e) => setTestimonial(e.target.value)}
                  maxLength={1000}
                  placeholder="Tell the community what changed in your trading process, education or experience with VaultTrades..."
                  rows={6}
                />
                <div className="vt-testimonial-form-footer">
                  <span>{testimonial.length}/1000</span>
                  <button
                    className="vt-community-cta vt-testimonial-button"
                    onClick={submitTestimonial}
                    disabled={submitting || testimonial.trim().length < 20}
                  >
                    {submitting ? "SUBMITTING..." : "SUBMIT TESTIMONY"}
                  </button>
                </div>
                {testimonialStatus && <div className="vt-testimonial-status">{testimonialStatus}</div>}
              </div>
            ) : (
              <div className="vt-testimonial-gate">
                <strong>{signedIn ? "Active product required" : "Customer access required"}</strong>
                <p>
                  {signedIn
                    ? "Your account does not currently have an active purchased product. Purchase a VaultTrades product to unlock testimonial submission."
                    : "Sign in to your VaultTrades account after purchasing a product to unlock testimonial submission."}
                </p>
                <div className="vt-community-actions">
                  {!signedIn && <a className="vt-community-link" href="/auth/login?next=%2Fcommunity">SIGN IN</a>}
                  <a className="vt-community-cta" href={checkout}>VIEW PRODUCTS <b>→</b></a>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="vt-community-dark">
        <div className="vt-community-container vt-problem-grid">
          <div>
            <div className="vt-label">TECHNOLOGY</div>
            <h2>Learn how the VaultTrades workflow connects.</h2>
          </div>
          <div className="vt-community-copy">
            <div className="vt-flow">TradingView <i>→</i> VaultTrades <i>→</i> Validation <i>→</i> Risk Rules <i>→</i> MT5</div>
            <p>Automation is not presented as a profit machine. It is treated as an execution layer that must operate inside defined rules.</p>
            <p><strong>OBSERVE → VALIDATE → LIVE.</strong> Test the behaviour before trusting technology with live capital.</p>
          </div>
        </div>
      </section>

      <section className="vt-community-section" id="package">
        <div className="vt-community-container">
          <div className="vt-label">FOUNDING PACKAGE</div>
          <div className="vt-package-card">
            <div>
              <div className="vt-package-tag">VAULTTRADES COMMUNITY</div>
              <h2>Build your trading process before you try to scale it.</h2>
              <p>This is a strictly online programme for traders who want structure, risk discipline, accountability and a repeatable way to approach the market.</p>
              <div className="vt-achieve">
                <h3>By working through the programme, you should be able to:</h3>
                <ul>
                  <li>Build a pre-trade and post-trade routine.</li>
                  <li>Define risk before thinking about position size.</li>
                  <li>Recognise when a setup does not qualify.</li>
                  <li>Separate a good process from a profitable outcome.</li>
                  <li>Identify emotional and behavioural trading patterns.</li>
                  <li>Understand the path from strategy observation to controlled execution.</li>
                </ul>
              </div>
            </div>
            <div className="vt-price-box">
              <div className="vt-label">FOUNDING ACCESS</div>
              <div className="vt-price">$88.88</div>
              <div className="vt-once">ONCE-OFF · FIRST 20 MEMBERS</div>
              <a className="vt-community-cta vt-full" href={checkout}>GET VAULTTRADES COMMUNITY ACCESS <b>→</b></a>
              <p>Educational programme only. Trading involves substantial risk. No strategy, signal, automation system or programme guarantees profits.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="vt-community-section">
        <div className="vt-community-container vt-for-grid">
          <div><div className="vt-label">FOR YOU IF</div><h2>You want to become more structured, not more dependent.</h2></div>
          <div className="vt-community-copy">
            <p>VaultTrades is designed for traders who are inconsistent, overtrade, chase entries, risk too much, struggle with emotions or know what to do but struggle to execute.</p>
            <p>It is not designed for guaranteed profits, instant wealth, blind signal dependency or recovering losses quickly.</p>
          </div>
        </div>
      </section>

      <footer className="vt-community-footer">
        <div className="vt-brand">Vault<span>Trades</span></div>
        <h2>Protect the capital.<br />Follow the plan.<br /><span>Execute the process.</span></h2>
        <a className="vt-community-cta" href={checkout}>SIGN UP FOR THE NEXT PROGRAM <b>→</b></a>
        <small>The market decides the outcome. You control the process.</small>
      </footer>
    </main>
  );
}

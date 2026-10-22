"use client";

import { useEffect, useState } from "react";
import TestimonialStyles from "./TestimonialStyles";

const outcomes = [
  ["01", "A repeatable trading routine", "Know what to check before, during and after a trade instead of improvising under pressure."],
  ["02", "A defined risk framework", "Work with risk per trade, position sizing, invalidation, drawdown awareness and daily boundaries."],
  ["03", "A setup decision process", "Learn to evaluate market context and setup quality without turning the chart into noise."],
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
  "Practical education on evaluating and using trading tools responsibly",
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
    if (testimonial.trim().length < 20) {
      setTestimonialStatus("Please write at least 20 characters so we can review your experience.");
      return;
    }

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
        setTestimonialStatus(data.message || (data.error === "SIGN_IN_REQUIRED"
          ? "Please sign in to submit your testimonial."
          : "Your testimonial could not be submitted. Please try again."));
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
      <TestimonialStyles />
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
            <p>The real challenge is making consistent decisions: avoiding late entries, oversized positions, emotional trades and changes to a plan under pressure.</p>
            <p><strong>VaultTrades is built around developing a disciplined, risk-aware trading process.</strong></p>
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
          <div className="vt-label">OUR APPROACH</div>
          <h2>Education, structure and responsible execution.</h2>
          <div className="vt-outcome-grid">
            <article className="vt-outcome"><div>01</div><h3>Understand the market</h3><p>Develop a clearer way to assess market conditions and decide whether a trade idea deserves further attention.</p></article>
            <article className="vt-outcome"><div>02</div><h3>Plan your risk</h3><p>Set personal risk limits and understand where a trade idea is no longer valid before committing capital.</p></article>
            <article className="vt-outcome"><div>03</div><h3>Review your decisions</h3><p>Use reflection and trading records to identify habits, learn from outcomes and improve consistency over time.</p></article>
          </div>
          <p className="vt-framework-note">Tools and automation can support a process, but they cannot remove market risk or guarantee a result.</p>
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
            Have you purchased a VaultTrades product or joined one of our programmes?
            We would love to hear how your experience influenced your learning, trading habits or decision-making.
            Submissions are reviewed before publication, and testimonials are accepted from customers with an active purchased product.
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
              <strong>Could you be the first to share your VaultTrades experience?</strong>
              <span>Sign in with an account that has an active purchased VaultTrades product to submit a testimonial.</span>
            </div>
          )}

          <div className="vt-testimonial-submit">
            <div>
              <div className="vt-label">ADD YOUR EXPERIENCE</div>
              <h3>Share your VaultTrades experience.</h3>
              <p>Tell us what you found useful and how the product or programme affected your approach. Please share your genuine experience; publication is subject to review.</p>
            </div>

            {canSubmit ? (
              <div className="vt-testimonial-form">
                <textarea
                  value={testimonial}
                  onChange={(e) => {
                    setTestimonial(e.target.value);
                    if (testimonialStatus) setTestimonialStatus("");
                  }}
                  maxLength={1000}
                  placeholder="Write at least 20 characters about your experience with VaultTrades..."
                  rows={6}
                  aria-label="Your VaultTrades testimonial"
                />
                <div className="vt-testimonial-form-footer">
                  <span>{testimonial.length}/1000 · Minimum 20 characters</span>
                  <button
                    className="vt-community-cta vt-testimonial-button"
                    onClick={submitTestimonial}
                    disabled={submitting || testimonial.trim().length < 20}
                    type="button"
                  >
                    {submitting ? "SUBMITTING..." : "SUBMIT TESTIMONY"}
                  </button>
                </div>
                {testimonialStatus && <div className="vt-testimonial-status" role="status">{testimonialStatus}</div>}
              </div>
            ) : (
              <div className="vt-testimonial-gate">
                <strong>{signedIn ? "Active product required" : "Customer access required"}</strong>
                <p>
                  {signedIn
                    ? "Testimonial submission is available to accounts with an active purchased VaultTrades product."
                    : "Sign in to your VaultTrades account after purchasing a product to unlock testimonial submission."}
                </p>
                <div className="vt-community-actions">
                  {!signedIn && <a className="vt-community-link" href="/auth/login?next=%2Fvaulttrades-community%23testimonials">SIGN IN</a>}
                  <a className="vt-community-cta" href="/products">VIEW PRODUCTS <b>→</b></a>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="vt-community-dark">
        <div className="vt-community-container vt-problem-grid">
          <div>
            <div className="vt-label">TRADING EDUCATION & TECHNOLOGY</div>
            <h2>Understand the tools. Keep control of your decisions.</h2>
          </div>
          <div className="vt-community-copy">
            <p>VaultTrades brings together market education, analysis tools and optional execution technology to support a more structured trading routine.</p>
            <p>Each trader remains responsible for understanding the risks, setting suitable limits and deciding whether to trade.</p>
            <p><strong>Observe carefully. Validate your approach. Use live capital only when you understand the risks.</strong></p>
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
                  <li>Make informed decisions about trading tools and technology.</li>
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

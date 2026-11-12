import "./opportunity.css";
import Link from "next/link";

const stages = [
  ["01", "PREPARE", "Understand the market environment, set your priorities and wait for conditions that fit a defined plan."],
  ["02", "PLAN", "Think through the idea, the risk and the decision before taking action."],
  ["03", "ACT WITH DISCIPLINE", "Follow your plan when the conditions are there. Do not force activity just to feel productive."],
  ["04", "REVIEW", "Reflect on decisions, record lessons and improve your process over time."],
];

const businessSteps = [
  ["01", "CLARITY", "Understand the value you are introducing and the people it may serve."],
  ["02", "ATTRACTION", "Create useful content that earns attention through relevance, not exaggerated promises."],
  ["03", "CONNECTION", "Build trust through clear conversations, honest answers and respectful follow-up."],
  ["04", "GROWTH", "Learn how to present an approved offer and develop your digital-business skills at your own pace."],
];

const faqs = [
  ["Do I need trading experience?", "You can start by learning the foundations, but trading requires study, practice and risk awareness. No experience does not mean no learning is required."],
  ["Will I make money every day?", "No. There are no guaranteed daily profits or fixed trading income. Some days may offer no suitable opportunity, and trading can result in losses."],
  ["Can I build a digital business without an audience?", "You can learn how to identify an audience, create useful content and build relationships over time. Growth takes work and is not guaranteed."],
  ["How does the reseller opportunity work?", "Eligible members may receive rights to introduce approved digital products under the terms of their chosen membership. Commission limits, qualifying sales and payout conditions are explained with the plans."],
  ["Are commissions or business income guaranteed?", "No. Commissions depend on qualifying completed sales and the applicable plan terms. No income level or number of sales is promised."],
  ["Are brokers and proprietary trading firms part of VaultTrades?", "No. Brokers and proprietary trading firms are independent third parties. Any third-party service is subject to that provider's own terms."],
];

export default function OpportunityPage() {
  return (
    <main className="vt-opportunity">
      <section className="vto-hero">
        <div className="vto-hero-image" role="img" aria-label="VaultTrades lifestyle workspace" />
        <div className="vto-hero-shade" />
        <div className="vto-hero-content">
          <div className="vto-kicker">WELCOME TO THE VAULTTRADES OPPORTUNITY</div>
          <div className="vto-brand">VAULT<span>TRADES</span></div>
          <h1>A process you can follow.<br /><em>A business you can build.</em></h1>
          <p className="vto-hero-lead">Discover a more structured approach to trading—and learn how digital skills can open another path to building something of your own.</p>
          <div className="vto-hero-actions">
            <a className="vto-button vto-button-gold" href="#the-opportunity">EXPLORE THE OPPORTUNITY</a>
            <Link className="vto-button vto-button-outline" href="/plans">VIEW MEMBERSHIP OPTIONS</Link>
          </div>
          <div className="vto-hero-foot">FOCUS. DISCIPLINE. CONSISTENCY.</div>
        </div>
        <div className="vto-hero-popouts" aria-label="The two parts of the opportunity">
          <div><span>01</span><strong>A PROCESS<br />YOU CAN FOLLOW</strong></div>
          <div><span>02</span><strong>A BUSINESS<br />YOU CAN BUILD</strong></div>
        </div>
      </section>

      <section className="vto-intro vto-container" id="the-opportunity">
        <div className="vto-kicker">A DIFFERENT WAY TO THINK ABOUT YOUR NEXT MOVE</div>
        <h2>Two pathways.<br /><span>One opportunity to explore.</span></h2>
        <p className="vto-lead">VaultTrades brings together a disciplined trading approach and a practical digital-business learning pathway. You can understand what is involved, explore the membership options and decide whether either path fits your goals and circumstances.</p>
        <div className="vto-pillars">
          <article className="vto-pillar"><div className="vto-number">01</div><h3>TRADE WITH STRUCTURE</h3><p>Move away from impulsive decisions. Learn to prepare, define risk, wait for conditions and review your decisions.</p></article>
          <article className="vto-pillar"><div className="vto-number">02</div><h3>LEARN AS YOU GO</h3><p>Follow a guided learning path that helps make the process clearer, more organised and easier to assess.</p></article>
          <article className="vto-pillar"><div className="vto-number">03</div><h3>BUILD DIGITAL SKILLS</h3><p>Learn attraction marketing, content, communication and how to introduce an approved digital offer responsibly.</p></article>
        </div>
      </section>

      <section className="vto-dark-band">
        <div className="vto-container vto-split">
          <div>
            <div className="vto-kicker">A PROCESS YOU CAN FOLLOW</div>
            <h2>Less guesswork.<br /><span>More deliberate decisions.</span></h2>
            <p>The aim is not to be active every day. It is to develop a repeatable routine, understand the risk before acting and recognise when the best decision is to wait.</p>
          </div>
          <div className="vto-workflow">
            {stages.map(([number, title, description]) => (
              <article className="vto-step" key={number}><span>{number}</span><div><h3>{title}</h3><p>{description}</p></div></article>
            ))}
          </div>
        </div>
      </section>

      <section className="vto-capital">
        <div className="vto-container vto-capital-grid">
          <div><div className="vto-kicker">DISCIPLINE BEFORE EXPECTATION</div><h2>Understand the potential.<br /><span>Respect the risk.</span></h2></div>
          <div>
            <p>Trading involves uncertainty. Account size can affect position size when risk is calculated appropriately, but it does not determine whether a trade will win or create a reliable income.</p>
            <p>VaultTrades promotes planning, risk awareness and informed decisions—not fixed daily targets, guaranteed returns or pressure to trade.</p>
          </div>
        </div>
      </section>

      <section className="vto-container vto-section vto-business">
        <div className="vto-business-copy">
          <div className="vto-kicker">A BUSINESS YOU CAN BUILD</div>
          <h2>Learn to attract.<br /><span>Connect. Grow with purpose.</span></h2>
          <p>The digital-business pathway is about learning how to communicate value online, build an audience and introduce relevant products through honest, permission-based marketing.</p>
          <p>Eligible members may receive reseller rights under the membership they choose. The applicable commission cap, qualifying sales, fees and payout terms are explained before purchase.</p>
        </div>
        <div className="vto-business-list">
          {businessSteps.map(([number, title, description]) => (
            <div className="vto-business-row" key={number}><span>{number}</span><div><b>{title}</b><p>{description}</p></div></div>
          ))}
        </div>
      </section>

      <section className="vto-learning-band">
        <div className="vto-container">
          <div className="vto-section-heading"><div className="vto-kicker">A GUIDED LEARNING JOURNEY</div><h2>Build capability step by step.</h2><p>Start with the foundations, practise the skills and develop at a pace that suits your circumstances.</p></div>
          <div className="vto-learning-grid">
            {[
              ["FOUNDATION", "Understand the opportunity, the expectations and the importance of managing risk."],
              ["ATTRACT", "Learn how to communicate clearly and create content that gives people a reason to learn more."],
              ["ENGAGE", "Build trust with useful information, respectful conversations and transparent follow-up."],
              ["PRESENT", "Understand how to explain an approved offer and direct interested people to the right information."],
              ["DEVELOP", "Use feedback and practical learning to improve your communication and organisation."],
              ["GROW", "Build consistently, without relying on exaggerated claims or promises of quick results."],
            ].map(([title, description], index) => (
              <article key={title}><span>PHASE 0{index + 1}</span><h3>{title}</h3><p>{description}</p></article>
            ))}
          </div>
        </div>
      </section>

      <section className="vto-evidence">
        <div className="vto-container vto-evidence-inner">
          <div className="vto-kicker">TRANSPARENCY MATTERS</div>
          <h2>Real progress. <span>Proper context.</span></h2>
          <p>Supporting records, milestones and certificates will be presented with their dates, context and source clearly identified. Historical examples are not guarantees of future results, and third-party achievements will never be presented as VaultTrades-issued credentials.</p>
          <div className="vto-evidence-cards">
            <div><span>01</span><b>TRADING JOURNEY</b><small>Examples and records with clear dates and outcome context.</small><em>SUPPORTING RECORDS</em></div>
            <div><span>02</span><b>CHALLENGE MILESTONES</b><small>Progress shown with the relevant independent provider identified.</small><em>SUPPORTING RECORDS</em></div>
            <div><span>03</span><b>CERTIFICATES</b><small>Credentials shown with the correct issuer and verification context.</small><em>SUPPORTING RECORDS</em></div>
          </div>
        </div>
      </section>

      <section className="vto-container vto-section vto-faq">
        <div className="vto-section-heading"><div className="vto-kicker">CLEAR ANSWERS BEFORE YOU DECIDE</div><h2>Frequently asked questions.</h2></div>
        <div className="vto-faq-list">{faqs.map(([question, answer]) => (<details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>))}</div>
      </section>

      <section className="vto-final">
        <div className="vto-container">
          <div className="vto-kicker">YOUR NEXT STEP</div>
          <h2>Ready to explore<br /><span>your options?</span></h2>
          <p>Review the membership options and decide whether the trading and digital-business pathways are right for you. Take your time and read the terms before choosing.</p>
          <div className="vto-final-actions"><Link className="vto-button vto-button-gold" href="/plans">EXPLORE MEMBERSHIP OPTIONS</Link></div>
          <small>Trading involves risk and losses are possible. Past performance does not guarantee future results. Digital-business income and reseller commissions are not guaranteed and depend on qualifying sales and the applicable terms.</small>
        </div>
      </section>
    </main>
  );
}
